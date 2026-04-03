<script lang="ts">
	import { showToast } from '$lib/stores/toast';
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import {
    ChevronLeft,
    Clock,
    CheckCircle2,
    XCircle,
  } from 'lucide-svelte';

  // ─── Route param ──────────────────────────────────────────────────────────
  const id = $derived($page.params.id);

  // ─── Backend / Wallet ─────────────────────────────────────────────────────
  const roles = $derived($actor?.walletAddress ? backend.listRoles($actor.walletAddress) : []);
  const hasGovRole = $derived(roles.includes('governance'));

  const proposal = $derived(backend.getGovernanceProposalById(id!));

  const totalVotes = $derived(proposal ? proposal.votesFor + proposal.votesAgainst : 0);
  const forPct = $derived(totalVotes > 0 ? (proposal!.votesFor / totalVotes) * 100 : 0);
  const isActive = $derived(proposal?.status === 'active');

  const voterId = $derived($actor?.walletAddress ?? null);
  const votedFor = $derived(voterId && proposal ? proposal.votersFor.includes(voterId) : false);
  const votedAgainst = $derived(voterId && proposal ? proposal.votersAgainst.includes(voterId) : false);

  // ─── Time remaining ───────────────────────────────────────────────────────
  const timeLeft = $derived(
    proposal?.endsAt
      ? (() => {
          const ms = new Date(proposal.endsAt).getTime() - Date.now();
          if (ms <= 0) return 'Ended';
          const days = Math.floor(ms / 86400000);
          const hours = Math.floor((ms % 86400000) / 3600000);
          return days > 0 ? `${days}d ${hours}h remaining` : `${hours}h remaining`;
        })()
      : null
  );

  // ─── Vote handler ─────────────────────────────────────────────────────────
  function handleVote(direction: any) {
    if (!$actor) { $showConnectModal = true; return; }
    if (!hasGovRole) {
      backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true });
    }
    backend.castGovernanceProposalVote({ proposalId: proposal!.id, voterId: $actor.walletAddress, direction, vp: 12_450 });
    showToast(direction === 'for' ? 'Voted for' : 'Voted against');
  }
</script>

<svelte:head>
  <title>Proposal — Necter Mining App Store</title>
</svelte:head>

{#if !proposal}
  <div class="animate-fadeIn px-8 pt-8 pb-12" style="max-width: 680px; margin: 0 auto;">
    <a href="/governance" class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6">
      <ChevronLeft class="h-3.5 w-3.5" />
      Back to Governance
    </a>
    <div class="p-12 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center">
      <p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Proposal not found</p>
      <p class="text-[13px] text-[var(--text-secondary)]">This proposal may no longer exist.</p>
    </div>
  </div>
{:else}
  <div class="animate-fadeIn px-8 pt-8 pb-12" style="max-width: 680px; margin: 0 auto;">
    <!-- Back -->
    <a href="/governance" class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6">
      <ChevronLeft class="h-3.5 w-3.5" />
      Back to Governance
    </a>

    <!-- Status + Type -->
    <div class="flex items-center gap-2 mb-3">
      <span class="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wide {isActive ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)]' : proposal.status === 'passed' ? 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]' : 'bg-[var(--surface-3)] text-[var(--text-secondary)]'}">
        {proposal.status}
      </span>
      <span class="text-[11px] text-[var(--text-tertiary)] capitalize">{proposal.type.replace('-', ' ')}</span>
      {#if isActive && timeLeft}
        <span class="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1 ml-auto">
          <Clock class="h-3 w-3" />
          {timeLeft}
        </span>
      {/if}
    </div>

    <!-- Title -->
    <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-2">{proposal.title}</h1>
    <p class="text-[11px] text-[var(--text-tertiary)] font-mono mb-6">
      Created {new Date(proposal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      {' · '}{proposal.id}
    </p>

    <!-- Description -->
    <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] p-5 mb-6">
      <p class="text-[13px] text-[var(--text-primary)] leading-[22px] whitespace-pre-wrap">{proposal.description}</p>
    </div>

    <!-- Vote section -->
    <div class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
      <!-- Vote bar header -->
      <div class="px-5 py-4 border-b border-[var(--border)]">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em]">Current Vote</span>
          <span class="text-[11px] text-[var(--text-tertiary)] font-mono">{totalVotes.toLocaleString()} VP total · {proposal.quorumPercent}% quorum</span>
        </div>

        <!-- Progress bar -->
        <div class="h-3 rounded-full w-full bg-[rgba(235,87,87,0.15)] overflow-hidden flex">
          <div
            class="h-full rounded-full transition-all duration-500 ease-out"
            style="width: {forPct}%; background: var(--success); box-shadow: {forPct > 0 ? '0 0 8px rgba(76,183,130,0.3)' : 'none'};"
          ></div>
        </div>

        <!-- Labels -->
        <div class="flex justify-between mt-2">
          <div class="flex items-center gap-1.5">
            <div class="w-2 h-2 rounded-full bg-[var(--success)]"></div>
            <span class="text-[12px] font-medium text-[var(--success)]">For {forPct.toFixed(1)}%</span>
            <span class="text-[11px] text-[var(--text-tertiary)] font-mono">({proposal.votesFor.toLocaleString()} VP)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-[var(--text-tertiary)] font-mono">({proposal.votesAgainst.toLocaleString()} VP)</span>
            <span class="text-[12px] font-medium text-[var(--error)]">Against {(100 - forPct).toFixed(1)}%</span>
            <div class="w-2 h-2 rounded-full bg-[var(--error)]"></div>
          </div>
        </div>
      </div>

      <!-- Vote buttons -->
      <div class="px-5 py-4">
        {#if isActive}
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              onclick={() => handleVote('for')}
              style="height: 44px; border-radius: 8px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 150ms ease-out; background: {votedFor ? 'var(--success)' : 'rgba(76,183,130,0.12)'}; color: {votedFor ? '#fff' : 'var(--success)'};"
            >
              <CheckCircle2 class="h-4 w-4" />
              {votedFor ? 'Voted For' : 'Vote For'}
            </button>
            <button
              type="button"
              onclick={() => handleVote('against')}
              style="height: 44px; border-radius: 8px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 150ms ease-out; background: {votedAgainst ? 'var(--error)' : 'rgba(235,87,87,0.12)'}; color: {votedAgainst ? '#fff' : 'var(--error)'};"
            >
              <XCircle class="h-4 w-4" />
              {votedAgainst ? 'Voted Against' : 'Vote Against'}
            </button>
          </div>
          {#if votedFor || votedAgainst}
            <p class="text-[11px] text-[var(--text-tertiary)] text-center mt-3">Click the same option to remove your vote.</p>
          {/if}
        {:else}
          <div class="text-center py-2">
            <p class="text-[13px] text-[var(--text-secondary)]">
              Voting has {proposal.status === 'passed' ? 'passed' : 'ended'}.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
