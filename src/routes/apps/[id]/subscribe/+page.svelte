<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, showConnectModal } from '$lib/stores/wallet';
	import { showToast, showError } from '$lib/stores/toast';
	import { appIconDataUri } from '$lib/app-icon';
	import { mockMiner } from '$lib/mock-data';
	import {
		ArrowLeft,
		CheckCircle2,
		AlertCircle,
		Cpu,
		Monitor,
		HardDrive
	} from 'lucide-svelte';

	const id = $derived(page.params.id);

	let agreedToTerms = $state(false);

	let app = $derived($backendState.apps.find((a) => a.id === id) ?? null);

	let iconSrc = $derived.by(() => {
		if (!app) return '/placeholder.svg';
		if (app.icon && app.icon !== '/placeholder.svg') return app.icon;
		return appIconDataUri({ id: app.id, name: app.name });
	});

	let hardwareChecks = $derived.by(() => {
		if (!app) return [];
		return [
			{
				name: 'CPU',
				required: app.requirements.cpu,
				available: mockMiner.hardware.cpu,
				compatible: true
			},
			{
				name: 'GPU',
				required: app.requirements.gpu,
				available: mockMiner.hardware.gpu,
				compatible: !!mockMiner.hardware.gpu
			},
			{
				name: 'RAM',
				required: app.requirements.ram,
				available: mockMiner.hardware.ram,
				compatible: true
			},
			{
				name: 'Storage',
				required: app.requirements.storage,
				available: mockMiner.hardware.storage,
				compatible: true
			}
		].filter((check) => check.required);
	});

	let allCompatible = $derived(hardwareChecks.every((check) => check.compatible));

	let minerId = $derived($actor?.minerId ?? null);

	let stakeAmount = $derived.by(() => {
		if (!app?.slaRequirements?.slashingPenalty) return 0;
		return Math.max(0, Math.round((app.slaRequirements.slashingPenalty / 100) * 10000));
	});

	let existingSub = $derived.by(() => {
		if (!minerId || !app) return null;
		return $backendState.subscriptions.find((s) => s.appId === app!.id && s.minerId === minerId) ?? null;
	});

	function handleSubscribe() {
		if (!$actor) {
			$showConnectModal = true;
			return;
		}
		try {
			const sub =
				existingSub ??
				backend.subscribeToApp({
					appId: app!.id,
					minerId: $actor.minerId,
					walletAddress: $actor.walletAddress,
					stakeAmount
				});
			if (!sub) {
				showError('Subscription blocked', 'This subscription could not be created.');
				return;
			}
			showToast('Subscribed!', `You are now mining ${app!.name}.`);
			goto(`/mining/${encodeURIComponent(sub.id)}`);
		} catch (e: any) {
			showError('Error', e?.message ?? 'Failed to subscribe.');
		}
	}
</script>

