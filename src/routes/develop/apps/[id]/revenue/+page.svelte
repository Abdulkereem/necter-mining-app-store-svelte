<script lang="ts">
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { getAppIcon } from '$lib/app-icon';
  import { ArrowLeft, Download, TrendingUp, DollarSign, Users, PieChart } from 'lucide-svelte';

  const id = $derived($page.params.id ?? '');
  const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);
  const data = $derived(backend.getRevenueAnalytics(id as string));

  const iconSrc = $derived(
    getAppIcon({ id: id as string, name: app?.name ?? '', icon: app?.icon, category: app?.category })
  );

  let showAllMiners = $state(false);

  function handleExportCsv() {
    const rows = [['Date', 'Amount (NECTA)'], ...data.dailyRevenue.map((d) => [d.date, d.amount.toFixed(4)])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-${id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const overviewStats = $derived([
    { label: 'Total Revenue', value: data.totalRevenue.toFixed(2), unit: 'NECTA', iconName: 'TrendingUp', color: 'var(--success)' },
    { label: 'Net Payouts', value: data.totalPayouts.toFixed(2), unit: 'NECTA', iconName: 'DollarSign' },
    { label: 'Platform Fees', value: data.platformFees.toFixed(2), unit: 'NECTA (10%)', iconName: 'PieChart', color: 'var(--warning)' },
    { label: 'Active Miners', value: data.payoutsByMiner.length.toString(), iconName: 'Users' },
  ]);

  const maxDailyVal = $derived(Math.max(...data.dailyRevenue.map((x) => x.amount), 1));
  const visibleMiners = $derived(showAllMiners ? data.payoutsByMiner : data.payoutsByMiner.slice(0, 10));
</script>

<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12" style="max-width: 860px; margin: 0 auto;">
  <a href="/develop/apps/{id}" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4">
    <ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to Project
  </a>

  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-4">
      {#if app}
        <img src={iconSrc} alt="" class="w-10 h-10 rounded-[8px]" />
      {/if}
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Revenue Analytics</h1>
        <p class="text-[12px] text-[var(--text-secondary)]">{app?.name ?? id}</p>
      </div>
    </div>
    <button
      type="button"
      class="flex items-center gap-1.5 h-8 text-[11px] rounded-[5px] px-3 font-medium"
      style="background: var(--surface-2); color: var(--text-secondary); border: 1px solid var(--border-default); cursor: pointer;"
      onclick={handleExportCsv}
    >
      <Download class="h-3.5 w-3.5" /> Export CSV
    </button>
  </div>

  <!-- Revenue overview -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; margin-bottom: 24px;" class="mobile-grid-2">
    {#each overviewStats as s}
      <div style="background: var(--surface-1); padding: 14px 16px;">
        <div class="flex items-center gap-1.5 mb-1">
          {#if s.iconName === 'TrendingUp'}
            <TrendingUp class="h-3 w-3" style="color: var(--text-tertiary);" strokeWidth={1.5} />
          {:else if s.iconName === 'DollarSign'}
            <DollarSign class="h-3 w-3" style="color: var(--text-tertiary);" strokeWidth={1.5} />
          {:else if s.iconName === 'PieChart'}
            <PieChart class="h-3 w-3" style="color: var(--text-tertiary);" strokeWidth={1.5} />
          {:else}
            <Users class="h-3 w-3" style="color: var(--text-tertiary);" strokeWidth={1.5} />
          {/if}
          <span style="font-size: 10px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">{s.label}</span>
        </div>
        <p style="font-size: 18px; font-weight: 600; font-family: var(--font-mono); color: {s.color || 'var(--text-primary)'}; margin: 0;">
          {s.value} {#if s.unit}<span style="font-size: 10px; font-weight: 400; color: var(--text-tertiary);">{s.unit}</span>{/if}
        </p>
      </div>
    {/each}
  </div>

  <!-- Daily revenue chart -->
  <div class="p-5 rounded-[8px] mb-6" style="background: var(--surface-1); border: 1px solid var(--border-default);">
    <h3 class="text-[13px] font-semibold mb-4" style="color: var(--text-primary);">Daily Revenue (30 days)</h3>
    <div class="flex items-end gap-[2px]" style="height: 120px;">
      {#each data.dailyRevenue as d}
        {@const pct = (d.amount / maxDailyVal) * 100}
        <div class="flex-1 group relative" title="{d.date}: {d.amount.toFixed(2)} NECTA">
          <div class="w-full rounded-t-[2px] opacity-60 group-hover:opacity-100 transition-opacity" style="background: var(--accent-base); height: {pct}%; min-height: 2px;"></div>
        </div>
      {/each}
    </div>
    <div class="flex justify-between mt-2 text-[10px] font-mono" style="color: var(--text-tertiary);">
      <span>{data.dailyRevenue[0]?.date}</span>
      <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
    </div>
  </div>

  <!-- Revenue by miner -->
  <div class="p-5 rounded-[8px] mb-6" style="background: var(--surface-1); border: 1px solid var(--border-default);">
    <h3 class="text-[13px] font-semibold mb-3" style="color: var(--text-primary);">Revenue by Miner</h3>
    {#if data.payoutsByMiner.length === 0}
      <p class="text-[12px]" style="color: var(--text-tertiary);">No miner payouts yet.</p>
    {:else}
      <div class="space-y-0 rounded-[6px] overflow-hidden" style="border: 1px solid var(--border-default);">
        <div class="grid gap-3 px-3 py-2" style="grid-template-columns: 1fr 100px 80px; background: var(--surface-2);">
          <span class="text-[10px] font-semibold uppercase" style="color: var(--text-tertiary);">Miner</span>
          <span class="text-[10px] font-semibold uppercase text-right" style="color: var(--text-tertiary);">Earned</span>
          <span class="text-[10px] font-semibold uppercase text-right" style="color: var(--text-tertiary);">Proofs</span>
        </div>
        {#each visibleMiners as m}
          <div class="grid gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors" style="grid-template-columns: 1fr 100px 80px; border-top: 1px solid var(--border-default);">
            <span class="text-[12px] font-mono truncate" style="color: var(--text-primary);">{m.minerId}</span>
            <span class="text-[12px] font-mono text-right" style="color: var(--success);">{m.amount.toFixed(2)}</span>
            <span class="text-[12px] font-mono text-right" style="color: var(--text-secondary);">{m.proofs}</span>
          </div>
        {/each}
      </div>
      {#if data.payoutsByMiner.length > 10}
        <button
          type="button"
          onclick={() => { showAllMiners = !showAllMiners; }}
          class="text-[11px] mt-2 hover:underline"
          style="color: var(--text-accent); background: transparent; border: none; cursor: pointer;"
        >
          {showAllMiners ? 'Show less' : `Show all ${data.payoutsByMiner.length} miners`}
        </button>
      {/if}
    {/if}
  </div>

  <!-- Recent payouts -->
  {#if data.recentPayouts.length > 0}
    <div class="p-5 rounded-[8px]" style="background: var(--surface-1); border: 1px solid var(--border-default);">
      <h3 class="text-[13px] font-semibold mb-3" style="color: var(--text-primary);">Recent Payouts</h3>
      <div class="space-y-0 rounded-[6px] overflow-hidden" style="border: 1px solid var(--border-default);">
        {#each data.recentPayouts.slice(0, 10) as p, idx}
          <div class="flex items-center justify-between px-3 py-2.5" style="{idx > 0 ? 'border-top: 1px solid var(--border-default);' : ''}">
            <div>
              <span class="text-[12px] font-mono" style="color: var(--text-primary);">{p.minerId}</span>
              <span class="text-[10px] ml-2" style="color: var(--text-tertiary);">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
            <span class="text-[12px] font-mono font-semibold" style="color: var(--success);">+{p.amount.toFixed(2)} NECTA</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
