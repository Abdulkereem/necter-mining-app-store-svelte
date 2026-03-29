<script>
  import { ArrowDownLeft, ArrowUpRight, Wallet, Gift } from 'lucide-svelte';

  const stats = [
    { label: 'Treasury Balance', value: '2,400,000', sub: 'NECTA', icon: Wallet, color: 'var(--text-accent)', bg: 'var(--accent-subtle)' },
    { label: '30d Inflows', value: '+180,420', sub: 'NECTA', icon: ArrowDownLeft, color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
    { label: '30d Outflows', value: '-95,180', sub: 'NECTA', icon: ArrowUpRight, color: 'var(--error)', bg: 'rgba(235,87,87,0.12)' },
    { label: 'Active Grants', value: '12', sub: 'programs', icon: Gift, color: 'var(--info)', bg: 'rgba(110,159,255,0.12)' },
  ];

  const inflows = [
    { date: 'Mar 25, 2026', source: 'Helium Coverage', amount: '12,450.00', txHash: '0xa1b2...c3d4' },
    { date: 'Mar 24, 2026', source: 'Render GPU Pool', amount: '8,320.50', txHash: '0xe5f6...g7h8' },
    { date: 'Mar 23, 2026', source: 'Filecoin Storage', amount: '6,180.25', txHash: '0xi9j0...k1l2' },
    { date: 'Mar 22, 2026', source: 'Akash Compute', amount: '4,950.00', txHash: '0xm3n4...o5p6' },
    { date: 'Mar 21, 2026', source: 'IoTeX Sensors', amount: '3,210.75', txHash: '0xq7r8...s9t0' },
    { date: 'Mar 20, 2026', source: 'Livepeer CDN', amount: '2,880.00', txHash: '0xu1v2...w3x4' },
  ];

  const outflows = [
    { date: 'Mar 24, 2026', recipient: 'DePIN Dev Collective', purpose: 'SDK tooling grant', amount: '25,000.00', status: 'completed' },
    { date: 'Mar 22, 2026', recipient: 'Community Rewards Pool', purpose: 'Monthly miner incentives', amount: '15,000.00', status: 'completed' },
    { date: 'Mar 20, 2026', recipient: 'Insurance Reserve', purpose: 'Quarterly allocation', amount: '10,000.00', status: 'completed' },
    { date: 'Mar 18, 2026', recipient: 'Audit Partners LLC', purpose: 'Smart contract audit', amount: '8,500.00', status: 'pending' },
    { date: 'Mar 15, 2026', recipient: 'Node Ops Foundation', purpose: 'Infrastructure grant', amount: '12,000.00', status: 'completed' },
  ];

  const allocations = [
    { label: 'Development', pct: 40, color: 'var(--text-accent)', bg: 'var(--accent-subtle)' },
    { label: 'Community Grants', pct: 25, color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
    { label: 'Insurance Fund', pct: 20, color: 'var(--info)', bg: 'rgba(110,159,255,0.12)' },
    { label: 'Operations', pct: 15, color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)' },
  ];

  let tab = $state('inflows');
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
  <div style="max-width:1152px;margin:0 auto">
    <h1 style="font-size:20px;font-weight:600;color:var(--text-primary);letter-spacing:-0.015em;line-height:28px;margin:0">
      Treasury Dashboard
    </h1>
    <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:20px">
      DAO treasury overview. Fee splits from mining apps fund development, grants, insurance, and operations.
    </p>

    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px">
      {#each stats as s}
        <div style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:8px;padding:16px">
          <div style="display:flex;align-items:start;justify-content:space-between">
            <div>
              <p style="font-size:12px;color:var(--text-secondary);margin:0">{s.label}</p>
              <p style="font-size:20px;font-weight:600;letter-spacing:-0.015em;margin-top:6px;color:{s.color};font-family:var(--font-mono);font-feature-settings:'tnum' 1">
                {s.value}
              </p>
              <p style="font-size:11px;color:var(--text-tertiary);margin-top:2px">{s.sub}</p>
            </div>
            <div style="width:36px;height:36px;border-radius:8px;background:{s.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <s.icon size={16} strokeWidth={1.5} style="color:{s.color}" />
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Allocation breakdown -->
    <div style="margin-top:24px">
      <p style="font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:12px">
        Allocation Breakdown
      </p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        {#each allocations as a}
          <div style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:8px;padding:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:13px;font-weight:500;color:var(--text-primary)">{a.label}</span>
              <span style="font-size:14px;font-weight:600;color:{a.color};font-family:var(--font-mono)">{a.pct}%</span>
            </div>
            <div style="height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden">
              <div style="height:100%;width:{a.pct}%;border-radius:2px;background:{a.color};transition:width 300ms ease-out"></div>
            </div>
            <p style="font-size:12px;color:var(--text-tertiary);margin-top:8px;font-family:var(--font-mono);font-feature-settings:'tnum' 1">
              {((2400000 * a.pct) / 100).toLocaleString()} NECTA
            </p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Inflows / Outflows -->
    <div style="margin-top:24px">
      <div style="display:flex;gap:4px;margin-bottom:16px">
        {#each ['inflows', 'outflows'] as t}
          <button
            type="button"
            onclick={() => (tab = t)}
            style="height:28px;padding:0 12px;border-radius:5px;font-size:12px;font-weight:500;border:none;cursor:pointer;background:{tab === t ? 'var(--accent-subtle)' : 'var(--surface-1)'};color:{tab === t ? 'var(--text-accent)' : 'var(--text-secondary)'};transition:background 100ms ease-out,color 100ms ease-out"
          >
            {t === 'inflows' ? 'Inflows' : 'Outflows'}
          </button>
        {/each}
      </div>

      <div style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:8px;overflow:hidden">
        {#if tab === 'inflows'}
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--surface-1);border-bottom:1px solid var(--border-default)">
                {#each ['Date', 'Source App', 'Amount (NECTA)', 'Tx Hash'] as h}
                  <th style="padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:var(--text-tertiary);text-align:left">{h}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each inflows as row, i}
                <tr
                  style="border-bottom:{i < inflows.length - 1 ? '1px solid var(--border-default)' : 'none'};transition:background 100ms ease-out"
                  onmouseenter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onmouseleave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style="padding:10px 16px;font-size:13px;color:var(--text-secondary)">{row.date}</td>
                  <td style="padding:10px 16px;font-size:13px;color:var(--text-primary)">{row.source}</td>
                  <td style="padding:10px 16px;font-size:13px;color:var(--success);font-family:var(--font-mono);font-feature-settings:'tnum' 1">+{row.amount}</td>
                  <td style="padding:10px 16px;font-size:12px;color:var(--text-tertiary);font-family:var(--font-mono)">{row.txHash}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--surface-1);border-bottom:1px solid var(--border-default)">
                {#each ['Date', 'Recipient', 'Purpose', 'Amount (NECTA)', 'Status'] as h}
                  <th style="padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:var(--text-tertiary);text-align:left">{h}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each outflows as row, i}
                <tr
                  style="border-bottom:{i < outflows.length - 1 ? '1px solid var(--border-default)' : 'none'};transition:background 100ms ease-out"
                  onmouseenter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onmouseleave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style="padding:10px 16px;font-size:13px;color:var(--text-secondary)">{row.date}</td>
                  <td style="padding:10px 16px;font-size:13px;color:var(--text-primary)">{row.recipient}</td>
                  <td style="padding:10px 16px;font-size:13px;color:var(--text-secondary)">{row.purpose}</td>
                  <td style="padding:10px 16px;font-size:13px;color:var(--error);font-family:var(--font-mono);font-feature-settings:'tnum' 1">-{row.amount}</td>
                  <td style="padding:10px 16px">
                    <span
                      class="inline-flex items-center"
                      style="height:20px;padding:0 6px;border-radius:3px;font-size:11px;font-weight:500;white-space:nowrap;background:{row.status === 'completed' ? 'rgba(76,183,130,0.12)' : 'rgba(242,153,74,0.12)'};color:{row.status === 'completed' ? 'var(--success)' : 'var(--warning)'}"
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>
</div>
