<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, showConnectModal } from '$lib/stores/wallet';
	import { showToast } from '$lib/stores/toast';
	import { appIconDataUri } from '$lib/app-icon';
	import { ArrowLeft, Pause, Play } from 'lucide-svelte';

	let minerId = $derived($actor?.minerId ?? null);

	let subs = $derived.by(() => {
		if (!minerId) return [];
		return $backendState.subscriptions
			.filter((s) => s.minerId === minerId)
			.map((s) => {
				const app = $backendState.apps.find((a) => a.id === s.appId);
				return { ...s, app };
			})
			.sort((a, b) => {
				const order: Record<string, number> = { active: 0, paused: 1, slashed: 2, cancelled: 3 };
				return (order[a.status] ?? 4) - (order[b.status] ?? 4) || (b.totalEarned ?? 0) - (a.totalEarned ?? 0);
			});
	});

	let activeCount = $derived(subs.filter((s) => s.status === 'active').length);
	let totalEarned = $derived(subs.reduce((s, sub) => s + (sub.totalEarned ?? 0), 0));
	let avgUptime = $derived(subs.length > 0 ? subs.reduce((s, sub) => s + sub.uptime, 0) / subs.length : 0);

	const statusStyles: Record<string, { label: string; color: string; bg: string }> = {
		active: { label: 'Active', color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
		paused: { label: 'Paused', color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)' },
		cancelled: { label: 'Cancelled', color: 'var(--text-tertiary)', bg: 'var(--surface-3)' },
		slashed: { label: 'Slashed', color: 'var(--error)', bg: 'rgba(239,68,68,0.12)' }
	};

	function getIconSrc(app: { id: string; name: string; icon: string } | undefined) {
		if (!app) return '';
		if (app.icon && app.icon !== '/placeholder.svg') return app.icon;
		return appIconDataUri({ id: app.id, name: app.name });
	}

	function handlePause(e: MouseEvent, subId: string) {
		e.preventDefault();
		e.stopPropagation();
		backend.pauseSubscription(subId);
		showToast('Paused');
	}

	function handleResume(e: MouseEvent, subId: string) {
		e.preventDefault();
		e.stopPropagation();
		backend.resumeSubscription(subId);
		showToast('Resumed');
	}
</script>

<svelte:head>
	<title>Subscriptions — Necter Mining App Store</title>
</svelte:head>

{#if !$actor}
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12 max-w-[960px] mx-auto">
		<div class="p-12 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center">
			<p class="text-[13px] text-[var(--text-secondary)] mb-3">Connect your wallet to view subscriptions.</p>
			<button class="btn-pill" onclick={() => ($showConnectModal = true)}>Connect Wallet</button>
		</div>
	</div>
{:else}
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12 max-w-[960px] mx-auto">
		<a
			href="/mining"
			class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4"
		>
			<ArrowLeft class="h-3 w-3" strokeWidth={1.5} />
			Back to Mining
		</a>

		<div class="mb-6">
			<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
				My Subscriptions
			</h1>
			<p class="text-[12px] text-[var(--text-secondary)] mt-0.5">
				Projects you are subscribed to. Click a row to open its detail page.
			</p>
		</div>

		<!-- Stats grid: 4 cols desktop, 2 cols mobile -->
		<div
			class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden mb-5"
		>
			{#each [
				{ label: 'Total Subscriptions', value: subs.length.toString() },
				{ label: 'Active', value: activeCount.toString(), color: 'var(--success)' },
				{ label: 'Total Earned', value: totalEarned.toFixed(2), unit: 'NECTA' },
				{ label: 'Avg Uptime', value: `${avgUptime.toFixed(1)}%` }
			] as stat}
				<div class="bg-[var(--surface-1)] p-3">
					<span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">
						{stat.label}
					</span>
					<p
						class="text-[18px] font-semibold font-mono mt-1"
						style="color:{stat.color || 'var(--text-primary)'}"
					>
						{stat.value}
						{#if stat.unit}
							<span class="text-[10px] font-normal text-[var(--text-tertiary)]">{stat.unit}</span>
						{/if}
					</p>
				</div>
			{/each}
		</div>

		<!-- Subscription list -->
		{#if subs.length === 0}
			<div class="p-12 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center">
				<p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">No subscriptions yet</p>
				<p class="text-[13px] text-[var(--text-secondary)] mb-4">
					Discover projects and start mining to earn NECTA.
				</p>
				<a href="/discover" class="btn-subscribe">Discover Projects</a>
			</div>
		{:else}
			<div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
				<!-- Header — desktop only -->
				<div
					class="hidden md:grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]"
					style="grid-template-columns:1fr 80px 90px 80px 90px 70px;gap:24px"
				>
					<span>Project</span>
					<span class="text-right">Status</span>
					<span class="text-right">Earned</span>
					<span class="text-right">Uptime</span>
					<span class="text-right">Tasks</span>
					<span class="text-right">Actions</span>
				</div>

				<!-- Rows -->
				{#each subs as sub (sub.id)}
					{@const sc = statusStyles[sub.status] ?? statusStyles.cancelled}
					<a
						href="/mining/{sub.id}"
						class="flex md:grid items-center px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors no-underline cursor-pointer gap-3 md:gap-0"
						style="grid-template-columns:1fr 80px 90px 80px 90px 70px"
					>
						<div class="flex items-center gap-3 min-w-0">
							{#if sub.app}
								<img
									src={getIconSrc(sub.app)}
									alt={sub.app.name}
									width="32"
									height="32"
									class="rounded-[6px] flex-shrink-0"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="text-[13px] font-medium text-[var(--text-primary)] truncate">
									{sub.app?.name ?? sub.appId}
								</p>
								<p class="text-[10px] text-[var(--text-tertiary)]">
									<span class="hidden md:inline">{sub.app?.category ?? ''}</span>
									<span class="md:hidden">
										{(sub.totalEarned ?? 0).toFixed(2)} NECTA &middot; {sub.uptime.toFixed(0)}%
									</span>
								</p>
							</div>
						</div>
						<!-- Status -->
						<div class="flex justify-end">
							<span
								class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-[3px]"
								style="background:{sc.bg};color:{sc.color}"
							>
								{sc.label}
							</span>
						</div>
						<span
							class="hidden md:block text-right text-[12px] font-mono font-medium text-[var(--success)] tabular-nums"
						>
							{(sub.totalEarned ?? 0).toFixed(2)}
						</span>
						<span
							class="hidden md:block text-right text-[12px] font-mono text-[var(--text-secondary)] tabular-nums"
						>
							{sub.uptime.toFixed(1)}%
						</span>
						<span
							class="hidden md:block text-right text-[12px] font-mono text-[var(--text-secondary)] tabular-nums"
						>
							{(sub.tasksCompleted ?? 0).toLocaleString()}
						</span>
						<!-- Actions (desktop) -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="hidden md:flex justify-end" onclick={(e) => e.preventDefault()}>
							{#if sub.status === 'active'}
								<button
									type="button"
									class="h-7 w-7 rounded-[5px] bg-[var(--surface-3)] flex items-center justify-center border-none cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
									title="Pause"
									onclick={(e) => handlePause(e, sub.id)}
								>
									<Pause class="h-3 w-3 text-[var(--text-secondary)]" strokeWidth={2} />
								</button>
							{/if}
							{#if sub.status === 'paused'}
								<button
									type="button"
									class="h-7 w-7 rounded-[5px] bg-[var(--surface-3)] flex items-center justify-center border-none cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
									title="Resume"
									onclick={(e) => handleResume(e, sub.id)}
								>
									<Play class="h-3 w-3 text-[var(--success)]" strokeWidth={2} />
								</button>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}

		<!-- Discover more -->
		<div class="mt-6 text-center">
			<a href="/discover" class="text-[12px] text-[var(--text-accent)] hover:underline no-underline">
				Discover more projects to mine &rarr;
			</a>
		</div>
	</div>
{/if}
