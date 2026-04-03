<script lang="ts">
	import { showToast } from '$lib/stores/toast';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { getAppIcon } from '$lib/app-icon';
  import {
    ChevronLeft,
    Save,
    Send,
  } from 'lucide-svelte';

  // ─── Route param ──────────────────────────────────────────────────────────
  const appId = $derived($page.params.appId);

  // ─── Backend / Wallet ─────────────────────────────────────────────────────
  const reviewerId = $derived($actor?.walletAddress ?? null);
  const roles = $derived($actor?.walletAddress ? backend.listRoles($actor.walletAddress) : []);
  const hasGovRole = $derived(roles.includes('governance'));
  const app = $derived($backendState.apps.find((a) => a.id === appId) ?? null);
  const decision = $derived($backendState.governance.find((g) => g.appId === appId) ?? null);

  const existing = $derived(reviewerId ? backend.getGovernanceReview(appId as string, reviewerId) : null);
  const reports = $derived(backend.listAppReports({ appId: appId as string, limit: 25 }));
  const submittedReviews = $derived(backend.listGovernanceReviews(appId as string).filter((r) => r.status === 'submitted'));

  // ─── Form state ───────────────────────────────────────────────────────────
  let overallScore = $state(7);
  let securityRating = $state('safe');
  let economicFairness = $state('fair');
  let technicalQuality = $state('medium');
  let recommendation = $state('approve');
  let comments = $state('');
  let conditions = $state('');

  // Sync from existing review when it loads
  $effect(() => {
    if (existing) {
      overallScore = existing.overallScore;
      securityRating = existing.securityRating;
      economicFairness = existing.economicFairness;
      technicalQuality = existing.technicalQuality;
      recommendation = existing.recommendation;
      comments = existing.comments;
      conditions = existing.conditions ?? '';
    }
  });

  // ─── Vote progress ───────────────────────────────────────────────────────
  const totalVotes = $derived(decision ? decision.yesVotes + decision.noVotes : 0);
  const yesPct = $derived(totalVotes > 0 ? (decision!.yesVotes / totalVotes) * 100 : 0);

  // ─── Save / Submit ────────────────────────────────────────────────────────
  function save(status: any) {
    if (!$actor) { $showConnectModal = true; return; }
    if (!hasGovRole) {
      backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true });
    }
    backend.upsertGovernanceReview({
      appId: appId as string,
      reviewerId: $actor.walletAddress,
      status,
      submittedAt: status === 'submitted' ? new Date().toISOString() : undefined,
      overallScore,
      securityRating: securityRating as any,
      economicFairness: economicFairness as any,
      technicalQuality: technicalQuality as any,
      compliance: 'pass',
      recommendation: recommendation as any,
      comments,
      conditions: recommendation === 'conditional' ? conditions : '',
    });
    showToast(status === 'submitted' ? 'Review submitted' : 'Draft saved');
    if (status === 'submitted') goto('/governance');
  }

  // ─── Recommendation button helpers ────────────────────────────────────────
  const recOptions = ['approve', 'conditional', 'reject'];

  function recButtonStyle(opt: any) {
    const isSelected = recommendation === opt;
    const bg = isSelected
      ? opt === 'approve' ? 'rgba(76,183,130,0.15)' : opt === 'reject' ? 'rgba(235,87,87,0.15)' : 'var(--accent-subtle)'
      : 'var(--surface-2)';
    const color = isSelected
      ? opt === 'approve' ? 'var(--success)' : opt === 'reject' ? 'var(--error)' : 'var(--text-accent)'
      : 'var(--text-secondary)';
    return `height: 32px; padding: 0 14px; border-radius: 5px; font-size: 12px; font-weight: 500; border: none; cursor: pointer; background: ${bg}; color: ${color}; transition: all 100ms;`;
  }

  function recLabel(opt: any) {
    return opt === 'approve' ? 'Approve' : opt === 'conditional' ? 'Conditional' : 'Reject';
  }
</script>

