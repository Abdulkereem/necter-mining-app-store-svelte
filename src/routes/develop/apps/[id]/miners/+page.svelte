<script>
  import { page } from '$app/stores';
  import { backendState } from '$lib/stores/backend';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import { ArrowLeft } from 'lucide-svelte';

  const id = $derived($page.params.id);
  const app = $derived($backendState.apps.find((a) => a.id === id));
  const subs = $derived($backendState.subscriptions.filter((s) => s.appId === id));
  const activeSubs = $derived(subs.filter((s) => s.status === 'active').length);
  const pausedSubs = $derived(subs.filter((s) => s.status === 'paused').length);
  const avgUptime = $derived(
    subs.length > 0
      ? (subs.reduce((s, sub) => s + (sub.uptime || 0), 0) / subs.length).toFixed(1)
      : '—'
  );
</script>

<div class="min-h-screen animate-fadeIn">
  <div style="padding: 24px 24px 48px;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <a href="/develop/apps/{id}" style="height: 28px; width: 28px; display: flex; align-items: center; justify-content: center; border-radius: 5px; text-decoration: none;">
        <ArrowLeft style="height: 16px; width: 16px; color: var(--text-tertiary);" strokeWidth={1.5} />
      </a>
      <div>
        <h1 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 0;">Miners</h1>
        <p style="font-size: 12px; color: var(--text-tertiary); margin: 0;">{subs.length} total subscribers</p>
      </div>
    </div>

    <!-- Stats -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
      <div style="border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-1); padding: 16px;">
        <p style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px;">Active</p>
        <p style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: var(--success); margin: 0;">{activeSubs}</p>
      </div>
      <div style="border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-1); padding: 16px;">
        <p style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px;">Paused</p>
        <p style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: var(--text-primary); margin: 0;">{pausedSubs}</p>
      </div>
      <div style="border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-1); padding: 16px;">
        <p style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px;">Avg Uptime</p>
        <p style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: var(--text-primary); margin: 0;">{avgUptime}%</p>
      </div>
    </div>

    <!-- Miner list -->
    {#if subs.length > 0}
      <div style="border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-1); overflow: hidden;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 8px 16px; border-bottom: 1px solid var(--border-default); font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;">
          <span>Miner ID</span>
          <span>Status</span>
          <span>Uptime</span>
          <span>Earned</span>
        </div>
        {#each subs as sub}
          <div class="miner-row" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--border-default); font-size: 12px;">
            <span style="display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <img src={minerAvatarDataUri(sub.minerId)} alt="" style="width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;" />{sub.minerId}
            </span>
            <span style="color: {sub.status === 'active' ? 'var(--success)' : 'var(--text-tertiary)'};">{sub.status}</span>
            <span style="font-family: var(--font-mono); color: var(--text-secondary);">{(sub.uptime || 0).toFixed(1)}%</span>
            <span style="font-family: var(--font-mono); color: var(--text-accent);">${(sub.totalEarned || 0).toFixed(2)}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div style="border-radius: 8px; border: 1px dashed var(--border-default); background: var(--surface-1); padding: 32px; text-align: center;">
        <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">No miners have subscribed yet.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .miner-row:last-child {
    border-bottom: none;
  }
  .miner-row:hover {
    background: var(--surface-2);
    transition: background 100ms;
  }
</style>
