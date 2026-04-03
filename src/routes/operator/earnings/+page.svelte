<script lang="ts">
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { ArrowLeft, DollarSign, TrendingUp, Clock, ArrowDownToLine } from 'lucide-svelte';

  const miners = $derived(backend.listOperatorMiners());
  const minerIdSet = $derived(new Set(miners.map((m) => m.id)));

  const fleetPayouts = $derived($backendState.payouts.filter((p) => minerIdSet.has(p.minerId)));

  const totalEarned = $derived(fleetPayouts.reduce((s, p) => s + p.minerAmount, 0));
  const totalDeveloper = $derived(fleetPayouts.reduce((s, p) => s + p.developerAmount, 0));
  const totalTreasury = $derived(fleetPayouts.reduce((s, p) => s + p.treasuryAmount, 0));

  const pendingAmount = $derived(totalEarned * 0.12);
  const withdrawnAmount = $derived(totalEarned * 0.65);
  const availableAmount = $derived(totalEarned - pendingAmount - withdrawnAmount);

  const earningsByApp = $derived.by(() => {
    const map: Record<string, any> = {};
    for (const p of fleetPayouts) {
      if (!map[p.appId]) {
        const app = $backendState.apps.find((a) => a.id === p.appId);
        map[p.appId] = { appId: p.appId, appName: app?.name ?? p.appId, amount: 0, count: 0 };
      }
      map[p.appId].amount += p.minerAmount;
      map[p.appId].count += 1;
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  });

  const topStats = $derived([
    { label: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, icon: DollarSign, color: 'var(--text-accent)' },
    { label: 'Available', value: `$${availableAmount.toFixed(2)}`, icon: TrendingUp, color: 'var(--success)' },
    { label: 'Pending', value: `$${pendingAmount.toFixed(2)}`, icon: Clock, color: 'var(--warning)' },
    { label: 'Withdrawn', value: `$${withdrawnAmount.toFixed(2)}`, icon: ArrowDownToLine, color: 'var(--text-secondary)' },
  ]);

  const revenueSplit = $derived([
    { label: 'Miner Revenue', value: `$${totalEarned.toFixed(2)}`, color: 'var(--success)' },
    { label: 'Developer Fees', value: `$${totalDeveloper.toFixed(2)}`, color: 'var(--info)' },
    { label: 'Treasury Contribution', value: `$${totalTreasury.toFixed(2)}`, color: 'var(--text-tertiary)' },
  ]);
</script>

{#if !$actor}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:1152px;margin:0 auto;text-align:center;padding-top:120px">
      <p style="font-size:13px;color:var(--text-secondary)">Connect a wallet to view Fleet Earnings.</p>
      <button class="btn-pill" onclick={() => ($showConnectModal = true)} style="font-size:13px;height:32px;padding:0 16px;margin-top:16px">
        Connect Wallet
      </button>
    </div>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:1152px;margin:0 auto">
      <a href="/operator" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);text-decoration:none;margin-bottom:16px">
        <ArrowLeft size={14} strokeWidth={1.5} />
        Operator Portal
      </a>

      <h1 class="text-[20px] font-semibold text-[var(--text-primary)]" style="letter-spacing:-0.015em;line-height:28px">
        Fleet Earnings
      </h1>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">
        Aggregate revenue across {miners.length} fleet miners.
      </p>

      <!-- Top stat cards -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px">
        {#each topStats as stat}
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <stat.icon size={14} strokeWidth={1.5} style="color:var(--text-tertiary)" />
              <span style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em">
                {stat.label}
              </span>
            </div>
            <p style="font-size:24px;font-weight:600;color:{stat.color};font-family:var(--font-mono);letter-spacing:-0.02em">
              {stat.value}
            </p>
          </div>
        {/each}
      </div>

      <!-- Revenue split summary -->
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px;margin-top:16px">
        <h2 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;letter-spacing:-0.006em">
          Revenue Split
        </h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
          {#each revenueSplit as item}
            <div>
              <p style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em;margin-bottom:4px">
                {item.label}
              </p>
              <p style="font-size:20px;font-weight:600;color:{item.color};font-family:var(--font-mono)">
                {item.value}
              </p>
            </div>
          {/each}
        </div>
      </div>

      <!-- Earnings by app -->
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px;margin-top:16px">
        <h2 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;letter-spacing:-0.006em">
          Earnings by App / Network
        </h2>

        {#if earningsByApp.length === 0}
          <p style="font-size:13px;color:var(--text-tertiary);padding:12px 0">No earnings recorded yet.</p>
        {:else}
          <div style="display:flex;flex-direction:column">
            {#each earningsByApp as item}
              {@const pct = totalEarned > 0 ? (item.amount / totalEarned) * 100 : 0}
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-default)">
                <div style="flex:1;min-width:0">
                  <p style="font-size:13px;color:var(--text-primary)">{item.appName}</p>
                  <p style="font-size:11px;color:var(--text-tertiary)">{item.count} payouts</p>
                </div>
                <div style="width:120px;flex-shrink:0">
                  <div style="height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden">
                    <div style="height:100%;width:{pct}%;background:var(--accent-base);border-radius:2px"></div>
                  </div>
                </div>
                <span style="font-size:13px;font-family:var(--font-mono);font-weight:600;color:var(--text-accent);min-width:80px;text-align:right">
                  ${item.amount.toFixed(2)}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
