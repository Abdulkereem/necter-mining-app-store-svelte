<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-svelte';
  import { hub } from '$lib/api/hub';
  import { useQuery } from '$lib/api/query.svelte';
  import type { Round } from '$lib/api/types';
  import { formatNumber, formatDateTime, shortHex, timeAgo } from '$lib/format';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import CopyText from '$lib/components/common/CopyText.svelte';
  import { Badge } from '$lib/components/ui';

  type BadgeVariant = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

  const roundId = $derived(decodeURIComponent(page.params.id ?? ''));
  const round = useQuery(() => hub.round(roundId));
  const projectId = $derived(round.data?.project_id ?? round.data?.task?.project_id ?? null);
  const project = useQuery(() => (projectId ? hub.project(projectId) : Promise.resolve(null)));

  const STATE_LABEL: Record<Round['state'], string> = {
    pending: 'Pending',
    committee_agreed: 'Committee agreed',
    finalized: 'Finalized',
    escalated: 'Escalated',
    failed: 'Failed',
    fallback: 'Validator fallback'
  };
  function stateVariant(s: Round['state']): BadgeVariant {
    if (s === 'finalized') return 'success';
    if (s === 'committee_agreed') return 'accent';
    if (s === 'escalated') return 'warning';
    if (s === 'failed') return 'error';
    return 'neutral';
  }

  const finalReceipt = $derived(round.data?.finality?.receipt_hash ?? round.data?.receipt_hash ?? null);
  const voterKeys = $derived(new Set((round.data?.finality?.voters ?? []).map((v) => v.public_key)));
  const nodeIdByKey = $derived(
    new Map<string, string>(
      (round.data?.committee?.draw ?? []).filter((d) => d.node_id).map((d) => [d.node_key, d.node_id as string])
    )
  );

  const summary = $derived.by(() => {
    const r = round.data;
    if (!r) return [];
    return [
      { label: 'Kind', value: r.kind },
      { label: 'Function', value: r.function ?? r.task?.function ?? '—' },
      { label: 'Epoch', value: r.epoch !== undefined ? String(r.epoch) : '—' },
      { label: 'Seq', value: r.seq !== undefined ? String(r.seq) : '—' },
      { label: 'Committee', value: r.committee_size !== undefined ? String(r.committee_size) : '—' },
      { label: 'Votes', value: r.votes !== undefined ? String(r.votes) : '—' },
      { label: 'Agreeing', value: r.agreeing !== undefined ? String(r.agreeing) : '—' },
      { label: 'Gas used', value: formatNumber(r.gas_used) },
      { label: 'Created', value: formatDateTime(r.created_at) },
      { label: 'Finalized', value: r.finalized_at ? formatDateTime(r.finalized_at) : '—' }
    ];
  });
</script>

<svelte:head>
  <title>Round {shortHex(roundId.replace(/^[a-z]+:/, ''))} — Explorer · Necter</title>
</svelte:head>

