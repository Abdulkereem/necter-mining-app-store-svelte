<script>
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { appIconDataUri } from '$lib/app-icon';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import { ArrowLeft } from 'lucide-svelte';

  const minerId = $derived($page.params.id);

  const subs = $derived($backendState.subscriptions.filter((s) => s.minerId === minerId));
  const appsById = $derived(new Map($backendState.apps.map((a) => [a.id, a])));
  const proofs = $derived($backendState.proofs.filter((p) => p.minerId === minerId));
  const badges = $derived(backend.listBadges(minerId));
  const reputation = $derived($backendState.minerReputationByMinerId?.[minerId] ?? 0);

  const totalEarned = $derived(subs.reduce((sum, s) => sum + (s.totalEarned ?? 0), 0));
  const avgUptime = $derived(subs.length > 0 ? subs.reduce((sum, s) => sum + s.uptime, 0) / subs.length : 0);
  const totalTasks = $derived(subs.reduce((sum, s) => sum + (s.tasksCompleted ?? 0), 0));
  const verifiedProofs = $derived(proofs.filter((p) => p.status === 'verified').length);

  const kindColors = {
    milestone: 'var(--accent-base)',
    performance: 'var(--success)',
    governance: 'var(--info)',
    community: 'var(--warning)',
  };
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
  <div style="max-width: 1152px; margin: 0 auto;">

    <!-- Back -->
    <a
      href="/leaderboards"
      style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); text-decoration: none; margin-bottom: 16px;"
    >
      <ArrowLeft style="width: 12px; height: 12px;" strokeWidth={1.5} />
      Back to Leaderboards
    </a>

    <!-- Profile header -->
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
        <img src={minerAvatarDataUri(minerId)} alt="" style="width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0;" />
        <div>
          <h1 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 0;">
            {minerId}
          </h1>
          <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px;">
            {subs.length} network{subs.length !== 1 ? 's' : ''} - Reputation {reputation}
          </p>
        </div>
      </div>

      <!-- Stats -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: var(--border-default); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-default);">
        {#each [
          { label: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, accent: true },
          { label: 'Avg Uptime', value: `${avgUptime.toFixed(1)}%`, accent: false },
          { label: 'Tasks', value: totalTasks.toLocaleString(), accent: false },
          { label: 'Proofs Verified', value: verifiedProofs.toLocaleString(), accent: false },
          { label: 'Badges', value: badges.length.toString(), accent: false },
        ] as s}
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

    <!-- Active Networks -->
    <div style="margin-bottom: 24px;">
      <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">
        Active Networks ({subs.length})
      </p>
      {#if subs.length > 0}
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          {#each subs as sub}
            {@const app = appsById.get(sub.appId)}
            {#if app}
              <a
                href="/apps/{app.id}"
                style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; text-decoration: none; transition: border-color 100ms ease-out;"
              >
                <img
                  src={app.icon && app.icon !== '/placeholder.svg' ? app.icon : appIconDataUri({ id: app.id, name: app.name })}
                  alt={app.name}
                  width="36"
                  height="36"
                  style="border-radius: 5px; flex-shrink: 0;"
                />
                <div style="flex: 1; min-width: 0;">
                  <p style="font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{app.name}</p>
                  <p style="font-size: 11px; color: var(--text-tertiary);">{app.category}</p>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <p style="font-size: 12px; font-family: var(--font-mono); color: var(--text-accent); font-feature-settings: 'tnum' 1;">
                    ${(sub.totalEarned ?? 0).toFixed(2)}
                  </p>
                  <p style="font-size: 11px; font-family: var(--font-mono); color: var(--text-tertiary); font-feature-settings: 'tnum' 1;">
                    {sub.uptime.toFixed(1)}% uptime
                  </p>
                </div>
              </a>
            {/if}
          {/each}
        </div>
      {:else}
        <p style="font-size: 13px; color: var(--text-tertiary);">No active networks.</p>
      {/if}
    </div>

    <!-- Badges -->
    {#if badges.length > 0}
      <div>
        <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">
          Badges ({badges.length})
        </p>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
          {#each badges as b}
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; text-align: center;">
              <div
                class="clip-hex"
                style="width: 40px; height: 40px; background: {kindColors[b.kind] || 'var(--accent-base)'}; margin: 0 auto 8px; opacity: 0.2;"
              ></div>
              <p style="font-size: 13px; font-weight: 500; color: var(--text-primary);">{b.name}</p>
              <p style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">{b.description}</p>
              <span style="display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; color: {kindColors[b.kind] || 'var(--text-tertiary)'};">
                {b.kind}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
