<script lang="ts">
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { ArrowLeft, Shield, AlertTriangle, Pause, RefreshCw, Star } from 'lucide-svelte';

  const miners = $derived(backend.listOperatorMiners());
  const rules = $derived($backendState.operatorAutomationRules);

  const triggerMeta = {
    low_reputation: { label: 'Low Reputation', icon: AlertTriangle, color: 'var(--warning)' },
    downtime: { label: 'Downtime Detected', icon: Pause, color: 'var(--error)' },
    low_roi: { label: 'Low ROI', icon: RefreshCw, color: 'var(--info)' },
  };

  const actionMeta = {
    pause: 'Pause miner',
    resume: 'Resume miner',
    switch_app: 'Switch to higher-ROI app',
  };

  function handleToggle(ruleId: any) {
    backend.toggleAutomationRule(ruleId);
  }

  const avgReputation = $derived(
    miners.length > 0 ? miners.reduce((s, m) => s + m.reputationScore, 0) / miners.length : 0
  );
  const topMiners = $derived([...miners].sort((a, b) => b.reputationScore - a.reputationScore).slice(0, 10));
  const lowMiners = $derived([...miners].sort((a, b) => a.reputationScore - b.reputationScore).slice(0, 5));
</script>

{#if !$actor}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:1152px;margin:0 auto;text-align:center;padding-top:120px">
      <p style="font-size:13px;color:var(--text-secondary)">Connect a wallet to access Automation.</p>
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
        Automation & Reputation
      </h1>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">
        Configure automated fleet rules and monitor miner reputation.
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px">
        <!-- Left: Automation rules -->
        <div>
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:20px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
              <RefreshCw size={16} strokeWidth={1.5} style="color:var(--text-accent)" />
              <h2 style="font-size:14px;font-weight:600;color:var(--text-primary);letter-spacing:-0.006em">
                Automation Rules
              </h2>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px">
              {#each rules as rule}
                {@const meta = triggerMeta[rule.trigger] ?? { label: rule.trigger, icon: RefreshCw, color: 'var(--text-secondary)' }}
                <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:5px;border:1px solid var(--border-default);background:var(--surface-0)">
                  <div style="width:32px;height:32px;border-radius:5px;background:{rule.enabled ? 'var(--accent-subtle)' : 'var(--surface-3)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <meta.icon size={14} strokeWidth={1.5} style="color:{rule.enabled ? meta.color : 'var(--text-tertiary)'}" />
                  </div>
                  <div style="flex:1;min-width:0">
                    <p style="font-size:13px;color:var(--text-primary);font-weight:500">{rule.name}</p>
                    <p style="font-size:11px;color:var(--text-tertiary);margin-top:2px">
                      Trigger: {meta.label} &rarr; {actionMeta[rule.action] ?? rule.action}
                    </p>
                  </div>
                  <button
                    type="button"
                    onclick={() => handleToggle(rule.id)}
                    style="width:36px;height:20px;border-radius:9999px;background:{rule.enabled ? 'var(--accent-base)' : 'var(--surface-3)'};border:none;cursor:pointer;position:relative;flex-shrink:0;transition:background 150ms"
                  >
                    <div style="width:14px;height:14px;border-radius:50%;background:white;position:absolute;top:3px;left:{rule.enabled ? '19px' : '3px'};transition:left 150ms"></div>
                  </button>
                </div>
              {/each}
            </div>

            {#if rules.length === 0}
              <p style="font-size:13px;color:var(--text-tertiary);padding:12px 0">No automation rules configured.</p>
            {/if}
          </div>
        </div>

        <!-- Right: Reputation -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <!-- Fleet average -->
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:20px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
              <Shield size={16} strokeWidth={1.5} style="color:var(--text-accent)" />
              <h2 style="font-size:14px;font-weight:600;color:var(--text-primary);letter-spacing:-0.006em">Fleet Reputation</h2>
            </div>
            <div style="text-align:center;padding:12px 0">
              <p style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em;margin-bottom:4px">
                Fleet Average
              </p>
              <p style="font-size:32px;font-weight:600;color:var(--text-accent);font-family:var(--font-mono);letter-spacing:-0.02em">
                {avgReputation.toFixed(1)}
              </p>
              <p style="font-size:12px;color:var(--text-tertiary);margin-top:4px">
                out of 5.0 &middot; {miners.length} miners
              </p>
            </div>
          </div>

          <!-- Top performers -->
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:20px">
            <h3 style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:12px">Top Performers</h3>
            <div style="display:flex;flex-direction:column">
              {#each topMiners as m, idx}
                <div style="display:flex;align-items:center;gap:10px;padding:6px 0;{idx < topMiners.length - 1 ? 'border-bottom:1px solid var(--border-default)' : ''}">
                  <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-tertiary);width:20px;text-align:center">{idx + 1}</span>
                  <span style="font-size:12px;font-family:var(--font-mono);color:var(--text-primary);flex:1">{m.label}</span>
                  <Star size={12} strokeWidth={1.5} style="color:var(--text-accent);flex-shrink:0" />
                  <span style="font-size:12px;font-family:var(--font-mono);color:var(--text-accent);min-width:30px;text-align:right">{m.reputationScore}</span>
                </div>
              {/each}
            </div>
          </div>

          <!-- Needs attention -->
          <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:20px">
            <h3 style="font-size:12px;font-weight:600;color:var(--warning);margin-bottom:12px">Needs Attention</h3>
            <div style="display:flex;flex-direction:column">
              {#each lowMiners as m, idx}
                <div style="display:flex;align-items:center;gap:10px;padding:6px 0;{idx < lowMiners.length - 1 ? 'border-bottom:1px solid var(--border-default)' : ''}">
                  <span class="status-dot status-dot-warning" style="flex-shrink:0"></span>
                  <span style="font-size:12px;font-family:var(--font-mono);color:var(--text-primary);flex:1">{m.label}</span>
                  <span style="font-size:12px;font-family:var(--font-mono);color:var(--warning);min-width:30px;text-align:right">{m.reputationScore}</span>
                  <span style="font-size:11px;color:var(--text-tertiary)">{m.uptime}% up</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
