<script>
  import { page } from '$app/stores';
  import { backendState } from '$lib/stores/backend';
  import { appIconDataUri } from '$lib/app-icon';
  import { getAppScreenshots } from '$lib/app-screenshots';
  import { ArrowLeft, Star, Users, TrendingUp, Shield, CheckCircle2 } from 'lucide-svelte';

  const id = $derived($page.params.id);
  const app = $derived($backendState.apps.find((a) => String(a.id) === String(id)) ?? null);

  const iconSrc = $derived(
    app && app.icon && app.icon !== '/placeholder.svg'
      ? app.icon
      : appIconDataUri({ id: id, name: app?.name ?? '' })
  );
  const screenshots = $derived(app ? getAppScreenshots(app) : []);
  const features = $derived(app?.features ?? []);
  const tags = $derived(app?.tags ?? []);

  const quickStats = $derived(
    app ? [
      { label: 'Earnings / Day', value: `$${app.avgEarningsPerDay.toFixed(2)}`, sub: 'avg per miner' },
      { label: 'Reputation', value: `${(app.averageRating || 4.5).toFixed(1)}/5`, sub: 'avg rating' },
      { label: 'Miners', value: app.totalMiners >= 1000 ? `${(app.totalMiners / 1000).toFixed(1)}K` : String(app.totalMiners), sub: 'active nodes' },
      { label: 'Uptime SLA', value: `${app.slaRequirements?.minUptime ?? 95}%`, sub: 'minimum required' },
      { label: 'Attestations', value: String(app.attestations), sub: 'on-chain verified' },
    ] : []
  );

  const hwReqs = $derived(
    app ? [
      { label: 'GPU', value: app.requirements?.gpu ?? '—' },
      { label: 'CPU', value: app.requirements?.cpu ?? '—' },
      { label: 'RAM', value: app.requirements?.ram ?? '—' },
      { label: 'Storage', value: app.requirements?.storage ?? '—' },
    ] : []
  );

  const techInfo = $derived(
    app ? [
      { label: 'Category', value: app.category },
      { label: 'Reward Token', value: app.rewardToken ?? 'NCR' },
      { label: 'Reward Model', value: app.rewardModel ?? '—' },
    ] : []
  );

  const screenshotsList = $derived(
    app && Array.isArray(app.screenshots) && app.screenshots.length > 0
      ? app.screenshots
      : screenshots
  );
  const hasScreenshots = $derived(screenshotsList.length > 0);
</script>

{#if !app}
  <div style="padding: 24px; color: var(--text-secondary); font-size: 13px;">
    Network not found.
    <a href="/develop" style="color: var(--text-accent); text-decoration: none;">Back to Dashboard</a>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn" style="background: var(--surface-0);">
    <!-- Preview Banner -->
    <div style="background: rgba(110,159,255,0.10); border-bottom: 1px solid rgba(110,159,255,0.25); padding: 10px 24px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--info); box-shadow: 0 0 6px var(--info);"></div>
        <span style="font-size: 13px; font-weight: 600; color: var(--info);">Preview Mode</span>
        <span style="font-size: 12px; color: var(--text-secondary);">This is how miners will see your network</span>
      </div>
      <a href="/develop/apps/{id}" style="display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 5px; font-size: 12px; font-weight: 500; background: var(--surface-2); border: 1px solid var(--border-default); color: var(--text-secondary); text-decoration: none;">
        <ArrowLeft style="width: 12px; height: 12px;" strokeWidth={1.5} />
        Back to Developer View
      </a>
    </div>

    <!-- Main content -->
    <div style="max-width: 960px; margin: 0 auto; padding: 32px 24px;">
      <!-- Header -->
      <div style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 28px;">
        <img src={iconSrc} alt={app.name} width="64" height="64" style="border-radius: 12px; flex-shrink: 0;" />
        <div style="flex: 1; min-width: 0;">
          <h1 style="font-size: 24px; font-weight: 600; letter-spacing: -0.02em; color: var(--text-primary); margin: 0; line-height: 32px;">
            {app.name}
          </h1>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 2px 0 0;">
            {app.developer}
          </p>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
            <!-- Stars -->
            <div style="display: flex; align-items: center; gap: 3px;">
              {#each Array(5) as _, i}
                <Star size={12} strokeWidth={0} fill={i < Math.round(app.averageRating || 4.5) ? 'var(--accent-base)' : 'var(--surface-3)'} />
              {/each}
              <span style="font-size: 12px; color: var(--text-secondary); font-family: var(--font-mono); margin-left: 3px;">
                {(app.averageRating || 4.5).toFixed(1)}
              </span>
            </div>
            <span style="color: var(--border-strong); font-size: 12px;">·</span>
            <span style="display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 3px; font-size: 11px; font-weight: 500; background: var(--accent-subtle); color: var(--text-accent);">
              {app.category}
            </span>
            <!-- Subscribe button (disabled in preview) -->
            <button disabled style="margin-left: auto; height: 28px; padding: 0 14px; border-radius: 5px; font-size: 12px; font-weight: 600; background: var(--accent-base); color: #0C0C0E; border: none; opacity: 0.5; cursor: not-allowed;">
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 32px;">
        {#each quickStats as s}
          <div style="background: var(--surface-2); border: 1px solid var(--border-default); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary);">{s.label}</span>
            <span style="font-size: 16px; font-weight: 600; font-family: var(--font-mono); color: var(--text-primary);">{s.value}</span>
            {#if s.sub}
              <span style="font-size: 11px; color: var(--text-tertiary);">{s.sub}</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Description -->
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <p style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 12px;">Description</p>
        <p style="font-size: 13px; color: var(--text-secondary); line-height: 20px; margin: 0;">
          {app.description}
        </p>
      </div>

      <!-- Two columns: Features + Tags -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <!-- Features -->
        <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
          <p style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 12px;">Network Features</p>
          {#if features.length > 0}
            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
              {#each features as f}
                <li style="display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                  <CheckCircle2 size={13} strokeWidth={1.5} style="color: var(--success); flex-shrink: 0; margin-top: 2px;" />
                  {f}
                </li>
              {/each}
            </ul>
          {:else}
            <p style="font-size: 12px; color: var(--text-tertiary);">No features listed yet.</p>
          {/if}
        </div>

        <!-- Tags + Technical -->
        <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
          <p style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 12px;">Tags & Info</p>
          {#if tags.length > 0}
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px;">
              {#each tags as t}
                <span style="font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 3px; background: var(--surface-3); color: var(--text-secondary);">{t}</span>
              {/each}
            </div>
          {:else}
            <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px;">No tags yet.</p>
          {/if}
          <div style="display: flex; flex-direction: column; gap: 10px;">
            {#each techInfo as row}
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; color: var(--text-tertiary);">{row.label}</span>
                <span style="font-size: 13px; color: var(--text-primary); font-weight: 500;">{row.value}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Screenshots -->
      {#if hasScreenshots}
        <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <p style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 12px;">Screenshots</p>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
            {#each screenshotsList as src, idx}
              <img src={src} alt="Screenshot {idx + 1}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-default);" />
            {/each}
          </div>
        </div>
      {/if}

      <!-- Hardware Requirements -->
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
        <p style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 12px;">Hardware Requirements</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          {#each hwReqs as row}
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-default);">
              <span style="font-size: 13px; color: var(--text-tertiary);">{row.label}</span>
              <span style="font-size: 13px; color: var(--text-primary); font-weight: 500; font-family: var(--font-mono);">{row.value}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
