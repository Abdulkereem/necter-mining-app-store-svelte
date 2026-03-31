<script>
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { appIconDataUri } from '$lib/app-icon';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import {
    ArrowLeft, Send, ExternalLink, CheckCircle2, Circle, Clock,
    Shield, DollarSign, Package, BarChart3, Users, Settings, Eye, Megaphone, Save,
  } from 'lucide-svelte';
  import AreaChart from '$lib/components/AreaChart.svelte';

  // Mock revenue data (30 days)
  const revenueChartLabels = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const revenueChartData = Array.from({ length: 30 }, (_, i) => +(12 + Math.sin(i * 0.35) * 6 + Math.random() * 4).toFixed(2));

  // Mock miner growth data (12 weeks)
  const minerGrowthLabels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
  const minerGrowthData = Array.from({ length: 12 }, (_, i) => Math.floor(8 + i * 3.5 + Math.sin(i * 0.6) * 4 + Math.random() * 3));

  const id = $derived($page.params.id);
  const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);
  const listingStatus = $derived($backendState.listingStatusByAppId[id] ?? 'draft');
  const devWalletAddress = $derived($actor?.walletAddress ?? null);

  let activeTab = $state('overview');

  const iconSrc = $derived(
    app && app.icon && app.icon !== '/placeholder.svg'
      ? app.icon
      : appIconDataUri({ id: id, name: app?.name ?? '' })
  );
  const subs = $derived($backendState.subscriptions.filter((s) => s.appId === id));
  const activeMiners = $derived(subs.filter((s) => s.status === 'active').length);
  const proofs = $derived($backendState.proofs.filter((p) => p.appId === id));
  const verifiedProofs = $derived(proofs.filter((p) => p.status === 'verified').length);
  const totalEarned = $derived(proofs.filter((p) => p.status === 'verified').reduce((s, p) => s + p.reward, 0));
  const reviews = $derived((app)?.reviews ?? []);
  const avgRating = $derived(reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—');
  const isDraft = $derived(listingStatus === 'draft');
  const isReview = $derived(listingStatus === 'pending_governance');
  const isLive = $derived(listingStatus === 'listed' || listingStatus === 'beta');

  // Draft checklist
  const hasDescription = $derived((app?.description ?? '').length > 20);
  const hasIcon = $derived(!!app?.icon && app.icon !== '/placeholder.svg');
  const hasScreenshots = $derived(Array.isArray(app?.screenshots) && app.screenshots.length > 0);
  const hasFeatures = $derived(Array.isArray(app?.features) && app.features.length > 0);
  const hasEconomics = $derived((app?.avgEarningsPerDay ?? 0) > 0);
  const checklist = $derived([
    { label: 'Description', done: hasDescription },
    { label: 'Icon', done: hasIcon },
    { label: 'Screenshots', done: hasScreenshots },
    { label: 'Features', done: hasFeatures },
    { label: 'Economics', done: hasEconomics },
  ]);
  const readyCount = $derived(checklist.filter((c) => c.done).length);

  function handleSubmitForReview() {
    if (!devWalletAddress || !app) return;
    try {
      const ver = backend.getDeveloperVerification(devWalletAddress);
      if (!ver || ver.status !== 'verified') {
        try { backend.requestDeveloperVerification({ walletAddress: devWalletAddress }); } catch {}
        try { backend.reviewDeveloperVerification({ walletAddress: devWalletAddress, status: 'verified' }); } catch {}
      }
      backend.publishAppDraft({ app, listingStatus: 'pending_governance' });
    } catch (e) {
      console.error('Submit for review failed:', e);
    }
  }

  const tabs = $derived(
    isDraft
      ? [{ id: 'overview', label: 'Overview' }, { id: 'settings', label: 'Settings' }]
      : isReview
        ? [{ id: 'overview', label: 'Overview' }]
        : [{ id: 'overview', label: 'Overview' }, { id: 'analytics', label: 'Analytics' }, { id: 'miners', label: 'Miners' }, { id: 'versions', label: 'Versions' }, { id: 'settings', label: 'Settings' }]
  );

  // Analytics tab mock data
  const revenueData = $derived(
    app ? Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      const base = app.avgEarningsPerDay * (0.6 + Math.random() * 0.8);
      return { date: d.toISOString().slice(5, 10), revenue: Number(base.toFixed(2)), miners: Math.max(1, Math.floor(activeMiners * (0.7 + Math.random() * 0.6))) };
    }) : []
  );
  const pendingCount = $derived(proofs.filter((p) => p.status === 'pending').length);
  const rejectedCount = $derived(proofs.filter((p) => p.status === 'rejected').length);

  // Inline settings state
  let settingsName = $state('');
  let settingsDescription = $state('');
  let settingsFeaturesStr = $state('');
  let settingsTagsStr = $state('');
  let settingsGpuReq = $state('');
  let settingsRamReq = $state('');
  let settingsEscrowBalance = $state(0);
  let settingsDailyEmission = $state(0);
  let settingsBaseReward = $state(0.5);

  $effect(() => {
    if (!app) return;
    settingsName = app.name;
    settingsDescription = app.description;
    settingsFeaturesStr = Array.isArray(app.features) ? app.features.join('\n') : '';
    settingsTagsStr = Array.isArray(app.tags) ? app.tags.join(', ') : '';
    settingsGpuReq = app.requirements?.gpu ?? '';
    settingsRamReq = app.requirements?.ram ?? '';
    settingsEscrowBalance = typeof app.escrowBalance === 'number' ? app.escrowBalance : 0;
    settingsDailyEmission = typeof app.dailyEmission === 'number' ? app.dailyEmission : 0;
    settingsBaseReward = typeof app.baseRewardPerTask === 'number' ? app.baseRewardPerTask : 0.5;
  });

  function handleSettingsSave() {
    if (!app) return;
    try {
      backend.updateApp(id, {
        name: settingsName, description: settingsDescription,
        features: settingsFeaturesStr.split('\n').map((f) => f.trim()).filter(Boolean),
        tags: settingsTagsStr.split(',').map((t) => t.trim()).filter(Boolean),
        requirements: { ...app.requirements, gpu: settingsGpuReq || undefined, ram: settingsRamReq || undefined },
        escrowBalance: settingsEscrowBalance, dailyEmission: settingsDailyEmission, baseRewardPerTask: settingsBaseReward,
      });
    } catch (e) {
      console.error('Settings save failed:', e);
    }
  }

  // Announcement form
  let announcementText = $state('');
  function handlePostAnnouncement() {
    if (!announcementText.trim()) return;
    announcementText = '';
  }

  const inp = 'width: 100%; height: 36px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--surface-0); color: var(--text-primary); font-size: 13px; font-family: inherit; outline: none;';
