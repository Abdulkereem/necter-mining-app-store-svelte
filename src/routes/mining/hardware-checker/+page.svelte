<script lang="ts">
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { mockMiningProfileTrustScores } from '$lib/mock-data';
  import { CheckCircle2, AlertCircle, XCircle } from 'lucide-svelte';

  let minerId = $derived($actor?.minerId ?? null);

  let gpuModel = $state('');
  let cpuCores = $state(8);
  let ramGb = $state(32);
  let storageGb = $state(500);
  let networkMbps = $state(100);

  $effect(() => {
    if (!minerId) {
      gpuModel = ''; cpuCores = 8; ramGb = 32; storageGb = 500; networkMbps = 100;
      return;
    }
    const existing = backend.getHardwareProfile(minerId);
    if (existing) {
      gpuModel = existing.gpuModel ?? '';
      cpuCores = existing.cpuCores ?? 8;
      ramGb = existing.ramGb ?? 32;
      storageGb = existing.storageGb ?? 500;
      networkMbps = existing.networkMbps ?? 100;
    }
  });

  const appCompatibility = $derived.by(() => {
    const apps = backend.listApps();
    return apps.map((app) => {
      let matchPercentage = 0;
      const missingRequirements = [];
      let performanceRating = 'good';

      const asNum = (s: any) => { if (!s) return null; const m = s.match(/(\d+(\.\d+)?)/); return m ? parseFloat(m[1]) : null; };

      if (app.requirements.cpu) {
        const req = asNum(app.requirements.cpu);
        if (req != null) { if (cpuCores >= req) matchPercentage += 15; else { matchPercentage += 5; missingRequirements.push(`CPU: Need ${req} cores, have ${cpuCores}`); } }
      }
      if (app.requirements.gpu) {
        if (gpuModel) matchPercentage += 20; else missingRequirements.push(`GPU required: ${app.requirements.gpu}`);
      } else { matchPercentage += 10; }
      if (app.requirements.ram) {
        const req = asNum(app.requirements.ram);
        if (req != null) { if (ramGb >= req) matchPercentage += 15; else { matchPercentage += 5; missingRequirements.push(`RAM: Need ${req}GB, have ${ramGb}GB`); } }
      }
      if (app.requirements.storage) {
        const req = asNum(app.requirements.storage);
        if (req != null) { if (storageGb >= req) matchPercentage += 15; else { matchPercentage += 2; missingRequirements.push(`Storage: Need ${req}GB, have ${storageGb}GB`); } }
      } else { matchPercentage += 10; }
      if (app.requirements.bandwidth) {
        const req = asNum(app.requirements.bandwidth);
        if (req != null) { if (networkMbps >= req) matchPercentage += 15; else { matchPercentage += 5; missingRequirements.push(`Bandwidth: Need ${req} Mbps, have ${networkMbps} Mbps`); } }
      } else { matchPercentage += 10; }

      let compatible = 'compatible';
      if (matchPercentage < 60) { compatible = 'incompatible'; performanceRating = 'poor'; }
      else if (matchPercentage < 80) { compatible = 'marginal'; performanceRating = 'fair'; }
      else if (matchPercentage >= 90) { performanceRating = 'excellent'; }

      const estimatedEarningsPerMonth = app.avgEarningsPerDay * 30 * (matchPercentage / 100);
      const trustScore = mockMiningProfileTrustScores.find((t) => t.appId === app.id)?.overallScore || 0;

      return { appId: app.id, appName: app.name, compatible, matchPercentage, missingRequirements, estimatedEarningsPerMonth, performanceRating, trustScore };
    });
  });

  const compatibleApps = $derived(appCompatibility.filter((a) => a.compatible === 'compatible').sort((a, b) => b.estimatedEarningsPerMonth - a.estimatedEarningsPerMonth));
  const marginalApps = $derived(appCompatibility.filter((a) => a.compatible === 'marginal'));
  const incompatibleApps = $derived(appCompatibility.filter((a) => a.compatible === 'incompatible'));

  function saveProfile() {
    if (!minerId) return;
    backend.upsertHardwareProfile({
      minerId,
      profile: { minerId, gpuModel: gpuModel || undefined, cpuCores, ramGb, storageGb, networkMbps },
    });
  }
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
  <div style="margin-bottom:24px">
    <h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]" style="margin-bottom:4px">Hardware Compatibility Checker</h1>
    <p class="text-[13px] text-[var(--text-secondary)]" style="max-width:640px">
      Enter your hardware specs to see which mining networks you can join and estimate your potential earnings.
    </p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 2fr;gap:32px">
    <!-- Hardware Input -->
    <div>
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:24px;position:sticky;top:16px">
        <h2 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px">Your Hardware</h2>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div>
            <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:8px">GPU Model</label>
            <select
              bind:value={gpuModel}
              style="width:100%;padding:8px 12px;border:1px solid var(--border-default);border-radius:5px;background:var(--surface-0);color:var(--text-primary);font-size:13px;outline:none"
            >
              <option value="">No GPU</option>
              <option value="RTX 4090">NVIDIA RTX 4090</option>
              <option value="RTX 4080">NVIDIA RTX 4080</option>
              <option value="RTX 3090">NVIDIA RTX 3090</option>
              <option value="RTX 3080">NVIDIA RTX 3080</option>
              <option value="RTX 3060">NVIDIA RTX 3060</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:8px">CPU Cores</label>
            <input type="number" bind:value={cpuCores} style="width:100%;padding:8px 12px;border:1px solid var(--border-default);border-radius:5px;background:var(--surface-0);color:var(--text-primary);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:8px">RAM (GB)</label>
            <input type="number" bind:value={ramGb} style="width:100%;padding:8px 12px;border:1px solid var(--border-default);border-radius:5px;background:var(--surface-0);color:var(--text-primary);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:8px">Storage (GB)</label>
            <input type="number" bind:value={storageGb} style="width:100%;padding:8px 12px;border:1px solid var(--border-default);border-radius:5px;background:var(--surface-0);color:var(--text-primary);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:8px">Network (Mbps)</label>
            <input type="number" bind:value={networkMbps} style="width:100%;padding:8px 12px;border:1px solid var(--border-default);border-radius:5px;background:var(--surface-0);color:var(--text-primary);font-size:13px;outline:none" />
          </div>
          <div style="padding-top:8px">
            {#if minerId}
              <button type="button" class="btn-subscribe" style="width:100%" onclick={saveProfile}>Save to My Hardware</button>
            {:else}
              <button type="button" class="btn-pill" style="width:100%" onclick={() => ($showConnectModal = true)}>Connect wallet to save</button>
            {/if}
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">
              Saved profiles appear in <a href="/settings" style="color:var(--text-accent)">Settings &rarr; My Hardware</a>.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div style="display:flex;flex-direction:column;gap:24px">
      {#if compatibleApps.length > 0}
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <CheckCircle2 size={20} style="color:var(--success)" />
            <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">Fully Compatible ({compatibleApps.length})</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            {#each compatibleApps as app}
              {@render compatibilityCard(app)}
            {/each}
          </div>
        </div>
      {/if}

      {#if marginalApps.length > 0}
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <AlertCircle size={20} style="color:var(--warning)" />
            <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">Marginal Compatibility ({marginalApps.length})</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            {#each marginalApps as app}
              {@render compatibilityCard(app)}
            {/each}
          </div>
        </div>
      {/if}

      {#if incompatibleApps.length > 0}
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <XCircle size={20} style="color:var(--error)" />
            <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">Incompatible ({incompatibleApps.length})</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            {#each incompatibleApps.slice(0, 3) as app}
              {@render compatibilityCard(app)}
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#snippet compatibilityCard(app: any)}
  {@const borderColor = app.compatible === 'compatible' ? 'rgba(76,183,130,0.20)' : app.compatible === 'marginal' ? 'rgba(242,153,74,0.20)' : 'rgba(235,87,87,0.20)'}
  {@const bgColor = app.compatible === 'compatible' ? 'rgba(76,183,130,0.05)' : app.compatible === 'marginal' ? 'rgba(242,153,74,0.05)' : 'rgba(235,87,87,0.05)'}
  {@const badgeColor = app.compatible === 'compatible' ? 'var(--success)' : app.compatible === 'marginal' ? 'var(--warning)' : 'var(--error)'}
  {@const badgeBg = app.compatible === 'compatible' ? 'rgba(76,183,130,0.12)' : app.compatible === 'marginal' ? 'rgba(242,153,74,0.12)' : 'rgba(235,87,87,0.12)'}
  {@const badgeLabel = app.compatible === 'compatible' ? 'Compatible' : app.compatible === 'marginal' ? 'Marginal' : 'Incompatible'}
  {@const barColor = app.compatible === 'compatible' ? 'var(--success)' : app.compatible === 'marginal' ? 'var(--warning)' : 'var(--error)'}

  <div style="border:2px solid {borderColor};background:{bgColor};border-radius:8px;padding:16px">
    <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:12px">
      <div>
        <h4 style="font-size:13px;font-weight:600;color:var(--text-primary)">{app.appName}</h4>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span style="font-size:11px;font-weight:500;padding:0 6px;height:20px;display:inline-flex;align-items:center;border-radius:3px;background:{badgeBg};color:{badgeColor}">{badgeLabel}</span>
          <span style="font-size:11px;color:var(--text-tertiary)">{app.matchPercentage}% match</span>
        </div>
      </div>
    </div>

    <!-- Progress bar -->
    <div style="height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden;margin-bottom:12px">
      <div style="height:100%;width:{app.matchPercentage}%;background:{barColor};border-radius:2px"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px">
      <div>
        <p style="font-size:12px;color:var(--text-secondary)">Est. Monthly Earnings</p>
        <p style="font-size:13px;font-weight:700;color:var(--text-accent);font-family:var(--font-mono)">${app.estimatedEarningsPerMonth.toFixed(2)}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text-secondary)">Performance</p>
        <p style="font-size:13px;font-weight:700;color:var(--text-primary);text-transform:capitalize">{app.performanceRating}</p>
      </div>
    </div>

    {#if app.missingRequirements.length > 0}
      <div style="background:var(--surface-0);border-radius:5px;padding:8px;margin-bottom:12px">
        <p style="font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px">Missing Requirements:</p>
        <ul style="font-size:11px;color:var(--text-tertiary);list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
          {#each app.missingRequirements as req}
            <li>&#8226; {req}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <a href="/apps/{app.appId}" class={app.compatible === 'compatible' ? 'btn-subscribe' : 'btn-secondary'} style="display:block;width:100%;text-align:center">
      {app.compatible === 'compatible' ? 'Open app (start mining)' : 'View app'}
    </a>
  </div>
{/snippet}
