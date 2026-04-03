<script lang="ts">
  import { goto } from '$app/navigation';
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { ArrowLeft } from 'lucide-svelte';

  let title = $state('');
  let description = $state('');
  let type = $state('parameter-update');
  let durationDays = $state(7);

  const roles = $derived($actor?.walletAddress ? backend.listRoles($actor.walletAddress) : []);
  const hasGovRole = $derived(roles.includes('governance'));
  const canSubmit = $derived(title.trim().length >= 6 && description.trim().length >= 20);

  function handleSubmit() {
    if (!$actor?.walletAddress) {
      $showConnectModal = true;
      return;
    }
    if (!hasGovRole) {
      backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true });
    }
    const p = backend.createGovernanceProposal({
      title,
      description,
      type: type as any,
      createdBy: $actor.walletAddress,
      durationDays,
    });
    goto(`/governance/proposals/${p.id}`);
  }
</script>

<div class="animate-fadeIn px-8 pt-8 pb-12">
  <div style="max-width:640px">
    <a href="/governance" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);text-decoration:none;margin-bottom:24px;transition:color 100ms">
      <ArrowLeft size={14} strokeWidth={1.5} />
      Back to Governance
    </a>

    <h1 style="font-size:20px;font-weight:600;color:var(--text-primary);letter-spacing:-0.015em;margin-bottom:32px">Create Proposal</h1>

    <div style="display:flex;flex-direction:column;gap:24px">
      <!-- Title -->
      <div>
        <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px">Title</label>
        <input
          type="text"
          bind:value={title}
          placeholder="e.g. Increase dispute window for proofs"
          style="width:100%;height:36px;padding:0 12px;font-size:13px;border-radius:5px;background:var(--surface-0);border:1px solid var(--border-default);color:var(--text-primary);outline:none"
        />
      </div>

      <!-- Type -->
      <div>
        <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px">Type</label>
        <select
          bind:value={type}
          style="width:100%;height:36px;padding:0 12px;font-size:13px;border-radius:5px;background:var(--surface-0);border:1px solid var(--border-default);color:var(--text-primary);outline:none"
        >
          <option value="parameter-update">Parameter update</option>
          <option value="reward-change">Reward change</option>
          <option value="treasury">Treasury</option>
          <option value="other">Other</option>
        </select>
      </div>

      <!-- Description -->
      <div>
        <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px">Description</label>
        <textarea
          bind:value={description}
          placeholder="Explain what changes, why it matters, and what the expected impact is."
          rows="10"
          style="width:100%;padding:12px;font-size:13px;border-radius:5px;background:var(--surface-0);border:1px solid var(--border-default);color:var(--text-primary);outline:none;resize:none;font-family:inherit"
        ></textarea>
        <div style="font-size:11px;color:var(--text-tertiary);font-family:var(--font-mono);margin-top:4px">{description.trim().length}/2000</div>
      </div>

      <!-- Duration -->
      <div>
        <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px">Voting duration (days)</label>
        <input
          type="number"
          bind:value={durationDays}
          min="1"
          max="30"
          style="width:100%;height:36px;padding:0 12px;font-size:13px;font-family:var(--font-mono);border-radius:5px;background:var(--surface-0);border:1px solid var(--border-default);color:var(--text-primary);outline:none"
        />
      </div>

      <!-- Actions -->
      <div style="display:flex;justify-content:flex-end;gap:12px;padding-top:16px;border-top:1px solid var(--border-default)">
        <a href="/governance" class="btn-secondary">Cancel</a>
        <button
          type="button"
          disabled={!canSubmit}
          class="btn-subscribe"
          style="opacity:{canSubmit ? 1 : 0.4}"
          onclick={handleSubmit}
        >
          Create proposal
        </button>
      </div>
    </div>
  </div>
</div>
