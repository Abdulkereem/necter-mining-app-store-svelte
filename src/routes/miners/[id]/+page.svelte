<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft } from 'lucide-svelte';
  import { hub } from '$lib/api/hub';
  import { useQuery } from '$lib/api/query.svelte';
  import type { Device } from '$lib/api/types';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import { bpToPercent, formatNumber, formatDate, shortAddress, timeAgo, DEVICE_CLASS_LABEL } from '$lib/format';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import CopyText from '$lib/components/common/CopyText.svelte';

  const nodeId = $derived(page.params.id ?? '');
  const device = useQuery(() => hub.device(nodeId));

  const PLATFORM_LABEL: Record<NonNullable<Device['platform']>, string> = {
    android: 'Android',
    ios: 'iOS',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux'
  };
  const STATUS_META: Record<Device['status'], { label: string; color: string }> = {
    online: { label: 'Online', color: 'var(--success)' },
    idle: { label: 'Idle', color: 'var(--text-accent)' },
    offline: { label: 'Offline', color: 'var(--text-tertiary)' },
    faulty: { label: 'Faulty', color: 'var(--warning)' },
    banned: { label: 'Banned', color: 'var(--error)' }
  };
</script>

<svelte:head>
  <title>{nodeId} — Miner · Necter</title>
</svelte:head>

<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12">
  <div style="max-width: 1152px; margin: 0 auto;">

    <!-- Back -->
    <a
      href="/leaderboards"
      style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); text-decoration: none; margin-bottom: 16px;"
    >
      <ArrowLeft style="width: 12px; height: 12px;" strokeWidth={1.5} />
      Back to Leaderboards
    </a>

    {#if device.loading}
      <LoadingBlock rows={3} height="96px" />
    {:else if device.error}
      <ErrorState error={device.error} retry={device.refresh} />
    {:else if !device.data}
      <EmptyState
        illustration="compute"
        title="Device not found"
        description="No miner device with this node id is registered on the testnet. Node ids look like ndsr- followed by 16 hex characters."
      >
        <a href="/leaderboards" class="btn-secondary">Back to Leaderboards</a>
      </EmptyState>
    {:else}
      {@const d = device.data}
      {@const st = STATUS_META[d.status]}
      <!-- Profile header -->
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
          <img src={minerAvatarDataUri(d.node_id)} alt="" style="width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0;" />
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h1 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 0; font-family: var(--font-mono);">
                {d.node_id}
              </h1>
              <span style="display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 6px; border-radius: 3px; font-size: 11px; font-weight: 500; background: var(--surface-3); color: {st.color};">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: {st.color};"></span>
                {st.label}
              </span>
            </div>
            <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px;">
              {d.class ? DEVICE_CLASS_LABEL[d.class] : 'Device'}{d.platform ? ` · ${PLATFORM_LABEL[d.platform]}` : ''}{d.region ? ` · ${d.region}` : ''}
              {#if d.last_seen_at} · last seen {timeAgo(d.last_seen_at)}{/if}
            </p>
            {#if d.owner}
              <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">
                Owned by
                <a href="/profiles/{d.owner.toLowerCase()}" style="color: var(--text-accent); font-family: var(--font-mono);">{shortAddress(d.owner)}</a>
              </p>
            {/if}
          </div>
        </div>

        <!-- Stats -->
        <div class="miner-stats">
          {#each [
            { label: 'Units (7d)', value: formatNumber(d.units_7d), accent: true },
            { label: 'Uptime (7d)', value: bpToPercent(d.uptime_bp_7d), accent: false },
            { label: 'Benchmark', value: d.benchmark ? formatNumber(d.benchmark.score) : '—', accent: false },
            { label: 'Subscriptions', value: formatNumber(d.subscriptions?.length ?? 0), accent: false },
            { label: 'Since', value: formatDate(d.created_at), accent: false },
          ] as s (s.label)}
            <div style="background: var(--surface-1); padding: 14px 16px;">
              <span style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">
                {s.label}
              </span>
              <span style="display: block; font-size: 18px; font-weight: 600; font-family: var(--font-mono); color: {s.accent ? 'var(--text-accent)' : 'var(--text-primary)'}; margin-top: 4px; font-feature-settings: 'tnum' 1;">
                {s.value}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Runtime -->
      <div style="margin-bottom: 24px;">
        <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">Runtime</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          {#each [
            { label: 'Miner version', value: d.miner_version ?? '—' },
            { label: 'NDSR version', value: d.ndsr_version ?? '—' },
            { label: 'Engine', value: d.engine ?? d.benchmark?.engine ?? '—' },
            { label: 'Architecture', value: d.arch ?? '—' },
          ] as r (r.label)}
            <div style="padding: 12px; background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px;">
              <p style="font-size: 11px; color: var(--text-tertiary);">{r.label}</p>
              <p style="font-size: 13px; font-family: var(--font-mono); color: var(--text-primary); margin-top: 2px;">{r.value}</p>
            </div>
          {/each}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; color: var(--text-tertiary);">
          Node key <CopyText value={d.public_key} />
        </div>
        {#if d.status_reason}
          <p style="font-size: 12px; color: var(--warning); margin-top: 8px;">{d.status_reason}</p>
        {/if}
      </div>

      {#if d.benchmark}
        <div>
          <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">
            Benchmark ({d.benchmark.suite})
          </p>
          <div style="padding: 12px 16px; background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            Score <span style="font-family: var(--font-mono); color: var(--text-primary);">{formatNumber(d.benchmark.score)}</span>
            · {d.benchmark.cases.length} cases · ran {timeAgo(d.benchmark.ran_at)} on {d.benchmark.engine}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .miner-stats {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1px;
    background: var(--border-default);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-default);
  }
  @media (max-width: 720px) {
    .miner-stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
