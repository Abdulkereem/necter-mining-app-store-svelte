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

  const inp = 'n-input';
</script>

{#if !app}
  <div class="min-h-screen animate-fadeIn">
    <div class="p-6">
      <p class="text-[13px] text-[var(--text-secondary)]">Project not found.</p>
      <a href="/develop" class="text-[13px] text-[var(--text-accent)] no-underline">Back to Dashboard</a>
    </div>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn">
    <div class="max-w-[960px] mx-auto p-6">

      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <a href="/develop" class="w-7 h-7 flex items-center justify-center rounded-[5px] no-underline">
            <ArrowLeft class="w-4 h-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
          </a>
          <img src={iconSrc} alt={app.name} width="44" height="44" class="rounded-[12px]" />
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-[18px] font-semibold text-[var(--text-primary)]">{app.name}</h1>
              <span class="text-[11px] font-medium px-2 py-0.5 rounded-[3px]" style="background: {isLive ? 'rgba(76,183,130,0.12)' : isReview ? 'rgba(242,153,74,0.12)' : 'var(--surface-3)'}; color: {isLive ? 'var(--success)' : isReview ? 'var(--warning)' : 'var(--text-secondary)'};">
                {isLive ? 'Live' : isReview ? 'In Review' : 'Draft'}
              </span>
            </div>
            <p class="text-[12px] text-[var(--text-tertiary)]">{app.category}</p>
          </div>
        </div>
        {#if isLive}
          <a href="/apps/{id}" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-[5px] text-[12px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] no-underline">
            <Eye size={12} strokeWidth={1.5} /> View on Store
          </a>
        {/if}
        {#if isDraft}
          <a href="/develop/apps/{id}/preview" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-[5px] text-[12px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] no-underline">
            <Eye size={12} strokeWidth={1.5} /> Preview
          </a>
        {/if}
      </div>

      <!-- Tab bar -->
      <div class="flex gap-1 mb-5 border-b border-[var(--border-default)]">
        {#each tabs as t}
          <button type="button" onclick={() => activeTab = t.id}
            class="h-[34px] px-3.5 text-[13px] font-medium cursor-pointer border-none bg-transparent transition-all -mb-px" style="border-bottom: {activeTab === t.id ? '2px solid var(--accent-base)' : '2px solid transparent'}; color: {activeTab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)'}">
            {t.label}
          </button>
        {/each}
      </div>

      <!-- OVERVIEW TAB -->
      {#if activeTab === 'overview'}
        <div class="flex flex-col gap-4">

          <!-- DRAFT: Checklist + Submit -->
          {#if isDraft}
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-[14px] font-semibold text-[var(--text-primary)]">Launch Checklist</h3>
                <span class="text-[12px] font-mono" style="color: {readyCount === checklist.length ? 'var(--success)' : 'var(--text-secondary)'};">{readyCount}/{checklist.length}</span>
              </div>
              <div class="h-[3px] rounded-sm bg-[var(--surface-3)] mb-3.5">
                <div class="h-[3px] rounded-sm transition-all" style="background: {readyCount === checklist.length ? 'var(--success)' : 'var(--accent-base)'}; width: {(readyCount / checklist.length) * 100}%; transition: width 300ms;"></div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                {#each checklist as item}
                  <span class="inline-flex items-center gap-[5px] px-2.5 py-1 rounded text-[12px]" style="background: {item.done ? 'rgba(76,183,130,0.08)' : 'var(--surface-2)'}; color: {item.done ? 'var(--success)' : 'var(--text-tertiary)'};">
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

            <div class="flex items-center justify-between bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
              <div>
                <p class="text-[13px] font-medium text-[var(--text-primary)]">Ready to go live?</p>
                <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">Submit for governance review. Auto-approves in demo mode.</p>
              </div>
              <button type="button" onclick={handleSubmitForReview} class="h-8 px-4 rounded-[6px] text-[12px] font-semibold bg-[var(--accent-base)] text-[#0C0C0E] border-none cursor-pointer flex items-center gap-1.5 shrink-0">
                <Send size={12} strokeWidth={1.5} /> Submit for Review
              </button>
            </div>

            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
              <p class="text-[12px] text-[var(--text-secondary)] leading-[18px]">{app.description || 'No description yet. Add one in Settings.'}</p>
            </div>
          {/if}

          <!-- IN REVIEW: Waiting state -->
          {#if isReview}
            <div class="bg-[var(--surface-1)] border border-[var(--border-accent)] rounded-[8px] p-8 text-center">
              <Clock size={32} strokeWidth={1.5} class="text-[var(--text-accent)] mx-auto mb-3" />
              <h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1.5">Under Governance Review</h3>
              <p class="text-[13px] text-[var(--text-tertiary)] max-w-[360px] mx-auto leading-5">
                Reviewers are checking security, economics, and package integrity. This auto-approves in a few seconds in demo mode.
              </p>
              <div class="flex justify-center gap-1.5 mt-4">
                {#each [0, 1, 2] as i}
                  <div class="w-10 h-1 rounded-sm bg-[var(--surface-3)] overflow-hidden">
                    <div class="w-full h-full bg-[var(--accent-base)]" style="animation: pulse 2s {i * 0.3}s infinite;"></div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- LIVE: Stats + Activity -->
          {#if isLive}
            <div class="grid grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
              {#each [
                { label: 'Miners', value: activeMiners.toLocaleString(), accent: false },
                { label: 'Proofs', value: verifiedProofs.toLocaleString(), accent: false },
                { label: 'Earned', value: `$${totalEarned.toFixed(0)}`, accent: true },
                { label: 'Rating', value: avgRating, accent: false },
              ] as s}
                <div class="bg-[var(--surface-1)] px-4 py-3.5">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{s.label}</span>
                  <p class="text-[20px] font-semibold font-mono mt-1" style="color: {s.accent ? 'var(--text-accent)' : 'var(--text-primary)'}">{s.value}</p>
                </div>
              {/each}
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
                <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-2">About</h3>
                <p class="text-[12px] text-[var(--text-secondary)] leading-[18px]">{app.description}</p>
                {#if app.tags && app.tags.length > 0}
                  <div class="flex gap-1 flex-wrap mt-2.5">
                    {#each app.tags as t}
                      <span class="text-[10px] font-medium px-2 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[var(--text-secondary)]">{t}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
                <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-2.5">Recent Activity</h3>
                {#if subs.length === 0 && proofs.length === 0}
                  <p class="text-[12px] text-[var(--text-tertiary)]">Waiting for miners...</p>
                {:else}
                  <div class="flex flex-col gap-1">
                    {#each subs.slice(0, 4) as s}
                      <div class="flex justify-between py-1 border-b border-[var(--border-default)] text-[12px]">
                        <span class="text-[var(--text-secondary)]">Miner subscribed</span>
                        <span class="text-[var(--text-tertiary)] font-mono">{new Date(s.subscribedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    {/each}
                    {#each proofs.slice(0, 3) as p}
                      <div class="flex justify-between py-1 border-b border-[var(--border-default)] text-[12px]">
                        <span style="color: {p.status === 'verified' ? 'var(--success)' : 'var(--text-secondary)'};">Proof {p.status}</span>
                        <span class="text-[var(--text-tertiary)] font-mono">${p.reward.toFixed(2)}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>

            <!-- Announcements -->
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
              <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-2.5">Post an Update</h3>
              <div>
                <textarea bind:value={announcementText} placeholder="Write an update for your miners..." rows="2"
                  class="w-full px-3 py-2.5 border border-[var(--border-default)] rounded-[6px] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] leading-5 resize-none outline-none font-inherit mb-2"></textarea>
                <button type="button" onclick={handlePostAnnouncement}
                  class="h-7 px-3 rounded-[5px] border-none bg-[var(--accent-base)] text-[#0C0C0E] text-[12px] font-semibold cursor-pointer">
                  Post Update
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- ANALYTICS TAB -->
      {#if activeTab === 'analytics'}
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
            {#each [
              { label: 'Total Revenue', value: `$${totalEarned.toFixed(0)}`, accent: true },
              { label: 'Avg Daily', value: `$${(app.avgEarningsPerDay ?? 0).toFixed(0)}`, accent: false },
              { label: 'Proof Success', value: proofs.length > 0 ? `${Math.round((verifiedProofs / proofs.length) * 100)}%` : '—', accent: false },
              { label: 'Active Miners', value: activeMiners.toLocaleString(), accent: false },
            ] as s}
              <div class="bg-[var(--surface-1)] px-4 py-3.5">
                <span class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{s.label}</span>
                <p class="text-[20px] font-semibold font-mono mt-1" style="color: {s.accent ? 'var(--text-accent)' : 'var(--text-primary)'}">{s.value}</p>
              </div>
            {/each}
          </div>

          <!-- Revenue chart placeholder -->
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
            <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-1">Revenue (30 days)</h3>
            <p class="text-[11px] text-[var(--text-tertiary)] mb-3">Daily earnings from verified proofs</p>
            <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-0)] overflow-hidden">
              <AreaChart data={revenueChartData} labels={revenueChartLabels} color="#FFBF00" height={208} />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <!-- Miner growth placeholder -->
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
              <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-1">Miner Growth (12 weeks)</h3>
              <p class="text-[11px] text-[var(--text-tertiary)] mb-3">Weekly active miner count</p>
              <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-0)] overflow-hidden">
                <AreaChart data={minerGrowthData} labels={minerGrowthLabels} color="#6E9FFF" height={160} />
              </div>
            </div>

            <!-- Proof breakdown -->
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
              <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-3">Proof Breakdown</h3>
              <div class="flex flex-col gap-2.5">
                {#each [
                  { label: 'Verified', count: verifiedProofs, color: 'var(--success)' },
                  { label: 'Pending', count: pendingCount, color: 'var(--text-secondary)' },
                  { label: 'Rejected', count: rejectedCount, color: 'var(--error)' },
                ] as row}
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[12px] text-[var(--text-secondary)]">{row.label}</span>
                      <span class="text-[13px] font-mono font-semibold text-[var(--text-primary)]">{row.count}</span>
                    </div>
                    <div class="h-1 rounded-sm bg-[var(--surface-3)]">
                      <div class="h-1 rounded-sm" style="background: {row.color}; width: {proofs.length > 0 ? (row.count / proofs.length) * 100 : 0}%; transition: width 300ms;"></div>
                    </div>
                  </div>
                {/each}
              </div>

              <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mt-4 mb-2">Recent Payouts</h3>
              <div class="flex flex-col gap-0.5">
                {#each proofs.filter((p) => p.status === 'verified').slice(0, 5) as p}
                  <div class="flex justify-between py-1 border-b border-[var(--border-default)] text-[12px]">
                    <span class="font-mono text-[var(--text-tertiary)]">{p.hash.slice(0, 10)}...</span>
                    <span class="font-mono text-[var(--success)] font-medium">+${p.reward.toFixed(2)}</span>
                  </div>
                {/each}
                {#if verifiedProofs === 0}
                  <p class="text-[12px] text-[var(--text-tertiary)]">No payouts yet.</p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- MINERS TAB -->
      {#if activeTab === 'miners'}
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
            {#each [
              { label: 'Total', value: subs.length, color: null },
              { label: 'Active', value: subs.filter((s) => s.status === 'active').length, color: 'var(--success)' },
              { label: 'Paused', value: subs.filter((s) => s.status === 'paused').length, color: null },
              { label: 'Avg Uptime', value: subs.length > 0 ? `${(subs.reduce((s, sub) => s + (sub.uptime || 0), 0) / subs.length).toFixed(1)}%` : '—', color: null },
            ] as s}
              <div class="bg-[var(--surface-1)] px-4 py-3.5">
                <span class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{s.label}</span>
                <p class="text-[20px] font-semibold font-mono mt-1" style="color: {s.color || 'var(--text-primary)'}">{s.value}</p>
              </div>
            {/each}
          </div>
          {#if subs.length > 0}
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
              <div class="grid px-4 py-2 border-b border-[var(--border-default)]" style="grid-template-columns: 1fr 100px 80px 80px 80px;">
                {#each ['Miner', 'Subscribed', 'Status', 'Uptime', 'Earned'] as h}
                  <span class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{h}</span>
                {/each}
              </div>
              {#each subs as sub}
                <div class="miner-row px-4 py-2.5 border-b border-[var(--border-default)] text-[12px] grid" style="grid-template-columns: 1fr 100px 80px 80px 80px;">
                  <span class="font-mono text-[var(--text-primary)] flex items-center gap-2">
                    <img src={minerAvatarDataUri(sub.minerId)} alt="" class="w-5 h-5 rounded shrink-0" />{sub.minerId}
                  </span>
                  <span class="text-[var(--text-tertiary)]">{new Date(sub.subscribedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span class="inline-flex items-center gap-[5px]">
                    <span class="w-1.5 h-1.5 rounded-full" style="background: {sub.status === 'active' ? 'var(--success)' : 'var(--text-tertiary)'};"></span>
                    <span class="capitalize" style="color: {sub.status === 'active' ? 'var(--success)' : 'var(--text-tertiary)'};">{sub.status}</span>
                  </span>
                  <span class="font-mono text-[var(--text-secondary)]">{(sub.uptime || 0).toFixed(1)}%</span>
                  <span class="font-mono text-[var(--text-accent)]">${(sub.totalEarned || 0).toFixed(2)}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] text-center p-8">
              <p class="text-[13px] text-[var(--text-tertiary)]">No miners have subscribed yet. Once your project is live, miners will appear here.</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- VERSIONS TAB -->
      {#if activeTab === 'versions'}
        <div class="flex flex-col gap-2.5">
          {#each [
            { version: 'v1.2.0', date: 'Mar 20, 2026', current: true, notes: 'Performance improvements, new proof verification algorithm' },
            { version: 'v1.1.0', date: 'Mar 5, 2026', current: false, notes: 'Added GPU support, fixed memory leak in task runner' },
            { version: 'v1.0.0', date: 'Feb 1, 2026', current: false, notes: 'Initial release' },
          ] as v}
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 flex items-start gap-3">
              <div class="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0" style="background: {v.current ? 'var(--accent-subtle)' : 'var(--surface-3)'}">
                {#if v.current}
                  <CheckCircle2 size={14} strokeWidth={2} class="text-[var(--text-accent)]" />
                {:else}
                  <Package size={14} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
                {/if}
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-[13px] font-semibold font-mono text-[var(--text-primary)]">{v.version}</span>
                  {#if v.current}
                    <span class="text-[10px] font-medium px-1.5 py-px rounded-[3px] bg-[var(--accent-subtle)] text-[var(--text-accent)]">Current</span>
                  {/if}
                </div>
                <p class="text-[12px] text-[var(--text-secondary)] mb-0.5">{v.notes}</p>
                <span class="text-[11px] text-[var(--text-tertiary)]">{v.date}</span>
              </div>
            </div>
          {/each}
          <a href="/develop/apps/{id}/settings" class="flex items-center justify-center h-9 rounded-[6px] text-[12px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] no-underline">
            Upload New Version &rarr;
          </a>
        </div>
      {/if}

      <!-- SETTINGS TAB -->
      {#if activeTab === 'settings'}
        <div class="flex flex-col gap-4">
          <!-- General -->
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
            <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-3.5">General</h3>
            <div class="flex flex-col gap-3">
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">Project Name</label>
                <input type="text" bind:value={settingsName} class={inp} />
              </div>
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">Description</label>
                <textarea bind:value={settingsDescription} rows="3" class="n-textarea"></textarea>
              </div>
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">Features</label>
                <textarea bind:value={settingsFeaturesStr} rows="3" placeholder="One feature per line" class="n-textarea font-mono"></textarea>
                <p class="text-[11px] text-[var(--text-tertiary)] mt-1">One per line. Shown on the app detail page.</p>
              </div>
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">Tags</label>
                <input type="text" bind:value={settingsTagsStr} placeholder="IoT, DePIN, Wireless" class={inp} />
                <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Comma-separated. Used for search and filtering.</p>
              </div>
            </div>
          </div>

          <!-- Economics -->
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
            <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-3.5">Economics</h3>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">Base Reward / Task</label>
                <input type="number" bind:value={settingsBaseReward} class={inp} />
              </div>
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">Escrow Balance</label>
                <input type="number" bind:value={settingsEscrowBalance} class={inp} />
              </div>
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">Daily Emission</label>
                <input type="number" bind:value={settingsDailyEmission} class={inp} />
              </div>
            </div>
          </div>

          <!-- Hardware -->
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
            <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-3.5">Hardware Requirements</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">GPU</label>
                <input type="text" bind:value={settingsGpuReq} placeholder="e.g. NVIDIA RTX 3080+" class={inp} />
              </div>
              <div>
                <label class="text-[11px] text-[var(--text-tertiary)] block mb-1">RAM</label>
                <input type="text" bind:value={settingsRamReq} placeholder="e.g. 16GB" class={inp} />
              </div>
            </div>
          </div>

          <!-- Save + Advanced -->
          <div class="flex items-center justify-between">
            <a href="/develop/apps/{id}/settings" class="text-[12px] text-[var(--text-tertiary)] no-underline">
              Advanced settings &rarr;
            </a>
            <button type="button" onclick={handleSettingsSave}
              class="h-9 px-5 rounded-[6px] text-[13px] font-semibold bg-[var(--accent-base)] text-[#0C0C0E] border-none cursor-pointer flex items-center gap-1.5">
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
