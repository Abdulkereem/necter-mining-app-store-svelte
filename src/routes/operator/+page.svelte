<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { Server, Cpu, Activity, Layers, Rocket, DollarSign, Shield, ChevronRight } from 'lucide-svelte';

  const miners = $derived(backend.listOperatorMiners());
  const groups = $derived(backend.listOperatorGroups());
  const deployments = $derived(backend.listOperatorDeployments(5));

  const activeMiners = $derived(miners.filter((m) => m.uptime >= 95));
  const avgReputation = $derived(
    miners.length > 0 ? (miners.reduce((s, m) => s + m.reputationScore, 0) / miners.length).toFixed(1) : '0.0'
  );
  const avgUptime = $derived(
    miners.length > 0 ? (miners.reduce((s, m) => s + m.uptime, 0) / miners.length).toFixed(1) : '0.0'
  );

  const statCards = $derived([
    { label: 'Total Miners', value: String(miners.length), icon: Server },
    { label: 'Active', value: String(activeMiners.length), icon: Activity },
    { label: 'Groups', value: String(groups.length), icon: Layers },
    { label: 'Deployments', value: String(deployments.length), icon: Rocket },
  ]);

  const quickLinks = [
    { href: '/operator/fleet', label: 'Fleet Management', icon: Server, desc: 'View and manage all miners' },
    { href: '/operator/deploy', label: 'Bulk Deploy', icon: Rocket, desc: 'Deploy apps to miner groups' },
    { href: '/operator/earnings', label: 'Fleet Earnings', icon: DollarSign, desc: 'Aggregate revenue breakdown' },
    { href: '/operator/automation', label: 'Automation & Reputation', icon: Shield, desc: 'Rules and fleet reputation' },
  ];

  const tiers = ['gpu', 'cpu', 'storage', 'bandwidth'];
</script>

{#if !$actor}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:1152px;margin:0 auto;text-align:center;padding-top:120px">
      <p style="font-size:13px;color:var(--text-secondary)">Connect a wallet to access the Operator Portal.</p>
      <button
        class="btn-pill"
        onclick={() => ($showConnectModal = true)}
        style="font-size:13px;height:32px;padding:0 16px;margin-top:16px"
      >
        Connect Wallet
      </button>
    </div>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:1152px;margin:0 auto">
      <h1 class="text-[20px] font-semibold text-[var(--text-primary)]" style="letter-spacing:-0.015em;line-height:28px">
        Operator Portal
      </h1>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">
        Manage your fleet of miners, deployments, and automation rules.
      </p>

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px">
        {#each statCards as stat}
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <stat.icon size={14} strokeWidth={1.5} style="color:var(--text-tertiary)" />
              <span style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em">
                {stat.label}
              </span>
            </div>
            <p style="font-size:24px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono);letter-spacing:-0.02em">
              {stat.value}
            </p>
          </div>
        {/each}
      </div>

      <!-- Fleet health summary -->
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px;margin-top:16px">
        <h2 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;letter-spacing:-0.006em">
          Fleet Health Summary
        </h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
          <div>
            <p style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em;margin-bottom:4px">
              Avg Uptime
            </p>
            <p style="font-size:20px;font-weight:600;color:var(--success);font-family:var(--font-mono)">
              {avgUptime}%
            </p>
          </div>
          <div>
            <p style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em;margin-bottom:4px">
              Avg Reputation
            </p>
            <p style="font-size:20px;font-weight:600;color:var(--text-accent);font-family:var(--font-mono)">
              {avgReputation}
            </p>
          </div>
          <div>
            <p style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em;margin-bottom:4px">
              Tier Breakdown
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
              {#each tiers as tier}
                {@const count = miners.filter((m) => m.tier === tier).length}
                <span style="font-size:11px;font-weight:500;padding:0 6px;height:20px;display:inline-flex;align-items:center;border-radius:3px;background:var(--surface-3);color:var(--text-secondary)">
                  {tier.toUpperCase()} {count}
                </span>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- Quick links -->
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px">
        {#each quickLinks as link}
          <a
            href={link.href}
            class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] hover:border-[rgba(255,255,255,0.10)]"
            style="padding:16px;display:flex;align-items:center;gap:12px;text-decoration:none;transition:border-color 100ms"
          >
            <div style="width:36px;height:36px;border-radius:8px;background:var(--accent-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <link.icon size={16} strokeWidth={1.5} style="color:var(--text-accent)" />
            </div>
            <div style="flex:1;min-width:0">
              <p style="font-size:13px;font-weight:600;color:var(--text-primary)">{link.label}</p>
              <p style="font-size:12px;color:var(--text-tertiary);margin-top:2px">{link.desc}</p>
            </div>
            <ChevronRight size={14} strokeWidth={1.5} style="color:var(--text-tertiary);flex-shrink:0" />
          </a>
        {/each}
      </div>

      <!-- Recent deployments -->
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px;margin-top:16px">
        <h2 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;letter-spacing:-0.006em">
          Recent Deployments
        </h2>
        {#if deployments.length === 0}
          <p style="font-size:13px;color:var(--text-tertiary);padding:12px 0">
            No deployments yet. Go to <a href="/operator/deploy" style="color:var(--text-accent)">Bulk Deploy</a> to start one.
          </p>
        {:else}
          <div style="display:flex;flex-direction:column">
            {#each deployments as dep}
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-default)">
                <span
                  class={dep.status === 'running' || dep.status === 'complete' ? 'status-dot status-dot-active' : 'status-dot status-dot-error'}
                  style="flex-shrink:0"
                ></span>
                <div style="flex:1;min-width:0">
                  <p style="font-size:13px;color:var(--text-primary)">
                    Deploy to {dep.minerIds.length} miners
                  </p>
                  <p style="font-size:11px;color:var(--text-tertiary);font-family:var(--font-mono)">
                    {dep.id}
                  </p>
                </div>
                <span
                  style="font-size:11px;font-weight:500;font-family:var(--font-mono);color:{dep.status === 'running' ? 'var(--warning)' : dep.status === 'complete' ? 'var(--success)' : 'var(--error)'}"
                >
                  {dep.status === 'running' ? `${dep.progress}%` : dep.status}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
