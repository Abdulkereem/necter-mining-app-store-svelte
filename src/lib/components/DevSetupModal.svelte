<script lang="ts">
	import { X, Check, ChevronRight, Package, FileText, Shield, Rocket } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { wallet } from '$lib/stores/wallet';
	import { hub } from '$lib/api/hub';
	import { errorMessage } from '$lib/api/http';
	import type { Developer } from '$lib/api/types';

	let {
		open = $bindable(false),
		developer = null,
		onenrolled
	}: {
		open: boolean;
		/** Existing record (e.g. a saved enrollment draft) to prefill from. */
		developer?: Developer | null;
		onenrolled?: (d: Developer) => void;
	} = $props();

	type Step = 1 | 2 | 3 | 4;

	const stepInfo = [
		{ num: 1, label: 'Account', icon: Package, desc: 'Your developer identity' },
		{ num: 2, label: 'Agreement', icon: FileText, desc: 'Accept program terms' },
		{ num: 3, label: 'Verify', icon: Shield, desc: 'Wallet verification' },
		{ num: 4, label: 'Launch', icon: Rocket, desc: 'Start building' },
	];

	let step = $state<Step>(1);
	let devType = $state<'individual' | 'organization'>('individual');
	let devName = $state('');
	let devEmail = $state('');
	let devWebsite = $state('');
	let devReason = $state('');
	let agreed = $state(false);
	let submitting = $state(false);
	let savingDraft = $state(false);
	let result = $state<Developer | null>(null);
	let prefilled = false;

	$effect(() => {
		if (!open || prefilled || !developer) return;
		prefilled = true;
		devType = developer.developer_type === 'organization' ? 'organization' : 'individual';
		devName = developer.display_name ?? '';
		devEmail = developer.email ?? '';
		devWebsite = developer.website ?? '';
	});

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const websiteOk = $derived(!devWebsite.trim() || /^https?:\/\/\S+$/.test(devWebsite.trim()));
	const emailOk = $derived(!devEmail.trim() || EMAIL_RE.test(devEmail.trim()));
	const canProceedStep1 = $derived(devName.trim().length > 0 && devName.trim().length <= 64 && emailOk && websiteOk && devReason.length <= 2000);
	const canProceedStep2 = $derived(agreed);
	const verified = $derived(result?.verification?.status === 'verified');

	function body(draft: boolean) {
		return {
			draft,
			developer_type: devType,
			display_name: devName.trim(),
			...(devEmail.trim() ? { email: devEmail.trim() } : {}),
			...(devWebsite.trim() ? { website: devWebsite.trim() } : {}),
			...(devReason.trim() ? { reason: devReason.trim() } : {}),
			agreements_accepted: true as const
		};
	}

	async function handleSaveDraft() {
		if (!canProceedStep1) return;
		savingDraft = true;
		try {
			const d = await hub.enroll(body(true));
			onenrolled?.(d);
			toast.success('Enrollment draft saved');
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			savingDraft = false;
		}
	}

	async function handleSubmit() {
		if (!$wallet || !canProceedStep1 || !agreed) return;
		submitting = true;
		try {
			result = await hub.enroll(body(false));
			onenrolled?.(result);
			step = 4;
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			submitting = false;
		}
	}

	function handleClose() {
		step = 1;
		open = false;
	}

	const currentStep = $derived(stepInfo[step - 1]);

	const inp =
		'w-full h-[36px] px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-[var(--accent-glow)]';
</script>