</script>

{#if !app}
  <div class="min-h-screen animate-fadeIn">
    <div style="padding: 24px;">
      <p style="font-size: 13px; color: var(--text-secondary);">Network not found.</p>
      <a href="/develop" style="font-size: 13px; color: var(--text-accent); text-decoration: none;">Back to Dashboard</a>
    </div>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn">
    <div style="max-width: 960px; margin: 0 auto; padding: 24px;">

      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <a href="/develop" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 5px; text-decoration: none;">
            <ArrowLeft style="width: 16px; height: 16px; color: var(--text-tertiary);" strokeWidth={1.5} />
          </a>
          <img src={iconSrc} alt={app.name} width="44" height="44" style="border-radius: 12px;" />
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0;">{app.name}</h1>
              <span style="font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 3px; background: {isLive ? 'rgba(76,183,130,0.12)' : isReview ? 'rgba(242,153,74,0.12)' : 'var(--surface-3)'}; color: {isLive ? 'var(--success)' : isReview ? 'var(--warning)' : 'var(--text-secondary)'};">
                {isLive ? 'Live' : isReview ? 'In Review' : 'Draft'}
              </span>
            </div>
            <p style="font-size: 12px; color: var(--text-tertiary); margin: 0;">{app.category}</p>
          </div>
        </div>
        {#if isLive}
          <a href="/apps/{id}" style="display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 5px; font-size: 12px; font-weight: 500; background: var(--surface-2); border: 1px solid var(--border-default); color: var(--text-secondary); text-decoration: none;">
            <Eye size={12} strokeWidth={1.5} /> View on Store
          </a>
        {/if}
        {#if isDraft}
          <a href="/develop/apps/{id}/preview" style="display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 5px; font-size: 12px; font-weight: 500; background: var(--surface-2); border: 1px solid var(--border-default); color: var(--text-secondary); text-decoration: none;">
            <Eye size={12} strokeWidth={1.5} /> Preview
          </a>
        {/if}
      </div>

      <!-- Tab bar -->
      <div style="display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--border-default); padding-bottom: 0;">
        {#each tabs as t}
          <button type="button" onclick={() => activeTab = t.id}
            style="height: 34px; padding: 0 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; border-bottom: {activeTab === t.id ? '2px solid var(--accent-base)' : '2px solid transparent'}; background: transparent; color: {activeTab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)'}; transition: all 100ms; margin-bottom: -1px;">
            {t.label}
          </button>
        {/each}
      </div>

      <!-- OVERVIEW TAB -->
      {#if activeTab === 'overview'}
        <div style="display: flex; flex-direction: column; gap: 16px;">

          <!-- DRAFT: Checklist + Submit -->
          {#if isDraft}
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h3 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">Launch Checklist</h3>
                <span style="font-size: 12px; font-family: var(--font-mono); color: {readyCount === checklist.length ? 'var(--success)' : 'var(--text-secondary)'};">{readyCount}/{checklist.length}</span>
              </div>
              <div style="height: 3px; border-radius: 2px; background: var(--surface-3); margin-bottom: 14px;">
                <div style="height: 3px; border-radius: 2px; background: {readyCount === checklist.length ? 'var(--success)' : 'var(--accent-base)'}; width: {(readyCount / checklist.length) * 100}%; transition: width 300ms;"></div>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                {#each checklist as item}
                  <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 4px; font-size: 12px; background: {item.done ? 'rgba(76,183,130,0.08)' : 'var(--surface-2)'}; color: {item.done ? 'var(--success)' : 'var(--text-tertiary)'};">
                    {#if item.done}
                      <CheckCircle2 size={12} strokeWidth={2} />
                    {:else}
                      <Circle size={12} strokeWidth={1.5} />
                    {/if}
                    {item.label}
                  </span>
                {/each}
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
              <div>
                <p style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin: 0;">Ready to go live?</p>
                <p style="font-size: 12px; color: var(--text-tertiary); margin: 2px 0 0;">Submit for governance review. Auto-approves in demo mode.</p>
              </div>
              <button type="button" onclick={handleSubmitForReview} style="height: 32px; padding: 0 16px; border-radius: 6px; font-size: 12px; font-weight: 600; background: var(--accent-base); color: #0C0C0E; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <Send size={12} strokeWidth={1.5} /> Submit for Review
              </button>
            </div>

            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
              <p style="font-size: 12px; color: var(--text-secondary); line-height: 18px; margin: 0;">{app.description || 'No description yet. Add one in Settings.'}</p>
            </div>
          {/if}

          <!-- IN REVIEW: Waiting state -->
          {#if isReview}
            <div style="background: var(--surface-1); border: 1px solid var(--border-accent); border-radius: 8px; padding: 32px; text-align: center;">
              <Clock size={32} strokeWidth={1.5} style="color: var(--text-accent); margin: 0 auto 12px;" />
              <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0 0 6px;">Under Governance Review</h3>
              <p style="font-size: 13px; color: var(--text-tertiary); max-width: 360px; margin: 0 auto; line-height: 20px;">
                Reviewers are checking security, economics, and package integrity. This auto-approves in a few seconds in demo mode.
              </p>
              <div style="display: flex; justify-content: center; gap: 6px; margin-top: 16px;">
                {#each [0, 1, 2] as i}
                  <div style="width: 40px; height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden;">
                    <div style="width: 100%; height: 100%; background: var(--accent-base); animation: pulse 2s {i * 0.3}s infinite;"></div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- LIVE: Stats + Activity -->
          {#if isLive}
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;">
              {#each [
                { label: 'Miners', value: activeMiners.toLocaleString(), accent: false },
                { label: 'Proofs', value: verifiedProofs.toLocaleString(), accent: false },
                { label: 'Earned', value: `$${totalEarned.toFixed(0)}`, accent: true },
                { label: 'Rating', value: avgRating, accent: false },
              ] as s}
                <div style="background: var(--surface-1); padding: 14px 16px;">
                  <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary);">{s.label}</span>
                  <p style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: {s.accent ? 'var(--text-accent)' : 'var(--text-primary)'}; margin: 4px 0 0;">{s.value}</p>
                </div>
              {/each}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
                <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 8px;">About</h3>
                <p style="font-size: 12px; color: var(--text-secondary); line-height: 18px; margin: 0;">{app.description}</p>
                {#if app.tags && app.tags.length > 0}
                  <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 10px;">
                    {#each app.tags as t}
                      <span style="font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 3px; background: var(--surface-3); color: var(--text-secondary);">{t}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
                <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 10px;">Recent Activity</h3>
                {#if subs.length === 0 && proofs.length === 0}
                  <p style="font-size: 12px; color: var(--text-tertiary);">Waiting for miners...</p>
                {:else}
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    {#each subs.slice(0, 4) as s}
                      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-default); font-size: 12px;">
                        <span style="color: var(--text-secondary);">Miner subscribed</span>
                        <span style="color: var(--text-tertiary); font-family: var(--font-mono);">{new Date(s.subscribedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    {/each}
                    {#each proofs.slice(0, 3) as p}
                      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-default); font-size: 12px;">
                        <span style="color: {p.status === 'verified' ? 'var(--success)' : 'var(--text-secondary)'};">Proof {p.status}</span>
                        <span style="color: var(--text-tertiary); font-family: var(--font-mono);">${p.reward.toFixed(2)}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>

            <!-- Announcements -->
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
              <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 10px;">Post an Update</h3>
              <div>
                <textarea bind:value={announcementText} placeholder="Write an update for your miners..." rows="2"
                  style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-default); border-radius: 6px; background: var(--surface-0); color: var(--text-primary); font-size: 13px; line-height: 20px; resize: none; outline: none; font-family: inherit; margin-bottom: 8px;"></textarea>
                <button type="button" onclick={handlePostAnnouncement}
                  style="height: 28px; padding: 0 12px; border-radius: 5px; border: none; background: var(--accent-base); color: #0C0C0E; font-size: 12px; font-weight: 600; cursor: pointer;">
                  Post Update
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- ANALYTICS TAB -->
      {#if activeTab === 'analytics'}
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;">
            {#each [
              { label: 'Total Revenue', value: `$${totalEarned.toFixed(0)}`, accent: true },
              { label: 'Avg Daily', value: `$${(app.avgEarningsPerDay ?? 0).toFixed(0)}`, accent: false },
              { label: 'Proof Success', value: proofs.length > 0 ? `${Math.round((verifiedProofs / proofs.length) * 100)}%` : '—', accent: false },
              { label: 'Active Miners', value: activeMiners.toLocaleString(), accent: false },
            ] as s}
              <div style="background: var(--surface-1); padding: 14px 16px;">
                <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary);">{s.label}</span>
                <p style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: {s.accent ? 'var(--text-accent)' : 'var(--text-primary)'}; margin: 4px 0 0;">{s.value}</p>
              </div>
            {/each}
          </div>

          <!-- Revenue chart placeholder -->
          <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
            <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 4px;">Revenue (30 days)</h3>
            <p style="font-size: 11px; color: var(--text-tertiary); margin: 0 0 12px;">Daily earnings from verified proofs</p>
            <div style="border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-0); overflow: hidden;">
              <AreaChart data={revenueChartData} labels={revenueChartLabels} color="#FFBF00" height={208} />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <!-- Miner growth placeholder -->
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
              <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 4px;">Miner Growth (12 weeks)</h3>
              <p style="font-size: 11px; color: var(--text-tertiary); margin: 0 0 12px;">Weekly active miner count</p>
              <div style="border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-0); overflow: hidden;">
                <AreaChart data={minerGrowthData} labels={minerGrowthLabels} color="#6E9FFF" height={160} />
              </div>
            </div>

            <!-- Proof breakdown -->
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
              <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 12px;">Proof Breakdown</h3>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                {#each [
                  { label: 'Verified', count: verifiedProofs, color: 'var(--success)' },
                  { label: 'Pending', count: pendingCount, color: 'var(--text-secondary)' },
                  { label: 'Rejected', count: rejectedCount, color: 'var(--error)' },
                ] as row}
                  <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                      <span style="font-size: 12px; color: var(--text-secondary);">{row.label}</span>
                      <span style="font-size: 13px; font-family: var(--font-mono); font-weight: 600; color: var(--text-primary);">{row.count}</span>
                    </div>
                    <div style="height: 4px; border-radius: 2px; background: var(--surface-3);">
                      <div style="height: 4px; border-radius: 2px; background: {row.color}; width: {proofs.length > 0 ? (row.count / proofs.length) * 100 : 0}%; transition: width 300ms;"></div>
                    </div>
                  </div>
                {/each}
              </div>

              <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin: 16px 0 8px;">Recent Payouts</h3>
              <div style="display: flex; flex-direction: column; gap: 3px;">
                {#each proofs.filter((p) => p.status === 'verified').slice(0, 5) as p}
                  <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-default); font-size: 12px;">
                    <span style="font-family: var(--font-mono); color: var(--text-tertiary);">{p.hash.slice(0, 10)}...</span>
                    <span style="font-family: var(--font-mono); color: var(--success); font-weight: 500;">+${p.reward.toFixed(2)}</span>
                  </div>
                {/each}
                {#if verifiedProofs === 0}
                  <p style="font-size: 12px; color: var(--text-tertiary);">No payouts yet.</p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- MINERS TAB -->
      {#if activeTab === 'miners'}
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;">
            {#each [
              { label: 'Total', value: subs.length, color: null },
              { label: 'Active', value: subs.filter((s) => s.status === 'active').length, color: 'var(--success)' },
              { label: 'Paused', value: subs.filter((s) => s.status === 'paused').length, color: null },
              { label: 'Avg Uptime', value: subs.length > 0 ? `${(subs.reduce((s, sub) => s + (sub.uptime || 0), 0) / subs.length).toFixed(1)}%` : '—', color: null },
            ] as s}
              <div style="background: var(--surface-1); padding: 14px 16px;">
                <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary);">{s.label}</span>
                <p style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: {s.color || 'var(--text-primary)'}; margin: 4px 0 0;">{s.value}</p>
              </div>
            {/each}
          </div>
          {#if subs.length > 0}
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 0; overflow: hidden;">
              <div style="display: grid; grid-template-columns: 1fr 100px 80px 80px 80px; padding: 8px 16px; border-bottom: 1px solid var(--border-default);">
                {#each ['Miner', 'Subscribed', 'Status', 'Uptime', 'Earned'] as h}
                  <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary);">{h}</span>
                {/each}
              </div>
              {#each subs as sub}
                <div class="miner-row" style="display: grid; grid-template-columns: 1fr 100px 80px 80px 80px; padding: 10px 16px; border-bottom: 1px solid var(--border-default); font-size: 12px;">
                  <span style="font-family: var(--font-mono); color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <img src={minerAvatarDataUri(sub.minerId)} alt="" style="width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;" />{sub.minerId}
                  </span>
                  <span style="color: var(--text-tertiary);">{new Date(sub.subscribedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span style="display: inline-flex; align-items: center; gap: 5px;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: {sub.status === 'active' ? 'var(--success)' : 'var(--text-tertiary)'};"></span>
                    <span style="color: {sub.status === 'active' ? 'var(--success)' : 'var(--text-tertiary)'}; text-transform: capitalize;">{sub.status}</span>
                  </span>
                  <span style="font-family: var(--font-mono); color: var(--text-secondary);">{(sub.uptime || 0).toFixed(1)}%</span>
                  <span style="font-family: var(--font-mono); color: var(--text-accent);">${(sub.totalEarned || 0).toFixed(2)}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; text-align: center; padding: 32px;">
              <p style="font-size: 13px; color: var(--text-tertiary);">No miners have subscribed yet. Once your network is live, miners will appear here.</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- VERSIONS TAB -->
      {#if activeTab === 'versions'}
        <div style="display: flex; flex-direction: column; gap: 10px;">
          {#each [
            { version: 'v1.2.0', date: 'Mar 20, 2026', current: true, notes: 'Performance improvements, new proof verification algorithm' },
            { version: 'v1.1.0', date: 'Mar 5, 2026', current: false, notes: 'Added GPU support, fixed memory leak in task runner' },
            { version: 'v1.0.0', date: 'Feb 1, 2026', current: false, notes: 'Initial release' },
          ] as v}
            <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; display: flex; align-items: start; gap: 12px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: {v.current ? 'var(--accent-subtle)' : 'var(--surface-3)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                {#if v.current}
                  <CheckCircle2 size={14} strokeWidth={2} style="color: var(--text-accent);" />
                {:else}
                  <Package size={14} strokeWidth={1.5} style="color: var(--text-tertiary);" />
                {/if}
              </div>
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                  <span style="font-size: 13px; font-weight: 600; font-family: var(--font-mono); color: var(--text-primary);">{v.version}</span>
                  {#if v.current}
                    <span style="font-size: 10px; font-weight: 500; padding: 1px 6px; border-radius: 3px; background: var(--accent-subtle); color: var(--text-accent);">Current</span>
                  {/if}
                </div>
                <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 2px;">{v.notes}</p>
                <span style="font-size: 11px; color: var(--text-tertiary);">{v.date}</span>
              </div>
            </div>
          {/each}
          <a href="/develop/apps/{id}/settings" style="display: flex; align-items: center; justify-content: center; height: 36px; border-radius: 6px; font-size: 12px; font-weight: 500; background: var(--surface-2); border: 1px solid var(--border-default); color: var(--text-secondary); text-decoration: none;">
            Upload New Version &rarr;
          </a>
        </div>
      {/if}

      <!-- SETTINGS TAB -->
      {#if activeTab === 'settings'}
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- General -->
          <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
            <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 14px;">General</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">Network Name</label>
                <input type="text" bind:value={settingsName} style={inp} />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">Description</label>
                <textarea bind:value={settingsDescription} rows="3" style="width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--surface-0); color: var(--text-primary); font-size: 13px; font-family: inherit; outline: none; line-height: 1.5; resize: vertical;"></textarea>
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">Features</label>
                <textarea bind:value={settingsFeaturesStr} rows="3" placeholder="One feature per line" style="width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--surface-0); color: var(--text-primary); font-size: 13px; font-family: var(--font-mono); outline: none; line-height: 1.5; resize: vertical;"></textarea>
                <p style="font-size: 11px; color: var(--text-tertiary); margin: 4px 0 0;">One per line. Shown on the app detail page.</p>
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">Tags</label>
                <input type="text" bind:value={settingsTagsStr} placeholder="IoT, DePIN, Wireless" style={inp} />
                <p style="font-size: 11px; color: var(--text-tertiary); margin: 4px 0 0;">Comma-separated. Used for search and filtering.</p>
              </div>
            </div>
          </div>

          <!-- Economics -->
          <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
            <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 14px;">Economics</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">Base Reward / Task</label>
                <input type="number" bind:value={settingsBaseReward} style={inp} />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">Escrow Balance</label>
                <input type="number" bind:value={settingsEscrowBalance} style={inp} />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">Daily Emission</label>
                <input type="number" bind:value={settingsDailyEmission} style={inp} />
              </div>
            </div>
          </div>

          <!-- Hardware -->
          <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
            <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); margin-bottom: 14px;">Hardware Requirements</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">GPU</label>
                <input type="text" bind:value={settingsGpuReq} placeholder="e.g. NVIDIA RTX 3080+" style={inp} />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 4px;">RAM</label>
                <input type="text" bind:value={settingsRamReq} placeholder="e.g. 16GB" style={inp} />
              </div>
            </div>
          </div>

          <!-- Save + Advanced -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <a href="/develop/apps/{id}/settings" style="font-size: 12px; color: var(--text-tertiary); text-decoration: none;">
              Advanced settings &rarr;
            </a>
            <button type="button" onclick={handleSettingsSave}
              style="height: 36px; padding: 0 20px; border-radius: 6px; font-size: 13px; font-weight: 600; background: var(--accent-base); color: #0C0C0E; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <Save size={14} strokeWidth={2} /> Save Changes
            </button>
          </div>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  .miner-row:hover {
    background: var(--surface-2);
  }
</style>
