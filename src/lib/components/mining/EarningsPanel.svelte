<script lang="ts">
	import { ArrowUpRight, Download } from 'lucide-svelte';
	import { Button, Card, StatCard } from '$lib/components/ui';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { signedIn } from '$lib/stores/wallet';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { formatAmount, formatNumber, formatDateTime, txUrl } from '$lib/format';
	import type { Token } from '$lib/api/types';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import { PAYOUT_STATUS, amountOf, bigOf, chartValue, sumByToken } from './labels';
	import { iconProject, projectName } from './projects.svelte';

	type Range = '7d' | '30d' | 'all';
	let range = $state<Range>('30d');

	const byDay = useQuery(() => hub.earnings({ period: range, group_by: 'day' }), { enabled: () => $signedIn });
	const byProject = useQuery(() => hub.earnings({ period: range, group_by: 'project' }), { enabled: () => $signedIn });
	const payouts = useQuery(() => hub.epochPayouts({ limit: 50 }), { enabled: () => $signedIn });
	const claims = useQuery(() => hub.claims(), { enabled: () => $signedIn });

	// Tokens seen anywhere (period totals, claimable, payouts) — amounts are never summed across tokens.
	let tokens = $derived.by(() => {
		const m = new Map<string, Token>();
		for (const t of byDay.data?.totals ?? []) m.set(t.token.address.toLowerCase(), t.token);
		for (const c of claims.data?.items ?? []) m.set(c.token.address.toLowerCase(), c.token);
		for (const p of payouts.data?.items ?? []) m.set(p.token.address.toLowerCase(), p.token);
		return [...m.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
	});

	let tokenAddr = $state<string | null>(null);
	let token = $derived(tokens.find((t) => t.address.toLowerCase() === tokenAddr) ?? tokens[0] ?? null);

	let claimable = $derived(
		token ? sumByToken((claims.data?.items ?? []).filter((c) => c.token.address.toLowerCase() === token!.address.toLowerCase()))[0]?.amount ?? 0n : 0n
	);
	let periodTotal = $derived(token ? amountOf(byDay.data?.totals, token.address) : 0n);
	let accruing = $derived(
		token
			? sumByToken(
					(payouts.data?.items ?? []).filter(
						(p) => (p.status === 'accruing' || p.status === 'attested') && p.token.address.toLowerCase() === token!.address.toLowerCase()
					)
				)[0]?.amount ?? 0n
			: 0n
	);

	function dayKeys(n: number): string[] {
		const now = new Date();
		const anchor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
		return Array.from({ length: n }, (_, i) => new Date(anchor - (n - 1 - i) * 86400000).toISOString().slice(0, 10));
	}

	let chart = $derived.by(() => {
		const rows = byDay.data?.rows ?? [];
		const map = new Map<string, bigint>();
		for (const r of rows) if (r.key && token) map.set(r.key, amountOf(r.amounts, token.address));
		const keys = range === 'all' ? [...map.keys()].sort() : dayKeys(range === '7d' ? 7 : 30);
		const values = keys.map((k) => map.get(k) ?? 0n);
		const max = values.reduce((a, b) => (b > a ? b : a), 0n);
		const fmt = (k: string) => new Date(`${k}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
		return { keys, values, max, labels: keys.map(fmt) };
	});

	let tooltip = $state<{ index: number; x: number } | null>(null);

	let projectRows = $derived(
		(byProject.data?.rows ?? [])
			.map((r) => ({ key: r.key ?? '', units: r.units ?? 0, amount: token ? amountOf(r.amounts, token.address) : 0n, amounts: r.amounts ?? [] }))
			.filter((r) => r.key)
			.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : b.units - a.units))
	);

	let payoutItems = $derived(payouts.data?.items ?? []);

	function exportCsv() {
		const header = ['project_id', 'epoch', 'units', 'amount_wei', 'token', 'status', 'claim_tx'];
		const lines = payoutItems.map((p) =>
			[p.project_id, p.epoch, p.units, p.amount, p.token.symbol, p.status, p.claim_tx ?? ''].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')
		);
		const blob = new Blob([`${header.join(',')}\n${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'necter-epoch-payouts.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex flex-col gap-4">
	{#if tokens.length > 1}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-[11px] text-[var(--text-tertiary)] mr-1">Reward token</span>
			{#each tokens as t (t.address)}
				<button
					type="button"
					onclick={() => (tokenAddr = t.address.toLowerCase())}
					class="h-6 px-2 rounded-[4px] text-[11px] font-medium border cursor-pointer transition-colors {token?.address === t.address
						? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] border-transparent'
						: 'bg-transparent text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--surface-2)]'}"
				>
					{t.symbol}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Summary stats -->
	<Card padding="p-0" class="overflow-hidden">
		<div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)]">
			<StatCard
				label="Claimable"
				value={token ? `${formatAmount(claimable, token.decimals)} ${token.symbol}` : '—'}
				color={claimable > 0n ? 'var(--success)' : undefined}
				class="!rounded-none !border-0 px-4 py-3.5"
			/>
			<StatCard
				label={range === 'all' ? 'Earned (all time)' : `Earned (${range})`}
				value={token ? `${formatAmount(periodTotal, token.decimals)} ${token.symbol}` : '—'}
				class="!rounded-none !border-0 px-4 py-3.5"
			/>
			<StatCard label="Compute units" value={byDay.data ? formatNumber(byDay.data.units ?? 0) : '—'} class="!rounded-none !border-0 px-4 py-3.5" />
			<StatCard
				label="Accruing"
				value={token ? `${formatAmount(accruing, token.decimals)} ${token.symbol}` : '—'}
				class="!rounded-none !border-0 px-4 py-3.5"
			/>
		</div>
	</Card>

	<!-- Earnings chart with time range -->
	<Card padding="p-0" class="overflow-hidden">
		<div class="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
			<span class="text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Earnings Trend</span>
			<div class="flex gap-0.5 bg-[var(--surface-2)] rounded-[5px] p-0.5">
				{#each ['7d', '30d', 'all'] as r (r)}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (range = r as Range)}
						class="!h-6 !px-2 !rounded text-[11px] {range === r ? '!bg-[var(--surface-1)] !text-[var(--text-primary)]' : '!text-[var(--text-tertiary)]'}"
						style={range === r ? 'box-shadow: 0 1px 3px rgba(0,0,0,0.2)' : ''}
					>
						{r === 'all' ? 'All' : r}
					</Button>
				{/each}
			</div>
		</div>
		<div class="p-4">
			{#if byDay.loading && !byDay.data}
				<LoadingBlock rows={1} height="170px" />
			{:else if byDay.error}
				<ErrorState error={byDay.error} retry={byDay.refresh} compact />
			{:else}
				<div class="mb-3">
					<span class="text-[20px] font-semibold font-mono text-[var(--text-primary)] tracking-[-0.02em]">
						{token ? formatAmount(periodTotal, token.decimals) : '0'}
					</span>
					<span class="text-[12px] text-[var(--text-tertiary)] ml-1.5">{token?.symbol ?? ''}</span>
				</div>
				{#if chart.keys.length === 0}
					<div class="h-[150px] flex items-center justify-center text-[12px] text-[var(--text-tertiary)]">
						No earnings in this period yet.
					</div>
				{:else}
					<div class="relative h-[150px]">
						{#if tooltip !== null && token}
							<div
								class="absolute z-10 pointer-events-none bottom-full -translate-x-1/2 mb-1 whitespace-nowrap bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] font-mono"
								style="left: {tooltip.x}px;"
							>
								<span class="text-[var(--text-tertiary)]">{chart.labels[tooltip.index]}</span>: {formatAmount(chart.values[tooltip.index], token.decimals)}
								{token.symbol}
							</div>
						{/if}
						<div class="flex items-end gap-0.5 h-full">
							{#each chart.values as val, i (chart.keys[i])}
								{@const ratio = chart.max > 0n ? chartValue((val * 10n ** 18n) / chart.max, 18) : 0}
								{@const h = val > 0n ? Math.max(4, ratio * 140) : 2}
								<div
									role="img"
									aria-label="{chart.labels[i]}: {token ? formatAmount(val, token.decimals) : '0'} {token?.symbol ?? ''}"
									class="flex-1 rounded-t-sm transition-all cursor-default"
									style="height: {h}px; background: {tooltip?.index === i || i === chart.values.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'};"
									onmouseenter={(e) => {
										const rect = e.currentTarget.getBoundingClientRect();
										const parent = e.currentTarget.parentElement!.getBoundingClientRect();
										tooltip = { index: i, x: rect.left - parent.left + rect.width / 2 };
									}}
									onmouseleave={() => (tooltip = null)}
								></div>
							{/each}
						</div>
					</div>
					<div class="flex justify-between mt-1.5">
						<span class="text-[10px] text-[var(--text-tertiary)] font-mono">{chart.labels[0] ?? ''}</span>
						<span class="text-[10px] text-[var(--text-tertiary)] font-mono">{range === 'all' ? chart.labels[chart.labels.length - 1] : 'Today'}</span>
					</div>
				{/if}
			{/if}
		</div>
	</Card>

	<!-- By project + epoch payouts -->
	<div class="mobile-stack grid gap-4" style="grid-template-columns: 1.2fr 1fr;">
		<Card>
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">By project</h3>
				<a href="/withdraw" class="inline-flex items-center gap-1 text-[12px] no-underline text-[var(--text-accent)]">
					Claim rewards <ArrowUpRight size={12} strokeWidth={1.5} />
				</a>
			</div>
			{#if byProject.loading && !byProject.data}
				<LoadingBlock rows={3} height="36px" />
			{:else if byProject.error}
				<ErrorState error={byProject.error} retry={byProject.refresh} compact />
			{:else if projectRows.length === 0}
				<p class="text-[12px] text-[var(--text-tertiary)] text-center py-6">No project earnings in this period.</p>
			{:else}
				<div class="flex flex-col">
					{#each projectRows as r (r.key)}
						<a
							href="/apps/{r.key}"
							class="flex items-center gap-2.5 py-2 border-b border-[var(--border-default)] last:border-0 no-underline hover:bg-[var(--surface-2)] -mx-2 px-2 rounded-[5px] transition-colors"
						>
							<ProjectIcon project={iconProject(r.key)} size={24} rounded="5px" />
							<div class="min-w-0 flex-1">
								<div class="text-[13px] font-medium truncate text-[var(--text-primary)]">{projectName(r.key)}</div>
								<div class="text-[11px] text-[var(--text-tertiary)]">{formatNumber(r.units)} units</div>
							</div>
							<div class="text-right shrink-0">
								{#each r.amounts as a (a.token.address)}
									<div class="text-[12px] font-mono tabular-nums text-[var(--text-primary)]">
										{formatAmount(a.amount, a.token.decimals)} <span class="text-[var(--text-tertiary)]">{a.token.symbol}</span>
									</div>
								{/each}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</Card>

		<Card>
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">Epoch payouts</h3>
				{#if payoutItems.length > 0}
					<Button variant="ghost" size="sm" onclick={exportCsv} class="text-[11px] !text-[var(--text-tertiary)]">
						<Download size={12} strokeWidth={1.5} />
						CSV
					</Button>
				{/if}
			</div>
			{#if payouts.loading && !payouts.data}
				<LoadingBlock rows={4} height="44px" />
			{:else if payouts.error}
				<ErrorState error={payouts.error} retry={payouts.refresh} compact />
			{:else if payoutItems.length === 0}
				<EmptyState
					compact
					illustration="hourglass"
					title="No payouts yet"
					description="Payouts appear when an epoch of a project you mine closes with your verified units."
				/>
			{:else}
				<div class="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
					{#each payoutItems as p (`${p.project_id}:${p.epoch}`)}
						{@const st = PAYOUT_STATUS[p.status]}
						<div class="px-3 py-2.5 rounded-[6px] border border-[var(--border-default)]">
							<div class="flex items-center justify-between gap-2">
								<span class="text-[13px] font-semibold font-mono text-[var(--text-primary)] tabular-nums">
									{formatAmount(bigOf(p.amount), p.token.decimals)} {p.token.symbol}
								</span>
								<span class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)]" style="color: {st?.color};">
									{st?.label ?? p.status}
								</span>
							</div>
							<div class="flex items-center justify-between gap-2 mt-0.5">
								<span class="text-[11px] text-[var(--text-tertiary)] truncate">
									{projectName(p.project_id)} · epoch {p.epoch} · {formatNumber(p.units)} units
								</span>
								{#if p.claim_tx}
									<a
										href={txUrl(p.claim_tx, explorerBase($descriptor))}
										target="_blank"
										rel="noopener noreferrer"
										class="text-[10px] font-mono text-[var(--text-accent)] no-underline shrink-0">tx ↗</a
									>
								{:else if p.claimable_at && p.status !== 'claimed'}
									<span class="text-[10px] text-[var(--text-tertiary)] shrink-0">from {formatDateTime(p.claimable_at)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	</div>
</div>
