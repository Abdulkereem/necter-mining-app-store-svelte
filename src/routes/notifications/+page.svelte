<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { getAppIcon } from '$lib/app-icon';
  import { onMount } from 'svelte';
  import {
    Bell,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    Download,
    CreditCard,
    Shield,
    Lock,
    ChevronDown,
    ChevronRight,
  } from 'lucide-svelte';
  import { Button, Card, StatCard } from '$lib/components/ui';

  // ─── Settings ────────────────────────────────────────────────────────────────
  const defaultSettings = [
    { id: 'updates', label: 'App Updates', desc: 'Deploys, mining packages, and runtime changes', enabled: true },
    { id: 'earnings', label: 'Earnings', desc: 'Payouts and withdrawals', enabled: true },
    { id: 'subscriptions', label: 'Subscriptions', desc: 'Subscribe, pause/resume, blocked reasons', enabled: true },
    { id: 'proofs', label: 'Proofs', desc: 'Proof submitted/verified/disputed', enabled: true },
    { id: 'governance', label: 'Governance', desc: 'Listing approvals/rejections and attestations', enabled: true },
    { id: 'security', label: 'Security', desc: 'Slashing and risk events', enabled: true },
    { id: 'staking', label: 'Staking', desc: 'Governance stake lock and return events', enabled: true },
  ];

  let settings = $state(defaultSettings.map((s) => ({ ...s })));
  let activeFilter = $state('all');
  let readIds = $state([]);
  let deletedIds = $state([]);
  let expandedGroups = $state(new Set());

  // ─── Constants ─────────────────────────────────────────────────────────────
  const COLLAPSE_THRESHOLD = 5;

  const MINING_PAGE_TYPES = new Set([
    'job_queued', 'job_started', 'job_completed', 'job_failed',
    'proof_submitted', 'proof_verified', 'proof_disputed', 'proof_dispute_resolved',
  ]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function mapEventToUiType(type) {
    if (type.startsWith('withdrawal_') || type === 'payout_distributed') return 'earnings';
    if (type.startsWith('subscription_')) return 'subscription';
    if (type === 'slash_applied') return 'slashing';
    if (type.startsWith('mining_package_') || type.startsWith('deploy_') || type.startsWith('attestation_oracle_')) return 'update';
    if (type.startsWith('listing_') || type.startsWith('governance_') || type === 'app_submitted_for_governance') return 'governance';
    if (type.endsWith('_blocked') || type.includes('rejected') || type.includes('failed')) return 'alert';
    if (type.startsWith('proof_')) return 'proof';
    return 'system';
  }

  function titleForEvent(e) {
    const titles = {
      proof_verified: 'Proof verified',
      proof_submitted: 'Proof submitted',
      payout_distributed: 'Payout distributed',
      withdrawal_completed: 'Withdrawal completed',
      withdrawal_requested: 'Withdrawal requested',
      subscription_created: 'Subscribed to network',
      subscription_blocked: 'Subscription blocked',
      listing_approved: 'Listing approved',
      listing_rejected: 'Listing rejected',
      mining_package_uploaded: 'Mining package uploaded',
      mining_package_activated: 'Mining package activated',
    };
    return titles[e.type] ?? String(e.type).replaceAll('_', ' ');
  }

  function extractAmount(e) {
    const m = e.metadata;
    if (!m) return undefined;
    if (e.type === 'payout_distributed') return typeof m.minerAmount === 'number' ? m.minerAmount : typeof m.gross === 'number' ? m.gross : undefined;
    if (e.type === 'withdrawal_requested' || e.type === 'withdrawal_completed') return typeof m.amount === 'number' ? m.amount : undefined;
    if (e.type === 'slash_applied') return typeof m.amount === 'number' ? m.amount : undefined;
    if (typeof m.reward === 'number') return m.reward;
    return undefined;
  }

  function linkForEvent(n) {
    if (n.eventType === 'payout_distributed' || n.eventType === 'proof_verified' || n.eventType === 'proof_submitted') return '/mining';
    if (n.eventType.startsWith('subscription_') && n.appId) return `/apps/${n.appId}`;
    if (n.appId) return `/apps/${n.appId}`;
    return null;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function dayEarningsSummary(items) {
    const payouts = items.filter((n) => n.eventType === 'payout_distributed' && typeof n.amount === 'number');
    if (payouts.length === 0) return null;
    const total = payouts.reduce((s, n) => s + (n.amount ?? 0), 0);
    const projectIds = new Set(payouts.map((n) => n.appId).filter(Boolean));
    return { total: total.toFixed(2), projects: projectIds.size };
  }

  function aggregateEvents(items, dateKey) {
    const typeCounts = new Map();
    for (const n of items) {
      const key = n.eventType;
      if (!typeCounts.has(key)) typeCounts.set(key, []);
      typeCounts.get(key).push(n);
    }

    const result = [];
    const collapsedTypes = new Set();

    for (const [eventType, group] of typeCounts) {
      if (group.length >= COLLAPSE_THRESHOLD) {
        collapsedTypes.add(eventType);
        const projectIds = new Set(group.map((n) => n.appId).filter(Boolean));
        const totalAmount = group.filter((n) => typeof n.amount === 'number').reduce((s, n) => s + (n.amount ?? 0), 0);
        let summary = '';
        if (eventType === 'payout_distributed') {
          summary = `${group.length} payouts totaling ${totalAmount.toFixed(2)} NECTA across ${projectIds.size} project${projectIds.size !== 1 ? 's' : ''}`;
        } else if (eventType === 'proof_verified') {
          summary = `${group.length} proofs verified across ${projectIds.size} project${projectIds.size !== 1 ? 's' : ''}`;
        } else if (eventType === 'proof_submitted') {
          summary = `${group.length} proofs submitted across ${projectIds.size} project${projectIds.size !== 1 ? 's' : ''}`;
        } else {
          const label = eventType.replaceAll('_', ' ');
          summary = `${group.length} ${label} events`;
        }
        result.push({ kind: 'collapsed', eventType, items: group, summary });
      }
    }

    for (const n of items) {
      if (!collapsedTypes.has(n.eventType)) {
        result.push({ kind: 'single', item: n });
      }
    }

    result.sort((a, b) => {
      if (a.kind === 'collapsed' && b.kind === 'single') return -1;
      if (a.kind === 'single' && b.kind === 'collapsed') return 1;
      if (a.kind === 'single' && b.kind === 'single') {
        return new Date(b.item.timestamp).getTime() - new Date(a.item.timestamp).getTime();
      }
      return 0;
    });

    return result;
  }

  function toggleExpandGroup(key) {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedGroups = next;
  }

  // ─── Persist read/deleted state ──────────────────────────────────────────────
  const storageKey = $derived($actor?.walletAddress ? `necter_notifications_v1:${$actor.walletAddress}` : null);

  onMount(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      readIds = Array.isArray(parsed.readIds) ? parsed.readIds : [];
      deletedIds = Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [];
    } catch { /* ignore */ }
  });

  $effect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ readIds, deletedIds }));
    } catch { /* ignore */ }
  });

  // ─── Derived data ──────────────────────────────────────────────────────────
  const walletAddress = $derived($actor?.walletAddress ?? null);
  const minerId = $derived($actor?.minerId ?? null);
  const roles = $derived(walletAddress ? backend.listRoles(walletAddress) : []);
  const isDeveloper = $derived(roles.includes('developer'));
  const isGovernance = $derived(roles.includes('governance'));

  const developerAppIds = $derived(
    walletAddress
      ? new Set($backendState.apps.filter((a) => (a.developerAddress ?? '') === walletAddress).map((a) => a.id))
      : new Set()
  );

  const enabled = $derived(new Set(settings.filter((s) => s.enabled).map((s) => s.id)));

  const notifications = $derived.by(() => {
    if (!walletAddress && !minerId) return [];

    const readSet = new Set(readIds);
    const deletedSet = new Set(deletedIds);

    const filtered = $backendState.events.filter((e) => {
      if (deletedSet.has(e.id)) return false;
      const byMiner = minerId && e.minerId === minerId;
      const byWallet = walletAddress && e.walletAddress === walletAddress;
      const byDevApp = isDeveloper && e.appId && developerAppIds.has(e.appId);
      const byGov = isGovernance && (e.type.startsWith('listing_') || e.type.startsWith('governance_') || e.type === 'app_submitted_for_governance');
      return Boolean(byMiner || byWallet || byDevApp || byGov);
    });

    const allowType = (t) => {
      if (t === 'update') return enabled.has('updates');
      if (t === 'earnings') return enabled.has('earnings');
      if (t === 'subscription') return enabled.has('subscriptions');
      if (t === 'proof') return enabled.has('proofs');
      if (t === 'governance') return enabled.has('governance');
      if (t === 'staking') return enabled.has('staking');
      if (t === 'slashing' || t === 'alert') return enabled.has('security');
      return true;
    };

    return filtered
      .filter((e) => !MINING_PAGE_TYPES.has(e.type))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((e) => allowType(mapEventToUiType(e.type)))
      .slice(0, 100)
      .map((e) => ({
        id: e.id,
        type: mapEventToUiType(e.type),
        title: titleForEvent(e),
        message: e.message,
        appId: e.appId,
        timestamp: e.createdAt,
        read: readSet.has(e.id),
        amount: extractAmount(e),
        eventType: e.type,
      }));
  });

  const unreadCount = $derived(notifications.filter((n) => !n.read).length);

  // ─── Summary stats ──────────────────────────────────────────────────────────
  const summaryStats = $derived.by(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayEvents = notifications.filter((n) => new Date(n.timestamp).getTime() >= todayStart);
    const earningsToday = todayEvents
      .filter((n) => n.eventType === 'payout_distributed' && typeof n.amount === 'number')
      .reduce((sum, n) => sum + (n.amount ?? 0), 0);

    const devices = minerId ? backend.listDevices(minerId) : [];
    const activeDevices = devices.filter((d) => d.status === 'online').length;

    const subs = minerId
      ? $backendState.subscriptions.filter((s) => s.minerId === minerId && s.status === 'active')
      : [];

    return {
      earningsToday: earningsToday.toFixed(2),
      eventsToday: todayEvents.length,
      activeDevices,
      activeProjects: subs.length,
    };
  });

  // ─── Filtering ──────────────────────────────────────────────────────────────
  const filteredNotifications = $derived.by(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'alerts') return notifications.filter((n) => n.type === 'slashing' || n.type === 'alert');
    if (activeFilter === 'updates') return notifications.filter((n) => n.type === 'update');
    if (activeFilter === 'staking') return notifications.filter((n) => n.type === 'staking' || n.type === 'governance');
    return notifications.filter((n) => n.type === activeFilter);
  });

  // ─── Group by day ───────────────────────────────────────────────────────────
  const filteredGrouped = $derived.by(() => {
    const now = new Date();
    const todayKey = now.toDateString();
    const yesterdayKey = new Date(now.getTime() - 86400000).toDateString();
    const buckets = new Map();
    for (const n of filteredNotifications) {
      const key = new Date(n.timestamp).toDateString();
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(n);
    }
    const groups = [];
    for (const [key, items] of buckets) {
      const label = key === todayKey ? 'Today' : key === yesterdayKey ? 'Yesterday' : new Date(key).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      groups.push({ label, dateKey: key, items });
    }
    return groups;
  });

  // ─── Actions ─────────────────────────────────────────────────────────────────
  function markAllRead() {
    const next = new Set(readIds);
    for (const n of notifications) next.add(n.id);
    readIds = [...next];
  }

  function markAsRead(id) {
    if (readIds.includes(id)) return;
    readIds = [...readIds, id];
  }

  function toggleSetting(id) {
    settings = settings.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'subscription', label: 'Subscriptions' },
    { id: 'governance', label: 'Governance' },
    { id: 'staking', label: 'Staking' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'updates', label: 'Updates' },
  ];

  const summaryItems = $derived([
    { label: 'Earnings today', value: summaryStats.earningsToday, unit: 'NECTA' },
    { label: 'Events today', value: String(summaryStats.eventsToday), unit: undefined },
    { label: 'Active devices', value: String(summaryStats.activeDevices), unit: undefined },
    { label: 'Active projects', value: String(summaryStats.activeProjects), unit: undefined },
  ]);
