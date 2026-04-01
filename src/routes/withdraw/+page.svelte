<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { ArrowLeft, ArrowDownToLine } from 'lucide-svelte';
  import { StatCard, Card, Input, Button } from '$lib/components/ui';

  let amount = $state('');
  let destination = $state('');
  let network = 'Necter L2';
  let submitting = $state(false);

  const walletAddress = $derived($actor?.walletAddress ?? null);
  const minerId = $derived($actor?.minerId ?? null);

  const availableBalance = $derived(
    walletAddress ? ($backendState.walletBalancesByAddress[walletAddress] ?? 0) : 0
  );

  const payouts = $derived(
    minerId ? ($backendState.payouts ?? []).filter((/** @type {any} */ p) => p.minerId === minerId) : []
  );

  const totalEarned = $derived(
    payouts.reduce((/** @type {number} */ sum, /** @type {any} */ p) => sum + (p.minerAmount ?? p.gross ?? 0), 0)
  );

  const withdrawals = $derived(
    minerId ? ($backendState.withdrawals ?? []).filter((/** @type {any} */ w) => w.minerId === minerId) : []
  );

  const totalWithdrawn = $derived(
    withdrawals.filter((/** @type {any} */ w) => w.status === 'completed').reduce((/** @type {number} */ sum, /** @type {any} */ w) => sum + w.amount, 0)
  );

  const pendingAmount = $derived(
    withdrawals.filter((/** @type {any} */ w) => w.status === 'pending' || w.status === 'processing').reduce((/** @type {number} */ sum, /** @type {any} */ w) => sum + w.amount, 0)
  );

  const numericAmount = $derived(Number(amount) || 0);

  const canWithdraw = $derived(
    !submitting && amount && numericAmount > 0 && numericAmount <= availableBalance
  );

  function handleWithdraw() {
    if (!walletAddress || !minerId || !canWithdraw) return;
    submitting = true;
    try {
      backend.requestWithdrawal({
        minerId,
        walletAddress,
        amount: numericAmount,
      });
      amount = '';
      destination = '';
    } catch (e) {
      console.error('Withdrawal error:', e);
    } finally {
      submitting = false;
    }
  }

  /** @type {Record<string, { bg: string; text: string }>} */
  const statusColor = {
    completed: { bg: 'rgba(76,183,130,0.12)', text: 'var(--success)' },
    pending: { bg: 'rgba(110,159,255,0.12)', text: 'var(--info)' },
    processing: { bg: 'rgba(242,153,74,0.12)', text: 'var(--warning)' },
    failed: { bg: 'rgba(235,87,87,0.12)', text: 'var(--error)' },
  };

  /** @param {number} n */
  function fmtCurrency(n) {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
</script>

<svelte:head>
  <title>Withdraw — Necter Mining App Store</title>
</svelte:head>

{#if !walletAddress}
  <div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
    <Card class="max-w-[480px] mt-20 mx-auto text-center" padding="p-8">
      <h2 class="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
        Earnings & Withdrawals
      </h2>
      <p class="text-[13px] text-[var(--text-secondary)] mb-4">
        Connect your wallet to view earnings and withdraw funds.
      </p>
      <button type="button" onclick={() => $showConnectModal = true} class="btn-pill-primary">
        Connect Wallet
      </button>
    </Card>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-[-0.015em] leading-7 m-0">
          Earnings & Withdrawals
        </h1>
        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
          Manage your mining revenue and withdraw funds
        </p>
      </div>
      <a href="/mining" class="btn-secondary">
        <ArrowLeft class="h-3 w-3 mr-1.5" strokeWidth={1.5} />
        Back
      </a>
    </div>

    <!-- Stats row -->
    <div class="mobile-grid-2 grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {#each [
        { label: 'Available Balance', value: fmtCurrency(availableBalance), accent: true },
        { label: 'Total Earned', value: fmtCurrency(totalEarned), accent: false },
        { label: 'Total Withdrawn', value: fmtCurrency(totalWithdrawn), accent: false },
        { label: 'Pending', value: fmtCurrency(pendingAmount), accent: false },
      ] as stat}
        <StatCard label={stat.label} value={stat.value} accent={stat.accent} />
      {/each}
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- Withdrawal form -->
      <Card>
        <h2 class="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.006em] mb-4">
          Withdraw Funds
        </h2>

        <div class="flex flex-col gap-3">
          <!-- Amount -->
          <div>
            <label class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-1.5">
              Amount
            </label>
            <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--text-tertiary)]">$</span>
                <Input
                  type="number"
                  bind:value={amount}
                  placeholder="0.00"
                  class="pl-7 font-mono tabular-nums"
                />
            </div>
            <p class="text-[11px] text-[var(--text-tertiary)] mt-1">
              Available: ${availableBalance.toFixed(2)}
            </p>
          </div>

          <!-- Destination select -->
          <div>
            <label class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-1.5">
              Destination Address
            </label>
            <Input
              type="text"
              bind:value={destination}
              placeholder={walletAddress}
              class="font-mono text-[12px]"
            />
            <p class="text-[11px] text-[var(--text-tertiary)] mt-1">
              Leave blank to withdraw to connected wallet
            </p>
          </div>

          <!-- Network -->
          <div>
            <label class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-1.5">
              Network
            </label>
            <div class="h-9 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[13px] text-[var(--text-secondary)] flex items-center">
              {network}
            </div>
          </div>

          <Button
            onclick={handleWithdraw}
            disabled={!canWithdraw}
            size="lg"
            class="mt-1 w-full"
          >
            <ArrowDownToLine class="h-3.5 w-3.5" strokeWidth={1.5} />
            {submitting ? 'Processing...' : 'Withdraw'}
          </Button>
        </div>

      </Card>

      <!-- Recent withdrawals -->
      <Card padding="p-0" class="overflow-hidden">
        <div class="px-5 py-4 border-b border-[var(--border-default)]">
          <h2 class="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.006em] m-0">
            Recent Withdrawals
          </h2>
        </div>

        {#if withdrawals.length === 0}
          <div class="px-5 py-8 text-center">
            <p class="text-[13px] text-[var(--text-secondary)]">No withdrawals yet.</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <!-- Table header -->
            <div class="grid gap-2 px-5 py-2 bg-[var(--surface-1)] border-b border-[var(--border-default)]" style="grid-template-columns: 1fr 100px 90px 1fr;">
              {#each ['Date', 'Amount', 'Status', 'Tx Hash'] as h}
                <span class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.02em]">{h}</span>
              {/each}
            </div>
            <!-- Rows -->
            {#each withdrawals.slice(0, 20) as w}
              {@const sc = statusColor[w.status] ?? statusColor.pending}
              {@const txDisplay = w.txHash ? `${w.txHash.slice(0, 10)}...${w.txHash.slice(-6)}` : '--'}
              <div class="grid gap-2 px-5 py-2.5 border-b border-[var(--border-default)] items-center" style="grid-template-columns: 1fr 100px 90px 1fr;">
                <span class="text-[12px] text-[var(--text-secondary)]">
                  {new Date(w.requestedAt).toLocaleDateString()}
                </span>
                <span class="text-[12px] font-mono text-[var(--text-primary)] tabular-nums">
                  ${w.amount.toFixed(2)}
                </span>
                <span class="inline-flex items-center h-5 px-1.5 rounded-[3px] text-[11px] font-medium capitalize w-fit" style="background: {sc.bg}; color: {sc.text};">
                  {w.status}
                </span>
                <span class="text-[12px] font-mono text-[var(--text-tertiary)]">
                  {txDisplay}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>
  </div>
{/if}