{#if app}
	<div class="space-y-6 md:space-y-8 max-w-4xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-12">
		<!-- Back Button -->
		<a href="/apps/{app.id}" class="btn-secondary inline-flex items-center gap-2">
			<ArrowLeft class="h-4 w-4" />
			Back to App Details
		</a>

		<!-- Header -->
		<div class="flex items-start gap-4 md:gap-6">
			<img
				src={iconSrc}
				alt={app.name}
				width="64"
				height="64"
				class="rounded-[8px] md:w-[80px] md:h-[80px]"
			/>
			<div class="flex-1">
				<h1 class="text-[20px] font-semibold mb-2 text-[var(--text-primary)]">
					Subscribe to {app.name}
				</h1>
				<p class="text-[13px] text-[var(--text-secondary)]">
					Start mining and earning rewards with this application
				</p>
			</div>
		</div>

		<!-- Earnings Preview -->
		<div class="p-6 bg-[var(--accent-subtle)] border border-[var(--border-accent)] rounded-[8px]">
			<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
				<div>
					<p class="text-[12px] text-[var(--text-secondary)] mb-1">Estimated Daily Earnings</p>
					<p class="text-[24px] font-semibold text-[var(--text-accent)] mb-1 font-mono">
						${app.avgEarningsPerDay.toFixed(2)}
					</p>
					<p class="text-[12px] text-[var(--text-secondary)]">Based on current network average</p>
				</div>
				<div class="text-right">
					<p class="text-[12px] text-[var(--text-secondary)] mb-1">Monthly Estimate</p>
					<p class="text-[20px] font-semibold text-[var(--text-primary)] font-mono">
						${(app.avgEarningsPerDay * 30).toFixed(2)}
					</p>
				</div>
			</div>
		</div>

		<!-- Hardware Compatibility -->
		<div>
			<h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-4">
				Hardware Compatibility Check
			</h2>
			<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
				<div class="space-y-4">
					{#each hardwareChecks as check}
						<div class="flex items-start justify-between p-4 rounded-[8px] bg-[var(--surface-2)]">
							<div class="flex items-start gap-3">
								<div
									class="h-10 w-10 rounded-[8px] flex items-center justify-center shrink-0 {check.compatible
										? 'bg-[var(--accent-subtle)]'
										: 'bg-[rgba(239,68,68,0.2)]'}"
								>
									{#if check.name === 'CPU'}
										<Cpu class="h-5 w-5" />
									{:else if check.name === 'GPU'}
										<Monitor class="h-5 w-5" />
									{:else}
										<HardDrive class="h-5 w-5" />
									{/if}
								</div>
								<div>
									<p class="text-[13px] font-medium text-[var(--text-primary)] mb-1">
										{check.name}
									</p>
									<p class="text-[12px] text-[var(--text-secondary)]">
										Required: {check.required}
									</p>
									<p class="text-[12px] text-[var(--text-secondary)]">
										Your hardware: {check.available || 'Not detected'}
									</p>
								</div>
							</div>
							{#if check.compatible}
								<CheckCircle2 class="h-6 w-6 text-[var(--text-accent)] shrink-0" />
							{:else}
								<AlertCircle class="h-6 w-6 text-[var(--error)] shrink-0" />
							{/if}
						</div>
					{/each}
				</div>

				{#if allCompatible}
					<div class="mt-4 p-3 rounded-[8px] border border-[var(--border-accent)] bg-[var(--accent-subtle)] flex items-center gap-2">
						<CheckCircle2 class="h-4 w-4 text-[var(--text-accent)] shrink-0" />
						<p class="text-[13px] text-[var(--text-accent)]">
							Your hardware meets all requirements for this application
						</p>
					</div>
				{:else}
					<div class="mt-4 p-3 rounded-[8px] border border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.12)] flex items-center gap-2">
						<AlertCircle class="h-4 w-4 text-[var(--error)] shrink-0" />
						<p class="text-[13px] text-[var(--error)]">
							Your hardware does not meet all requirements. Mining may not be possible.
						</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Terms and Subscribe -->
		<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
			<h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-4">Terms & Conditions</h2>
			<div class="space-y-4 mb-6">
				<div class="flex items-start gap-3">
					<CheckCircle2 class="h-5 w-5 text-[var(--text-accent)] shrink-0 mt-0.5" />
					<p class="text-[13px] text-[var(--text-secondary)]">
						You will contribute {app.resourceTypes.join(', ')} resources to the {app.name} network
					</p>
				</div>
				<div class="flex items-start gap-3">
					<CheckCircle2 class="h-5 w-5 text-[var(--text-accent)] shrink-0 mt-0.5" />
					<p class="text-[13px] text-[var(--text-secondary)]">
						Rewards are paid in {app.rewardToken} tokens based on your contribution and uptime
					</p>
				</div>
				<div class="flex items-start gap-3">
					<CheckCircle2 class="h-5 w-5 text-[var(--text-accent)] shrink-0 mt-0.5" />
					<p class="text-[13px] text-[var(--text-secondary)]">
						You can pause or cancel your subscription at any time
					</p>
				</div>
				<div class="flex items-start gap-3">
					<CheckCircle2 class="h-5 w-5 text-[var(--text-accent)] shrink-0 mt-0.5" />
					<p class="text-[13px] text-[var(--text-secondary)]">
						Your reputation score will be affected by your uptime and task completion rate
					</p>
				</div>
			</div>

			<div class="flex items-center gap-3 mb-6 p-4 rounded-[8px] bg-[var(--surface-2)]">
				<input
					type="checkbox"
					id="terms"
					bind:checked={agreedToTerms}
					class="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-base)] cursor-pointer"
				/>
				<label for="terms" class="text-[13px] text-[var(--text-primary)] cursor-pointer">
					I agree to the terms and conditions and understand the resource requirements
				</label>
			</div>

			<div class="flex flex-col-reverse md:flex-row gap-3">
				<button
					type="button"
					class="btn-subscribe flex-1"
					disabled={!agreedToTerms || !allCompatible}
					style="opacity:{!agreedToTerms || !allCompatible ? 0.4 : 1}"
					onclick={handleSubscribe}
				>
					Subscribe & Start Mining
				</button>
				<a href="/apps/{app.id}" class="btn-secondary text-center">Cancel</a>
			</div>
		</div>
	</div>
{:else}
	<div class="px-4 md:px-6 pt-4 md:pt-6 pb-12 max-w-4xl mx-auto">
		<p class="text-[14px] text-[var(--text-secondary)]">App not found.</p>
	</div>
{/if}