</script>

<svelte:head>
  <title>Activity — Necter Mining App Store</title>
</svelte:head>

{#if !$actor}
  <!-- Not connected -->
  <div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
    <Card class="p-12 text-center">
      <Bell class="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-4" />
      <h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Connect a wallet</h3>
      <p class="text-[13px] text-[var(--text-secondary)]">Notifications are derived from your mining, developer, and governance activity.</p>
      <div class="mt-4">
        <Button onclick={() => showConnectModal.set(true)}>Connect wallet</Button>
      </div>
    </Card>
  </div>
{:else}
  <div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-8 pb-12 max-w-[720px] mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Activity</h1>
        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 hidden md:block">Your mining, earning, and governance events</p>
      </div>
      {#if unreadCount > 0}
        <Button variant="secondary" size="sm" onclick={markAllRead}>
          Mark all read
        </Button>
      {/if}
    </div>

    <!-- Summary stats bar -->
    <Card padding="p-0" class="overflow-hidden mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)]">
        {#each summaryItems as stat}
          <StatCard label={stat.label} value={stat.unit ? `${stat.value}` : stat.value} class="!rounded-none !border-0 px-3 md:px-4 py-3" />
        {/each}
      </div>
    </Card>

    <!-- Filters -->
    <div class="flex items-center gap-1 mb-5 overflow-x-auto mobile-tabs-scroll">
      {#each filters as f}
        <Button
          variant="ghost"
          size="sm"
          onclick={() => (activeFilter = f.id)}
          class="whitespace-nowrap flex-shrink-0 text-[12px] {activeFilter === f.id
            ? '!bg-[var(--accent-subtle)] !text-[var(--text-accent)]'
            : ''}"
        >
          {f.label}
        </Button>
      {/each}
    </div>

    <!-- Timeline -->
    {#if filteredNotifications.length === 0}
      <Card class="p-16 text-center">
        <p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
          {activeFilter === 'all' ? 'No activity yet' : `No ${activeFilter} events`}
        </p>
        <p class="text-[13px] text-[var(--text-secondary)] mb-4">
          {activeFilter === 'all' ? 'Start mining to see your events here.' : 'Try a different filter.'}
        </p>
        {#if activeFilter === 'all'}
          <a href="/discover"><Button>Discover projects</Button></a>
        {/if}
      </Card>
    {:else}
      <div class="space-y-6">
        {#each filteredGrouped as group (group.label)}
          {@const earnings = dayEarningsSummary(group.items)}
          {@const aggregated = aggregateEvents(group.items, group.dateKey)}
          <div>
            <!-- Day header -->
            <div class="flex items-center gap-3 mb-2">
              <span class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em]">{group.label}</span>
              <div class="flex-1 h-px bg-[var(--border-default)]"></div>
              <span class="text-[10px] text-[var(--text-tertiary)] font-mono">{group.items.length}</span>
            </div>

            <!-- Daily earnings summary -->
            {#if earnings}
              <div class="flex items-center gap-2 mb-2 px-1">
                <TrendingUp class="h-3 w-3 text-[var(--success)]" />
                <span class="text-[11px] text-[var(--text-secondary)]">
                  Earned <span class="font-mono font-semibold text-[var(--success)]">{earnings.total} NECTA</span> from {earnings.projects} project{earnings.projects !== 1 ? 's' : ''}
                </span>
              </div>
            {/if}

            <!-- Event cards -->
            <Card padding="p-0" class="overflow-hidden divide-y divide-[var(--border-default)]">
              {#each aggregated as entry}
                {#if entry.kind === 'collapsed'}
                  <!-- Collapsed group -->
                  {@const groupKey = `${group.dateKey}::${entry.eventType}`}
                  {@const isExpanded = expandedGroups.has(groupKey)}
                  {@const uiType = mapEventToUiType(entry.eventType)}
                  <div>
                    <button
                      type="button"
                      class="w-full flex items-center gap-3 py-3 px-3.5 hover:bg-[var(--surface-2)] transition-colors text-left"
                      onclick={() => toggleExpandGroup(groupKey)}
                    >
                      <div class="flex-shrink-0 w-7">
                        <div class="h-6 w-6 rounded-[4px] bg-[var(--surface-3)] flex items-center justify-center">
                          {#if uiType === 'update'}
                            <Download class="h-4 w-4 text-[var(--text-accent)]" />
                          {:else if uiType === 'earnings'}
                            <TrendingUp class="h-4 w-4 text-[var(--success)]" />
                          {:else if uiType === 'subscription'}
                            <CreditCard class="h-4 w-4 text-[var(--text-accent)]" />
                          {:else if uiType === 'alert'}
                            <AlertTriangle class="h-4 w-4 text-[var(--warning)]" />
                          {:else if uiType === 'proof'}
                            <CheckCircle2 class="h-4 w-4 text-[var(--success)]" />
                          {:else if uiType === 'slashing'}
                            <AlertTriangle class="h-4 w-4 text-[var(--error)]" />
                          {:else if uiType === 'governance'}
                            <Shield class="h-4 w-4 text-[var(--text-accent)]" />
                          {:else if uiType === 'staking'}
                            <Lock class="h-4 w-4 text-[var(--text-accent)]" />
                          {:else}
                            <Bell class="h-4 w-4 text-[var(--text-tertiary)]" />
                          {/if}
                        </div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-[13px] font-medium text-[var(--text-secondary)]">{entry.summary}</span>
                          <span class="text-[10px] font-mono font-medium text-[var(--text-accent)] bg-[var(--accent-subtle)] rounded-[4px] px-1.5 py-0.5">{entry.items.length}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="text-[11px] text-[var(--text-tertiary)]">{isExpanded ? 'Hide' : 'Show all'}</span>
                        {#if isExpanded}
                          <ChevronDown class="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        {:else}
                          <ChevronRight class="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        {/if}
                      </div>
                    </button>
                    {#if isExpanded}
                      <div class="border-t border-[var(--border-default)]">
                        {#each entry.items as n (n.id)}
                          {@const app = n.appId ? $backendState.apps.find((a) => a.id === n.appId) : null}
                          {@const iconSrc = app ? getAppIcon(app) : null}
                          {@const link = linkForEvent(n)}
                          {@const isEarning = n.eventType === 'payout_distributed'}
                          {@const isWithdrawal = n.eventType === 'withdrawal_requested' || n.eventType === 'withdrawal_completed'}
                          {@const isSlash = n.eventType === 'slash_applied'}
                          {#if link}
                            <a href={link} class="block no-underline" onclick={() => markAsRead(n.id)}>
                              <div
                                class="flex items-start gap-3 py-3 px-3.5 transition-colors cursor-pointer {!n.read ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--surface-2)]'}"
                              >
                                <div class="flex-shrink-0 pt-0.5 w-7">
                                  {#if iconSrc}
                                    <img src={iconSrc} alt={app?.name ?? ''} width="24" height="24" class="rounded-[4px]" />
                                  {:else}
                                    <div class="h-6 w-6 rounded-[4px] bg-[var(--surface-3)] flex items-center justify-center">
                                      {#if n.type === 'update'}
                                        <Download class="h-4 w-4 text-[var(--text-accent)]" />
                                      {:else if n.type === 'earnings'}
                                        <TrendingUp class="h-4 w-4 text-[var(--success)]" />
                                      {:else if n.type === 'subscription'}
                                        <CreditCard class="h-4 w-4 text-[var(--text-accent)]" />
                                      {:else if n.type === 'alert'}
                                        <AlertTriangle class="h-4 w-4 text-[var(--warning)]" />
                                      {:else if n.type === 'proof'}
                                        <CheckCircle2 class="h-4 w-4 text-[var(--success)]" />
                                      {:else if n.type === 'slashing'}
                                        <AlertTriangle class="h-4 w-4 text-[var(--error)]" />
                                      {:else if n.type === 'governance'}
                                        <Shield class="h-4 w-4 text-[var(--text-accent)]" />
                                      {:else if n.type === 'staking'}
                                        <Lock class="h-4 w-4 text-[var(--text-accent)]" />
                                      {:else}
                                        <Bell class="h-4 w-4 text-[var(--text-tertiary)]" />
                                      {/if}
                                    </div>
                                  {/if}
                                </div>
                                <div class="flex-1 min-w-0">
                                  <div class="flex items-baseline justify-between gap-2">
                                    <div class="flex items-baseline gap-2 min-w-0">
                                      <h3 class="text-[13px] truncate {!n.read ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}">{n.title}</h3>
                                      {#if app}
                                        <span class="text-[11px] text-[var(--text-tertiary)] truncate flex-shrink-0">{app.name}</span>
                                      {/if}
                                    </div>
                                    <div class="flex items-baseline gap-2.5 flex-shrink-0">
                                      {#if n.amount != null && (isEarning || isWithdrawal)}
                                        <span class="text-[12px] font-semibold font-mono text-[var(--success)]">+{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                                      {/if}
                                      {#if n.amount != null && isSlash}
                                        <span class="text-[12px] font-semibold font-mono text-[var(--error)]">-{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                                      {/if}
                                      <span class="text-[10px] text-[var(--text-tertiary)] font-mono whitespace-nowrap">{formatTime(n.timestamp)}</span>
                                    </div>
                                  </div>
                                  <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-[17px] line-clamp-2">{n.message}</p>
                                </div>
                                {#if !n.read}
                                  <div class="flex-shrink-0 pt-1.5">
                                    <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-base)]"></div>
                                  </div>
                                {/if}
                              </div>
                            </a>
                          {:else}
                            <div
                              class="flex items-start gap-3 py-3 px-3.5 transition-colors {!n.read ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--surface-2)]'}"
                              role="button"
                              tabindex="0"
                              onclick={() => markAsRead(n.id)}
                              onkeydown={(e) => e.key === 'Enter' && markAsRead(n.id)}
                            >
                              <div class="flex-shrink-0 pt-0.5 w-7">
                                {#if iconSrc}
                                  <img src={iconSrc} alt={app?.name ?? ''} width="24" height="24" class="rounded-[4px]" />
                                {:else}
                                  <div class="h-6 w-6 rounded-[4px] bg-[var(--surface-3)] flex items-center justify-center">
                                    {#if n.type === 'update'}
                                      <Download class="h-4 w-4 text-[var(--text-accent)]" />
                                    {:else if n.type === 'earnings'}
                                      <TrendingUp class="h-4 w-4 text-[var(--success)]" />
                                    {:else if n.type === 'subscription'}
                                      <CreditCard class="h-4 w-4 text-[var(--text-accent)]" />
                                    {:else if n.type === 'alert'}
                                      <AlertTriangle class="h-4 w-4 text-[var(--warning)]" />
                                    {:else if n.type === 'proof'}
                                      <CheckCircle2 class="h-4 w-4 text-[var(--success)]" />
                                    {:else if n.type === 'slashing'}
                                      <AlertTriangle class="h-4 w-4 text-[var(--error)]" />
                                    {:else if n.type === 'governance'}
                                      <Shield class="h-4 w-4 text-[var(--text-accent)]" />
                                    {:else if n.type === 'staking'}
                                      <Lock class="h-4 w-4 text-[var(--text-accent)]" />
                                    {:else}
                                      <Bell class="h-4 w-4 text-[var(--text-tertiary)]" />
                                    {/if}
                                  </div>
                                {/if}
                              </div>
                              <div class="flex-1 min-w-0">
                                <div class="flex items-baseline justify-between gap-2">
                                  <div class="flex items-baseline gap-2 min-w-0">
                                    <h3 class="text-[13px] truncate {!n.read ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}">{n.title}</h3>
                                    {#if app}
                                      <span class="text-[11px] text-[var(--text-tertiary)] truncate flex-shrink-0">{app.name}</span>
                                    {/if}
                                  </div>
                                  <div class="flex items-baseline gap-2.5 flex-shrink-0">
                                    {#if n.amount != null && (isEarning || isWithdrawal)}
                                      <span class="text-[12px] font-semibold font-mono text-[var(--success)]">+{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                                    {/if}
                                    {#if n.amount != null && isSlash}
                                      <span class="text-[12px] font-semibold font-mono text-[var(--error)]">-{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                                    {/if}
                                    <span class="text-[10px] text-[var(--text-tertiary)] font-mono whitespace-nowrap">{formatTime(n.timestamp)}</span>
                                  </div>
                                </div>
                                <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-[17px] line-clamp-2">{n.message}</p>
                              </div>
                              {#if !n.read}
                                <div class="flex-shrink-0 pt-1.5">
                                  <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-base)]"></div>
                                </div>
                              {/if}
                            </div>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <!-- Single event card -->
                  {@const n = entry.item}
                  {@const app = n.appId ? $backendState.apps.find((a) => a.id === n.appId) : null}
                  {@const iconSrc = app ? getAppIcon(app) : null}
                  {@const link = linkForEvent(n)}
                  {@const isEarning = n.eventType === 'payout_distributed'}
                  {@const isWithdrawal = n.eventType === 'withdrawal_requested' || n.eventType === 'withdrawal_completed'}
                  {@const isSlash = n.eventType === 'slash_applied'}
                  {#if link}
                    <a href={link} class="block no-underline" onclick={() => markAsRead(n.id)}>
                      <div
                        class="flex items-start gap-3 py-3 px-3.5 transition-colors cursor-pointer {!n.read ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--surface-2)]'}"
                      >
                        <div class="flex-shrink-0 pt-0.5 w-7">
                          {#if iconSrc}
                            <img src={iconSrc} alt={app?.name ?? ''} width="24" height="24" class="rounded-[4px]" />
                          {:else}
                            <div class="h-6 w-6 rounded-[4px] bg-[var(--surface-3)] flex items-center justify-center">
                              {#if n.type === 'update'}
                                <Download class="h-4 w-4 text-[var(--text-accent)]" />
                              {:else if n.type === 'earnings'}
                                <TrendingUp class="h-4 w-4 text-[var(--success)]" />
                              {:else if n.type === 'subscription'}
                                <CreditCard class="h-4 w-4 text-[var(--text-accent)]" />
                              {:else if n.type === 'alert'}
                                <AlertTriangle class="h-4 w-4 text-[var(--warning)]" />
                              {:else if n.type === 'proof'}
                                <CheckCircle2 class="h-4 w-4 text-[var(--success)]" />
                              {:else if n.type === 'slashing'}
                                <AlertTriangle class="h-4 w-4 text-[var(--error)]" />
                              {:else if n.type === 'governance'}
                                <Shield class="h-4 w-4 text-[var(--text-accent)]" />
                              {:else if n.type === 'staking'}
                                <Lock class="h-4 w-4 text-[var(--text-accent)]" />
                              {:else}
                                <Bell class="h-4 w-4 text-[var(--text-tertiary)]" />
                              {/if}
                            </div>
                          {/if}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-baseline justify-between gap-2">
                            <div class="flex items-baseline gap-2 min-w-0">
                              <h3 class="text-[13px] truncate {!n.read ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}">{n.title}</h3>
                              {#if app}
                                <span class="text-[11px] text-[var(--text-tertiary)] truncate flex-shrink-0">{app.name}</span>
                              {/if}
                            </div>
                            <div class="flex items-baseline gap-2.5 flex-shrink-0">
                              {#if n.amount != null && (isEarning || isWithdrawal)}
                                <span class="text-[12px] font-semibold font-mono text-[var(--success)]">+{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                              {/if}
                              {#if n.amount != null && isSlash}
                                <span class="text-[12px] font-semibold font-mono text-[var(--error)]">-{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                              {/if}
                              <span class="text-[10px] text-[var(--text-tertiary)] font-mono whitespace-nowrap">{formatTime(n.timestamp)}</span>
                            </div>
                          </div>
                          <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-[17px] line-clamp-2">{n.message}</p>
                        </div>
                        {#if !n.read}
                          <div class="flex-shrink-0 pt-1.5">
                            <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-base)]"></div>
                          </div>
                        {/if}
                      </div>
                    </a>
                  {:else}
                    <div
                      class="flex items-start gap-3 py-3 px-3.5 transition-colors {!n.read ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--surface-2)]'}"
                      role="button"
                      tabindex="0"
                      onclick={() => markAsRead(n.id)}
                      onkeydown={(e) => e.key === 'Enter' && markAsRead(n.id)}
                    >
                      <div class="flex-shrink-0 pt-0.5 w-7">
                        {#if iconSrc}
                          <img src={iconSrc} alt={app?.name ?? ''} width="24" height="24" class="rounded-[4px]" />
                        {:else}
                          <div class="h-6 w-6 rounded-[4px] bg-[var(--surface-3)] flex items-center justify-center">
                            {#if n.type === 'update'}
                              <Download class="h-4 w-4 text-[var(--text-accent)]" />
                            {:else if n.type === 'earnings'}
                              <TrendingUp class="h-4 w-4 text-[var(--success)]" />
                            {:else if n.type === 'subscription'}
                              <CreditCard class="h-4 w-4 text-[var(--text-accent)]" />
                            {:else if n.type === 'alert'}
                              <AlertTriangle class="h-4 w-4 text-[var(--warning)]" />
                            {:else if n.type === 'proof'}
                              <CheckCircle2 class="h-4 w-4 text-[var(--success)]" />
                            {:else if n.type === 'slashing'}
                              <AlertTriangle class="h-4 w-4 text-[var(--error)]" />
                            {:else if n.type === 'governance'}
                              <Shield class="h-4 w-4 text-[var(--text-accent)]" />
                            {:else if n.type === 'staking'}
                              <Lock class="h-4 w-4 text-[var(--text-accent)]" />
                            {:else}
                              <Bell class="h-4 w-4 text-[var(--text-tertiary)]" />
                            {/if}
                          </div>
                        {/if}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-baseline justify-between gap-2">
                          <div class="flex items-baseline gap-2 min-w-0">
                            <h3 class="text-[13px] truncate {!n.read ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}">{n.title}</h3>
                            {#if app}
                              <span class="text-[11px] text-[var(--text-tertiary)] truncate flex-shrink-0">{app.name}</span>
                            {/if}
                          </div>
                          <div class="flex items-baseline gap-2.5 flex-shrink-0">
                            {#if n.amount != null && (isEarning || isWithdrawal)}
                              <span class="text-[12px] font-semibold font-mono text-[var(--success)]">+{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                            {/if}
                            {#if n.amount != null && isSlash}
                              <span class="text-[12px] font-semibold font-mono text-[var(--error)]">-{n.amount.toFixed(2)} <span class="text-[10px] font-normal">NECTA</span></span>
                            {/if}
                            <span class="text-[10px] text-[var(--text-tertiary)] font-mono whitespace-nowrap">{formatTime(n.timestamp)}</span>
                          </div>
                        </div>
                        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-[17px] line-clamp-2">{n.message}</p>
                      </div>
                      {#if !n.read}
                        <div class="flex-shrink-0 pt-1.5">
                          <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-base)]"></div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/if}
              {/each}
            </Card>
          </div>
        {/each}
      </div>
    {/if}

  </div>
{/if}
