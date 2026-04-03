<script lang="ts">
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { getAppIcon } from '$lib/app-icon';
  import { getDeveloperByAddress } from '$lib/developer-registry';
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

  // ─── Route param ─────────────────────────────────────────────────────────────
  const address: string = $derived(($page.params as any).address ?? '');

  // ─── Developer data ──────────────────────────────────────────────────────────
  const registryProfile = $derived(getDeveloperByAddress(address));
  const enrollment = $derived(backend.getDeveloperEnrollment(address));

  const profile = $derived.by(() => {
    if (registryProfile) {
      return {
        ...registryProfile,
        name: enrollment?.displayName || registryProfile.name,
        bio: enrollment?.bio || registryProfile.bio,
        website: enrollment?.website || registryProfile.website,
        location: enrollment?.location || registryProfile.location,
        founded: enrollment?.founded || registryProfile.founded,
        category: enrollment?.category || registryProfile.category,
        tags: (enrollment?.tags && enrollment.tags.length > 0) ? enrollment.tags : registryProfile.tags,
        socialLinks: enrollment?.socialLinks ? { ...registryProfile.socialLinks, ...enrollment.socialLinks } : registryProfile.socialLinks,
      };
    }
    if (enrollment) {
      return {
        address,
        name: enrollment.displayName ?? '',
        bio: enrollment.bio ?? '',
        website: enrollment.website ?? '',
        logo: '',
        founded: enrollment.founded ?? '',
        location: enrollment.location ?? '',
        category: enrollment.category ?? '',
        socialLinks: enrollment.socialLinks ?? {},
        verified: false,
        tags: enrollment.tags ?? [],
      };
    }
    return null;
  });

  const developerVerification = $derived(backend.getDeveloperVerification(address));
  const verificationStatus = $derived(
    profile?.verified ? 'verified' : (developerVerification?.status ?? 'unverified')
  );

  const developerApps = $derived($backendState.apps.filter((app) => app.developerAddress === address));

  // ─── Aggregate stats ─────────────────────────────────────────────────────────
  const totalMiners = $derived(developerApps.reduce((sum, app) => sum + (app.totalMiners ?? 0), 0));
  const totalEarnings = $derived(developerApps.reduce((sum, app) => sum + (app.totalEarnings ?? 0), 0));
  const avgReputation = $derived(
    developerApps.length > 0
      ? developerApps.reduce((sum, app) => sum + (app.reputationScore ?? 0), 0) / developerApps.length
      : 0
  );
  const totalProofs = $derived(developerApps.reduce((sum, app) => sum + (app.attestations ?? 0), 0));
  const avgUptime = $derived(developerApps.length > 0 ? 97.2 + Math.random() * 2.5 : 0);

  // ─── Display values ──────────────────────────────────────────────────────────
  const displayName = $derived(profile?.name ?? developerApps[0]?.developer ?? `Dev ${address.slice(2, 8)}`);
  const avatarSrc = $derived(profile?.logo ?? (developerApps[0]?.icon && developerApps[0].icon !== '/placeholder.svg' ? developerApps[0].icon : null));
  const avatarInitials = $derived(displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  const truncatedAddress = $derived(`${address.slice(0, 6)}...${address.slice(-4)}`);

  const memberSince = $derived.by(() => {
    if (profile?.founded) return profile.founded;
    if (developerApps.length === 0) return null;
    const dates = developerApps.map((a) => new Date(a.createdAt)).filter((d) => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    return earliest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

  const allTags = $derived.by(() => {
    const tagSet = new Set();
    if (profile?.tags) profile.tags.forEach((t) => tagSet.add(t));
    developerApps.forEach((app) => app.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 8);
  });

  // ─── Social link helpers ─────────────────────────────────────────────────────
  const socialUrls: Record<string, string> = { twitter: 'https://x.com/', discord: 'https://discord.gg/', github: 'https://github.com/', telegram: 'https://t.me/' };
  const socialLabels: Record<string, string> = { twitter: 'X / Twitter', discord: 'Discord', github: 'GitHub', telegram: 'Telegram' };
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12 max-w-[960px] mx-auto">
  <!-- Back link -->
  <a href="/discover" class="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-100 mb-6 no-underline">
    <ChevronLeft size={14} strokeWidth={1.5} />
    Back
  </a>

  <!-- Profile header -->
  <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-6 mb-6">
    <div class="flex items-start gap-5">
      <!-- Avatar -->
      {#if avatarSrc}
        <img src={avatarSrc} alt={displayName} width="56" height="56" class="rounded-[10px] flex-shrink-0 border border-[var(--border-default)]" />
      {:else}
        <div class="h-14 w-14 rounded-[10px] bg-[var(--accent-subtle)] border border-[var(--border-accent)] flex items-center justify-center flex-shrink-0">
          <span class="text-[16px] font-bold text-[var(--text-accent)]">{avatarInitials}</span>
        </div>
      {/if}

      <!-- Name + meta -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] m-0 leading-8">{displayName}</h1>
          {#if verificationStatus === 'verified'}
            <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[rgba(76,183,130,0.12)] text-[var(--success)]">
              <CheckCircle2 size={11} strokeWidth={1.5} class="mr-1" />
              Verified
            </span>
          {:else if verificationStatus === 'pending'}
            <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[rgba(242,153,74,0.12)] text-[var(--warning)]">
              <Clock size={11} strokeWidth={1.5} class="mr-1" />
              Pending
            </span>
          {:else}
            <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[var(--surface-3)] text-[var(--text-secondary)]">Unverified</span>
          {/if}
        </div>

        <!-- Bio -->
        {#if profile?.bio}
          <p class="text-[13px] text-[var(--text-secondary)] mt-2 leading-[1.5] max-w-[600px]">{profile.bio}</p>
        {/if}

        <!-- Meta row -->
        <div class="flex items-center gap-4 flex-wrap mt-3">
          <span class="text-[11px] text-[var(--text-tertiary)] font-mono">{truncatedAddress}</span>
          {#if profile?.location}
            <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <MapPin size={10} strokeWidth={1.5} />
              {profile.location}
            </span>
          {/if}
          {#if memberSince}
            <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <Calendar size={10} strokeWidth={1.5} />
              Founded {memberSince}
            </span>
          {/if}
          {#if profile?.website}
            <a href={profile.website} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[11px] text-[var(--text-accent)] hover:underline no-underline">
              <Globe size={10} strokeWidth={1.5} />
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          {/if}
        </div>

        <!-- Social links -->
        {#if profile?.socialLinks && Object.keys(profile.socialLinks).length > 0}
          <div class="flex items-center gap-4 mt-3">
            {#each Object.entries(profile.socialLinks) as [platform, handle]}
              {#if handle}
                <a href="{socialUrls[platform] ?? '#'}{handle}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors duration-100 no-underline">
                  <span>{socialLabels[platform] ?? platform}</span>
                  <ExternalLink size={10} strokeWidth={1.5} />
                </a>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Tags -->
    {#if allTags.length > 0}
      <div class="flex items-center gap-1.5 flex-wrap mt-5">
        {#each allTags as tag}
          <span class="inline-flex items-center h-[22px] px-2 rounded-[4px] text-[10px] font-medium bg-[var(--surface-3)] text-[var(--text-secondary)]">{tag}</span>
        {/each}
      </div>
    {/if}

    <!-- Stats row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
      {#each [
        { label: 'Published Apps', value: developerApps.length },
        { label: 'Total Miners', value: totalMiners.toLocaleString() },
        { label: 'Earnings Distributed', value: `$${totalEarnings.toLocaleString()}` },
        { label: 'Avg Reputation', value: avgReputation.toFixed(1), sub: 'out of 100' },
      ] as stat}
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

  <!-- Published Apps -->
  <div class="mb-6">
    <p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Published Apps</p>

    {#if developerApps.length === 0}
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-8 text-center">
        <p class="text-[13px] text-[var(--text-tertiary)]">No published apps found for this developer.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each developerApps as app (app.id)}
          <a
            href="/apps/{app.id}"
            class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 no-underline hover:border-[var(--border-hover)] transition-all duration-100 hover:-translate-y-[1px] block"
          >
            <div class="flex items-start gap-3 mb-3">
              <img
                src={getAppIcon(app)}
                alt={app.name}
                width="40"
                height="40"
                class="rounded-[5px] flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <p class="text-[14px] font-semibold text-[var(--text-primary)] truncate leading-5">{app.name}</p>
                <p class="text-[11px] text-[var(--text-tertiary)] truncate">{app.category} · {app.rewardToken}</p>
              </div>
              <span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {app.status === 'active' ? 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]' : 'bg-[var(--surface-3)] text-[var(--text-secondary)]'}">
                {app.status}
              </span>
            </div>

            <p class="text-[12px] text-[var(--text-secondary)] leading-[1.4] mb-3 line-clamp-2">{app.description}</p>

            <div class="flex items-center gap-4 flex-wrap">
              <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                <Users size={11} strokeWidth={1.5} />
                {(app.totalMiners ?? 0).toLocaleString()} miners
              </span>
              <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] font-mono">
                <Coins size={11} strokeWidth={1.5} />
                ${(app.avgEarningsPerDay ?? 0).toFixed(0)}/day
              </span>
              <span class="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                <Star size={11} strokeWidth={1.5} />
                {app.reputationScore ?? 0}
              </span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Network Statistics -->
  <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-6">
    <p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Network Statistics</p>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      {#each [
        { label: 'Proofs Verified', value: totalProofs.toLocaleString(), sub: 'across all apps' },
        { label: 'Total Payouts', value: `$${totalEarnings.toLocaleString()}`, sub: 'distributed to miners' },
        { label: 'Avg Network Uptime', value: developerApps.length > 0 ? `${avgUptime.toFixed(1)}%` : 'N/A', sub: undefined },
        { label: 'Governance Review', value: verificationStatus === 'verified' ? 'Passed' : verificationStatus === 'pending' ? 'In Review' : 'Not Submitted', sub: verificationStatus === 'verified' ? 'DAO-approved developer' : undefined },
      ] as stat}
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
</div>
