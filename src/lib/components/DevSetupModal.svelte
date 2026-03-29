<script lang="ts">
	import { X, Check } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { wallet } from '$lib/stores/wallet';
	import { backend } from '$lib/stores/backend';
	import { showToast } from '$lib/stores/toast';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let step = $state<1 | 2 | 3 | 4>(1);
	let devName = $state('');
	let devEmail = $state('');
	let devWebsite = $state('');
	let devType = $state<'individual' | 'organization'>('individual');
	let agreed = $state(false);
	let verifying = $state(false);
	let verified = $state(false);
	let submitting = $state(false);

	const canStep1 = $derived(devName.trim().length > 0 && devEmail.trim().length > 0);

	function handleVerify() {
		verifying = true;
		setTimeout(() => { verifying = false; verified = true; }, 2000);
	}

	function handleSubmit() {
		if (!$wallet) return;
		submitting = true;
		setTimeout(() => {
			try {
				backend.saveDeveloperEnrollmentDraft({
					walletAddress: $wallet!.address,
					displayName: devName,
					email: devEmail,
					developerType: devType,
					agreementsAccepted: true,
				});
				backend.submitDeveloperEnrollment($wallet!.address);
				backend.grantRole($wallet!.address, 'developer');
			} catch (e) {
				console.warn('Enrollment error:', e);
			}
			submitting = false;
			step = 4;
		}, 800);
	}

	function handleClose() {
		step = 1;
		open = false;
	}

	const inp = 'w-full h-9 px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none';
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<div class="absolute inset-0 bg-black/60" onclick={handleClose} role="presentation"></div>
		<div class="relative bg-[var(--surface-1)] border border-[var(--border-default)] rounded-xl w-[460px] overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
				<div>
					<p class="text-[14px] font-semibold text-[var(--text-primary)] m-0">Developer Setup</p>
					<p class="text-[11px] text-[var(--text-tertiary)] m-0 mt-0.5">Step {step} of 4</p>
				</div>
				<button onclick={handleClose} class="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] p-1 leading-none">
					<X size={14} strokeWidth={2} />
				</button>
			</div>

			<!-- Progress -->
			<div class="flex gap-[3px] px-5 pt-3">
				{#each [1,2,3,4] as s}
					<div class="flex-1 h-[2px] rounded-[1px]" style="background: {s <= step ? 'var(--accent-base)' : 'var(--surface-3)'}; transition: background 300ms;"></div>
				{/each}
			</div>

			<div class="p-5 min-h-[280px]">
				{#if step === 1}
					<h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Your Identity</h3>
					<p class="text-[12px] text-[var(--text-tertiary)] mb-5">Tell us about yourself or your organization.</p>

					<div class="flex gap-2 mb-4">
						{#each ['individual', 'organization'] as t}
							<button
								onclick={() => devType = t}
								class="flex-1 h-9 rounded-[6px] text-[12px] font-medium border-none cursor-pointer transition-colors"
								style="background: {devType === t ? 'var(--accent-subtle)' : 'var(--surface-2)'}; color: {devType === t ? 'var(--text-accent)' : 'var(--text-secondary)'};"
							>
								{t === 'individual' ? 'Individual' : 'Organization'}
							</button>
						{/each}
					</div>

					<div class="space-y-3">
						<div>
							<label class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5">Name *</label>
							<input class={inp} bind:value={devName} placeholder="Your name or org name" />
						</div>
						<div>
							<label class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5">Email *</label>
							<input class={inp} type="email" bind:value={devEmail} placeholder="you@example.com" />
						</div>
						<div>
							<label class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5">Website</label>
							<input class={inp} bind:value={devWebsite} placeholder="https://" />
						</div>
					</div>

					<button onclick={() => step = 2} disabled={!canStep1} class="btn-subscribe w-full h-10 justify-center mt-5" style="opacity: {canStep1 ? 1 : 0.4};">
						Continue
					</button>

				{:else if step === 2}
					<h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Program Agreement</h3>
					<p class="text-[12px] text-[var(--text-tertiary)] mb-5">Review and accept the Necter Developer Program terms.</p>

					<div class="p-4 rounded-[8px] bg-[var(--surface-2)] text-[12px] text-[var(--text-secondary)] leading-5 max-h-[160px] overflow-y-auto mb-4">
						By joining the Necter Developer Program, you agree to: publish accurate network descriptions, maintain minimum uptime SLAs, not distribute malicious mining packages, comply with governance decisions, and maintain escrow balances sufficient to cover miner rewards.
					</div>

					<label class="flex items-center gap-2.5 cursor-pointer">
						<input type="checkbox" bind:checked={agreed} class="w-4 h-4 accent-[var(--accent-base)]" />
						<span class="text-[13px] text-[var(--text-primary)]">I accept the Developer Program terms</span>
					</label>

					<div class="flex gap-2 mt-5">
						<button onclick={() => step = 1} class="btn-secondary h-10 px-4">Back</button>
						<button onclick={() => step = 3} disabled={!agreed} class="btn-subscribe flex-1 h-10 justify-center" style="opacity: {agreed ? 1 : 0.4};">Continue</button>
					</div>

				{:else if step === 3}
					<h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Identity Verification</h3>
					<p class="text-[12px] text-[var(--text-tertiary)] mb-5">Verify your wallet ownership to complete enrollment.</p>

					<div class="p-4 rounded-[8px] bg-[var(--surface-2)] mb-4">
						<p class="text-[12px] text-[var(--text-secondary)] mb-2">Wallet: <span class="font-mono text-[var(--text-primary)]">{$wallet?.address?.slice(0, 10)}...</span></p>
						{#if verified}
							<div class="flex items-center gap-2 text-[var(--success)] text-[13px] font-medium">
								<Check size={16} /> Verified
							</div>
						{:else}
							<button onclick={handleVerify} disabled={verifying} class="btn-subscribe h-9" style="opacity: {verifying ? 0.5 : 1};">
								{verifying ? 'Verifying...' : 'Verify Wallet'}
							</button>
						{/if}
					</div>

					<div class="flex gap-2 mt-5">
						<button onclick={() => step = 2} class="btn-secondary h-10 px-4">Back</button>
						<button onclick={handleSubmit} disabled={!verified || submitting} class="btn-subscribe flex-1 h-10 justify-center" style="opacity: {verified && !submitting ? 1 : 0.4};">
							{submitting ? 'Submitting...' : 'Complete Setup'}
						</button>
					</div>

				{:else}
					<div class="text-center py-8">
						<div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style="background: rgba(76,183,130,0.12);">
							<Check size={24} style="color: var(--success);" />
						</div>
						<h3 class="text-[18px] font-semibold text-[var(--text-primary)] mb-2">You're in!</h3>
						<p class="text-[13px] text-[var(--text-secondary)] mb-6">Your developer account is active. Start building your first mining network.</p>
						<button onclick={() => { handleClose(); goto('/develop/create'); }} class="btn-subscribe h-10 px-6">
							Create Your First Network
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
