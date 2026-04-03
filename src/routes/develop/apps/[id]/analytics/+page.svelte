<script lang="ts">
  import { page } from '$app/stores';
  import { backendState } from '$lib/stores/backend';
  import { ArrowLeft } from 'lucide-svelte';
  import AreaChart from '$lib/components/AreaChart.svelte';

  // Generate mock metric chart data based on range and metric
  function makeMetricData(rangeStr: string, metricKey: string) {
    const days = rangeStr === '7d' ? 7 : rangeStr === '30d' ? 30 : 90;
    const labels = [];
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      if (metricKey === 'revenue') {
        data.push(+(10 + Math.sin(i * 0.3) * 5 + Math.random() * 3).toFixed(2));
      } else if (metricKey === 'activeMiners') {
        data.push(Math.floor(15 + i * 0.4 + Math.sin(i * 0.5) * 5 + Math.random() * 3));
      } else {
        data.push(Math.floor(20 + Math.sin(i * 0.4) * 8 + Math.random() * 5));
      }
    }
    return { labels, data };
  }

  const id = $derived($page.params.id);
  const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);

  const subs = $derived($backendState.subscriptions.filter((s) => s.appId === id));
  const activeSubs = $derived(subs.filter((s) => s.status === 'active'));
  const proofs = $derived($backendState.proofs.filter((p) => p.appId === id));
  const verifiedProofs = $derived(proofs.filter((p) => p.status === 'verified'));
  const rejectedProofs = $derived(proofs.filter((p) => p.status === 'rejected'));
  const pendingProofs = $derived(proofs.filter((p) => p.status === 'pending'));
  const jobs = $derived($backendState.jobs.filter((j) => j.appId === id));
  const failedJobs = $derived(jobs.filter((j) => j.status === 'failed'));

  const avgVerificationMs = $derived((() => {
    const details = $backendState.proofDetails.filter((d) => d.appId === id && typeof d.verificationTime === 'number');
    if (details.length === 0) return null;
    return details.reduce((sum, d) => sum + (d.verificationTime ?? 0), 0) / details.length;
  })());

  const avgTaskSeconds = $derived((() => {
    const completed = jobs.filter((j) => j.status === 'completed' && j.startedAt && j.completedAt);
    if (completed.length === 0) return null;
    const ms = completed.reduce((sum, j) => sum + (new Date(j.completedAt!).getTime() - new Date(j.startedAt!).getTime()), 0) / completed.length;
    return ms / 1000;
  })());

  const hasData = $derived(subs.length > 0 || jobs.length > 0 || proofs.length > 0);

  let range = $state('30d');
  let metric = $state('revenue');

  function cycleRange() {
    range = range === '7d' ? '30d' : range === '30d' ? '90d' : '7d';
  }

  const metricLabel = $derived(
    metric === 'revenue' ? 'Developer revenue (NECTA)' : metric === 'activeMiners' ? 'Active miners' : 'Verified proofs'
  );

  const slashingCount = $derived($backendState.slashingEvents.filter((s) => s.appId === id).length);
  const totalRewardsCredited = $derived(verifiedProofs.reduce((sum, p) => sum + p.reward, 0));

  let analyticsChartData = $derived(makeMetricData(range, metric));
</script>

<div class="animate-fadeIn" style="padding: 24px 24px 48px;">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <a href="/develop/apps/{id}" style="height: 32px; padding: 0 12px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border-default); color: var(--text-secondary); font-size: 13px; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
        <ArrowLeft style="height: 16px; width: 16px;" />
        Back
      </a>
      <h1 style="font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); margin: 0;">Project Analytics</h1>
    </div>
    <div style="display: flex; gap: 8px;">
      <button style="height: 32px; padding: 0 12px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border-default); color: var(--text-primary); font-size: 13px; font-weight: 500; cursor: pointer;">
        Export CSV
      </button>
      <button onclick={cycleRange} style="height: 32px; padding: 0 12px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border-default); color: var(--text-primary); font-size: 13px; font-weight: 500; cursor: pointer;">
        Range: {range}
      </button>
    </div>
  </div>

  <!-- Top stats row -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
      <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 4px;">Avg Proof Time</p>
      <p style="font-size: 20px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono); margin: 0;">
        {avgVerificationMs == null ? '—' : `${Math.round(avgVerificationMs / 1000)}s`}
      </p>
    </div>
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
      <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 4px;">Avg Task Time</p>
      <p style="font-size: 20px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono); margin: 0;">
        {avgTaskSeconds == null ? '—' : `${avgTaskSeconds.toFixed(1)}s`}
      </p>
    </div>
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
      <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 4px;">Tasks Failed</p>
      <p style="font-size: 20px; font-weight: 600; color: var(--error); font-family: var(--font-mono); margin: 0;">{failedJobs.length.toLocaleString()}</p>
    </div>
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
      <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 4px;">Slashing Events</p>
      <p style="font-size: 20px; font-weight: 600; color: var(--error); font-family: var(--font-mono); margin: 0;">{slashingCount.toLocaleString()}</p>
    </div>
  </div>

  <div style="display: flex; flex-direction: column; gap: 24px;">
    {#if !hasData}
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">No activity yet</div>
        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
          Analytics populates once miners subscribe and proofs/jobs are produced.
          {#if app} Project: {app.name}{/if}
        </div>
      </div>
    {/if}

    <!-- Three summary cards -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
        <div style="font-size: 12px; color: var(--text-secondary);">Active miners</div>
        <div style="font-size: 20px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono); margin-top: 4px;">
          {activeSubs.length.toLocaleString()}
        </div>
        <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">
          {subs.length.toLocaleString()} total subscriptions
        </div>
      </div>
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
        <div style="font-size: 12px; color: var(--text-secondary);">Proofs</div>
        <div style="font-size: 20px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono); margin-top: 4px;">
          {proofs.length.toLocaleString()}
        </div>
        <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">
          {verifiedProofs.length} verified · {pendingProofs.length} pending · {rejectedProofs.length} rejected
        </div>
      </div>
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
        <div style="font-size: 12px; color: var(--text-secondary);">Total rewards credited</div>
        <div style="font-size: 20px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono); margin-top: 4px;">
          {totalRewardsCredited.toFixed(4)} NECTA
        </div>
        <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">{jobs.length} jobs</div>
      </div>
    </div>

    <!-- Performance chart area -->
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px;">
        <div>
          <h3 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">Performance Overview</h3>
          <div style="font-size: 13px; color: var(--text-secondary);">{metricLabel}</div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
          {#each [
            { key: 'revenue', label: 'Revenue' },
            { key: 'activeMiners', label: 'Active miners' },
            { key: 'verifiedProofs', label: 'Verified proofs' },
          ] as btn}
            <button
              onclick={() => metric = btn.key}
              style="height: 28px; padding: 0 12px; border-radius: 5px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 100ms; background: {metric === btn.key ? 'var(--accent-subtle)' : 'var(--surface-2)'}; color: {metric === btn.key ? 'var(--text-accent)' : 'var(--text-secondary)'}; border: 1px solid {metric === btn.key ? 'var(--border-accent)' : 'var(--border-default)'};"
            >
              {btn.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Performance chart -->
      <div style="border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-0); overflow: hidden;">
        <AreaChart data={analyticsChartData.data} labels={analyticsChartData.labels} color={metric === 'revenue' ? '#FFBF00' : metric === 'activeMiners' ? '#6E9FFF' : '#4CB782'} height={288} />
      </div>

      <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 12px;">
        {#if app}Project: {app.name} · {/if}Range: {range} · Metric: {metricLabel}
      </div>
    </div>
  </div>
</div>
