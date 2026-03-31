<script>
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { appIconDataUri } from '$lib/app-icon';
  import { ArrowLeft, Heart, Shield, Zap, Users, AlertTriangle, CheckCircle2 } from 'lucide-svelte';

  const id = $derived($page.params.id);
  const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);
  const health = $derived(backend.getProjectHealthScore(id));

  const iconSrc = $derived(
    app && app.icon && app.icon !== '/placeholder.svg'
      ? app.icon
      : appIconDataUri({ id: id, name: app?.name ?? '' })
  );

  const statusConfig = {
    healthy: { label: 'Healthy', color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
    warning: { label: 'Warning', color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)' },
    critical: { label: 'Critical', color: 'var(--error)', bg: 'rgba(239,68,68,0.12)' },
  };

  const sc = $derived(statusConfig[health.status]);

  const circ = $derived(2 * Math.PI * 60);
  const scoreOffset = $derived(circ - (health.overall / 100) * circ);

  const metricIcons = { Zap, Shield, Users, Heart };

  const metrics = $derived([
    { label: 'Uptime', value: health.uptime, iconName: 'Zap', color: health.uptime >= 95 ? 'var(--success)' : 'var(--warning)' },
    { label: 'Proof Rate', value: health.proofRate, iconName: 'Shield', color: health.proofRate >= 90 ? 'var(--success)' : 'var(--warning)' },
    { label: 'Miner Satisfaction', value: health.minerSatisfaction, iconName: 'Users', color: health.minerSatisfaction >= 70 ? 'var(--success)' : 'var(--warning)' },
    { label: 'Reward Health', value: health.rewardHealth, iconName: 'Heart', color: health.rewardHealth >= 70 ? 'var(--success)' : 'var(--warning)' },
  ]);

  const methodology = [
    { label: 'Uptime', weight: '30%', desc: 'Average miner uptime across all subscribers' },
    { label: 'Proof Rate', weight: '30%', desc: 'Percentage of proofs that pass verification' },
    { label: 'Miner Satisfaction', weight: '20%', desc: 'Based on average miner review rating' },
    { label: 'Reward Health', weight: '20%', desc: 'Active miners and reward distribution consistency' },
  ];
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
      <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Project Health</h1>
      <p class="text-[12px] text-[var(--text-secondary)]">{app?.name ?? id}</p>
    </div>
    <div class="ml-auto">
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-semibold" style="background: {sc.bg}; color: {sc.color};">
        {#if health.status === 'healthy'}
          <CheckCircle2 class="h-3.5 w-3.5" />
        {:else}
          <AlertTriangle class="h-3.5 w-3.5" />
        {/if}
        {sc.label}
      </span>
    </div>
  </div>

  <!-- Overall score -->
  <div class="p-6 rounded-[8px] mb-6 text-center" style="background: var(--surface-1); border: 1px solid var(--border-default);">
    <div class="relative inline-flex items-center justify-center" style="width: 140px; height: 140px;">
      <svg width="140" height="140" style="transform: rotate(-90deg); position: absolute;">
        <circle cx="70" cy="70" r="60" fill="none" stroke="var(--surface-3)" stroke-width="10" />
        <circle cx="70" cy="70" r="60" fill="none" stroke={sc.color} stroke-width="10"
          stroke-dasharray={circ} stroke-dashoffset={scoreOffset}
          stroke-linecap="round" style="transition: stroke-dashoffset 600ms ease-out;" />
      </svg>
      <div class="flex flex-col items-center">
        <span class="text-[36px] font-bold font-mono" style="color: {sc.color};">{health.overall}</span>
        <span class="text-[10px] uppercase tracking-wide" style="color: var(--text-tertiary);">Overall</span>
      </div>
    </div>
  </div>

  <!-- Metric breakdown -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    {#each metrics as m}
      <div class="p-4 rounded-[8px] text-center" style="background: var(--surface-1); border: 1px solid var(--border-default);">
        {#if m.iconName === 'Zap'}
          <Zap class="h-5 w-5 mx-auto mb-2" style="color: {m.color};" strokeWidth={1.5} />
        {:else if m.iconName === 'Shield'}
          <Shield class="h-5 w-5 mx-auto mb-2" style="color: {m.color};" strokeWidth={1.5} />
        {:else if m.iconName === 'Users'}
          <Users class="h-5 w-5 mx-auto mb-2" style="color: {m.color};" strokeWidth={1.5} />
        {:else}
          <Heart class="h-5 w-5 mx-auto mb-2" style="color: {m.color};" strokeWidth={1.5} />
        {/if}
        <p class="text-[24px] font-bold font-mono" style="color: {m.color};">{m.value}%</p>
        <p class="text-[11px] mt-1" style="color: var(--text-tertiary);">{m.label}</p>
        <div class="h-1.5 rounded-full overflow-hidden mt-2" style="background: var(--surface-3);">
          <div class="h-full rounded-full transition-all" style="width: {m.value}%; background: {m.color};"></div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Score breakdown explanation -->
  <div class="p-5 rounded-[8px] mb-6" style="background: var(--surface-1); border: 1px solid var(--border-default);">
    <h3 class="text-[13px] font-semibold mb-3" style="color: var(--text-primary);">How it's calculated</h3>
    <div class="space-y-2">
      {#each methodology as item}
        <div class="flex items-center gap-3 p-2 rounded-[5px]" style="background: var(--surface-2);">
          <span class="text-[11px] font-mono font-semibold w-10" style="color: var(--text-accent);">{item.weight}</span>
          <span class="text-[12px] font-medium w-36" style="color: var(--text-primary);">{item.label}</span>
          <span class="text-[11px]" style="color: var(--text-tertiary);">{item.desc}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Issues -->
  {#if health.issues.length > 0}
    <div class="p-5 rounded-[8px]" style="background: var(--surface-1); border: 1px solid var(--border-default);">
      <h3 class="text-[13px] font-semibold mb-3" style="color: var(--text-primary);">Issues to Address</h3>
      <div class="space-y-2">
        {#each health.issues as issue}
          <div class="flex items-center gap-2 p-2.5 rounded-[5px]" style="background: rgba(242,153,74,0.08); border: 1px solid rgba(242,153,74,0.2);">
            <AlertTriangle class="h-3.5 w-3.5 flex-shrink-0" style="color: var(--warning);" />
            <span class="text-[12px]" style="color: var(--text-primary);">{issue}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