<div class="min-h-screen">
  <div class="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-6">
    <a href="/explorer" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] no-underline">
      <ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to Explorer
    </a>

    {#if round.loading}
      <LoadingBlock rows={4} height="80px" />
    {:else if round.error}
      <ErrorState error={round.error} retry={round.refresh} />
    {:else if !round.data}
      <EmptyState
        illustration="network"
        title="Round not found"
        description="No round with this id is known to the Hub. Round ids look like task:0x… or exec:0x…."
      >
        <a href="/explorer" class="btn-secondary">Back to Explorer</a>
      </EmptyState>
    {:else}
      {@const r = round.data}
      <!-- Header -->
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs uppercase text-[var(--text-tertiary)] tracking-[0.04em]">{r.kind} round</div>
            <h1 class="text-[18px] font-semibold font-mono break-all mt-1">{r.round_id}</h1>
            <div class="text-sm text-[var(--text-secondary)] mt-1">
              {#if projectId}
                <a href="/apps/{projectId}" class="hover:text-[var(--text-primary)]">{project.data?.name ?? shortHex(projectId)}</a> ·
              {/if}
              {timeAgo(r.created_at)}
            </div>
          </div>
          <div class="flex items-center gap-2">
            {#if r.audited}<Badge variant="accent">Audited by validators</Badge>{/if}
            <Badge variant={stateVariant(r.state)}>{STATE_LABEL[r.state]}</Badge>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
          {#each summary as s (s.label)}
            <div class="rounded-[6px] bg-[var(--surface-2)] px-3 py-2">
              <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">{s.label}</div>
              <div class="text-[13px] font-mono mt-0.5 truncate">{s.value}</div>
            </div>
          {/each}
        </div>
        {#if finalReceipt}
          <div class="flex flex-wrap items-center gap-2 mt-4 text-xs text-[var(--text-secondary)]">
            Result receipt
            <a href="/explorer/receipts/{finalReceipt}" class="font-mono text-[var(--text-accent)] hover:underline">{shortHex(finalReceipt, 10, 8)}</a>
            <CopyText value={finalReceipt} />
          </div>
        {/if}
        {#if r.state === 'fallback'}
          <p class="text-xs text-[var(--text-tertiary)] mt-3">
            No committee could be formed for this slot (too few miners, no snapshot or an underfunded project), so validators
            executed the task directly. No miner earns units for fallback rounds.
          </p>
        {/if}
      </div>

      <!-- Task context -->
      {#if r.task}
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
          <div class="font-semibold mb-3">Task</div>
          <div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {#each [
              ['Module', r.task.module_address],
              ['Input hash', r.task.input_hash],
              ['Consensus version', r.task.consensus_hash],
              ['Miner set', r.task.set_hash]
            ] as [label, value] (label)}
              <div class="flex items-center justify-between gap-3">
                <span class="text-[var(--text-tertiary)]">{label}</span>
                <CopyText {value} />
              </div>
            {/each}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Gas limit</span>
              <span class="font-mono">{formatNumber(r.task.gas_limit)}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Issued</span>
              <span class="font-mono">{formatDateTime(r.task.issued_at)}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Committee -->
      {#if r.committee}
        {@const c = r.committee}
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="font-semibold">Committee</div>
            <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">
              {c.k_eff} primaries · {c.b_eff} backups · quorum {c.quorum}
            </span>
          </div>
          {#if c.draw.length === 0}
            <p class="text-sm text-[var(--text-secondary)]">No members were drawn for this slot.</p>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-xs min-w-[560px]">
                <thead>
                  <tr class="text-left text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]">
                    <th class="py-2 pr-3 font-semibold">#</th>
                    <th class="py-2 pr-3 font-semibold">Role</th>
                    <th class="py-2 pr-3 font-semibold">Device</th>
                    <th class="py-2 pr-3 font-semibold text-right">Weight</th>
                    <th class="py-2 font-semibold text-right">Counted in finality</th>
                  </tr>
                </thead>
                <tbody>
                  {#each c.draw as d (d.position)}
                    <tr class="border-b border-[var(--border-default)] last:border-b-0">
                      <td class="py-2 pr-3 font-mono">{d.position}</td>
                      <td class="py-2 pr-3 capitalize">{d.role}</td>
                      <td class="py-2 pr-3">
                        {#if d.node_id}
                          <a href="/miners/{d.node_id}" class="font-mono hover:text-[var(--text-accent)]">{d.node_id}</a>
                        {:else}
                          <span class="font-mono">{shortHex(d.node_key)}</span>
                        {/if}
                      </td>
                      <td class="py-2 pr-3 font-mono text-right">{d.weight}</td>
                      <td class="py-2 text-right">
                        {#if r.finality}
                          {#if voterKeys.has(d.node_key)}
                            <CheckCircle2 class="h-3.5 w-3.5 inline text-[var(--success)]" strokeWidth={2} />
                          {:else}
                            <XCircle class="h-3.5 w-3.5 inline text-[var(--text-tertiary)]" strokeWidth={2} />
                          {/if}
                        {:else}—{/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
          <div class="flex flex-wrap gap-4 mt-3 text-xs text-[var(--text-tertiary)]">
            <span class="inline-flex items-center gap-1">seed <CopyText value={c.seed} /></span>
            {#if c.committee_hash}<span class="inline-flex items-center gap-1">committee hash <CopyText value={c.committee_hash} /></span>{/if}
          </div>
        </div>
      {/if}

      <!-- Votes -->
      {#if r.votes_detail && r.votes_detail.length > 0}
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
          <div class="font-semibold mb-3">Miner votes ({r.votes_detail.length})</div>
          <div class="space-y-2">
            {#each r.votes_detail as v (v.public_key + v.receipt_hash)}
              {@const agrees = finalReceipt ? v.receipt_hash === finalReceipt : null}
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-[var(--surface-2)] px-3 py-2.5">
                <div class="min-w-0 text-xs">
                  <a href="/miners/{v.node_id}" class="font-mono text-[13px] text-[var(--text-primary)] hover:text-[var(--text-accent)]">{v.node_id}</a>
                  <span class="text-[var(--text-tertiary)]"> · position {v.committee.position} · {formatNumber(v.receipt.gas_used)} gas</span>
                  <div class="text-[var(--text-tertiary)] mt-0.5">
                    payout <a href="/profiles/{v.payout_address}" class="font-mono hover:text-[var(--text-primary)]">{shortHex(v.payout_address)}</a>
                    · receipt <span class="font-mono">{shortHex(v.receipt_hash)}</span>
                  </div>
                </div>
                {#if agrees === true}
                  <Badge variant="success">Agrees with final result</Badge>
                {:else if agrees === false}
                  <Badge variant="error">Different result</Badge>
                {:else}
                  <Badge variant="neutral">Awaiting finality</Badge>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Finality -->
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div class="font-semibold">Validator finality</div>
          {#if r.finality_votes}
            <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">{r.finality_votes.length} validator signatures</span>
          {/if}
        </div>
        {#if !r.finality}
          <p class="text-sm text-[var(--text-secondary)]">
            {#if r.kind === 'task'}
              No finality record yet. Validators sign one after every leased member voted or the round deadline passed.
            {:else}
              {r.kind} rounds are finalized by validator votes directly; there is no committee finality record.
            {/if}
          </p>
        {:else}
          {@const f = r.finality}
          <div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Receipt</span>
              <a href="/explorer/receipts/{f.receipt_hash}" class="font-mono text-[var(--text-accent)] hover:underline">{shortHex(f.receipt_hash)}</a>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Gas used</span>
              <span class="font-mono">{formatNumber(f.gas_used)}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Audited</span>
              <span>{f.audited ? 'Yes — re-executed by validators' : 'No'}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Credited voters</span>
              <span class="font-mono">{f.voters.length}</span>
            </div>
          </div>
          {#if f.voters.length > 0}
            <div class="mt-4">
              <div class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-2">Voters credited with compute units</div>
              <div class="flex flex-wrap gap-2">
                {#each f.voters as v (v.public_key)}
                  {@const nid = nodeIdByKey.get(v.public_key)}
                  <a
                    href="/profiles/{v.payout_address}"
                    class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[5px] bg-[var(--surface-2)] text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline"
                    title={nid ?? v.public_key}
                  >
                    {shortHex(v.payout_address)}
                  </a>
                {/each}
              </div>
            </div>
          {:else if f.audited}
            <p class="text-xs text-[var(--warning)] mt-3">
              The audit result differs from every committee vote, so no miner was credited for this round.
            </p>
          {/if}
        {/if}
        {#if r.exec_votes && r.exec_votes.length > 0}
          <details class="mt-4">
            <summary class="text-xs text-[var(--text-secondary)] cursor-pointer">Validator execution votes ({r.exec_votes.length})</summary>
            <pre class="mt-2 p-3 rounded-[6px] bg-[var(--surface-0)] text-[11px] font-mono overflow-x-auto max-h-[360px]">{JSON.stringify(r.exec_votes, null, 2)}</pre>
          </details>
        {/if}
      </div>
    {/if}
  </div>
</div>