{#if open}
	<div class="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
		<div class="absolute inset-0 bg-black/60" onclick={handleClose} role="presentation"></div>
		<div
			class="relative bg-[var(--surface-1)] border border-[var(--border-default)] rounded-t-[12px] md:rounded-[12px] w-full md:w-[480px] overflow-hidden"
			style="box-shadow: 0 16px 70px rgba(0,0,0,0.50);"
		>
			<!-- Header with step indicator -->
			<div
				class="px-6 pt-5 pb-4 border-b border-[var(--border-default)]"
				style="background: radial-gradient(ellipse at 50% 0%, rgba(217,170,60,0.04) 0%, transparent 70%);"
			>
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-[16px] font-semibold text-[var(--text-primary)] m-0">Developer Account</h2>
					<button
						type="button"
						onclick={handleClose}
						class="h-6 w-6 flex items-center justify-center rounded-[3px] bg-transparent border-none cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
					>
						<X size={14} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
					</button>
				</div>

				<!-- Step progress bar -->
				<div class="flex items-center gap-1">
					{#each stepInfo as s}
						<div class="flex items-center flex-1">
							<div
								class="h-1 flex-1 rounded-full transition-colors duration-300"
								style="background: {step >= s.num ? 'var(--accent-base)' : 'var(--surface-3)'};"
							></div>
						</div>
					{/each}
				</div>

				<!-- Current step label -->
				<div class="flex items-center gap-2 mt-3">
					<currentStep.icon size={16} strokeWidth={1.5} class="text-[var(--text-accent)]" />
					<span class="text-[12px] font-medium text-[var(--text-accent)]">{currentStep.label}</span>
					<span class="text-[12px] text-[var(--text-tertiary)]">· {currentStep.desc}</span>
					<span class="ml-auto text-[11px] text-[var(--text-tertiary)]">{step}/4</span>
				</div>
			</div>

			<!-- Step content -->
			<div class="p-6">
				{#if step === 1}
					<div class="space-y-4">
						<div class="grid grid-cols-2 gap-1.5">
							{#each [{ v: 'individual', l: 'Individual' }, { v: 'organization', l: 'Organization' }] as const as t}
								<button
									type="button"
									onclick={() => (devType = t.v)}
									class="h-[34px] rounded-[5px] text-[12px] font-medium cursor-pointer transition-colors"
									style="border:1px solid {devType === t.v ? 'var(--border-accent)' : 'var(--border-default)'};background:{devType === t.v ? 'var(--accent-subtle)' : 'var(--surface-0)'};color:{devType === t.v ? 'var(--text-accent)' : 'var(--text-secondary)'}"
								>
									{t.l}
								</button>
							{/each}
						</div>
						<div>
							<label class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide block mb-1.5"
								>Display Name *</label
							>
							<input class={inp} type="text" maxlength="64" bind:value={devName} placeholder="Your name or org name" />
						</div>
						<div>
							<label class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide block mb-1.5"
								>Email</label
							>
							<input class={inp} type="email" bind:value={devEmail} placeholder="dev@example.com" />
							{#if !emailOk}<p class="text-[11px] text-[var(--error)] mt-1 m-0">Enter a valid email address</p>{/if}
						</div>
						<div>
							<label class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide block mb-1.5"
								>Website</label
							>
							<input class={inp} type="url" bind:value={devWebsite} placeholder="https://yourproject.com" />
							{#if !websiteOk}<p class="text-[11px] text-[var(--error)] mt-1 m-0">Enter a full URL starting with https://</p>{/if}
						</div>
						<div>
							<label class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide block mb-1.5"
								>What are you building?</label
							>
							<textarea
								bind:value={devReason}
								rows={3}
								maxlength={2000}
								placeholder="Describe your mining project..."
								class="w-full px-3 py-2 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-[var(--accent-glow)] resize-none"
							></textarea>
						</div>
					</div>
				{:else if step === 2}
					<div class="space-y-4">
						<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4">
							<h3 class="text-[13px] font-medium text-[var(--text-primary)] mb-2 m-0">
								Necter Developer Program License
							</h3>
							<div class="text-[12px] text-[var(--text-secondary)] leading-relaxed space-y-2">
								<p class="m-0">By enrolling in the Necter Developer Program, you agree to:</p>
								<ul class="list-disc pl-4 space-y-1 m-0">
									<li>Comply with all applicable laws and regulations</li>
									<li>Submit accurate information about your mining project</li>
									<li>Keep your reward vault funded for the epochs you advertise to miners</li>
									<li>Accept operator review of listings during the testnet (listing, pausing and delisting)</li>
									<li>Pay the treasury share of rewards set in each project's fee split</li>
								</ul>
							</div>
						</div>
						<button
							type="button"
							class="flex items-start gap-3 cursor-pointer bg-transparent border-none p-0 text-left w-full"
							onclick={() => (agreed = !agreed)}
						>
							<div
								class="h-5 w-5 rounded-[3px] border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
								style="background: {agreed
									? 'var(--accent-base)'
									: 'var(--surface-0)'}; border-color: {agreed ? 'var(--accent-base)' : 'var(--border-default)'};"
							>
								{#if agreed}<Check size={12} strokeWidth={2.5} class="text-[#0C0C0E]" />{/if}
							</div>
							<span class="text-[13px] text-[var(--text-primary)] leading-relaxed">
								I have read and agree to the Developer Program License Agreement and understand that my
								projects are reviewed by the network operator before they are listed.
							</span>
						</button>
					</div>
				{:else if step === 3}
					<div class="space-y-4">
						<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4">
							<h3 class="text-[13px] font-medium text-[var(--text-primary)] mb-1 m-0">
								Wallet Verification
							</h3>
							<p class="text-[12px] text-[var(--text-secondary)] m-0">
								On the testnet your signed-in wallet is verified automatically when you enroll. Verified
								developers can publish projects and show a verified badge on their listings.
							</p>
						</div>

						<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-0)] p-4">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-[13px] font-medium text-[var(--text-primary)] m-0">Wallet</p>
									<p class="text-[12px] font-mono text-[var(--text-tertiary)] mt-0.5 m-0">
										{$wallet?.address?.slice(0, 12)}...{$wallet?.address?.slice(-8)}
									</p>
								</div>
								<div class="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-tertiary)]">
									<Shield size={14} strokeWidth={1.5} />
									Verified on enrollment
								</div>
							</div>
						</div>
					</div>
				{:else}
					<!-- Step 4: Launch -->
					<div class="text-center py-6 bg-honeycomb rounded-[8px]">
						<div class="h-14 w-14 mx-auto mb-4 flex items-center justify-center">
							<svg viewBox="0 0 56 56" fill="none" class="h-14 w-14">
								<polygon
									points="28,2 52,15 52,41 28,54 4,41 4,15"
									fill="rgba(76,183,130,0.12)"
									stroke="var(--success)"
									stroke-width="1"
								/>
								<polygon
									points="28,14 40,20.5 40,35.5 28,42 16,35.5 16,20.5"
									fill="none"
									stroke="var(--success)"
									stroke-width="0.7"
									opacity="0.4"
								/>
								<circle cx="28" cy="28" r="3.5" fill="var(--success)" />
							</svg>
						</div>
						{#if result?.enrollment?.status === 'active'}
							<h3 class="text-[18px] font-semibold text-[var(--text-primary)] mb-2 m-0">You're all set!</h3>
							<p class="text-[13px] text-[var(--text-secondary)] mb-6 max-w-[320px] mx-auto m-0">
								Your developer account is active{verified ? ' and verified' : ''}. Start building your first mining project.
							</p>
						{:else}
							<h3 class="text-[18px] font-semibold text-[var(--text-primary)] mb-2 m-0">Enrollment submitted</h3>
							<p class="text-[13px] text-[var(--text-secondary)] mb-6 max-w-[320px] mx-auto m-0">
								Your enrollment is {result?.enrollment?.status ?? 'pending'}. You can publish projects once it is active.
							</p>
						{/if}
						<div class="space-y-2">
							<button
								type="button"
								onclick={() => {
									handleClose();
									goto('/develop/create');
								}}
								class="w-full h-[36px] rounded-[6px] text-[13px] font-semibold bg-[var(--accent-base)] text-[#0C0C0E] border-none cursor-pointer hover:brightness-110 transition-all"
							>
								Create Your First Project
							</button>
							<button
								type="button"
								onclick={() => {
									handleClose();
									goto('/develop');
								}}
								class="w-full h-[36px] rounded-[6px] text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--surface-2)] border border-[var(--border-default)] cursor-pointer hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"
							>
								Go to Dashboard
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer with navigation -->
			{#if step < 4}
				<div class="px-6 py-4 border-t border-[var(--border-default)] flex items-center justify-between">
					{#if step > 1}
						<button
							type="button"
							onclick={() => (step = (step - 1) as Step)}
							class="text-[13px] text-[var(--text-secondary)] bg-transparent border-none cursor-pointer hover:text-[var(--text-primary)] transition-colors"
						>
							Back
						</button>
					{:else}
						<button
							type="button"
							onclick={handleSaveDraft}
							disabled={!canProceedStep1 || savingDraft}
							class="text-[13px] text-[var(--text-secondary)] bg-transparent border-none cursor-pointer hover:text-[var(--text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{savingDraft ? 'Saving…' : 'Save draft'}
						</button>
					{/if}

					{#if step === 3}
						<button
							type="button"
							onclick={handleSubmit}
							disabled={submitting}
							class="h-[32px] px-4 rounded-[5px] text-[13px] font-medium bg-[var(--surface-3)] text-[var(--text-primary)] border-none cursor-pointer hover:bg-[var(--accent-base)] hover:text-[#0C0C0E] transition-colors flex items-center gap-1.5 disabled:opacity-50"
						>
							{submitting ? 'Enrolling...' : 'Enroll'}
							<ChevronRight size={14} strokeWidth={1.5} />
						</button>
					{:else}
						<button
							type="button"
							onclick={() => (step = (step + 1) as Step)}
							disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
							class="h-[32px] px-4 rounded-[5px] text-[13px] font-medium bg-[var(--surface-3)] text-[var(--text-primary)] border-none cursor-pointer hover:bg-[var(--accent-base)] hover:text-[#0C0C0E] transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
						>
							Continue
							<ChevronRight size={14} strokeWidth={1.5} />
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
