<script lang="ts">
	import AreaChart from '$lib/components/AreaChart.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { signedIn } from '$lib/stores/wallet';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { formatAmount, formatNumber, formatDateTime, txUrl } from '$lib/format';
	import { PAYOUT_STATUS, bigOf, chartValue, sumByToken } from './labels';

	let { projectId }: { projectId: string } = $props();

	const payouts = useQuery(() => hub.epochPayouts({ project_id: projectId, limit: 200 }), { enabled: () => $signedIn });
	let items = $derived(payouts.data?.items ?? []);

	let totals = $derived(sumByToken(items));
	let claimed = $derived(sumByToken(items.filter((p) => p.status === 'claimed')));
	let claimable = $derived(sumByToken(items.filter((p) => p.status === 'claimable')));
	let accruing = $derived(sumByToken(items.filter((p) => p.status === 'accruing' || p.status === 'attested' || p.status === 'settled')));

	// Chart: miner payout per epoch (oldest → newest) for the main token.
	let chart = $derived.by(() => {
		const token = totals[0]?.token;
		if (!token) return { data: [] as number[], labels: [] as string[], symbol: '' };
		const rows = items.filter((p) => p.token.address.toLowerCase() === token.address.toLowerCase()).sort((a, b) => a.epoch - b.epoch);
		return {
			data: rows.map((p) => chartValue(bigOf(p.amount), token.decimals)),
			labels: rows.map((p) => `ep ${p.epoch}`),
			symbol: token.symbol
		};
	});

	const fmt = (list: { token: { symbol: string; decimals: number }; amount: bigint }[]) =>
		list.length === 0 ? '0' : list.map((t) => `${formatAmount(t.amount, t.token.decimals)} ${t.token.symbol}`).join(' · ');
</script>

<div class="space-y-6">
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each [
			{ label: 'Total paid out', value: fmt(totals), hint: 'All epoch payouts for this project', accent: true },
			{ label: 'Claimable', value: fmt(claimable), hint: 'Settled, ready to claim', accent: false },
			{ label: 'In progress', value: fmt(accruing), hint: 'Accruing, attested or awaiting settlement', accent: false },
			{ label: 'Claimed', value: fmt(claimed), hint: 'Sent to your wallet', accent: false }
		] as c (c.label)}
			<div class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
				<p class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">{c.label}</p>
				<p class="text-[18px] font-bold mt-1 font-mono {c.accent ? 'text-[var(--text-accent)]' : 'text-[var(--text-primary)]'}">{c.value}</p>
				<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">{c.hint}</p>
			</div>
		{/each}
	</div>

	{#if chart.data.length > 1}
		<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
			<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Payout per epoch ({chart.symbol})</h3>
			<div class="rounded-[8px] bg-[var(--surface-2)] overflow-hidden">
				<AreaChart data={chart.data} labels={chart.labels} color="#FFBF00" height={220} />
			</div>
		</div>
	{/if}

	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<div class="flex items-center justify-between mb-4">
			<div>
				<h4 class="text-[13px] font-semibold text-[var(--text-primary)]">Epoch payouts</h4>
				<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">Payouts are per wallet and project — they include every device you run on this project.</p>
			</div>
			<a href="/withdraw" class="btn-secondary no-underline">Claim rewards</a>
		</div>
		{#if payouts.loading && !payouts.data}
			<LoadingBlock rows={3} height="40px" />
		{:else if payouts.error}
			<ErrorState error={payouts.error} retry={payouts.refresh} compact />
		{:else if items.length === 0}
			<EmptyState
				compact
				illustration="hourglass"
				title="No payouts yet"
				description="Each epoch that closes with verified units from this device produces a payout here."
			/>
		{:else}
			<div class="rounded-[8px] border border-[var(--border)] overflow-x-auto">
				<table class="w-full text-[13px]">
					<thead>
						<tr class="border-b border-[var(--border)] bg-[var(--surface-2)]">
							{#each ['Epoch', 'Units', 'Amount', 'Status', 'Claim'] as h, i (h)}
								<th class="p-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide {i === 2 ? 'text-right' : 'text-left'}">{h}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each items as p (`${p.project_id}:${p.epoch}`)}
							{@const st = PAYOUT_STATUS[p.status]}
							<tr class="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
								<td class="p-3 text-[12px] font-mono text-[var(--text-secondary)]">{p.epoch}</td>
								<td class="p-3 text-[12px] font-mono text-[var(--text-secondary)]">{formatNumber(p.units)}</td>
								<td class="p-3 text-right tabular-nums font-mono font-medium text-[13px] text-[var(--success)]">+{formatAmount(p.amount, p.token.decimals)} {p.token.symbol}</td>
								<td class="p-3"><span class="text-[11px] px-2 py-0.5 rounded bg-[var(--surface-2)]" style="color: {st?.color};">{st?.label ?? p.status}</span></td>
								<td class="p-3 text-[11px] text-[var(--text-tertiary)]">
									{#if p.claim_tx}
										<a href={txUrl(p.claim_tx, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="font-mono text-[var(--text-accent)] no-underline">tx ↗</a>
									{:else if p.claimable_at}
										{formatDateTime(p.claimable_at)}
									{:else}
										—
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
