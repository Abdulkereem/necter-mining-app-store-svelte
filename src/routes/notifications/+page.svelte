<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { CheckCheck, Circle, AlertTriangle } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Notification } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { refreshMe } from '$lib/stores/account';
	import { timeAgo } from '$lib/format';
	import { eventMeta, eventHref, TONE_COLOR } from '$lib/components/mining/labels';
	import { Card, StatCard } from '$lib/components/ui';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	type Filter = 'all' | 'unread' | 'mining' | 'earnings' | 'security' | 'developer';
	const FILTERS: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'unread', label: 'Unread' },
		{ id: 'mining', label: 'Mining' },
		{ id: 'earnings', label: 'Earnings' },
		{ id: 'security', label: 'Slashing & alerts' },
		{ id: 'developer', label: 'Developer' }
	];
	let filter = $state<Filter>('all');
	let marking = $state(false);

	const q = useQuery(() => hub.notifications({ limit: 200 }), { enabled: () => $signedIn, pollMs: 30_000 });
	const alertsQ = useQuery(() => hub.alerts(), { enabled: () => $signedIn });

	const items = $derived((q.data?.items ?? []) as Notification[]);
	const unread = $derived(q.data?.unread ?? items.filter((n) => !n.read).length);
	const filtered = $derived(
		items.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read : eventMeta(n.type).group === filter))
	);

	function dayLabel(ts: number) {
		const d = new Date(ts * 1000);
		const today = new Date();
		const y = new Date(today);
		y.setDate(today.getDate() - 1);
		if (d.toDateString() === today.toDateString()) return 'Today';
		if (d.toDateString() === y.toDateString()) return 'Yesterday';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
	const groups = $derived.by(() => {
		const m = new Map<string, Notification[]>();
		for (const n of filtered) m.set(dayLabel(n.created_at), [...(m.get(dayLabel(n.created_at)) ?? []), n]);
		return [...m.entries()].map(([label, list]) => ({ label, items: list }));
	});

	async function markAll() {
		marking = true;
		try {
			await hub.markRead({ all: true });
			await q.refresh();
			void refreshMe();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			marking = false;
		}
	}

	async function open(n: Notification) {
		if (!n.read) {
			hub.markRead({ ids: [n.id] }).then(() => {
				void q.refresh();
				void refreshMe();
			}).catch(() => undefined);
		}
		const href = eventHref(n);
		if (href) await goto(href);
	}
</script>

<svelte:head><title>Activity · Necter</title></svelte:head>

<SignInGate title="Your activity" description="Sign in to see device, subscription, proof, payout and slashing events for your wallet.">
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-8 pb-12 max-w-[720px] mx-auto">
		<div class="flex items-center justify-between mb-5">
			<div>
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Activity</h1>
				<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 hidden md:block">Your mining, earnings, slashing and developer events</p>
			</div>
			<button type="button" class="btn-secondary inline-flex items-center gap-1.5" disabled={marking || unread === 0} onclick={markAll}>
				<CheckCheck class="h-3.5 w-3.5" /> Mark all read
			</button>
		</div>

		{#if (alertsQ.data?.items?.length ?? 0) > 0}
			<div class="mb-5 space-y-2">
				{#each alertsQ.data?.items ?? [] as a (a.id)}
					<a href={eventHref(a) ?? '/mining'} class="flex items-center gap-3 p-3 rounded-[8px] no-underline border {a.severity === 'critical' ? 'border-[rgba(235,87,87,0.3)] bg-[rgba(235,87,87,0.06)]' : 'border-[rgba(242,153,74,0.3)] bg-[rgba(242,153,74,0.06)]'}">
						<AlertTriangle class="h-4 w-4 flex-shrink-0" style="color:{a.severity === 'critical' ? 'var(--error)' : 'var(--warning)'}" />
						<span class="text-[13px] text-[var(--text-primary)] flex-1">{a.message}</span>
						<span class="text-[11px] text-[var(--text-tertiary)]">{timeAgo(a.created_at)}</span>
					</a>
				{/each}
			</div>
		{/if}

		<Card padding="p-0" class="overflow-hidden mb-6">
			<div class="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border-default)]">
				<StatCard label="Events" value={String(items.length)} class="!rounded-none !border-0 px-3 md:px-4 py-3" />
				<StatCard label="Unread" value={String(unread)} accent={unread > 0} class="!rounded-none !border-0 px-3 md:px-4 py-3" />
				<StatCard label="Active alerts" value={String(alertsQ.data?.items?.length ?? 0)} class="!rounded-none !border-0 px-3 md:px-4 py-3" />
			</div>
		</Card>

		<div class="flex items-center gap-1 mb-5 overflow-x-auto mobile-tabs-scroll">
			{#each FILTERS as f (f.id)}
				<button
					type="button"
					onclick={() => (filter = f.id)}
					class="whitespace-nowrap flex-shrink-0 text-[12px] h-[28px] px-3 rounded-[5px] border-none cursor-pointer {filter === f.id ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				>
					{f.label}
				</button>
			{/each}
		</div>

		{#if q.loading && !q.data}
			<LoadingBlock rows={5} />
		{:else if q.error}
			<ErrorState error={q.error} retry={q.refresh} />
		{:else if filtered.length === 0}
			<EmptyState
				illustration="bee"
				title={items.length === 0 ? 'No activity yet' : 'Nothing in this filter'}
				description={items.length === 0 ? 'Events appear here as your devices bind, subscribe, vote in rounds and get paid.' : 'Try another filter.'}
			>
				{#if items.length === 0}<a href="/discover" class="btn-subscribe">Start mining</a>{/if}
			</EmptyState>
		{:else}
			<div class="space-y-6">
				{#each groups as group (group.label)}
					<div>
						<div class="flex items-center gap-3 mb-2">
							<span class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em]">{group.label}</span>
							<div class="flex-1 h-px bg-[var(--border-default)]"></div>
							<span class="text-[10px] text-[var(--text-tertiary)] font-mono">{group.items.length}</span>
						</div>
						<Card padding="p-0" class="overflow-hidden divide-y divide-[var(--border-default)]">
							{#each group.items as n (n.id)}
								{@const meta = eventMeta(n.type)}
								<button type="button" onclick={() => open(n)} class="w-full flex items-center gap-3 py-3 px-3.5 hover:bg-[var(--surface-2)] transition-colors text-left bg-transparent border-none cursor-pointer">
									<div class="flex-shrink-0 w-7 flex justify-center">
										<span class="h-2 w-2 rounded-full" style="background:{TONE_COLOR[meta.tone]}"></span>
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-[13px] font-medium text-[var(--text-primary)]">{meta.label}</p>
										{#if n.message}<p class="text-[12px] text-[var(--text-secondary)] truncate">{n.message}</p>{/if}
									</div>
									<span class="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">{timeAgo(n.created_at)}</span>
									{#if !n.read}<Circle class="h-2 w-2 fill-[var(--accent-base)] text-[var(--accent-base)]" />{/if}
								</button>
							{/each}
						</Card>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</SignInGate>