{#if !app}
  <div class="animate-fadeIn px-8 pt-8 pb-12" style="max-width: 800px; margin: 0 auto;">
    <a href="/governance" class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6">
      <ChevronLeft class="h-3.5 w-3.5" />
      Back to Governance
    </a>
    <div class="p-12 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center">
      <p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">App not found</p>
    </div>
  </div>
{:else}
  <div class="animate-fadeIn px-8 pt-8 pb-12" style="max-width: 800px; margin: 0 auto;">
    <!-- Back -->
    <a href="/governance" class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6">
      <ChevronLeft class="h-3.5 w-3.5" />
      Back to Governance
    </a>

    <!-- Header -->
    <div class="flex items-start gap-4 mb-8">
      <img src={getAppIcon(app)} alt="" class="h-14 w-14 rounded-[12px] flex-shrink-0" />
      <div class="flex-1">
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">{app.name}</h1>
        <p class="text-[13px] text-[var(--text-secondary)] mt-0.5">{app.category} · {app.developer}</p>
        {#if decision}
          <div class="mt-3">
            <div class="flex justify-between text-[11px] text-[var(--text-tertiary)] mb-1">
              <span>{decision.yesVotes} yes</span>
              <span>{decision.yesVotes + decision.noVotes} of {decision.requiredAttestations} votes</span>
              <span>{decision.noVotes} no</span>
            </div>
            <!-- Progress bar -->
            <div class="h-1.5 rounded-full w-full bg-[var(--surface-3)] overflow-hidden">
              <div class="h-full bg-[var(--text-accent)] rounded-full transition-all" style="width: {yesPct}%"></div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Network details -->
    <div class="mb-8">
      <h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">Network Details</h2>
      <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
        <p class="px-4 py-3 text-[13px] text-[var(--text-secondary)] leading-[20px] border-b border-[var(--border)]">{app.description}</p>
        <div class="grid grid-cols-2 divide-x divide-[var(--border)]">
          {#each [
            { label: 'Consensus', value: app.consensusMechanism ?? 'N/A' },
            { label: 'Verification', value: app.verificationMethod ?? 'N/A' },
            { label: 'Reward Model', value: app.rewardModel ?? 'N/A' },
            { label: 'Avg Earnings', value: `$${app.avgEarningsPerDay.toFixed(2)}/day` },
            { label: 'Reputation', value: `${app.reputationScore}/100` },
            { label: 'Reward Token', value: app.rewardToken },
          ] as row (row.label)}
            <div class="px-4 py-2.5 flex justify-between items-baseline border-b border-[var(--border)]">
              <span class="text-[11px] text-[var(--text-tertiary)]">{row.label}</span>
              <span class="text-[12px] text-[var(--text-primary)] font-mono">{row.value}</span>
            </div>
          {/each}
        </div>
        {#if app.requirements}
          <div class="px-4 py-3 border-t border-[var(--border)]">
            <span class="text-[11px] text-[var(--text-tertiary)]">Requirements: </span>
            <span class="text-[12px] text-[var(--text-secondary)]">
              {Object.entries(app.requirements).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Reports (if any) -->
    {#if reports.length > 0}
      <div class="mb-8">
        <h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">Miner Reports ({reports.length})</h2>
        <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden divide-y divide-[var(--border)]">
          {#each reports.slice(0, 5) as r (r.id)}
            <div class="px-4 py-3">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-[12px] text-[var(--text-primary)]">{r.category} · {r.severity}</span>
                <span class="text-[10px] text-[var(--text-tertiary)] font-mono">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <p class="text-[12px] text-[var(--text-secondary)] mt-1 leading-[17px]">{r.reason}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Other reviews -->
    {#if submittedReviews.length > 0}
      <div class="mb-8">
        <h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">Reviewer Assessments ({submittedReviews.length})</h2>
        <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden divide-y divide-[var(--border)]">
          {#each submittedReviews as r (r.id)}
            <div class="px-4 py-3">
              <div class="flex items-baseline justify-between">
                <span class="text-[12px] font-mono text-[var(--text-primary)]">{r.reviewerId.slice(0, 10)}...</span>
                <span class="text-[13px] font-semibold text-[var(--text-primary)]">{r.overallScore}/10</span>
              </div>
              <div class="text-[11px] text-[var(--text-tertiary)] mt-0.5 capitalize">{r.recommendation}</div>
              {#if r.comments}
                <p class="text-[12px] text-[var(--text-secondary)] mt-1.5 leading-[17px]">{r.comments}</p>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Your assessment -->
    <div>
      <h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">Your Assessment</h2>
      <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] p-5 space-y-5">

        <!-- Score slider -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-[12px] font-medium text-[var(--text-primary)]">Overall Score</span>
            <span class="text-[18px] font-semibold text-[var(--text-primary)] font-mono">{overallScore}/10</span>
          </div>
          <input
            type="range"
            bind:value={overallScore}
            min="1"
            max="10"
            step="1"
            class="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--text-accent)] bg-[var(--surface-3)]"
          />
        </div>

        <!-- Rating grid -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Security</span>
            <select
              bind:value={securityRating}
              class="w-full h-8 px-2 text-[12px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--text-accent)] transition-colors appearance-none cursor-pointer"
            >
              <option value="safe">Safe</option>
              <option value="concerns">Concerns</option>
              <option value="unsafe">Unsafe</option>
            </select>
          </div>
          <div>
            <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Economics</span>
            <select
              bind:value={economicFairness}
              class="w-full h-8 px-2 text-[12px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--text-accent)] transition-colors appearance-none cursor-pointer"
            >
              <option value="fair">Fair</option>
              <option value="questionable">Questionable</option>
              <option value="unfair">Unfair</option>
            </select>
          </div>
          <div>
            <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Technical</span>
            <select
              bind:value={technicalQuality}
              class="w-full h-8 px-2 text-[12px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--text-accent)] transition-colors appearance-none cursor-pointer"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <!-- Recommendation -->
        <div>
          <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Recommendation</span>
          <div class="flex gap-2">
            {#each recOptions as opt}
              <button
                type="button"
                onclick={() => { recommendation = opt; }}
                style={recButtonStyle(opt)}
              >
                {recLabel(opt)}
              </button>
            {/each}
          </div>
        </div>

        <!-- Comments -->
        <div>
          <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Comments</span>
          <textarea
            bind:value={comments}
            placeholder="Your assessment of this network..."
            rows="5"
            class="w-full px-3 py-2 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none outline-none focus:border-[var(--text-accent)] transition-colors"
          ></textarea>
        </div>

        {#if recommendation === 'conditional'}
          <div>
            <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Conditions for approval</span>
            <textarea
              bind:value={conditions}
              placeholder="What must be addressed before full approval..."
              rows="3"
              class="w-full px-3 py-2 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none outline-none focus:border-[var(--text-accent)] transition-colors"
            ></textarea>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" onclick={() => save('in_progress')}>
            <Save class="h-3.5 w-3.5" /> Save Draft
          </button>
          <button type="button" class="btn-subscribe" onclick={() => save('submitted')}>
            <Send class="h-3.5 w-3.5" /> Submit Review
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
