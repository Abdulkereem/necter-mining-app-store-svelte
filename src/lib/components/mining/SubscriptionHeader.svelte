<script lang="ts">
	import type { App, Subscription } from '$lib/types';
	import { ArrowLeft, AlertTriangle } from 'lucide-svelte';
	import { backend } from '$lib/stores/backend';
	import { showToast } from '$lib/stores/toast';

	let {
		subscription,
		app,
		iconSrc,
		wrongWallet,
		totalEarnedNecta,
		verifiedProofsCount,
		safe
	}: {
		subscription: Subscription;
		app: App;
		iconSrc: string;
		wrongWallet: boolean;
		totalEarnedNecta: number;
		verifiedProofsCount: number;
		safe: (fn: () => void) => void;
	} = $props();
</script>

<!-- Back Button -->
<a
	href="/mining"
	class="inline-flex items-center gap-2 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-[5px] text-[13px] px-3 py-1.5"
>
	<ArrowLeft class="h-4 w-4" />
	Back to My Mining
</a>

<!-- Header -->
<div class="flex items-start gap-3 md:gap-4">
	<img
		src={iconSrc}
		alt={app.name}
		width="48"
		height="48"
		class="rounded-[10px] w-12 h-12 md:w-14 md:h-14 object-cover shrink-0"
	/>
	<div class="flex-1">
		<div class="flex items-center gap-3 mb-2">
			<h1 class="text-[24px] font-semibold text-[var(--text-primary)]">{app.name}</h1>
			<span
				class="inline-flex items-center gap-2 text-xs px-2 py-0.5 rounded capitalize {subscription.status === 'active'
					? 'bg-[var(--success)]/15 text-[var(--success)]'
					: 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}"
			>
				{#if subscription.status === 'active'}
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse"></span>
				{/if}
				{subscription.status}
			</span>
		</div>
		<div
			class="text-[13px] text-[var(--text-secondary)] mb-4 flex flex-wrap items-center gap-2"
		>
			<span>
				Subscription: <span
					class="font-mono text-[12px] text-[var(--text-primary)]">{subscription.id}</span
				>
			</span>
		</div>

		{#if wrongWallet}
			<div
				class="p-4 mb-4 bg-[var(--surface-1)] border border-[rgba(242,153,74,0.30)] rounded-[8px]"
			>
				<div class="flex items-start gap-3">
					<AlertTriangle class="h-5 w-5 text-[var(--warning)] mt-0.5" />
					<div>
						<div class="text-[13px] font-medium text-[var(--text-primary)]">
							This subscription belongs to a different wallet
						</div>
						<div class="text-[12px] text-[var(--text-secondary)] mt-1">
							Connect the wallet for miner <span class="font-mono"
								>{subscription.minerId}</span
							> to manage it.
						</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="flex flex-wrap gap-2 mb-6">
			{#if subscription.status === 'active'}
				<button
					type="button"
					class="btn-secondary"
					onclick={() => safe(() => backend.pauseSubscription(subscription.id))}
					disabled={wrongWallet}
					style:opacity={wrongWallet ? 0.4 : 1}
				>
					Pause
				</button>
			{:else}
				<button
					type="button"
					class="btn-subscribe"
					onclick={() => safe(() => backend.resumeSubscription(subscription.id))}
					disabled={wrongWallet}
					style:opacity={wrongWallet ? 0.4 : 1}
				>
					Resume
				</button>
			{/if}
			<a href="/apps/{app.id}" class="btn-secondary">View app page</a>
			<a href="/withdraw" class="btn-secondary">Withdraw</a>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Total Earned</p>
				<p class="text-[20px] font-bold text-[var(--text-accent)] font-mono">
					{totalEarnedNecta.toFixed(4)} NECTA
				</p>
			</div>
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Tasks completed</p>
				<p class="text-[11px] text-[var(--text-tertiary)]">Verified proofs</p>
				<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">
					{verifiedProofsCount.toLocaleString('en-US')}
				</p>
			</div>
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Uptime</p>
				<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">
					{(subscription.uptime ?? 0).toFixed(1)}%
				</p>
			</div>
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Daily Average</p>
				<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">
					{(totalEarnedNecta / 30).toFixed(4)} NECTA
				</p>
			</div>
		</div>
	</div>
</div>
