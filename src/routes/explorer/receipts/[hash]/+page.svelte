<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, ExternalLink } from 'lucide-svelte';
  import { hub } from '$lib/api/hub';
  import { useQuery } from '$lib/api/query.svelte';
  import { descriptor, loadDescriptor, explorerBase } from '$lib/stores/network';
  import { formatNumber, formatDateTime, shortHex, timeAgo, txUrl } from '$lib/format';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import CopyText from '$lib/components/common/CopyText.svelte';
  import { Badge } from '$lib/components/ui';

  type BadgeVariant = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

  const hash = $derived((page.params.hash ?? '').toLowerCase());
  const valid = $derived(/^0x[0-9a-f]{64}$/.test(hash));
  const receipt = useQuery(() => (valid ? hub.receipt(hash) : Promise.resolve(null)));

  $effect(() => {
    loadDescriptor().catch(() => {});
  });

  const KIND_LABEL: Record<string, { label: string; help: string }> = {
    execution: {
      label: 'Execution receipt',
      help: 'Signed result of one task execution: module, function, input/output hashes and gas used.'
    },
    reward_v1: {
      label: 'Reward receipt v1',
      help: 'Validator reward round for a module vault (paid directly to validator payout addresses).'
    },
    reward_v2: {
      label: 'Reward receipt v2',
      help: 'Per-project epoch receipt: compute units per miner, fee split totals and the Merkle root miners claim against.'
    }
  };

  /** Small typed view over the receipt object (its shape depends on `kind`). */
  const body = $derived((receipt.data?.receipt ?? {}) as Record<string, unknown>);
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const projectId = $derived(str(body.project_id));
  const epochNo = $derived(num(body.round));

  function settlementVariant(s: string | undefined): BadgeVariant {
    if (s === 'settled' || s === 'released') return 'success';
    if (s === 'vetoed' || s === 'reverted' || s === 'failed') return 'error';
    if (s === 'sent' || s === 'signed') return 'accent';
    return 'neutral';
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  let copied = $state(false);
  async function copyJson(v: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(v, null, 2));
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }
</script>

<svelte:head>
  <title>Receipt {shortHex(hash)} — Explorer · Necter</title>
</svelte:head>

<div class="min-h-screen">
  <div class="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-6">
    <a href="/explorer" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] no-underline">
      <ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to Explorer
    </a>

    {#if receipt.loading}
      <LoadingBlock rows={3} height="80px" />
    {:else if receipt.error}
      <ErrorState error={receipt.error} retry={receipt.refresh} />
    {:else if !receipt.data}
      <EmptyState
        illustration="network"
        title="Receipt not found"
        description={valid ? 'No execution or reward receipt with this hash is known to the Hub.' : 'Receipt hashes are 0x followed by 64 hex characters.'}
      >
        <a href="/explorer" class="btn-secondary">Back to Explorer</a>
      </EmptyState>
    {:else}
      {@const d = receipt.data}
      {@const meta = KIND_LABEL[d.kind]}
      <!-- Header -->
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs uppercase text-[var(--text-tertiary)] tracking-[0.04em]">{meta?.label ?? d.kind}</div>
            <h1 class="text-[16px] md:text-[18px] font-semibold font-mono break-all mt-1">{hash}</h1>
            {#if meta}<p class="text-sm text-[var(--text-secondary)] mt-1">{meta.help}</p>{/if}
          </div>
          <Badge variant="accent">{d.kind}</Badge>
        </div>

        <div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs mt-4">
          {#if projectId}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Project</span>
              <a href="/apps/{projectId}" class="font-mono hover:text-[var(--text-accent)]">{shortHex(projectId)}</a>
            </div>
          {/if}
          {#if projectId && epochNo !== undefined}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Epoch</span>
              <a href="/explorer/epochs/{projectId}/{epochNo}" class="font-mono text-[var(--text-accent)] hover:underline">{epochNo}</a>
            </div>
          {/if}
          {#if str(body.module_address)}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Module</span>
              <CopyText value={str(body.module_address) ?? ''} />
            </div>
          {/if}
          {#if str(body.function)}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Function</span>
              <span class="font-mono">{str(body.function)}</span>
            </div>
          {/if}
          {#if num(body.gas_used) !== undefined}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Gas used</span>
              <span class="font-mono">{formatNumber(num(body.gas_used))}</span>
            </div>
          {/if}
          {#if typeof body.success === 'boolean'}
            <div class="flex items-center justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Result</span>
              <span class={body.success ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{body.success ? 'Success' : 'Failed'}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Rounds -->
      {#if d.rounds && d.rounds.length > 0}
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
          <div class="font-semibold mb-3">Rounds ({d.rounds.length})</div>
          <div class="space-y-1.5">
            {#each d.rounds as rid (rid)}
              <a
                href="/explorer/rounds/{encodeURIComponent(rid)}"
                class="flex items-center justify-between gap-3 rounded-[6px] bg-[var(--surface-2)] px-3 py-2 text-xs no-underline hover:bg-[var(--surface-3)]"
              >
                <span class="uppercase text-[var(--text-tertiary)]">{rid.split(':')[0]}</span>
                <span class="font-mono text-[var(--text-primary)] truncate">{shortHex(rid.replace(/^[a-z]+:/, ''), 12, 8)}</span>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Settlement -->
      {#if d.settlement}
        {@const s = d.settlement}
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="font-semibold">On-chain settlement</div>
            {#if s.status}<Badge variant={settlementVariant(s.status)}>{cap(s.status)}</Badge>{/if}
          </div>
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
          </div>
          {#if s.error}<p class="text-xs text-[var(--error)] mt-3">{s.error}</p>{/if}
        </div>
      {/if}

      <!-- Raw receipt -->
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="font-semibold">Receipt JSON</div>
          <button
            type="button"
            onclick={() => copyJson(d.receipt)}
            class="inline-flex items-center gap-1 h-7 px-2.5 rounded-[5px] bg-[var(--surface-3)] text-[12px] text-[var(--text-primary)] border-none cursor-pointer hover:bg-[var(--surface-4)]"
          >{copied ? 'Copied' : 'Copy JSON'}</button>
        </div>
        <pre class="p-3 rounded-[6px] bg-[var(--surface-0)] text-[11px] leading-[17px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-[560px]">{JSON.stringify(d.receipt, null, 2)}</pre>
      </div>
    {/if}
  </div>
</div>
