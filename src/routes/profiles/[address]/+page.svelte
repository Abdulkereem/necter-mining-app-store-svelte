<script lang="ts">
  import { page } from '$app/state';
  import {
    CheckCircle2,
    Clock,
    Users,
    Coins,
    Star,
    Globe,
    ChevronLeft,
    ExternalLink,
    Calendar,
    MapPin,
  } from 'lucide-svelte';
  import { hub } from '$lib/api/hub';
  import { useQuery } from '$lib/api/query.svelte';
  import type { Project, ProjectSummary } from '$lib/api/types';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import {
    bpToPercent,
    formatDate,
    formatNumber,
    formatRating,
    formatToken,
    shortAddress,
    categoryShort,
    listingStatusLabel
  } from '$lib/format';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
  import CopyText from '$lib/components/common/CopyText.svelte';

  // ─── Route param ─────────────────────────────────────────────────────────────
  const address = $derived((page.params.address ?? '').toLowerCase());
  const validAddress = $derived(/^0x[0-9a-f]{40}$/.test(address));

  // ─── Data ────────────────────────────────────────────────────────────────────
  const profile = useQuery(() => (validAddress ? hub.account(address) : Promise.resolve(null)));
  const developer = $derived(profile.data?.developer ?? null);
  const isDeveloper = $derived(!!developer && developer.enrollment?.status === 'active');

  const minedIds = $derived(profile.data?.projects ?? []);
  const mined = useQuery(async () => {
    const ids = minedIds;
    if (ids.length === 0) return [] as Project[];
    const rows = await Promise.all(ids.slice(0, 30).map((id) => hub.project(id).catch(() => null)));
    return rows.filter((p): p is Project => !!p);
  });

  const published = useQuery(() => hub.projects({ developer: address, limit: 100 }), {
    enabled: () => validAddress && !!developer
  });
  const publishedItems = $derived<ProjectSummary[]>(published.data?.items ?? []);

  // ─── Display values ──────────────────────────────────────────────────────────
  const displayName = $derived(profile.data?.display_name ?? developer?.display_name ?? shortAddress(address));
  const avatarSrc = $derived(
    developer?.logo && developer.logo.startsWith('https://') ? developer.logo : minerAvatarDataUri(address)
  );
  const verificationStatus = $derived(developer?.verification?.status ?? null);

  // ─── Social link helpers ─────────────────────────────────────────────────────
  const socialUrls: Record<string, string> = { twitter: 'https://x.com/', discord: 'https://discord.gg/', github: 'https://github.com/', telegram: 'https://t.me/' };
  const socialLabels: Record<string, string> = { twitter: 'X / Twitter', discord: 'Discord', github: 'GitHub', telegram: 'Telegram' };
  const socials = $derived(
    Object.entries(developer?.social ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0)
  );
  function socialHref(platform: string, handle: string): string {
    if (/^https:\/\//.test(handle)) return handle;
    return `${socialUrls[platform] ?? 'https://'}${handle.replace(/^@/, '')}`;
  }
  const safeWebsite = $derived(developer?.website && /^https?:\/\//.test(developer.website) ? developer.website : null);
</script>

<svelte:head>
  <title>{displayName} — Profile · Necter</title>
</svelte:head>

<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12 max-w-[960px] mx-auto">
  <!-- Back link -->
  <a href="/leaderboards" class="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-100 mb-6 no-underline">
    <ChevronLeft size={14} strokeWidth={1.5} />
    Back
  </a>

  {#if profile.loading}
    <LoadingBlock rows={3} height="120px" />
  {:else if profile.error}
    <ErrorState error={profile.error} retry={profile.refresh} />
  {:else if !profile.data}
    <EmptyState
      illustration="bee"
      title="No profile for this address"
      description={validAddress
        ? 'This wallet has not mined or published on the Necter testnet yet.'
        : 'That is not a valid wallet address. Profiles are addressed by a 0x… Ethereum address.'}
    >
      <a href="/leaderboards" class="btn-secondary">Leaderboards</a>
      <a href="/discover" class="btn-secondary">Browse projects</a>
    </EmptyState>
  {:else}
    {@const p = profile.data}
    <!-- Profile header -->
    <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-6 mb-6">
      <div class="flex items-start gap-5">
        <img src={avatarSrc} alt="" width="56" height="56" class="rounded-[10px] flex-shrink-0 border border-[var(--border-default)] object-cover" referrerpolicy="no-referrer" />

        <!-- Name + meta -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] m-0 leading-8 break-all">{displayName}</h1>
            {#if developer}
              {#if verificationStatus === 'verified'}
                <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[rgba(76,183,130,0.12)] text-[var(--success)]">
                  <CheckCircle2 size={11} strokeWidth={1.5} class="mr-1" />
                  Verified developer
                </span>
              {:else if verificationStatus === 'pending'}
                <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[rgba(242,153,74,0.12)] text-[var(--warning)]">
                  <Clock size={11} strokeWidth={1.5} class="mr-1" />
                  Verification pending
                </span>
              {:else if isDeveloper}
                <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[var(--surface-3)] text-[var(--text-secondary)]">Developer</span>
              {/if}
            {/if}
            {#if (p.devices_total ?? 0) > 0}
              <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[var(--accent-subtle)] text-[var(--text-accent)]">Miner</span>
            {/if}
          </div>

          <!-- Bio -->
          {#if developer?.bio}
            <p class="text-[13px] text-[var(--text-secondary)] mt-2 leading-[1.5] max-w-[600px]">{developer.bio}</p>
          {/if}

          <!-- Meta row -->
          <div class="flex items-center gap-4 flex-wrap mt-3">
            <CopyText value={p.address} class="!text-[11px] !text-[var(--text-tertiary)]" />
            {#if developer?.location}
              <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                <MapPin size={10} strokeWidth={1.5} />
                {developer.location}
              </span>
            {/if}
            {#if p.first_seen_at}
              <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                <Calendar size={10} strokeWidth={1.5} />
                First seen {formatDate(p.first_seen_at)}
              </span>
            {/if}
            {#if safeWebsite}
              <a href={safeWebsite} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[11px] text-[var(--text-accent)] hover:underline no-underline">
                <Globe size={10} strokeWidth={1.5} />
                {safeWebsite.replace(/^https?:\/\//, '')}
              </a>
            {/if}
          </div>

          <!-- Social links -->
          {#if socials.length > 0}
            <div class="flex items-center gap-4 mt-3 flex-wrap">
              {#each socials as [platform, handle] (platform)}
                <a href={socialHref(platform, handle)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors duration-100 no-underline">
                  <span>{socialLabels[platform] ?? platform}</span>
                  <ExternalLink size={10} strokeWidth={1.5} />
                </a>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        {#each [
          { label: 'Devices Online', value: `${formatNumber(p.devices_online ?? 0)} / ${formatNumber(p.devices_total ?? 0)}`, sub: 'online / total' },
          { label: 'Projects Mined', value: formatNumber(p.projects?.length ?? 0), sub: undefined },
          { label: 'Compute Units', value: formatNumber(p.units_30d), sub: 'last 30 days' },
          { label: 'Avg Reputation', value: bpToPercent(p.reputation_avg), sub: 'across subscriptions' },
        ] as stat (stat.label)}
          <div class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1">
            <p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">{stat.label}</p>
            <p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono">{stat.value}</p>
            {#if stat.sub}
              <p class="text-[11px] text-[var(--text-tertiary)]">{stat.sub}</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Projects mined -->
    <div class="mb-6">
      <p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Projects Mined</p>
      {#if minedIds.length === 0}
        <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-8 text-center">
          <p class="text-[13px] text-[var(--text-tertiary)]">This wallet has no project subscriptions yet.</p>
        </div>
      {:else if mined.loading}
        <LoadingBlock rows={2} grid height="72px" />
      {:else if mined.error}
        <ErrorState error={mined.error} retry={mined.refresh} compact />
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each mined.data ?? [] as app (app.project_id)}
            <a
              href="/apps/{app.project_id}"
              class="flex items-center gap-3 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-3 no-underline hover:border-[var(--border-hover)] transition-all duration-100"
            >
              <ProjectIcon project={app} size={36} rounded="5px" />
              <div class="min-w-0">
                <p class="text-[13px] font-medium text-[var(--text-primary)] truncate">{app.name}</p>
                <p class="text-[11px] text-[var(--text-tertiary)] truncate">{categoryShort(app.category)} · {app.token.symbol}</p>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Published projects (developer) -->
    {#if developer}
      <div class="mb-6">
        <div class="flex items-center justify-between gap-3 mb-3">
          <p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Published Projects</p>
          {#if developer.joined_at}
            <span class="text-[11px] text-[var(--text-tertiary)]">Developer since {formatDate(developer.joined_at)}</span>
          {/if}
        </div>

        {#if published.loading}
          <LoadingBlock rows={3} grid height="140px" />
        {:else if published.error}
          <ErrorState error={published.error} retry={published.refresh} compact />
        {:else if publishedItems.length === 0}
          <EmptyState compact illustration="platform" title="No published projects yet" description="Projects this developer publishes and gets listed will appear here." />
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each publishedItems as app (app.project_id)}
              {@const st = listingStatusLabel(app.listing_status)}
              <a
                href="/apps/{app.project_id}"
                class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 no-underline hover:border-[var(--border-hover)] transition-all duration-100 hover:-translate-y-[1px] block"
              >
                <div class="flex items-start gap-3 mb-3">
                  <ProjectIcon project={app} size={40} rounded="5px" />
                  <div class="flex-1 min-w-0">
                    <p class="text-[14px] font-semibold text-[var(--text-primary)] truncate leading-5">{app.name}</p>
                    <p class="text-[11px] text-[var(--text-tertiary)] truncate">{categoryShort(app.category)} · {app.token.symbol}</p>
                  </div>
                  <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {st.variant === 'success' ? 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]' : st.variant === 'warning' ? 'bg-[rgba(242,153,74,0.12)] text-[var(--warning)]' : 'bg-[var(--surface-3)] text-[var(--text-secondary)]'}">
                    {st.label}
                  </span>
                </div>

                {#if app.tagline}
                  <p class="text-[12px] text-[var(--text-secondary)] leading-[1.4] mb-3 line-clamp-2">{app.tagline}</p>
                {/if}

                <div class="flex items-center gap-4 flex-wrap">
                  <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                    <Users size={11} strokeWidth={1.5} />
                    {formatNumber(app.miners ?? 0)} miners
                  </span>
                  {#if app.avg_daily_reward_per_miner}
                    <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] font-mono">
                      <Coins size={11} strokeWidth={1.5} />
                      {formatToken(app.avg_daily_reward_per_miner, app.token)}/day
                    </span>
                  {/if}
                  {#if app.average_rating_x100 !== null && app.average_rating_x100 !== undefined}
                    <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                      <Star size={11} strokeWidth={1.5} />
                      {formatRating(app.average_rating_x100)}
                    </span>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
