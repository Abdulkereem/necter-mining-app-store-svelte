<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, ExternalLink } from 'lucide-svelte';
  import { hub } from '$lib/api/hub';
  import { useQuery } from '$lib/api/query.svelte';
  import type { EpochSummary, Token } from '$lib/api/types';
  import { descriptor, loadDescriptor, explorerBase } from '$lib/stores/network';
  import {
    formatToken,
    formatNumber,
    formatDateTime,
    formatDuration,
    shortHex,
    timeAgo,
    rewardModelLabel,
    txUrl,
    addressUrl
  } from '$lib/format';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import CopyText from '$lib/components/common/CopyText.svelte';
  import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
  import { Badge } from '$lib/components/ui';

  type BadgeVariant = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

  const projectId = $derived((page.params.project ?? '').toLowerCase());
  const epochNum = $derived(Number(page.params.epoch));
  const validParams = $derived(/^0x[0-9a-f]{64}$/.test(projectId) && Number.isInteger(epochNum) && epochNum >= 0);

  const epoch = useQuery(() => (validParams ? hub.epoch(projectId, epochNum) : Promise.resolve(null)));
  const project = useQuery(() => (validParams ? hub.project(projectId) : Promise.resolve(null)));

  $effect(() => {
    loadDescriptor().catch(() => {});
  });

  const token = $derived<Pick<Token, 'symbol' | 'decimals'> | null>(epoch.data?.token ?? project.data?.token ?? null);

  function statusVariant(s: EpochSummary['status']): BadgeVariant {
    if (s === 'settled' || s === 'released') return 'success';
    if (s === 'attested' || s === 'submitted') return 'accent';
    if (s === 'underfunded') return 'warning';
    if (s === 'vetoed') return 'error';
    return 'neutral';
  }
  function settlementVariant(s: string | undefined): BadgeVariant {
    if (s === 'settled' || s === 'released') return 'success';
    if (s === 'vetoed' || s === 'reverted' || s === 'failed') return 'error';
    if (s === 'sent' || s === 'signed') return 'accent';
    return 'neutral';
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const STATUS_HELP: Record<EpochSummary['status'], string> = {
    open: 'The epoch is still running; rounds finalized in it will earn compute units.',
    closed: 'The epoch has ended. Validators are computing the reward receipt.',
    attested: 'A validator quorum signed the v2 reward receipt.',
    submitted: 'The receipt was submitted to the Hub and is queued for on-chain settlement.',
    settled: 'The epoch was settled on Sepolia. Miner amounts become claimable after the challenge window.',
    released: 'The challenge window passed; miners can claim with Merkle proofs.',
    vetoed: 'The settlement was vetoed by the vault guardian and may be settled again.',
    underfunded: 'The project escrow could not cover this epoch, so its tasks ran on validator fallback.'
  };
</script>

<svelte:head>
  <title>Epoch {page.params.epoch} — Explorer · Necter</title>
</svelte:head>

<div class="min-h-screen">
  <div class="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-6">
    <a href="/explorer?tab=epochs" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] no-underline">
      <ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to Explorer
    </a>

    {#if epoch.loading}
      <LoadingBlock rows={4} height="80px" />
    {:else if epoch.error}
      <ErrorState error={epoch.error} retry={epoch.refresh} />
    {:else if !epoch.data}
      <EmptyState
        illustration="network"
        title="Epoch not found"
        description="This project has no recorded reward epoch with that number. Epochs appear once the project has rounds in them."
      >
        <a href="/explorer?tab=epochs" class="btn-secondary">All epochs</a>
      </EmptyState>
    {:else}
      {@const e = epoch.data}
      {@const receipt = e.receipt}
      <!-- Header -->
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            {#if project.data}
              <ProjectIcon project={project.data} size={40} />
            {/if}
            <div class="min-w-0">
              <div class="text-xs uppercase text-[var(--text-tertiary)] tracking-[0.04em]">Reward epoch</div>
              <h1 class="text-[20px] font-semibold mt-0.5">
                Epoch <span class="font-mono">{e.epoch}</span>
                {#if project.data}· <a href="/apps/{e.project_id}" class="hover:text-[var(--text-accent)]">{project.data.name}</a>{/if}
              </h1>
              <div class="text-sm text-[var(--text-secondary)] mt-1">
                {#if e.starts_at}{formatDateTime(e.starts_at)}{e.ends_at ? ` – ${formatDateTime(e.ends_at)}` : ''}{/if}
                {#if e.epoch_secs} · {formatDuration(e.epoch_secs)} epochs{/if}
              </div>
            </div>
          </div>
          <Badge variant={statusVariant(e.status)}>{cap(e.status)}</Badge>
        </div>
        <p class="text-xs text-[var(--text-tertiary)] mt-3">{STATUS_HELP[e.status]}</p>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {#each [
            { label: 'Rounds', value: formatNumber(e.rounds) },
            { label: 'Fallback rounds', value: formatNumber(e.fallback_rounds) },
            { label: 'Miners paid', value: formatNumber(e.miners) },
            { label: 'Compute units', value: formatNumber(e.totals?.units) }
          ] as s (s.label)}
            <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2">
              <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{s.label}</div>
              <div class="text-[14px] font-mono mt-0.5">{s.value}</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Totals -->
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="font-semibold mb-3">Reward totals</div>
        {#if !e.totals}
          <p class="text-sm text-[var(--text-secondary)]">Totals are known once validators attest the epoch receipt.</p>
        {:else}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            {#each [
              { label: 'Gross', value: formatToken(e.totals.gross, token), accent: true },
              { label: 'Miners', value: formatToken(e.totals.miner, token), accent: false },
              { label: 'Developer', value: formatToken(e.totals.developer, token), accent: false },
              { label: 'Treasury', value: formatToken(e.totals.treasury, token), accent: false }
            ] as t (t.label)}
              <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2.5">
                <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{t.label}</div>
                <div class="text-[14px] font-mono mt-0.5 truncate" class:text-[var(--text-accent)]={t.accent}>{t.value}</div>
              </div>
            {/each}
          </div>
        {/if}
        <div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs mt-4">
          {#if e.merkle_root}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Merkle root</span>
              <CopyText value={e.merkle_root} />
            </div>
          {/if}
          {#if e.receipt_hash}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Receipt hash</span>
              <a href="/explorer/receipts/{e.receipt_hash}" class="font-mono text-[var(--text-accent)] hover:underline">{shortHex(e.receipt_hash)}</a>
            </div>
          {/if}
        </div>
      </div>

      <!-- Settlement -->
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="font-semibold">On-chain settlement</div>
          {#if e.settlement?.status}
            <Badge variant={settlementVariant(e.settlement.status)}>{cap(e.settlement.status)}</Badge>
          {/if}
        </div>
        {#if !e.settlement}
          <p class="text-sm text-[var(--text-secondary)]">Not settled yet. The Hub relayer settles the attested receipt on the project vault.</p>
        {:else}
          {@const s = e.settlement}
          <div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {#if s.tx_hash}
              <div class="flex items-center justify-between gap-3">
                <span class="text-[var(--text-tertiary)]">Transaction</span>
                <a href={txUrl(s.tx_hash, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-mono text-[var(--text-accent)] hover:underline">
                  {shortHex(s.tx_hash)} <ExternalLink class="h-3 w-3" strokeWidth={1.5} />
                </a>
              </div>
            {/if}
            {#if s.block_number !== undefined}
              <div class="flex items-center justify-between gap-3">
                <span class="text-[var(--text-tertiary)]">Block</span>
                <span class="font-mono">{formatNumber(s.block_number)}</span>
              </div>
            {/if}
            {#if s.claimable_at}
              <div class="flex items-center justify-between gap-3">
                <span class="text-[var(--text-tertiary)]">Claimable</span>
                <span>{formatDateTime(s.claimable_at)} ({timeAgo(s.claimable_at)})</span>
              </div>
            {/if}
            {#if receipt?.vault_address}
              <div class="flex items-center justify-between gap-3">
                <span class="text-[var(--text-tertiary)]">Vault</span>
                <a href={addressUrl(receipt.vault_address, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-mono text-[var(--text-accent)] hover:underline">
                  {shortHex(receipt.vault_address)} <ExternalLink class="h-3 w-3" strokeWidth={1.5} />
                </a>
              </div>
            {/if}
          </div>
          {#if s.error}
            <p class="text-xs text-[var(--error)] mt-3">{s.error}</p>
          {/if}
        {/if}
      </div>

      <!-- Receipt v2 -->
      {#if receipt}
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="font-semibold">Reward receipt v2</div>
            <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">
              {rewardModelLabel(receipt.reward_model)} · chain {receipt.chain_id}
            </span>
          </div>
          <div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs mb-4">
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Consensus version</span>
              <CopyText value={receipt.consensus_hash} />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Reward token</span>
              <CopyText value={receipt.reward_token} />
            </div>
          </div>

          <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-2">
            Compute units ({receipt.compute_units.length} miners)
          </div>
          {#if receipt.compute_units.length === 0}
            <p class="text-sm text-[var(--text-secondary)]">No miner earned units in this epoch.</p>
          {:else}
            <div class="overflow-x-auto rounded-[6px] border border-[var(--border-default)]">
              <table class="w-full text-xs min-w-[480px]">
                <thead>
                  <tr class="text-left text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--surface-2)]">
                    <th class="py-2 px-3 font-semibold">Miner</th>
                    <th class="py-2 px-3 font-semibold text-right">Units</th>
                    <th class="py-2 px-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {#each receipt.compute_units as cu (cu.miner)}
                    <tr class="border-b border-[var(--border-default)] last:border-b-0">
                      <td class="py-2 px-3">
                        <a href="/profiles/{cu.miner}" class="inline-flex items-center gap-2 font-mono hover:text-[var(--text-accent)]">
                          <img src={minerAvatarDataUri(cu.miner)} alt="" class="w-4 h-4 rounded-[3px]" />
                          {shortHex(cu.miner)}
                        </a>
                      </td>
                      <td class="py-2 px-3 font-mono text-right">{formatNumber(cu.units)}</td>
                      <td class="py-2 px-3 font-mono text-right">{formatToken(cu.amount, token)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}

          <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mt-5 mb-2">
            Validator attestations ({receipt.attestations.length})
          </div>
          {#if receipt.attestations.length === 0}
            <p class="text-sm text-[var(--text-secondary)]">No attestations recorded yet.</p>
          {:else}
            <div class="space-y-1.5">
              {#each receipt.attestations as a (a.public_key)}
                <div class="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-[var(--surface-2)] px-3 py-2 text-xs">
                  <span class="font-mono">{a.node_id}</span>
                  <span class="inline-flex items-center gap-1 text-[var(--text-tertiary)]">signature <CopyText value={a.signature} /></span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
