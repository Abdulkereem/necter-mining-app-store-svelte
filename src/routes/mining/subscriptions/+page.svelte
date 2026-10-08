<script lang="ts">
	import toast from 'svelte-french-toast';
	import { ArrowLeft, Pause, Play } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Subscription, SubscriptionStatus } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { pause, resume } from '$lib/flows';
	import { bpToPercent, formatNumber, formatToken, categoryShort } from '$lib/format';
	import { subStatus, sumByToken, SUBSCRIPTION_STATUSES } from '$lib/components/mining/labels';
	import { projectRef } from '$lib/components/mining/projects.svelte';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	let filter = $state<SubscriptionStatus | 'all'>('all');
	let pending = $state<string | null>(null);

	const q = useQuery(() => hub.mySubscriptions({ limit: 200, ...(filter === 'all' ? {} : { status: filter }) }), {
		enabled: () => $signedIn
	});
	const subs = $derived((q.data?.items ?? []) as Subscription[]);
	const activeCount = $derived(subs.filter((s) => s.status === 'active').length);
	const earned = $derived(sumByToken(subs.filter((s) => s.token && s.earned_total).map((s) => ({ token: s.token!, amount: s.earned_total! }))));
	const avgUptime = $derived.by(() => {
		const xs = subs.filter((s) => s.status === 'active' && typeof s.uptime_bp === 'number');
		return xs.length ? Math.round(xs.reduce((a, s) => a + (s.uptime_bp ?? 0), 0) / xs.length) : null;
	});

	async function toggle(e: MouseEvent, s: Subscription) {
		e.preventDefault();
		e.stopPropagation();
		pending = s.subscription_id;
		try {
			if (s.status === 'active') await pause(s);
			else await resume(s);
			toast.success(s.status === 'active' ? 'Paused' : 'Resumed');
			await q.refresh();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			pending = null;
		}
	}
</script>

<svelte:head><title>My subscriptions · Necter</title></svelte:head>

<SignInGate title="Sign in to see your subscriptions" description="Your subscriptions are the projects your devices mine, each backed by NECTA collateral.">
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12 max-w-[960px] mx-auto">
		<a href="/mining" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4">
			<ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to Mining
		</a>
		<div class="mb-6">
			<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">My Subscriptions</h1>
			<p class="text-[12px] text-[var(--text-secondary)] mt-0.5">One subscription = one device mining one project. Open a row for collateral, proofs and payouts.</p>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden mb-5">
			<div class="bg-[var(--surface-1)] p-3">
				<span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">Subscriptions</span>
				<p class="text-[18px] font-semibold font-mono mt-1">{q.data ? subs.length : '—'}</p>
			</div>
			<div class="bg-[var(--surface-1)] p-3">
				<span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">Active</span>
				<p class="text-[18px] font-semibold font-mono mt-1 text-[var(--success)]">{q.data ? activeCount : '—'}</p>
			</div>
			<div class="bg-[var(--surface-1)] p-3">
				<span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">Total earned</span>
				<p class="text-[15px] font-semibold font-mono mt-1">
					{#if earned.length}{#each earned as t (t.token.address)}<span class="block">{formatToken(t.amount.toString(), t.token, { maxFrac: 2 })}</span>{/each}{:else}—{/if}
				</p>
			</div>
			<div class="bg-[var(--surface-1)] p-3">
				<span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">Avg uptime (active)</span>
				<p class="text-[18px] font-semibold font-mono mt-1">{bpToPercent(avgUptime)}</p>
			</div>
		</div>

		<div class="flex gap-1 flex-wrap mb-4">
			{#each ['all', ...SUBSCRIPTION_STATUSES] as s (s)}
				<button
					type="button"
					onclick={() => (filter = s as SubscriptionStatus | 'all')}
					class="h-[28px] px-3 rounded-[5px] text-[12px] border-none cursor-pointer {filter === s ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium' : 'bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				>
					{s === 'all' ? 'All' : subStatus(s).label}
				</button>
			{/each}
		</div>

		{#if q.loading && !q.data}
			<LoadingBlock rows={4} />
		{:else if q.error}
			<ErrorState error={q.error} retry={q.refresh} />
		{:else if subs.length === 0}
			<EmptyState
				illustration="platform"
				title={filter === 'all' ? 'No subscriptions yet' : `No ${subStatus(filter).label.toLowerCase()} subscriptions`}
				description="Pick a project, choose one of your devices and bond NECTA collateral to start mining."
			>
				<a href="/discover" class="btn-subscribe">Discover projects</a>
				<a href="/faucet" class="btn-secondary">Get testnet NECTA</a>
			</EmptyState>
		{:else}
			<div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
				<div class="hidden md:grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style="grid-template-columns:1fr 110px 120px 80px 80px 50px;gap:16px">
					<span>Project</span><span class="text-right">Status</span><span class="text-right">Earned</span><span class="text-right">Uptime</span><span class="text-right">Units</span><span></span>
				</div>
				{#each subs as s (s.subscription_id)}
					{@const st = subStatus(s.status)}
					{@const ref = projectRef(s.project_id)}
					<a href="/mining/{s.subscription_id}" class="flex md:grid items-center px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors no-underline gap-3 md:gap-4" style="grid-template-columns:1fr 110px 120px 80px 80px 50px">
						<div class="flex items-center gap-3 min-w-0 flex-1">
							<ProjectIcon project={{ project_id: s.project_id, name: s.project_name ?? ref?.name ?? 'Project', category: ref?.category, icon: ref?.icon }} size={32} rounded="6px" />
							<div class="min-w-0">
								<p class="text-[13px] font-medium text-[var(--text-primary)] truncate">{s.project_name ?? ref?.name ?? s.project_id.slice(0, 10)}</p>
								<p class="text-[10px] text-[var(--text-tertiary)] font-mono truncate">{s.node_id}{ref?.category ? ` · ${categoryShort(ref.category)}` : ''}</p>
							</div>
						</div>
						<div class="flex justify-end">
							<span class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)]" style="color:{st.color}" title={st.hint}>{st.label}</span>
						</div>
						<span class="hidden md:block text-right text-[12px] font-mono text-[var(--success)] tabular-nums">{s.earned_total && s.token ? formatToken(s.earned_total, s.token, { maxFrac: 2 }) : '—'}</span>
						<span class="hidden md:block text-right text-[12px] font-mono text-[var(--text-secondary)] tabular-nums">{bpToPercent(s.uptime_bp)}</span>
						<span class="hidden md:block text-right text-[12px] font-mono text-[var(--text-secondary)] tabular-nums">{formatNumber(s.units_total)}</span>
						<div class="hidden md:flex justify-end">
							{#if s.status === 'active' || s.status === 'paused'}
								<button
									type="button"
									disabled={pending === s.subscription_id}
									class="h-7 w-7 rounded-[5px] bg-[var(--surface-3)] flex items-center justify-center border-none cursor-pointer hover:bg-[var(--surface-4)] transition-colors"
									title={s.status === 'active' ? 'Pause' : 'Resume'}
									onclick={(e) => toggle(e, s)}
								>
									{#if s.status === 'active'}<Pause class="h-3 w-3 text-[var(--text-secondary)]" strokeWidth={2} />{:else}<Play class="h-3 w-3 text-[var(--success)]" strokeWidth={2} />{/if}
								</button>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
		<div class="mt-6 text-center">
			<a href="/discover" class="text-[12px] text-[var(--text-accent)] hover:underline no-underline">Discover more projects to mine &rarr;</a>
		</div>
	</div>
</SignInGate>
