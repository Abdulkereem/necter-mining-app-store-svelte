<script lang="ts">
  import toast from 'svelte-french-toast';
  import { hub } from '$lib/api/hub';
  import { errorMessage } from '$lib/api/http';
  import { useQuery } from '$lib/api/query.svelte';
  import type { Developer, Draft } from '$lib/api/types';
  import { signedIn } from '$lib/stores/wallet';
  import { formatToken, formatNumber, listingStatusLabel, categoryName, timeAgo, formatDate } from '$lib/format';
  import { HIVEKIT_TEMPLATES } from '$lib/develop/templates';
  import { pendingTxOf, isWizardDraft } from '$lib/develop/pending-tx';
  import DevSetupModal from '$lib/components/DevSetupModal.svelte';
  import SignInGate from '$lib/components/common/SignInGate.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
  import { Plus, Code, KeyRound, UserRound, FileEdit, Trash2, ShieldCheck, Clock, Send } from 'lucide-svelte';

  const BADGE: Record<string, { bg: string; text: string }> = {
    success: { bg: 'rgba(76,183,130,0.12)', text: 'var(--success)' },
    warning: { bg: 'rgba(242,153,74,0.12)', text: 'var(--warning)' },
    error: { bg: 'rgba(235,87,87,0.12)', text: 'var(--error)' },
    accent: { bg: 'var(--accent-subtle)', text: 'var(--text-accent)' },
    neutral: { bg: 'var(--surface-3)', text: 'var(--text-secondary)' },
  };

  // ── Data ──
  const devQ = useQuery(() => hub.myDeveloper(), { enabled: () => $signedIn });
  const developer = $derived(devQ.data ?? null);
  const enrollment = $derived(developer?.enrollment?.status ?? 'none');
  const enrolled = $derived(enrollment === 'active');

  const projectsQ = useQuery(() => hub.myProjects(), { enabled: () => $signedIn && enrolled });
  const draftsQ = useQuery(() => hub.drafts(), { enabled: () => $signedIn && enrolled });

  const projects = $derived(projectsQ.data?.items ?? []);
  const allDrafts = $derived(draftsQ.data?.items ?? []);
  const wizardDrafts = $derived(allDrafts.filter(isWizardDraft));
  const pendingTxs = $derived(allDrafts.map(pendingTxOf).filter((p) => !!p));

  const totalMiners = $derived(projects.reduce((s, p) => s + (p.miners ?? 0), 0));
  const listedCount = $derived(projects.filter((p) => p.listing_status === 'listed').length);

  let setupModalOpen = $state(false);
  let requestingVerification = $state(false);
  let deletingDraft = $state<string | null>(null);

  function onEnrolled(d: Developer) {
    devQ.set(d);
  }

  async function requestVerification() {
    requestingVerification = true;
    try {
      devQ.set(await hub.requestVerification());
      toast.success('Verification requested');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      requestingVerification = false;
    }
  }

  async function deleteDraft(d: Draft) {
    deletingDraft = d.draft_id;
    try {
      await hub.deleteDraft(d.draft_id);
      toast.success('Draft deleted');
      await draftsQ.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      deletingDraft = null;
    }
  }

  function draftName(d: Draft): string {
    const form = (d.data as { form?: { name?: unknown; slug?: unknown } })?.form;
    const n = typeof form?.name === 'string' && form.name.trim() ? form.name.trim() : null;
    const s = typeof form?.slug === 'string' && form.slug.trim() ? form.slug.trim() : null;
    return n ?? s ?? 'Untitled project';
  }

  const verificationLabel: Record<string, { label: string; variant: string }> = {
    verified: { label: 'Verified', variant: 'success' },
    pending: { label: 'Verification pending', variant: 'warning' },
    rejected: { label: 'Verification rejected', variant: 'error' },
    unverified: { label: 'Unverified', variant: 'neutral' },
  };
</script>

<svelte:head>
  <title>Developer Portal — Necter Mining App Store</title>
