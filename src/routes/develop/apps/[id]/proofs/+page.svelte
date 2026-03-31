<script>
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { appIconDataUri } from '$lib/app-icon';
  import { ArrowLeft, Shield, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-svelte';

  const id = $derived($page.params.id);
  const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);
  const data = $derived(backend.getProofMonitoring(id));

  const iconSrc = $derived(
    app && app.icon && app.icon !== '/placeholder.svg'
      ? app.icon
      : appIconDataUri({ id: id, name: app?.name ?? '' })
  );

  const statusIcons = {
    verified: { color: 'var(--success)' },
    rejected: { color: 'var(--error)' },
    pending: { color: 'var(--warning)' },
    disputed: { color: 'var(--error)' },
  };

  const stats = $derived([
    { label: 'Total', value: data.total.toString() },
    { label: 'Verified', value: data.verified.toString(), color: 'var(--success)' },
    { label: 'Failed', value: data.failed.toString(), color: data.failed > 0 ? 'var(--error)' : undefined },
    { label: 'Pending', value: data.pending.toString(), color: 'var(--warning)' },
    { label: 'Success Rate', value: `${data.successRate.toFixed(1)}%`, color: data.successRate >= 90 ? 'var(--success)' : 'var(--warning)' },
  ]);

  const maxHourly = $derived(Math.max(...data.hourlyRate.map((x) => x.count), 1));
</script>

<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12" style="max-width: 860px; margin: 0 auto;">
  <a href="/develop/apps/{id}" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4">
    <ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to Project
  </a>

  <div class="flex items-center gap-4 mb-6">
    {#if app}
      <img src={iconSrc} alt="" class="w-10 h-10 rounded-[8px]" />
    {/if}
    <div>
      <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Proof Monitoring</h1>
      <p class="text-[12px] text-[var(--text-secondary)]">{app?.name ?? id}</p>
    </div>
  </div>

  <!-- Stats -->
  <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; margin-bottom: 24px;" class="mobile-grid-2">
    {#each stats as s}
      <div style="background: var(--surface-1); padding: 12px 14px;">
        <span style="font-size: 10px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">{s.label}</span>
        <p style="font-size: 18px; font-weight: 600; font-family: var(--font-mono); color: {s.color || 'var(--text-primary)'}; margin: 4px 0 0;">{s.value}</p>
      </div>
    {/each}
  </div>

  <!-- Hourly proof rate (bar chart) -->
  <div class="p-5 rounded-[8px] mb-6" style="background: var(--surface-1); border: 1px solid var(--border-default);">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[13px] font-semibold" style="color: var(--text-primary);">Proof Rate (24h)</h3>
      <span class="text-[11px]" style="color: var(--text-tertiary);">Avg verification time: {data.avgVerificationTime.toFixed(1)}s</span>
    </div>
    <div class="flex items-end gap-[3px]" style="height: 100px;">
      {#each data.hourlyRate as h}
        {@const totalPct = (h.count / maxHourly) * 100}
        {@const verifiedPct = (h.verified / maxHourly) * 100}
        <div class="flex-1 relative group" title="{h.hour} — {h.verified}/{h.count} verified">
          <div class="w-full rounded-t-[2px]" style="background: var(--surface-3); height: {totalPct}%; min-height: 2px;"></div>
          <div class="w-full rounded-t-[2px] absolute bottom-0 left-0" style="background: var(--success); height: {verifiedPct}%; min-height: 1px; opacity: 0.8;"></div>
        </div>
      {/each}
    </div>
    <div class="flex justify-between mt-2 text-[9px] font-mono" style="color: var(--text-tertiary);">
      <span>{data.hourlyRate[0]?.hour}</span>
      <span>{data.hourlyRate[data.hourlyRate.length - 1]?.hour}</span>
    </div>
    <div class="flex items-center gap-4 mt-2">
      <div class="flex items-center gap-1.5"><div class="w-2 h-2 rounded-[1px]" style="background: var(--surface-3);"></div><span class="text-[10px]" style="color: var(--text-tertiary);">Total</span></div>
      <div class="flex items-center gap-1.5"><div class="w-2 h-2 rounded-[1px]" style="background: var(--success);"></div><span class="text-[10px]" style="color: var(--text-tertiary);">Verified</span></div>
    </div>
  </div>

  <!-- Failure reasons -->
  {#if data.failureReasons.length > 0}
    {@const totalFailed = data.failureReasons.reduce((s, x) => s + x.count, 0) || 1}
    <div class="p-5 rounded-[8px] mb-6" style="background: var(--surface-1); border: 1px solid var(--border-default);">
      <h3 class="text-[13px] font-semibold mb-3" style="color: var(--text-primary);">Failure Breakdown</h3>
      <div class="space-y-2">
        {#each data.failureReasons as r}
          {@const pct = (r.count / totalFailed) * 100}
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[12px]" style="color: var(--text-primary);">{r.reason}</span>
              <span class="text-[11px] font-mono" style="color: var(--error);">{r.count} ({pct.toFixed(0)}%)</span>
            </div>
            <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--surface-3);">
              <div class="h-full rounded-full" style="background: var(--error); width: {pct}%; opacity: 0.6;"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Recent proofs -->
  <div class="p-5 rounded-[8px]" style="background: var(--surface-1); border: 1px solid var(--border-default);">
    <h3 class="text-[13px] font-semibold mb-3" style="color: var(--text-primary);">Recent Proofs</h3>
    {#if data.recentProofs.length === 0}
      <p class="text-[12px]" style="color: var(--text-tertiary);">No proofs submitted yet.</p>
    {:else}
      <div class="space-y-0 rounded-[6px] overflow-hidden" style="border: 1px solid var(--border-default);">
        {#each data.recentProofs as p, idx}
          {@const si = statusIcons[p.status] ?? statusIcons.pending}
          <div class="flex items-center gap-3 px-3 py-2.5" style="{idx < data.recentProofs.length - 1 ? 'border-bottom: 1px solid var(--border-default);' : ''}">
            {#if p.status === 'verified'}
              <CheckCircle2 class="h-3.5 w-3.5 flex-shrink-0" style="color: {si.color};" />
            {:else if p.status === 'rejected'}
              <XCircle class="h-3.5 w-3.5 flex-shrink-0" style="color: {si.color};" />
            {:else if p.status === 'pending'}
              <Clock class="h-3.5 w-3.5 flex-shrink-0" style="color: {si.color};" />
            {:else}
              <AlertTriangle class="h-3.5 w-3.5 flex-shrink-0" style="color: {si.color};" />
            {/if}
            <span class="text-[12px] font-mono truncate flex-1" style="color: var(--text-primary);">{p.id}</span>
            <span class="text-[11px] font-mono" style="color: var(--text-tertiary);">{p.minerId}</span>
            <span class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-[3px]" style="background: {p.status === 'verified' ? 'rgba(76,183,130,0.12)' : p.status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'var(--surface-3)'}; color: {si.color};">{p.status}</span>
            <span class="text-[10px] font-mono" style="color: var(--text-tertiary);">{new Date(p.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
