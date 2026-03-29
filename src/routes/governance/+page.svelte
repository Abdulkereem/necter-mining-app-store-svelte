<script>
	import { showToast } from '$lib/stores/toast';
  import { goto } from '$app/navigation';
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { appIconDataUri } from '$lib/app-icon';
  import {
    CheckCircle2,
    XCircle,
    AlertCircle,
  } from 'lucide-svelte';

  // ─── Backend / Wallet ──────────────────────────────────────────────────────
  const pendingListings = $derived(
    $backendState.governance.filter((g) => g.status === 'review' || g.status === 'voting' || g.status === 'executing')
  );
  const proposals = $derived(backend.listGovernanceProposals());

  const roles = $derived($actor?.walletAddress ? backend.listRoles($actor.walletAddress) : []);
  const hasGovRole = $derived(roles.includes('governance'));

  // ─── Create proposal modal state ──────────────────────────────────────────
  let showCreateModal = $state(false);
  let propTitle = $state('');
  let propDesc = $state('');
  let propType = $state('parameter-update');
  let propDuration = $state(7);
  const canSubmitProp = $derived(propTitle.trim().length >= 6 && propDesc.trim().length >= 20);

  // ─── Safe action wrapper ──────────────────────────────────────────────────
  function safe(fn) {
    try {
      fn();
    } catch (e) {
      showToast(e?.message ?? 'Please try again.');
    }
  }

  // ─── Derived: pending queue ───────────────────────────────────────────────
  const pendingQueue = $derived(
    pendingListings
      .map((g) => {
        const app = $backendState.apps.find((a) => a.id === g.appId) ?? null;
        const ageDays = Math.floor((new Date($backendState.updatedAt).getTime() - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return { g, app, ageDays };
      })
      .sort((a, b) => new Date(b.g.createdAt).getTime() - new Date(a.g.createdAt).getTime())
  );

  // ─── Derived: developer verifications ─────────────────────────────────────
  const pendingDeveloperVerifications = $derived(
    Object.values($backendState.developerVerificationByAddress ?? {})
      .filter((r) => r.status === 'pending')
  );

  const pendingDeveloperEnrollments = $derived(
    Object.values($backendState.developerEnrollmentByAddress ?? {})
      .filter((r) => r.status === 'pending')
  );

  // ─── Derived: moderation cases & apps lookup ──────────────────────────────
  const moderationCases = $derived(backend.listModerationCases({ status: 'open', limit: 25 }));
  const appsById = $derived(new Map($backendState.apps.map((a) => [a.id, a])));

  // ─── Derived: vote items ──────────────────────────────────────────────────
  const voteItems = $derived((() => {
    const activeProposals = proposals.filter((p) => p.status === 'active');
    return [
      ...activeProposals.map((p) => ({ kind: 'proposal', createdAt: p.createdAt, data: p })),
      ...pendingQueue.filter(({ g }) => g.status === 'voting' || g.status === 'review').map((item) => ({ kind: 'listing', createdAt: item.g.createdAt, data: item })),
      ...moderationCases.map((c) => ({ kind: 'moderation', createdAt: c.createdAt, data: c })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  })());

  // ─── Derived: recent decisions ────────────────────────────────────────────
  const decisions = $derived((() => {
    const completedProposals = proposals.filter((p) => p.status === 'passed' || p.status === 'rejected' || p.status === 'executed');
    const finalizedListings = $backendState.governance.filter((g) => g.status === 'approved' || g.status === 'rejected');

    return [
      ...completedProposals.map((p) => ({ kind: 'proposal', date: p.endsAt ?? p.createdAt, title: p.title, status: p.status })),
      ...finalizedListings.map((g) => {
        const app = $backendState.apps.find((a) => a.id === g.appId) ?? null;
        return { kind: 'listing', date: g.decidedAt ?? g.createdAt, title: app?.name ?? `App ${g.appId}`, status: g.status };
      }),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  })());

  const statusColors = {
    passed: 'text-[var(--success)] bg-[rgba(76,183,130,0.15)]',
    executed: 'text-[var(--success)] bg-[rgba(76,183,130,0.15)]',
    approved: 'text-[var(--success)] bg-[rgba(76,183,130,0.15)]',
    rejected: 'text-[var(--error)] bg-[rgba(235,87,87,0.15)]',
    delisted: 'text-[var(--error)] bg-[rgba(235,87,87,0.15)]',
  };
</script>

<div class="animate-fadeIn px-8 pt-8 pb-12">
  <!-- Page Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-1">Governance</h1>
      <p class="text-[13px] text-[var(--text-secondary)]">
        Shape the marketplace. Vote on proposals, review listings, and moderate flagged networks.
      </p>
    </div>
    <button
      type="button"
      class="btn-subscribe"
      onclick={() => {
        if (!$actor) { $showConnectModal = true; return; }
        if (!hasGovRole) {
          backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true });
        }
        showCreateModal = true;
      }}
    >
      Create Proposal
    </button>
  </div>

  <!-- Section 1: Needs Your Vote -->
  <div class="mb-10">
    <h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">Needs Your Vote</h2>
    {#if voteItems.length === 0}
      <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
        <div class="flex items-start gap-3">
          <AlertCircle class="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
          <div>
            <div class="text-[13px] font-semibold text-[var(--text-primary)]">Nothing to vote on right now</div>
            <div class="text-[12px] text-[var(--text-secondary)] mt-1">Active proposals, listing reviews, and moderation cases will appear here.</div>
          </div>
        </div>
      </div>
    {:else}
      <div class="space-y-2">
        {#each voteItems as item (item.kind + '-' + (item.data.id ?? item.data.g?.appId ?? item.data.appId ?? ''))}
          {#if item.kind === 'proposal'}
            {@const proposal = item.data}
            {@const totalVotes = proposal.votesFor + proposal.votesAgainst}
            {@const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0}
            <div class="p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-[var(--accent-subtle)] text-[10px] font-semibold text-[var(--text-accent)] uppercase tracking-wide">Proposal</span>
                    <h3 class="text-[13px] font-semibold text-[var(--text-primary)] truncate">{proposal.title}</h3>
                  </div>
                  <p class="text-[12px] text-[var(--text-secondary)] leading-[1.4] line-clamp-2 mb-3">{proposal.description}</p>
                  <div class="space-y-1">
                    <div class="flex justify-between text-[11px]">
                      <span class="font-medium text-[var(--success)]">For {forPercentage.toFixed(1)}%</span>
                      <span class="font-medium text-[var(--error)]">Against {(100 - forPercentage).toFixed(1)}%</span>
                    </div>
                    <div class="h-1.5 rounded-full w-full bg-[rgba(235,87,87,0.20)] overflow-hidden flex">
                      <div class="h-full bg-[var(--success)]" style="width: {forPercentage}%"></div>
                    </div>
                  </div>
                </div>
                <a href="/governance/proposals/{proposal.id}" class="btn-subscribe shrink-0">Vote</a>
              </div>
            </div>

          {:else if item.kind === 'listing'}
            {@const g = item.data.g}
            {@const app = item.data.app}
            {@const totalVotes = g.yesVotes + g.noVotes}
            {@const yesPct = totalVotes > 0 ? (g.yesVotes / totalVotes) * 100 : 0}
            {@const canVote = g.status === 'voting'}
            {@const isExecuting = g.status === 'executing'}
            <div class="p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Listing</span>
                    {#if app}
                      <img src={appIconDataUri({ id: app.id, name: app.name, category: app.category })} alt="" style="width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;" />
                    {/if}
                    <span class="text-[13px] font-semibold text-[var(--text-primary)] truncate">{app?.name || `App ${g.appId}`}</span>
                    {#if app?.category}
                      <span class="text-[11px] text-[var(--text-tertiary)]">{app.category}</span>
                    {/if}
                  </div>
                  {#if app?.description}
                    <p class="text-[12px] text-[var(--text-secondary)] leading-[1.4] mb-2 truncate">{app.description.slice(0, 80)}{app.description.length > 80 ? '...' : ''}</p>
                  {/if}
                  <div class="text-[11px] text-[var(--text-tertiary)] mb-2">
                    {g.yesVotes + g.noVotes} of {g.requiredAttestations} votes needed
                  </div>
                  <div>
                    <!-- Progress bar -->
                    <div class="h-1.5 rounded-full w-full bg-[var(--surface-3)] overflow-hidden">
                      <div class="h-full bg-[var(--text-accent)] rounded-full transition-all" style="width: {yesPct}%"></div>
                    </div>
                    <div class="flex justify-between text-[11px] text-[var(--text-tertiary)] mt-1">
                      <span class="font-mono">{g.yesVotes} yes</span>
                      <span class="font-mono">{g.noVotes} no</span>
                    </div>
                  </div>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    class="btn-subscribe"
                    onclick={() => {
                      if (!$actor) { $showConnectModal = true; return; }
                      if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); showToast('Governance enabled'); }
                      safe(() => backend.castGovernanceAttestation({ appId: g.appId, attestor: $actor.walletAddress, direction: 'yes' }));
                    }}
                    disabled={!canVote || isExecuting || !$actor}
                  >
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    Yes
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    onclick={() => {
                      if (!$actor) { $showConnectModal = true; return; }
                      if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); showToast('Governance enabled'); }
                      safe(() => backend.castGovernanceAttestation({ appId: g.appId, attestor: $actor.walletAddress, direction: 'no' }));
                    }}
                    disabled={!canVote || isExecuting || !$actor}
                  >
                    <XCircle class="h-3.5 w-3.5" />
                    No
                  </button>
                  <a href="/governance/review/{g.appId}" class="btn-secondary">Review</a>
                </div>
              </div>
            </div>

          {:else if item.kind === 'moderation'}
            {@const c = item.data}
            {@const app = appsById.get(c.appId) ?? null}
            <div class="p-3 rounded-[8px] border border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-1)]">
              <div class="flex items-center gap-2 min-w-0">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-[rgba(235,87,87,0.15)] text-[10px] font-semibold text-[var(--error)] uppercase tracking-wide">Moderation</span>
                {#if app}
                  <img src={appIconDataUri({ id: app.id, name: app.name, category: app.category })} alt="" style="width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;" />
                {/if}
                <div class="min-w-0">
                  <div class="text-[13px] font-medium text-[var(--text-primary)] truncate">{app?.name ?? c.appId}</div>
                  <div class="text-[11px] text-[var(--text-tertiary)]">{c.reportCount} reports · Keep {c.keepVotes}/{c.requiredVotes} · Delist {c.delistVotes}/{c.requiredVotes}</div>
                </div>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button type="button" class="btn-subscribe" onclick={() => { if (!$actor) { $showConnectModal = true; return; } if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); } safe(() => backend.castModerationVote({ appId: c.appId, voterId: $actor.walletAddress, direction: 'keep' })); }}>Keep</button>
                <button type="button" class="btn-secondary" onclick={() => { if (!$actor) { $showConnectModal = true; return; } if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); } safe(() => backend.castModerationVote({ appId: c.appId, voterId: $actor.walletAddress, direction: 'delist' })); }}>Delist</button>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <!-- Section 2: Recent Decisions -->
  {#if decisions.length > 0}
    <div class="mb-10">
      <h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">Recent Decisions</h2>
      <div class="space-y-1">
        {#each decisions as d, i}
          <div class="flex items-center gap-3 px-3 py-2 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)]">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wide {d.kind === 'proposal' ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)]' : 'bg-[var(--surface-3)] text-[var(--text-secondary)]'}">
              {d.kind === 'proposal' ? 'Proposal' : 'Listing'}
            </span>
            <span class="text-[13px] text-[var(--text-primary)] truncate flex-1">{d.title}</span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold capitalize {statusColors[d.status] ?? 'bg-[var(--surface-3)] text-[var(--text-secondary)]'}">
              {d.status}
            </span>
            <span class="text-[11px] text-[var(--text-tertiary)] font-mono shrink-0">{new Date(d.date).toLocaleDateString()}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Section 3: Developer Applications (conditional) -->
  {#if hasGovRole && (pendingDeveloperVerifications.length > 0 || pendingDeveloperEnrollments.length > 0)}
    <div class="mb-10">
      <h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">Developer Applications</h2>
      <div class="space-y-2">
        {#each pendingDeveloperVerifications as r (r.walletAddress)}
          <div class="p-3 rounded-[8px] border border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-1)]">
            <div class="min-w-0">
              <div class="text-[12px] font-mono text-[var(--text-primary)] truncate">{r.walletAddress}</div>
              <div class="text-[11px] text-[var(--text-tertiary)]">Identity verification</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button type="button" class="btn-subscribe" onclick={() => safe(() => backend.reviewDeveloperVerification({ walletAddress: r.walletAddress, status: 'verified', notes: 'Approved.' }))}>Approve</button>
              <button type="button" class="btn-secondary" onclick={() => safe(() => backend.reviewDeveloperVerification({ walletAddress: r.walletAddress, status: 'rejected', notes: 'Rejected.' }))}>Reject</button>
            </div>
          </div>
        {/each}
        {#each pendingDeveloperEnrollments as r (r.walletAddress)}
          <div class="p-3 rounded-[8px] border border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-1)]">
            <div class="min-w-0">
              <div class="text-[12px] font-mono text-[var(--text-primary)] truncate">{r.walletAddress}</div>
              <div class="text-[11px] text-[var(--text-tertiary)]">{r.displayName ? `${r.displayName} · ` : ''}Enrollment</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button type="button" class="btn-subscribe" onclick={() => safe(() => backend.reviewDeveloperEnrollment({ walletAddress: r.walletAddress, status: 'active', notes: 'Approved.' }))}>Approve</button>
              <button type="button" class="btn-secondary" onclick={() => safe(() => backend.reviewDeveloperEnrollment({ walletAddress: r.walletAddress, status: 'rejected', notes: 'Rejected.' }))}>Reject</button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Create Proposal Modal -->
  {#if showCreateModal}
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onkeydown={(e) => { if (e.key === 'Escape') showCreateModal = false; }}
      onclick={(e) => { if (e.target === e.currentTarget) showCreateModal = false; }}
    >
      <!-- Modal -->
      <div class="w-full max-w-[520px] rounded-[12px] bg-[var(--surface-1)] border border-[var(--border)] p-6 shadow-xl">
        <h2 class="text-[16px] font-semibold text-[var(--text-primary)] mb-4">Create Proposal</h2>
        <div class="space-y-4">
          <!-- Title -->
          <div>
            <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Title</span>
            <input
              type="text"
              bind:value={propTitle}
              placeholder="e.g. Increase dispute window for proofs"
              class="w-full h-9 px-3 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-accent)] transition-colors"
            />
          </div>
          <!-- Type + Duration -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Type</span>
              <select
                bind:value={propType}
                class="w-full h-9 px-2 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--text-accent)] transition-colors appearance-none cursor-pointer"
              >
                <option value="parameter-update">Parameter update</option>
                <option value="reward-change">Reward change</option>
                <option value="treasury">Treasury</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Voting duration (days)</span>
              <input
                type="number"
                bind:value={propDuration}
                min="1"
                max="30"
                class="w-full h-9 px-3 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--text-accent)] transition-colors"
              />
            </div>
          </div>
          <!-- Description -->
          <div>
            <span class="text-[11px] text-[var(--text-tertiary)] block mb-1.5">Description</span>
            <textarea
              bind:value={propDesc}
              placeholder="Explain what changes, why it matters, and what the expected impact is."
              rows="6"
              class="w-full px-3 py-2 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none outline-none focus:border-[var(--text-accent)] transition-colors"
            ></textarea>
            <div class="text-[10px] text-[var(--text-tertiary)] font-mono mt-1">{propDesc.trim().length}/2000</div>
          </div>
          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn-secondary" onclick={() => { showCreateModal = false; }}>Cancel</button>
            <button
              type="button"
              class="btn-subscribe"
              disabled={!canSubmitProp}
              style="opacity: {canSubmitProp ? 1 : 0.4}"
              onclick={() => {
                if (!$actor?.walletAddress) { $showConnectModal = true; return; }
                if (!hasGovRole) {
                  backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true });
                }
                const p = backend.createGovernanceProposal({
                  title: propTitle,
                  description: propDesc,
                  type: propType,
                  createdBy: $actor.walletAddress,
                  durationDays: propDuration,
                });
                showCreateModal = false;
                propTitle = ''; propDesc = '';
                goto(`/governance/proposals/${p.id}`);
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
