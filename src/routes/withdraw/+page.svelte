<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { ArrowLeft, ArrowDownToLine } from 'lucide-svelte';

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
    <div style="max-width: 480px; margin: 80px auto 0; padding: 32px; background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; text-align: center;">
      <h2 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
        Earnings & Withdrawals
      </h2>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
        Connect your wallet to view earnings and withdraw funds.
      </p>
      <button type="button" onclick={() => $showConnectModal = true} class="btn-pill-primary">
        Connect Wallet
      </button>
    </div>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
      <div>
        <h1 style="font-size: 20px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.015em; line-height: 28px; margin: 0;">
          Earnings & Withdrawals
        </h1>
        <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px;">
          Manage your mining revenue and withdraw funds
        </p>
      </div>
      <a href="/mining" class="btn-secondary">
        <ArrowLeft class="h-3 w-3" strokeWidth={1.5} style="margin-right: 6px;" />
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
        <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
          <p style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 500; margin-bottom: 4px;">
            {stat.label}
          </p>
          <p style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: {stat.accent ? 'var(--text-accent)' : 'var(--text-primary)'}; font-feature-settings: 'tnum';">
            {stat.value}
          </p>
        </div>
      {/each}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <!-- Withdrawal form -->
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
        <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em; margin-bottom: 16px;">
          Withdraw Funds
        </h2>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Amount -->
          <div>
            <label style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">
              Amount
            </label>
            <div style="position: relative;">
                <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text-tertiary);">$</span>
                <input
                  type="number"
                  bind:value={amount}
                  placeholder="0.00"
                  style="width: 100%; height: 36px; padding-left: 28px; padding-right: 12px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-0); font-size: 13px; font-family: var(--font-mono); color: var(--text-primary); outline: none; font-feature-settings: 'tnum';"
                />
            </div>
            <p style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
              Available: ${availableBalance.toFixed(2)}
            </p>
          </div>

          <!-- Destination select -->
          <div>
            <label style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">
              Destination Address
            </label>
            <input
              type="text"
              bind:value={destination}
              placeholder={walletAddress}
              style="width: 100%; height: 36px; padding: 0 12px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-0); font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); outline: none;"
            />
            <p style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
              Leave blank to withdraw to connected wallet
            </p>
          </div>

          <!-- Network -->
          <div>
            <label style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">
              Network
            </label>
            <div style="height: 36px; padding: 0 12px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-0); font-size: 13px; color: var(--text-secondary); display: flex; align-items: center;">
              {network}
            </div>
          </div>

          <button
            type="button"
            onclick={handleWithdraw}
            disabled={!canWithdraw}
            class="btn-subscribe"
            style="margin-top: 4px; opacity: {canWithdraw ? 1 : 0.4}; cursor: {canWithdraw ? 'pointer' : 'not-allowed'};"
          >
            <ArrowDownToLine class="h-3.5 w-3.5" strokeWidth={1.5} />
            {submitting ? 'Processing...' : 'Withdraw'}
          </button>
        </div>

      </div>

      <!-- Recent withdrawals -->
      <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-default);">
          <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em; margin: 0;">
            Recent Withdrawals
          </h2>
        </div>

        {#if withdrawals.length === 0}
          <div style="padding: 32px 20px; text-align: center;">
            <p style="font-size: 13px; color: var(--text-secondary);">No withdrawals yet.</p>
          </div>
        {:else}
          <div style="overflow-x: auto;">
            <!-- Table header -->
            <div style="display: grid; grid-template-columns: 1fr 100px 90px 1fr; gap: 8px; padding: 8px 20px; background: var(--surface-1); border-bottom: 1px solid var(--border-default);">
              {#each ['Date', 'Amount', 'Status', 'Tx Hash'] as h}
                <span style="font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">{h}</span>
              {/each}
            </div>
            <!-- Rows -->
            {#each withdrawals.slice(0, 20) as w}
              {@const sc = statusColor[w.status] ?? statusColor.pending}
              {@const txDisplay = w.txHash ? `${w.txHash.slice(0, 10)}...${w.txHash.slice(-6)}` : '--'}
              <div style="display: grid; grid-template-columns: 1fr 100px 90px 1fr; gap: 8px; padding: 10px 20px; border-bottom: 1px solid var(--border-default); align-items: center;">
                <span style="font-size: 12px; color: var(--text-secondary);">
                  {new Date(w.requestedAt).toLocaleDateString()}
                </span>
                <span style="font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); font-feature-settings: 'tnum';">
                  ${w.amount.toFixed(2)}
                </span>
                <span style="display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 3px; font-size: 11px; font-weight: 500; background: {sc.bg}; color: {sc.text}; text-transform: capitalize; width: fit-content;">
                  {w.status}
                </span>
                <span style="font-size: 12px; font-family: var(--font-mono); color: var(--text-tertiary);">
                  {txDisplay}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
