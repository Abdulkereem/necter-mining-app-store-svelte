<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { appIconDataUri } from '$lib/app-icon';
  import { onMount } from 'svelte';
  import {
    Bell,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    Download,
    CreditCard,
    Shield,
  } from 'lucide-svelte';

  // ─── Settings ────────────────────────────────────────────────────────────────
  const defaultSettings = [
    { id: 'updates', label: 'App Updates', desc: 'Deploys, mining packages, and runtime changes', enabled: true },
    { id: 'earnings', label: 'Earnings', desc: 'Payouts and withdrawals', enabled: true },
    { id: 'subscriptions', label: 'Subscriptions', desc: 'Subscribe, pause/resume, blocked reasons', enabled: true },
    { id: 'proofs', label: 'Proofs', desc: 'Proof submitted/verified/disputed', enabled: true },
    { id: 'governance', label: 'Governance', desc: 'Listing approvals/rejections and attestations', enabled: true },
    { id: 'security', label: 'Security', desc: 'Slashing and risk events', enabled: true },
  ];

  let settings = $state(defaultSettings.map((s) => ({ ...s })));
  let activeFilter = $state('all');
  let readIds = $state([]);
  let deletedIds = $state([]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const MINING_PAGE_TYPES = new Set([
    'job_queued', 'job_started', 'job_completed', 'job_failed',
    'proof_submitted', 'proof_verified', 'proof_disputed', 'proof_dispute_resolved',
  ]);

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

  // Save whenever readIds/deletedIds change
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
      }));
  });

  const unreadCount = $derived(notifications.filter((n) => !n.read).length);

  const filteredNotifications = $derived.by(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'alerts') return notifications.filter((n) => n.type === 'slashing' || n.type === 'alert');
    if (activeFilter === 'updates') return notifications.filter((n) => n.type === 'update');
    return notifications.filter((n) => n.type === activeFilter);
  });

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
      groups.push({ label, items });
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
    { id: 'alerts', label: 'Alerts' },
    { id: 'updates', label: 'Updates' },
  ];
</script>

{#if !$actor}
  <!-- Not connected -->
  <div class="animate-fadeIn px-6 pt-6 pb-12">
    <div class="p-12 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center">
      <Bell class="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-4" />
      <h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Connect a wallet</h3>
      <p class="text-[13px] text-[var(--text-secondary)]">Notifications are derived from your mining, developer, and governance activity.</p>
      <div class="mt-4">
        <button type="button" class="btn-pill" onclick={() => showConnectModal.set(true)}>Connect wallet</button>
      </div>
    </div>
  </div>
{:else}
  <div class="animate-fadeIn px-6 pt-8 pb-12" style="max-width:720px;margin:0 auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Activity</h1>
        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">Your mining, earning, and governance events</p>
      </div>
      {#if unreadCount > 0}
        <button type="button" class="btn-secondary" style="height:28px;font-size:12px;padding:0 10px" onclick={markAllRead}>
          Mark all read
        </button>
      {/if}
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-1 mb-6 flex-wrap">
      {#each filters as f}
        {@const count = f.id === 'all' ? notifications.length : notifications.filter((n) => f.id === 'alerts' ? (n.type === 'slashing' || n.type === 'alert') : n.type === f.id || (f.id === 'updates' && n.type === 'update')).length}
        <button
          type="button"
          onclick={() => (activeFilter = f.id)}
          style="height:28px;padding:0 10px;border-radius:5px;font-size:12px;font-weight:500;border:none;cursor:pointer;background:{activeFilter === f.id ? 'var(--accent-subtle)' : 'var(--surface-1)'};color:{activeFilter === f.id ? 'var(--text-accent)' : 'var(--text-secondary)'};transition:all 100ms ease-out"
        >
          {f.label}{count > 0 && activeFilter !== f.id ? ` (${count})` : ''}
        </button>
      {/each}
    </div>

    <!-- Timeline -->
    {#if filteredNotifications.length === 0}
      <div class="p-16 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center">
        <p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
          {activeFilter === 'all' ? 'No activity yet' : `No ${activeFilter} events`}
        </p>
        <p class="text-[13px] text-[var(--text-secondary)] mb-4">
          {activeFilter === 'all' ? 'Start mining to see your events here.' : 'Try a different filter.'}
        </p>
        {#if activeFilter === 'all'}
          <a href="/discover" class="btn-subscribe">Discover networks</a>
        {/if}
      </div>
    {:else}
      <div class="space-y-6">
        {#each filteredGrouped as group (group.label)}
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em]">{group.label}</span>
              <div class="flex-1 h-px bg-[var(--border-default)]"></div>
              <span class="text-[10px] text-[var(--text-tertiary)] font-mono">{group.items.length}</span>
            </div>
            <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden divide-y divide-[var(--border-default)]">
              {#each group.items as n (n.id)}
                {@const app = n.appId ? $backendState.apps.find((a) => a.id === n.appId) : null}
                {@const iconSrc = app?.icon && app.icon !== '/placeholder.svg' ? app.icon : app ? appIconDataUri({ id: app.id, name: app.name }) : null}
                <button
                  type="button"
                  class="w-full text-left flex items-start gap-3 py-3 px-3 rounded-[6px] cursor-pointer transition-colors {!n.read ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--surface-2)]'}"
                  onclick={() => markAsRead(n.id)}
                >
                  <!-- Timeline dot -->
                  <div class="flex flex-col items-center pt-1 flex-shrink-0" style="width:20px">
                    <div
                      style="width:8px;height:8px;border-radius:50%;background:{!n.read ? 'var(--accent-base)' : 'var(--surface-3)'};{n.read ? 'border:2px solid var(--border-default)' : ''};flex-shrink:0"
                    ></div>
                  </div>
                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline justify-between gap-2">
                      <h3 class="text-[13px] {!n.read ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}">
                        {n.title}
                      </h3>
                      <span class="text-[10px] text-[var(--text-tertiary)] font-mono whitespace-nowrap flex-shrink-0">{formatTime(n.timestamp)}</span>
                    </div>
                    <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-[17px]">{n.message}</p>
                    {#if app && iconSrc}
                      <a href="/apps/{app.id}" class="inline-flex items-center gap-1.5 mt-1.5 no-underline group">
                        <img src={iconSrc} alt={app.name} width="14" height="14" class="rounded-[2px]" />
                        <span class="text-[11px] text-[var(--text-tertiary)] group-hover:text-[var(--text-accent)] transition-colors">{app.name}</span>
                      </a>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Preferences -->
    <details class="mt-8">
      <summary class="text-[12px] font-medium text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors">
        Event preferences
      </summary>
      <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden mt-3">
        <div class="px-5 py-4 border-b border-[var(--border)]">
          <h3 class="text-[13px] font-semibold text-[var(--text-primary)]">Event Preferences</h3>
          <p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">Choose which events show up in your feed</p>
        </div>
        <div class="divide-y divide-[var(--border-default)]">
          {#each settings as setting}
            <div class="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <h4 class="text-[13px] font-medium text-[var(--text-primary)]">{setting.label}</h4>
                <p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">{setting.desc}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={setting.enabled} onchange={() => toggleSetting(setting.id)} class="sr-only peer" />
                <div class="w-9 h-5 bg-[var(--surface-3)] peer-checked:bg-[var(--accent-base)] rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </label>
            </div>
          {/each}
        </div>
      </div>
    </details>
  </div>
{/if}
