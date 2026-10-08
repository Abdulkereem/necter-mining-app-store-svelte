<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { untrack } from 'svelte';
  import { Search, ExternalLink, Loader2 } from 'lucide-svelte';
  import { hub } from '$lib/api/hub';
  import { useQuery } from '$lib/api/query.svelte';
  import { errorMessage } from '$lib/api/http';
  import type { EpochSummary, ProjectSummary, RoundSummary, Slash, SlashStatus, Token } from '$lib/api/types';
  import { descriptor, loadDescriptor, explorerBase } from '$lib/stores/network';
  import {
    formatAmount,
    formatToken,
    formatNumber,
    formatDateTime,
    shortHex,
    timeAgo,
    bpToPercent,
    txUrl
  } from '$lib/format';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import CopyText from '$lib/components/common/CopyText.svelte';
  import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
  import { Badge } from '$lib/components/ui';

  type ExplorerTab = 'rounds' | 'epochs' | 'slashes';
  type RoundKind = NonNullable<RoundSummary['kind']>;
  type RoundState = NonNullable<RoundSummary['state']>;
  type EpochStatus = EpochSummary['status'];
  type BadgeVariant = 'accent' | 'success' | 'warning' | 'error' | 'neutral';
  type PageResult<T> = { items: T[]; next_cursor: string | null };

  const NECTA = { symbol: 'NECTA', decimals: 18 } as const;
  const PAGE_SIZE = 50;

  /** Cursor-paged list with "Load more"; stale responses (after a filter change) are dropped. */
  class Pager<T> {
    items = $state<T[]>([]);
    next = $state<string | null>(null);
    loading = $state(false);
    loadingMore = $state(false);
    error = $state<unknown>(null);
    loaded = $state(false);
    key = '';
    #seq = 0;
    #fetch: (cursor: string | undefined) => Promise<PageResult<T>>;

    constructor(fetch: (cursor: string | undefined) => Promise<PageResult<T>>) {
      this.#fetch = fetch;
    }

    async reset(key: string) {
      this.key = key;
      const seq = ++this.#seq;
      this.loading = true;
      this.error = null;
      try {
        const res = await this.#fetch(undefined);
        if (seq !== this.#seq) return;
        this.items = res.items;
        this.next = res.next_cursor;
        this.loaded = true;
      } catch (e) {
        if (seq !== this.#seq) return;
        this.error = e;
        this.items = [];
        this.next = null;
      } finally {
        if (seq === this.#seq) this.loading = false;
      }
    }

    async more() {
      if (!this.next || this.loadingMore) return;
      const seq = this.#seq;
      this.loadingMore = true;
      try {
        const res = await this.#fetch(this.next);
        if (seq !== this.#seq) return;
        this.items = [...this.items, ...res.items];
        this.next = res.next_cursor;
      } catch (e) {
        if (seq === this.#seq) this.error = e;
      } finally {
        this.loadingMore = false;
      }
    }
  }

  // ── tab (kept in the URL so links like /explorer?tab=epochs work) ──
  const tabs: { id: ExplorerTab; label: string }[] = [
    { id: 'rounds', label: 'Rounds' },
    { id: 'epochs', label: 'Epochs' },
    { id: 'slashes', label: 'Slashes' }
  ];
  const urlTab = page.url.searchParams.get('tab');
  let tab = $state<ExplorerTab>(urlTab === 'epochs' || urlTab === 'slashes' ? urlTab : 'rounds');

  function selectTab(t: ExplorerTab) {
    tab = t;
    const url = new URL(page.url);
    url.searchParams.set('tab', t);
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // ── filters ──
  const ROUND_KINDS: { id: RoundKind | ''; label: string }[] = [
    { id: '', label: 'All kinds' },
    { id: 'task', label: 'Task (committee)' },
    { id: 'exec', label: 'Exec (validators)' },
    { id: 'epoch', label: 'Epoch (rewards v2)' },
    { id: 'reward', label: 'Reward (v1)' }
  ];
  const ROUND_STATES: { id: RoundState | ''; label: string }[] = [
    { id: '', label: 'All states' },
    { id: 'pending', label: 'Pending' },
    { id: 'committee_agreed', label: 'Committee agreed' },
    { id: 'finalized', label: 'Finalized' },
    { id: 'escalated', label: 'Escalated' },
    { id: 'fallback', label: 'Validator fallback' },
    { id: 'failed', label: 'Failed' }
  ];
  const EPOCH_STATUSES: { id: EpochStatus | ''; label: string }[] = [
    { id: '', label: 'All statuses' },
    { id: 'open', label: 'Open' },
    { id: 'closed', label: 'Closed' },
    { id: 'attested', label: 'Attested' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'settled', label: 'Settled' },
    { id: 'released', label: 'Released' },
    { id: 'vetoed', label: 'Vetoed' },
    { id: 'underfunded', label: 'Underfunded' }
  ];
  const SLASH_STATUSES: { id: SlashStatus | ''; label: string }[] = [
    { id: '', label: 'All statuses' },
    { id: 'recorded', label: 'Recorded' },
    { id: 'proposed', label: 'Proposed' },
    { id: 'disputed', label: 'Disputed' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'executed', label: 'Executed' }
  ];

  let projectFilter = $state(page.url.searchParams.get('project') ?? '');
  let kindFilter = $state<RoundKind | ''>('');
  let stateFilter = $state<RoundState | ''>('');
  let epochStatusFilter = $state<EpochStatus | ''>('');
  let slashStatusFilter = $state<SlashStatus | ''>('');

  // ── data ──
  const status = useQuery(() => hub.status(), { pollMs: 30_000, keepPrevious: true });
  const stats = useQuery(() => hub.explorerStats(), { pollMs: 30_000, keepPrevious: true });
  const validators = useQuery(() => hub.validators());
  const projects = useQuery(() => hub.projects({ sort: 'name', limit: 200 }));

  $effect(() => {
    loadDescriptor().catch(() => {});
  });

  const projectsById = $derived(new Map<string, ProjectSummary>((projects.data?.items ?? []).map((p) => [p.project_id, p])));

  const rounds = new Pager<RoundSummary>((cursor) =>
    hub.rounds({
      limit: PAGE_SIZE,
      cursor,
      ...(projectFilter ? { project_id: projectFilter } : {}),
      ...(kindFilter ? { kind: kindFilter } : {}),
      ...(stateFilter ? { state: stateFilter } : {})
    })
  );
  const epochs = new Pager<EpochSummary>((cursor) =>
    hub.epochs({
      limit: PAGE_SIZE,
      cursor,
      ...(projectFilter ? { project_id: projectFilter } : {}),
      ...(epochStatusFilter ? { status: epochStatusFilter } : {})
    })
  );
  const slashes = new Pager<Slash>((cursor) =>
    hub.explorerSlashes({
      limit: PAGE_SIZE,
      cursor,
      ...(projectFilter ? { project_id: projectFilter } : {}),
      ...(slashStatusFilter ? { status: slashStatusFilter } : {})
    })
  );

  // Load the active tab's first page whenever the tab or its filters change.
  $effect(() => {
    const t = tab;
    const key =
      t === 'rounds'
        ? `${projectFilter}|${kindFilter}|${stateFilter}`
        : t === 'epochs'
          ? `${projectFilter}|${epochStatusFilter}`
          : `${projectFilter}|${slashStatusFilter}`;
    untrack(() => {
      const pager = t === 'rounds' ? rounds : t === 'epochs' ? epochs : slashes;
      if (!pager.loaded || pager.key !== key) void pager.reset(key);
    });
  });

  function reloadActive() {
    const pager = tab === 'rounds' ? rounds : tab === 'epochs' ? epochs : slashes;
    void pager.reset(pager.key);
  }

  // ── search ──
  type SearchHit = { type: string; id: string; label: string };
  let query = $state('');
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let hits = $state<SearchHit[] | null>(null);

  function hitHref(h: SearchHit): { href: string; external: boolean } | null {
    switch (h.type) {
      case 'project':
        return { href: `/apps/${h.id}`, external: false };
      case 'round':
        return { href: `/explorer/rounds/${encodeURIComponent(h.id)}`, external: false };
      case 'receipt':
        return { href: `/explorer/receipts/${h.id}`, external: false };
      case 'epoch': {
        const m = /(0x[0-9a-f]{64})[:/](\d+)/i.exec(h.id);
        return m ? { href: `/explorer/epochs/${m[1].toLowerCase()}/${m[2]}`, external: false } : null;
      }
      case 'account':
        return { href: `/profiles/${h.id.toLowerCase()}`, external: false };
      case 'device':
        return { href: `/miners/${h.id}`, external: false };
      case 'tx':
        return { href: txUrl(h.id, explorerBase($descriptor)), external: true };
      default:
        // module, slash: no public detail page in the store yet
        return null;
    }
  }

  const HIT_LABEL: Record<string, string> = {
    project: 'Project',
    module: 'Module',
    round: 'Round',
    receipt: 'Receipt',
    epoch: 'Epoch',
    account: 'Account',
    device: 'Device',
    slash: 'Slash',
    tx: 'Transaction'
  };

  async function runSearch(e: SubmitEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      searchError = 'Type at least 2 characters.';
      hits = null;
      return;
    }
    searching = true;
    searchError = null;
    hits = null;
    try {
      const res = await hub.explorerSearch(q);
      const items = res.items ?? [];
      const routable = items.filter((h) => hitHref(h));
      if (items.length === 1 && routable.length === 1) {
        const target = hitHref(routable[0])!;
        if (target.external) window.open(target.href, '_blank', 'noopener');
        else await goto(target.href);
        return;
      }
      hits = items;
    } catch (err) {
      searchError = errorMessage(err);
    } finally {
      searching = false;
    }
  }

  // ── presentation helpers ──
  function roundStateVariant(s: RoundState): BadgeVariant {
    switch (s) {
      case 'finalized':
        return 'success';
      case 'committee_agreed':
        return 'accent';
      case 'escalated':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'neutral';
    }
  }
  const ROUND_STATE_LABEL: Record<RoundState, string> = {
    pending: 'Pending',
    committee_agreed: 'Committee agreed',
    finalized: 'Finalized',
    escalated: 'Escalated',
    failed: 'Failed',
    fallback: 'Validator fallback'
  };
  function epochStatusVariant(s: EpochStatus): BadgeVariant {
    switch (s) {
      case 'settled':
      case 'released':
        return 'success';
      case 'attested':
      case 'submitted':
        return 'accent';
      case 'underfunded':
        return 'warning';
      case 'vetoed':
        return 'error';
      default:
        return 'neutral';
    }
  }
  function settlementVariant(s: string | undefined): BadgeVariant {
    if (s === 'settled' || s === 'released') return 'success';
    if (s === 'vetoed' || s === 'reverted' || s === 'failed') return 'error';
    if (s === 'sent' || s === 'signed') return 'accent';
    return 'neutral';
  }
  function slashVariant(s: SlashStatus): BadgeVariant {
    if (s === 'executed') return 'error';
    if (s === 'proposed' || s === 'disputed') return 'warning';
    return 'neutral';
  }
  const SLASH_KIND_LABEL: Record<Slash['kind'], string> = {
    invalid_result: 'Invalid result',
    equivocation: 'Equivocation',
    missed_sla: 'Missed SLA'
  };
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  function projectName(id: string | undefined): string {
    if (!id) return '—';
    return projectsById.get(id)?.name ?? shortHex(id);
  }
  function epochToken(e: EpochSummary): Pick<Token, 'symbol' | 'decimals'> | null {
    return e.token ?? projectsById.get(e.project_id)?.token ?? null;
  }

  const reachable = $derived((status.data?.validators ?? []).filter((v) => v.reachable).length);
  const validatorTotal = $derived(status.data?.validators?.length ?? validators.data?.count ?? 0);
  const statusVariant = $derived<BadgeVariant>(
    status.data?.status === 'ok' ? 'success' : status.data?.status === 'degraded' ? 'warning' : status.data ? 'error' : 'neutral'
  );

  const statTiles = $derived([
    { label: 'Projects listed', value: formatNumber(stats.data?.projects_listed) },
    { label: 'Miners online', value: formatNumber(stats.data?.miners_online) },
    { label: 'Devices online', value: formatNumber(stats.data?.devices_online) },
    {
      label: 'Rounds (24h)',
      value: formatNumber(stats.data?.rounds_24h),
      sub: stats.data?.rounds_finalized_24h !== undefined ? `${formatNumber(stats.data.rounds_finalized_24h)} finalized` : undefined
    },
    { label: 'Compute units (24h)', value: formatNumber(stats.data?.units_24h) },
    { label: 'Validators', value: formatNumber(stats.data?.validators) },
    { label: 'Collateral bonded', value: stats.data?.collateral_bonded ? formatToken(stats.data.collateral_bonded, NECTA, { compact: true }) : '—' }
  ]);

  const selectClass =
    'h-[30px] pl-2.5 pr-7 rounded-[5px] bg-[var(--surface-1)] border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] outline-none cursor-pointer';
</script>

<svelte:head>
  <title>Explorer — Necter</title>
</svelte:head>

<div class="min-h-screen">
  <div class="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 class="text-[20px] font-semibold">Explorer</h1>
        <p class="text-[var(--text-secondary)] text-sm mt-1">
          Public view of the Necter testnet: committee rounds, reward epochs, settlements and slashes.
        </p>
      </div>
      <div class="flex gap-2">
        <a href="/discover" class="btn-secondary">Browse projects</a>
      </div>
    </div>

    <!-- Search -->
    <form class="relative" onsubmit={runSearch} data-testid="explorer-search">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
      <input
        type="search"
        bind:value={query}
        maxlength={200}
        placeholder="Search a round id, receipt hash, tx hash, address, node id or project…"
        class="w-full h-10 pl-9 pr-24 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--border-accent)]"
      />
      <button
        type="submit"
        disabled={searching}
        class="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 rounded-[5px] bg-[var(--surface-3)] text-[12px] font-medium text-[var(--text-primary)] border-none cursor-pointer hover:bg-[var(--surface-4)] disabled:opacity-60 inline-flex items-center gap-1.5"
      >
        {#if searching}<Loader2 class="h-3.5 w-3.5 animate-spin" strokeWidth={2} />{/if}
        Search
      </button>
    </form>
    {#if searchError}
      <p class="text-[12px] text-[var(--error)] -mt-3">{searchError}</p>
    {/if}
    {#if hits}
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] -mt-3 overflow-hidden">
        {#if hits.length === 0}
          <p class="px-4 py-3 text-[13px] text-[var(--text-secondary)]">No matches for “{query.trim()}”.</p>
        {:else}
          {#each hits as h (h.type + h.id)}
            {@const target = hitHref(h)}
            <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-default)] last:border-b-0">
              <div class="flex items-center gap-2 min-w-0">
                <Badge variant="neutral">{HIT_LABEL[h.type] ?? h.type}</Badge>
                {#if target}
                  <a
                    href={target.href}
                    target={target.external ? '_blank' : undefined}
                    rel={target.external ? 'noopener noreferrer' : undefined}
                    class="text-[13px] text-[var(--text-primary)] hover:text-[var(--text-accent)] truncate no-underline"
                  >{h.label}</a>
                {:else}
                  <span class="text-[13px] text-[var(--text-primary)] truncate">{h.label}</span>
                {/if}
              </div>
              <CopyText value={h.id} />
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    <!-- Network status -->
    <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5" data-testid="network-status">
      {#if status.loading && !status.data}
        <LoadingBlock rows={1} height="64px" />
      {:else if status.error && !status.data}
        <ErrorState error={status.error} retry={status.refresh} compact />
      {:else if status.data}
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="font-semibold">Network status</span>
            <Badge variant={statusVariant}>{cap(status.data.status)}</Badge>
            {#if status.data.committees_enabled !== undefined}
              <Badge variant={status.data.committees_enabled ? 'accent' : 'neutral'}>
                {status.data.committees_enabled ? 'Committee mining on' : 'Validator fallback only'}
              </Badge>
            {/if}
          </div>
          <span class="text-xs text-[var(--text-tertiary)]">Updated {timeAgo(status.data.time)}</span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2.5">
            <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">Hub version</div>
            <div class="text-[14px] font-mono mt-1">{status.data.hub_version ?? '—'}</div>
          </div>
          <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2.5">
            <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">Validators reachable</div>
            <div class="text-[14px] font-mono mt-1" class:text-[var(--warning)]={validatorTotal > 0 && reachable < validatorTotal}>
              {status.data.validators ? `${reachable} / ${validatorTotal}` : '—'}
            </div>
          </div>
          <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2.5">
            <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">Chain indexer lag</div>
            <div class="text-[14px] font-mono mt-1">
              {status.data.chain?.lag_secs !== undefined ? `${formatNumber(status.data.chain.lag_secs)} s` : '—'}
            </div>
            {#if status.data.chain?.indexed_block !== undefined}
              <div class="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono">
                block {formatNumber(status.data.chain.indexed_block)}{status.data.chain.head_block !== undefined ? ` / ${formatNumber(status.data.chain.head_block)}` : ''}
              </div>
            {/if}
          </div>
          <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2.5">
            <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">Relay connected devices</div>
            <div class="text-[14px] font-mono mt-1">{formatNumber(status.data.relay?.connected_devices)}</div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Totals -->
    {#if stats.loading && !stats.data}
      <LoadingBlock rows={1} height="72px" />
    {:else if stats.error && !stats.data}
      <ErrorState error={stats.error} retry={stats.refresh} compact />
    {:else}
      <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3" data-testid="explorer-stats">
        {#each statTiles as s (s.label)}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
            <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{s.label}</div>
            <div class="text-[18px] font-semibold font-mono mt-1 tabular-nums">{s.value}</div>
            {#if s.sub}<div class="text-[11px] text-[var(--text-tertiary)] mt-0.5">{s.sub}</div>{/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Validators -->
    <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
      <div class="flex items-center justify-between gap-4 mb-3">
        <div class="font-semibold">Validators</div>
        {#if validators.data}
          <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">
            {validators.data.count} validators · quorum {validators.data.quorum}
          </span>
        {/if}
      </div>
      {#if validators.loading}
        <LoadingBlock rows={2} height="40px" />
      {:else if validators.error}
        <ErrorState error={validators.error} retry={validators.refresh} compact />
      {:else if (validators.data?.validators ?? []).length === 0}
        <p class="text-sm text-[var(--text-secondary)]">No validators registered yet.</p>
      {:else}
        <div class="grid md:grid-cols-2 gap-2">
          {#each validators.data?.validators ?? [] as v (v.node_id)}
            {@const live = status.data?.validators?.find((s) => s.node_id === v.node_id)}
            <div class="flex items-center justify-between gap-3 rounded-[6px] bg-[var(--surface-2)] px-3 py-2.5">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="h-2 w-2 rounded-full shrink-0"
                    style="background:{live ? (live.reachable ? 'var(--success)' : 'var(--error)') : 'var(--text-tertiary)'}"
                    title={live ? (live.reachable ? 'Reachable' : 'Unreachable') : 'Unknown'}
                  ></span>
                  <span class="font-mono text-[13px] truncate">{v.node_id}</span>
                </div>
                {#if v.url}
                  <div class="text-xs text-[var(--text-tertiary)] truncate mt-0.5 font-mono">{v.url.replace(/^https?:\/\//, '')}</div>
                {/if}
              </div>
              <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)] uppercase shrink-0">{v.region ?? '—'}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Tab bar -->
    <div class="flex items-center gap-1 border-b border-[var(--border-default)] overflow-x-auto">
      {#each tabs as t (t.id)}
        <button
          type="button"
          class="px-3 py-2 text-sm font-medium transition-colors duration-100 -mb-px border-b-2 bg-transparent cursor-pointer {tab === t.id
            ? 'text-[var(--text-accent)] border-[var(--text-accent)]'
            : 'text-[var(--text-secondary)] border-transparent'}"
          onclick={() => selectTab(t.id)}
        >
          {t.label}
        </button>
      {/each}
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2">
      <select bind:value={projectFilter} class={selectClass} aria-label="Project">
        <option value="">All projects</option>
        {#each projects.data?.items ?? [] as p (p.project_id)}
          <option value={p.project_id}>{p.name}</option>
        {/each}
      </select>
      {#if tab === 'rounds'}
        <select bind:value={kindFilter} class={selectClass} aria-label="Round kind">
          {#each ROUND_KINDS as k (k.id)}<option value={k.id}>{k.label}</option>{/each}
        </select>
        <select bind:value={stateFilter} class={selectClass} aria-label="Round state">
          {#each ROUND_STATES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
        </select>
      {:else if tab === 'epochs'}
        <select bind:value={epochStatusFilter} class={selectClass} aria-label="Epoch status">
          {#each EPOCH_STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
        </select>
      {:else}
        <select bind:value={slashStatusFilter} class={selectClass} aria-label="Slash status">
          {#each SLASH_STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
        </select>
      {/if}
    </div>

    <!-- Rounds tab -->
    {#if tab === 'rounds'}
      {#if rounds.loading}
        <LoadingBlock rows={5} height="72px" />
      {:else if rounds.error && rounds.items.length === 0}
        <ErrorState error={rounds.error} retry={reloadActive} />
      {:else if rounds.items.length === 0}
        <EmptyState
          illustration="network"
          title={kindFilter || stateFilter || projectFilter ? 'No rounds match these filters' : 'No rounds yet'}
          description="Rounds appear here as soon as subscribed miners and validators start executing project tasks on the testnet."
        >
          <a href="/discover" class="btn-secondary">Browse projects</a>
          <a href="/learn/guides/committee-mining" class="btn-secondary">How rounds work</a>
        </EmptyState>
      {:else}
        <div class="space-y-3" data-testid="rounds-list">
          {#each rounds.items as r (r.round_id)}
            {@const proj = r.project_id ? projectsById.get(r.project_id) : undefined}
            <a
              href="/explorer/rounds/{encodeURIComponent(r.round_id)}"
              class="block rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4 hover:border-[var(--border-hover)] transition-colors no-underline"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex items-start gap-3">
                  {#if proj}
                    <ProjectIcon project={proj} size={28} rounded="6px" />
                  {/if}
                  <div class="min-w-0">
                    <div class="font-medium truncate text-[var(--text-primary)]">
                      <span class="uppercase text-xs text-[var(--text-tertiary)] mr-1">{r.kind}</span>
                      <span class="font-mono">{shortHex(r.round_id.replace(/^[a-z]+:/, ''), 10, 6)}</span>
                      {#if r.project_id} · {projectName(r.project_id)}{/if}
                    </div>
                    <div class="text-xs text-[var(--text-secondary)] mt-1">
                      {#if r.function}{r.function} · {/if}
                      {#if r.epoch !== undefined}epoch {r.epoch}{r.seq !== undefined ? ` · seq ${r.seq}` : ''} · {/if}
                      {#if r.committee_size !== undefined}committee {r.committee_size} · {/if}
                      {#if r.votes !== undefined}{r.votes} votes{r.agreeing !== undefined ? ` (${r.agreeing} agreeing)` : ''} · {/if}
                      {#if r.gas_used !== undefined}{formatNumber(r.gas_used)} gas · {/if}
                      {timeAgo(r.created_at)}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  {#if r.audited}<Badge variant="accent">Audited</Badge>{/if}
                  <Badge variant={roundStateVariant(r.state)}>{ROUND_STATE_LABEL[r.state]}</Badge>
                </div>
              </div>
            </a>
          {/each}
          {#if rounds.next}
            <div class="flex justify-center pt-2">
              <button type="button" class="btn-secondary" onclick={() => rounds.more()} disabled={rounds.loadingMore}>
                {rounds.loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Epochs tab -->
    {#if tab === 'epochs'}
      {#if epochs.loading}
        <LoadingBlock rows={5} height="96px" />
      {:else if epochs.error && epochs.items.length === 0}
        <ErrorState error={epochs.error} retry={reloadActive} />
      {:else if epochs.items.length === 0}
        <EmptyState
          illustration="network"
          title={epochStatusFilter || projectFilter ? 'No epochs match these filters' : 'No reward epochs yet'}
          description="Each listed project closes an hourly reward epoch. Validators attest a v2 receipt with a Merkle root and the Hub settles it on Sepolia."
        >
          <a href="/discover" class="btn-secondary">Browse projects</a>
        </EmptyState>
      {:else}
        <div class="space-y-3" data-testid="epochs-list">
          {#each epochs.items as e (e.project_id + ':' + e.epoch)}
            {@const token = epochToken(e)}
            {@const proj = projectsById.get(e.project_id)}
            <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex items-start gap-3">
                  {#if proj}
                    <ProjectIcon project={proj} size={28} rounded="6px" />
                  {/if}
                  <div class="min-w-0">
                    <a
                      href="/explorer/epochs/{e.project_id}/{e.epoch}"
                      class="font-medium truncate block text-[var(--text-primary)] hover:text-[var(--text-accent)] no-underline"
                    >
                      Epoch <span class="font-mono">{e.epoch}</span> · {projectName(e.project_id)}
                    </a>
                    <div class="text-xs text-[var(--text-secondary)] mt-1">
                      {#if e.starts_at}{formatDateTime(e.starts_at)}{e.ends_at ? ` – ${formatDateTime(e.ends_at)}` : ''} · {/if}
                      {#if e.rounds !== undefined}{formatNumber(e.rounds)} rounds{e.fallback_rounds ? ` (${formatNumber(e.fallback_rounds)} fallback)` : ''} · {/if}
                      {#if e.miners !== undefined}{formatNumber(e.miners)} miners{/if}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <Badge variant={epochStatusVariant(e.status)}>{cap(e.status)}</Badge>
                </div>
              </div>
              {#if e.totals}
                <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                  {#each [
                    { label: 'Units', value: formatNumber(e.totals.units) },
                    { label: 'Gross', value: formatToken(e.totals.gross, token) },
                    { label: 'Miners', value: formatToken(e.totals.miner, token) },
                    { label: 'Developer', value: formatToken(e.totals.developer, token) },
                    { label: 'Treasury', value: formatToken(e.totals.treasury, token) }
                  ] as t (t.label)}
                    <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2">
                      <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{t.label}</div>
                      <div class="text-[12px] font-mono mt-0.5 truncate">{t.value}</div>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if e.settlement || e.receipt_hash}
                <div class="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--text-secondary)]">
                  {#if e.settlement?.status}
                    <span class="inline-flex items-center gap-1.5">Settlement <Badge variant={settlementVariant(e.settlement.status)}>{cap(e.settlement.status)}</Badge></span>
                  {/if}
                  {#if e.settlement?.tx_hash}
                    <a
                      href={txUrl(e.settlement.tx_hash, explorerBase($descriptor))}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 font-mono text-[var(--text-accent)] hover:underline"
                    >
                      {shortHex(e.settlement.tx_hash)} <ExternalLink class="h-3 w-3" strokeWidth={1.5} />
                    </a>
                  {/if}
                  {#if e.receipt_hash}
                    <a href="/explorer/receipts/{e.receipt_hash}" class="font-mono hover:text-[var(--text-primary)]">
                      receipt {shortHex(e.receipt_hash)}
                    </a>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
          {#if epochs.next}
            <div class="flex justify-center pt-2">
              <button type="button" class="btn-secondary" onclick={() => epochs.more()} disabled={epochs.loadingMore}>
                {epochs.loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Slashes tab -->
    {#if tab === 'slashes'}
      {#if slashes.loading}
        <LoadingBlock rows={4} height="72px" />
      {:else if slashes.error && slashes.items.length === 0}
        <ErrorState error={slashes.error} retry={reloadActive} />
      {:else if slashes.items.length === 0}
        <EmptyState
          illustration="security"
          title={slashStatusFilter || projectFilter ? 'No slashes match these filters' : 'No slashes on the testnet'}
          description="On the testnet collateral is slashed only for equivocation and for results that a validator audit proves invalid. Every slash has a dispute window before it executes."
        />
      {:else}
        <div class="space-y-3" data-testid="slashes-list">
          {#each slashes.items as s (s.evidence_hash)}
            <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="font-medium truncate">
                    {SLASH_KIND_LABEL[s.kind]} · {projectName(s.project_id)}
                  </div>
                  <div class="text-xs text-[var(--text-secondary)] mt-1 flex flex-wrap items-center gap-x-1">
                    <img src={minerAvatarDataUri(s.node_id)} alt="" class="inline-block w-[14px] h-[14px] rounded-[3px] align-text-bottom" />
                    <a href="/miners/{s.node_id}" class="font-mono hover:text-[var(--text-primary)]">{s.node_id}</a>
                    {#if s.amount} · {formatAmount(s.amount, NECTA.decimals)} NECTA{/if}
                    {#if s.bp !== undefined} ({bpToPercent(s.bp)} of bond){/if}
                    · {timeAgo(s.created_at)}
                    {#if s.status === 'proposed' && s.executable_at} · executable {timeAgo(s.executable_at)}{/if}
                  </div>
                  <div class="text-xs text-[var(--text-tertiary)] mt-1 flex flex-wrap items-center gap-3">
                    <span class="inline-flex items-center gap-1">evidence <CopyText value={s.evidence_hash} /></span>
                    {#if s.round_id}
                      <a href="/explorer/rounds/{encodeURIComponent(s.round_id)}" class="font-mono hover:text-[var(--text-primary)]">round {shortHex(s.round_id.replace(/^[a-z]+:/, ''))}</a>
                    {/if}
                    {#if s.propose_tx}
                      <a href={txUrl(s.propose_tx, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-mono text-[var(--text-accent)] hover:underline">
                        {shortHex(s.propose_tx)} <ExternalLink class="h-3 w-3" strokeWidth={1.5} />
                      </a>
                    {/if}
                  </div>
                </div>
                <Badge variant={slashVariant(s.status)}>{cap(s.status)}</Badge>
              </div>
            </div>
          {/each}
          {#if slashes.next}
            <div class="flex justify-center pt-2">
              <button type="button" class="btn-secondary" onclick={() => slashes.more()} disabled={slashes.loadingMore}>
                {slashes.loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
