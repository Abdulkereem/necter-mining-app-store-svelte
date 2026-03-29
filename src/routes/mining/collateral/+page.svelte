<script>
  import { backendState } from '$lib/stores/backend';
  import { mockCollateralInfo } from '$lib/mock-data';
  import { AlertCircle, Lock, Unlock } from 'lucide-svelte';

  let selectedCollateral = $state(null);

  const totalLocked = mockCollateralInfo.reduce((sum, c) => sum + c.amountLocked, 0);
  const totalRequired = mockCollateralInfo.reduce((sum, c) => sum + c.amountRequired, 0);
  const maxMarginCallRisk = Math.max(...mockCollateralInfo.map((c) => c.marginCallRisk));

  const sortedCollateral = [...mockCollateralInfo].sort((a, b) => b.marginCallRisk - a.marginCallRisk);
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
  <div style="margin-bottom:24px">
    <h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]" style="margin-bottom:12px">Collateral Management</h1>
    <p class="text-[13px] text-[var(--text-secondary)]" style="max-width:640px">
      Monitor your locked collateral, unlock dates, and slashing history across all mining networks.
    </p>
  </div>

  <!-- Summary Stats -->
  <div style="border-bottom:1px solid var(--border-default);padding-bottom:24px">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
      <div>
        <p style="font-size:12px;color:var(--text-secondary);font-weight:500;text-transform:uppercase;letter-spacing:0.04em">Total Locked</p>
        <p style="font-size:24px;font-weight:600;font-family:var(--font-mono);color:var(--text-accent);margin-top:8px">${totalLocked.toLocaleString()}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text-secondary);font-weight:500;text-transform:uppercase;letter-spacing:0.04em">Total Required</p>
        <p style="font-size:24px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary);margin-top:8px">${totalRequired.toLocaleString()}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text-secondary);font-weight:500;text-transform:uppercase;letter-spacing:0.04em">Networks Active</p>
        <p style="font-size:24px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary);margin-top:8px">{mockCollateralInfo.length}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text-secondary);font-weight:500;text-transform:uppercase;letter-spacing:0.04em">Max Risk Level</p>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <p style="font-size:24px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary)">{maxMarginCallRisk}%</p>
          {#if maxMarginCallRisk > 30}
            <AlertCircle size={20} style="color:var(--warning)" />
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div style="margin-top:24px;display:flex;flex-direction:column;gap:16px">
    {#each sortedCollateral as collateral}
      {@const app = $backendState.apps.find((a) => a.id === collateral.appId) ?? null}
      {@const borderColor = collateral.status === 'healthy' ? 'rgba(76,183,130,0.20)' : collateral.status === 'warning' ? 'rgba(242,153,74,0.20)' : 'rgba(235,87,87,0.20)'}
      {@const bgColor = collateral.status === 'healthy' ? 'rgba(76,183,130,0.05)' : collateral.status === 'warning' ? 'rgba(242,153,74,0.05)' : 'rgba(235,87,87,0.05)'}
      {@const badgeColor = collateral.status === 'healthy' ? 'var(--success)' : collateral.status === 'warning' ? 'var(--warning)' : 'var(--error)'}
      {@const badgeBg = collateral.status === 'healthy' ? 'rgba(76,183,130,0.12)' : collateral.status === 'warning' ? 'rgba(242,153,74,0.12)' : 'rgba(235,87,87,0.12)'}
      {@const badgeLabel = collateral.status === 'healthy' ? 'Healthy' : collateral.status === 'warning' ? 'Warning' : 'Critical'}
      {@const fillColor = collateral.status === 'healthy' ? 'var(--success)' : collateral.status === 'warning' ? 'var(--warning)' : 'var(--error)'}
      {@const unlockDate = new Date(collateral.unlockDate)}
      {@const daysUntilUnlock = Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}

      <div
        style="border:1px solid {borderColor};background:{bgColor};border-radius:8px;padding:24px;cursor:pointer;transition:border-color 100ms"
        onclick={() => (selectedCollateral = selectedCollateral === collateral.appId ? null : collateral.appId)}
        onkeydown={(e) => { if (e.key === 'Enter') selectedCollateral = selectedCollateral === collateral.appId ? null : collateral.appId; }}
        role="button"
        tabindex="0"
      >
        <!-- Header -->
        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:16px">
          <div style="display:flex;align-items:start;gap:16px;flex:1">
            {#if app}
              <img src={app.icon || '/placeholder.svg'} alt={app.name} style="height:48px;width:48px;border-radius:5px" />
              <div>
                <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">{app.name}</h3>
                <p style="font-size:13px;color:var(--text-secondary)">{app.category}</p>
              </div>
            {/if}
          </div>
          <span style="font-size:11px;font-weight:500;padding:0 6px;height:20px;display:inline-flex;align-items:center;border-radius:3px;background:{badgeBg};color:{badgeColor}">
            {badgeLabel}
          </span>
        </div>

        <!-- Collateral Status -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:16px">
          <div>
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Amount Locked</p>
            <p style="font-size:20px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary)">${collateral.amountLocked}</p>
            <p style="font-size:12px;color:var(--text-tertiary);margin-top:4px;font-family:var(--font-mono)">of ${collateral.amountRequired} required</p>
          </div>
          <div>
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Lock Status</p>
            <div style="display:flex;align-items:center;gap:8px">
              <Lock size={20} style="color:var(--text-accent)" />
              <span style="font-size:13px;font-weight:500;color:var(--text-primary)">Locked</span>
            </div>
          </div>
          <div>
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Unlock Date</p>
            <p style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary)">{unlockDate.toLocaleDateString()}</p>
            <p style="font-size:12px;color:var(--text-tertiary);margin-top:4px">{daysUntilUnlock} days remaining</p>
          </div>
        </div>

        <!-- Margin Call Risk -->
        <div style="margin-bottom:16px;padding:12px;background:var(--surface-0);border-radius:5px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;font-weight:500;color:var(--text-primary)">Margin Call Risk</span>
            <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary)">{collateral.marginCallRisk}%</span>
          </div>
          <div style="height:8px;border-radius:3px;background:var(--surface-3);overflow:hidden">
            <div style="height:100%;border-radius:3px;width:{collateral.marginCallRisk}%;background:{fillColor};transition:width 300ms"></div>
          </div>
          {#if collateral.marginCallRisk > 30}
            <p style="font-size:12px;color:var(--warning);margin-top:8px">High risk. Monitor network health closely.</p>
          {/if}
        </div>

        <!-- Expanded Details -->
        {#if selectedCollateral === collateral.appId}
          <div style="padding-top:16px;border-top:1px solid var(--border-default)">
            <h4 style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Slashing History</h4>
            {#if collateral.slashingHistory.length > 0}
              <div style="display:flex;flex-direction:column;gap:12px">
                {#each collateral.slashingHistory as slash}
                  <div style="padding:12px;background:rgba(235,87,87,0.05);border:1px solid rgba(235,87,87,0.15);border-radius:5px">
                    <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:8px">
                      <span style="font-size:13px;font-weight:500;font-family:var(--font-mono);color:var(--text-primary)">${slash.amount} slashed</span>
                      <span style="font-size:12px;color:var(--text-tertiary)">{new Date(slash.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">{slash.reason}</p>
                    {#if slash.recoveryPath}
                      <p style="font-size:12px;color:var(--success)">Recovery: {slash.recoveryPath}</p>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <p style="font-size:13px;color:var(--text-tertiary)">No slashing events. Keep up the good work!</p>
            {/if}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:12px;margin-top:16px;border-top:1px solid var(--border-default)">
              <button type="button" class="btn-secondary" style="width:100%">View Details</button>
              {#if daysUntilUnlock <= 0}
                <button type="button" class="btn-subscribe" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px">
                  <Unlock size={16} />
                  Claim Collateral
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