</svelte:head>

<SignInGate
  title="Developer Portal"
  description="Build mining projects on Necter. Sign in with your wallet to enroll as a developer, publish projects and manage your miners."
  illustration="platform"
>
  {#if devQ.loading && !devQ.data}
    <div class="px-6 pt-6 pb-12 max-w-[1152px] mx-auto">
      <LoadingBlock rows={3} height="88px" />
    </div>
  {:else if devQ.error}
    <div class="px-6 pt-6 pb-12 max-w-[1152px] mx-auto">
      <ErrorState error={devQ.error} retry={devQ.refresh} />
    </div>
  {:else if !enrolled}
    <!-- ── Not enrolled / pending ── -->
    <div class="animate-fadeIn px-4 md:px-6 pt-6 pb-12">
      <div class="max-w-[480px] mx-auto mt-10 md:mt-16">
        <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[12px] px-6 md:px-8 pt-8 pb-8 text-center">
          <img src="/brand/3d/cloud-infra.png" alt="" loading="lazy" class="w-20 h-auto mx-auto mb-5 opacity-80" />
          {#if enrollment === 'pending'}
            <h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-2">Enrollment Under Review</h2>
            <p class="text-[13px] text-[var(--text-secondary)] mx-auto mb-2 leading-5 max-w-[340px]">
              Your developer enrollment was submitted {timeAgo(developer?.enrollment?.submitted_at)}. You can publish projects once the operator activates it.
            </p>
            <span class="inline-flex items-center gap-1.5 text-[12px] text-[var(--warning)]"><Clock size={12} strokeWidth={1.5} /> Pending</span>
          {:else if enrollment === 'rejected'}
            <h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-2">Enrollment Not Approved</h2>
            <p class="text-[13px] text-[var(--text-secondary)] mx-auto mb-6 leading-5 max-w-[340px]">
              {developer?.enrollment?.notes ?? 'The operator did not approve your enrollment.'} You can update your details and submit again.
            </p>
            <button type="button" onclick={() => { setupModalOpen = true; }} class="btn-primary w-full h-10">Submit Again</button>
          {:else}
            <h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-2">Set Up Your Developer Account</h2>
            <p class="text-[13px] text-[var(--text-secondary)] mx-auto mb-6 leading-5 max-w-[340px]">
              {enrollment === 'draft'
                ? 'Your enrollment is saved as a draft. Finish it to start publishing mining projects.'
                : 'Enroll your wallet to publish mining projects, manage miners and track rewards on Necter.'}
            </p>
            <button type="button" onclick={() => { setupModalOpen = true; }} class="btn-primary w-full h-10">
              {enrollment === 'draft' ? 'Continue Enrollment' : 'Get Started'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    {@const ver = verificationLabel[developer?.verification?.status ?? 'unverified'] ?? verificationLabel.unverified}
    <!-- ── Developer dashboard ── -->
    <div class="animate-fadeIn px-4 md:px-6 pt-6 pb-12">
      <div class="max-w-[1152px] mx-auto flex flex-col gap-8">

        <!-- Header -->
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-[-0.015em]">Developer Portal</h1>
            <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{developer?.display_name ?? 'Developer'}</span>
              <span class="text-[10px] font-medium px-1.5 py-px rounded-[3px]" style="background:{BADGE[ver.variant].bg};color:{BADGE[ver.variant].text}">
                {#if ver.variant === 'success'}<ShieldCheck class="inline w-3 h-3 -mt-px" strokeWidth={2} />{/if}
                {ver.label}
              </span>
              {#if developer?.joined_at}<span>Joined {formatDate(developer.joined_at)}</span>{/if}
            </p>
          </div>
          <div class="flex gap-2 flex-wrap">
            {#if developer?.verification?.status === 'unverified' || developer?.verification?.status === 'rejected'}
              <button type="button" class="btn-secondary" disabled={requestingVerification} onclick={requestVerification}>
                <ShieldCheck class="w-3 h-3 mr-1" strokeWidth={1.5} />
                {requestingVerification ? 'Requesting…' : 'Request verification'}
              </button>
            {/if}
            <a href="/develop/profile" class="btn-secondary no-underline"><UserRound class="w-3 h-3 mr-1" strokeWidth={1.5} /> Profile</a>
            <a href="/develop/api-keys" class="btn-secondary no-underline"><KeyRound class="w-3 h-3 mr-1" strokeWidth={1.5} /> API Keys</a>
            <a href="/develop/create" class="btn-subscribe gap-1 no-underline">
              <Plus class="w-3 h-3" strokeWidth={2} />
              Create Project
            </a>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
          {#each [
            { label: 'Projects', value: projectsQ.data ? formatNumber(projects.length) : '—' },
            { label: 'Listed', value: projectsQ.data ? formatNumber(listedCount) : '—', accent: true },
            { label: 'Subscribed Miners', value: projectsQ.data ? formatNumber(totalMiners) : '—' },
            { label: 'Drafts', value: draftsQ.data ? formatNumber(wizardDrafts.length) : '—' },
          ] as s}
            <div class="bg-[var(--surface-1)] px-4 py-3.5">
              <span class="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">{s.label}</span>
              <span class="block text-[22px] font-semibold font-mono mt-1 tabular-nums" style="color:{s.accent ? 'var(--text-accent)' : 'var(--text-primary)'}">{s.value}</span>
            </div>
          {/each}
        </div>

        <!-- Awaiting transactions -->
        {#if pendingTxs.length > 0}
          <div class="bg-[var(--surface-1)] border border-[var(--border-accent)] rounded-[8px] p-4 flex flex-col gap-2">
            <span class="text-[13px] font-semibold text-[var(--text-primary)]">Transactions waiting to be sent</span>
            {#each pendingTxs as p (p?.draft_id)}
              {#if p}
                <div class="flex items-center justify-between gap-3 text-[12px]">
                  <span class="text-[var(--text-secondary)]">
                    {p.kind === 'register' ? 'Registration' : `Version ${p.version} publish`} · <span class="font-mono">{p.project_id.slice(0, 10)}…</span>
                  </span>
                  <a href="/develop/apps/{p.project_id}" class="btn-subscribe no-underline shrink-0"><Send class="w-3 h-3" strokeWidth={1.5} /> Open</a>
                </div>
              {/if}
            {/each}
          </div>
        {/if}

        <!-- Your Projects -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-[14px] font-semibold text-[var(--text-primary)]">Your Projects</span>
          </div>

          {#if projectsQ.loading && !projectsQ.data}
            <LoadingBlock rows={3} height="68px" grid />
          {:else if projectsQ.error}
            <ErrorState error={projectsQ.error} retry={projectsQ.refresh} />
          {:else if projects.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {#each projects as p (p.project_id)}
                {@const st = listingStatusLabel(p.listing_status)}
                <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] transition-colors overflow-hidden hover:border-[var(--border-hover)]">
                  <div class="flex items-center gap-3 px-4 py-3.5">
                    <a href="/develop/apps/{p.project_id}" class="flex items-center gap-3 flex-1 min-w-0 no-underline">
                      <ProjectIcon project={p} size={40} />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="text-[13px] font-medium text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
                          <span class="text-[10px] font-medium px-1.5 py-px rounded-[3px] shrink-0" style="background:{BADGE[st.variant].bg};color:{BADGE[st.variant].text}">
                            {st.label}
                          </span>
                        </div>
                        <span class="text-[11px] text-[var(--text-tertiary)]">{categoryName(p.category)}</span>
                      </div>
                      <div class="text-right shrink-0">
                        <span class="block text-[12px] font-mono text-[var(--text-primary)] tabular-nums">{formatNumber(p.miners ?? 0)} miners</span>
                        {#if p.avg_daily_reward_per_miner}
                          <span class="block text-[11px] font-mono text-[var(--text-tertiary)] tabular-nums">{formatToken(p.avg_daily_reward_per_miner, p.token)}/d avg</span>
                        {/if}
                      </div>
                    </a>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <EmptyState
              illustration="cloud"
              title="No projects yet"
              description="Upload a stateless worker module, set your reward economics and publish your first mining project."
            >
              <a href="/develop/create" class="btn-subscribe gap-1 no-underline">
                <Plus class="w-3 h-3" strokeWidth={2} />
                Create Project
              </a>
              <a href="/develop/templates" class="btn-secondary no-underline">Browse templates</a>
            </EmptyState>
          {/if}
        </div>

        <!-- Drafts -->
        {#if draftsQ.error}
          <ErrorState error={draftsQ.error} retry={draftsQ.refresh} compact />
        {:else if wizardDrafts.length > 0}
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-[14px] font-semibold text-[var(--text-primary)]">Drafts</span>
              <span class="text-[11px] text-[var(--text-tertiary)]">Saved privately on the Hub</span>
            </div>
            <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
              {#each wizardDrafts as d, i (d.draft_id)}
                <div class="flex items-center gap-3 px-4 py-3 {i > 0 ? 'border-t border-[var(--border-default)]' : ''}">
                  <FileEdit class="w-4 h-4 text-[var(--text-tertiary)] shrink-0" strokeWidth={1.5} />
                  <a href="/develop/create?draft={encodeURIComponent(d.draft_id)}" class="flex-1 min-w-0 no-underline">
                    <span class="block text-[13px] font-medium text-[var(--text-primary)] truncate">{draftName(d)}</span>
                    <span class="block text-[11px] text-[var(--text-tertiary)]">Step {d.current_step + 1} · updated {timeAgo(d.updated_at)}</span>
                  </a>
                  <a href="/develop/create?draft={encodeURIComponent(d.draft_id)}" class="btn-secondary no-underline shrink-0">Continue</a>
                  <button
                    type="button"
                    class="w-7 h-7 flex items-center justify-center rounded-[5px] bg-transparent border-none cursor-pointer hover:bg-[var(--surface-3)] shrink-0"
                    title="Delete draft"
                    disabled={deletingDraft === d.draft_id}
                    onclick={() => deleteDraft(d)}
                  >
                    <Trash2 class="w-3.5 h-3.5 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Templates -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <span class="text-[14px] font-semibold text-[var(--text-primary)]">HiveKit Templates</span>
              <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">Write a stateless worker module in your language, build a .hbc and publish it</p>
            </div>
            <a href="/develop/templates" class="text-[12px] text-[var(--text-accent)] no-underline">View all &rarr;</a>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {#each HIVEKIT_TEMPLATES.slice(0, 3) as t (t.id)}
              <a
                href="/develop/templates#{t.id}"
                class="flex flex-col rounded-[8px] border border-[var(--border-default)] overflow-hidden no-underline transition-all hover:border-[var(--border-hover)] hover:-translate-y-px"
              >
                <div class="flex items-center gap-2.5 px-4 pt-5 pb-4" style="background:var(--surface-2)">
                  <Code style="width:24px;height:24px;color:var(--text-secondary);opacity:0.8" strokeWidth={1.5} />
                  <span class="text-[14px] font-semibold text-white">{t.name}</span>
                </div>
                <div class="px-4 pt-3 pb-3.5 bg-[var(--surface-1)] flex-1 flex flex-col">
                  <p class="text-[11px] text-[var(--text-secondary)] leading-4 mb-2.5">{t.description}</p>
                  <div class="flex items-center justify-between mt-auto">
                    <span class="text-[10px] text-[var(--text-tertiary)] font-mono">{t.sdk}</span>
                    <span class="text-[11px] font-medium text-[var(--text-accent)]">Use &rarr;</span>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>

      </div>
    </div>
  {/if}
</SignInGate>

<DevSetupModal bind:open={setupModalOpen} {developer} onenrolled={onEnrolled} />
