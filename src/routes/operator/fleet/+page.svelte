<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { ArrowLeft, Server, Filter } from 'lucide-svelte';
  import { minerAvatarDataUri } from '$lib/miner-avatar';

  const miners = $derived(backend.listOperatorMiners());
  const groups = $derived(backend.listOperatorGroups());

  let selectedGroup = $state('all');

  const filteredMiners = $derived.by(() => {
    if (selectedGroup === 'all') return miners;
    const group = groups.find((g) => g.id === selectedGroup);
    if (!group) return miners;
    const idSet = new Set(group.minerIds);
    return miners.filter((m) => idSet.has(m.id));
  });

  const minerMeta = $derived.by(() => {
    const meta = {};
    for (const m of miners) {
      const subs = $backendState.subscriptions.filter((s) => s.minerId === m.id && s.status === 'active');
      const totalEarned = $backendState.payouts.filter((p) => p.minerId === m.id).reduce((sum, p) => sum + p.minerAmount, 0);
      meta[m.id] = { activeApps: subs.length, earnings: totalEarned, hardware: m.tier.toUpperCase() };
    }
    return meta;
  });

  const columns = ['Miner ID', 'Status', 'Tier', 'Active Apps', 'Uptime %', 'Reputation', 'Earnings', 'Location'];
</script>

{#if !$actor}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:1152px;margin:0 auto;text-align:center;padding-top:120px">
      <p style="font-size:13px;color:var(--text-secondary)">Connect a wallet to access Fleet Management.</p>
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
        Fleet Management
      </h1>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">
        {miners.length} miners across {groups.length} groups
      </p>

      <!-- Group filter -->
      <div style="display:flex;align-items:center;gap:8px;margin-top:20px;margin-bottom:12px">
        <Filter size={14} strokeWidth={1.5} style="color:var(--text-tertiary)" />
        <select
          bind:value={selectedGroup}
          style="height:32px;padding:0 12px;border-radius:5px;border:1px solid var(--border-default);background:var(--surface-1);color:var(--text-primary);font-size:13px;outline:none"
        >
          <option value="all">All Miners ({miners.length})</option>
          {#each groups as g}
            <option value={g.id}>{g.name} ({g.minerIds.length})</option>
          {/each}
        </select>
      </div>

      <!-- Table -->
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border-default)">
              {#each columns as col}
                <th style="padding:0 16px;height:36px;font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em;text-align:left;background:var(--surface-1);position:sticky;top:0">
                  {col}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each filteredMiners as miner}
              {@const meta = minerMeta[miner.id] ?? { activeApps: 0, earnings: 0, hardware: miner.tier.toUpperCase() }}
              {@const isHealthy = miner.uptime >= 95}
              <tr
                style="border-bottom:1px solid var(--border-default);cursor:pointer;transition:background 100ms"
                onmouseenter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onmouseleave={(e) => (e.currentTarget.style.background = '')}
              >
                <td style="padding:0 16px;height:40px">
                  <span style="font-size:12px;font-family:var(--font-mono);color:var(--text-primary);display:flex;align-items:center;gap:8px">
                    <img src={minerAvatarDataUri(miner.id)} alt="" style="width:22px;height:22px;border-radius:5px;flex-shrink:0" />
                    {miner.id}
                  </span>
                  <span style="font-size:11px;color:var(--text-tertiary);display:block">{miner.label}</span>
                </td>
                <td style="padding:0 16px;height:40px">
                  <span class={isHealthy ? 'status-dot status-dot-active' : 'status-dot status-dot-warning'} style="margin-right:6px"></span>
                  <span style="font-size:12px;color:{isHealthy ? 'var(--success)' : 'var(--warning)'}">
                    {isHealthy ? 'Healthy' : 'Degraded'}
                  </span>
                </td>
                <td style="padding:0 16px;height:40px">
                  <span style="font-size:11px;font-weight:500;padding:0 6px;height:20px;display:inline-flex;align-items:center;border-radius:3px;background:var(--surface-3);color:var(--text-secondary)">
                    {miner.tier.toUpperCase()}
                  </span>
                </td>
                <td style="padding:0 16px;height:40px;font-size:12px;font-family:var(--font-mono);color:var(--text-primary)">
                  {meta.activeApps}
                </td>
                <td style="padding:0 16px;height:40px;font-size:12px;font-family:var(--font-mono);color:{miner.uptime >= 98 ? 'var(--success)' : miner.uptime >= 95 ? 'var(--text-primary)' : 'var(--warning)'}">
                  {miner.uptime}%
                </td>
                <td style="padding:0 16px;height:40px;font-size:12px;font-family:var(--font-mono);color:var(--text-accent)">
                  {miner.reputationScore}
                </td>
                <td style="padding:0 16px;height:40px;font-size:12px;font-family:var(--font-mono);color:var(--text-primary)">
                  ${meta.earnings.toFixed(2)}
                </td>
                <td style="padding:0 16px;height:40px;font-size:12px;color:var(--text-secondary)">
                  {miner.location ?? '-'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
{/if}
