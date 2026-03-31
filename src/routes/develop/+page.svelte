<script>
  import { onMount } from 'svelte';
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
  import { appIconDataUri } from '$lib/app-icon';
  import DevSetupModal from '$lib/components/DevSetupModal.svelte';
  import {
    Plus, Send, Cpu, Server, Database, Wifi, Globe, Shield,
  } from 'lucide-svelte';

  // ── Config ──
  const listingStatusConfig = {
    draft: { label: 'Draft', bg: 'var(--surface-3)', text: 'var(--text-secondary)' },
    pending_governance: { label: 'Pending Review', bg: 'rgba(242,153,74,0.12)', text: 'var(--warning)' },
    beta: { label: 'Beta', bg: 'rgba(110,159,255,0.12)', text: 'var(--info)' },
    listed: { label: 'Listed', bg: 'rgba(76,183,130,0.12)', text: 'var(--success)' },
    delisted: { label: 'Delisted', bg: 'rgba(235,87,87,0.12)', text: 'var(--error)' },
  };

  const pipelineStages = [
    { key: 'draft', label: 'Draft' },
    { key: 'pending_governance', label: 'In Review' },
    { key: 'listed', label: 'Live' },
  ];

  function stageIndex(status) {
    const idx = pipelineStages.findIndex((s) => s.key === status);
    return idx === -1 ? 0 : idx;
  }

  const templates = [
    { name: 'AI Inference', icon: Cpu, consensus: 'PoW', reward: 'Per Task', color: 'var(--text-secondary)', desc: 'Distributed GPU inference for AI models. Miners serve predictions on demand.', gradient: 'var(--surface-2)' },
    { name: 'Storage Provider', icon: Database, consensus: 'PoST', reward: 'Time Based', color: 'var(--text-secondary)', desc: 'Decentralized storage with erasure coding. Miners provide disk space and bandwidth.', gradient: 'var(--surface-2)' },
    { name: 'IoT Sensor Grid', icon: Wifi, consensus: 'PoC', reward: 'Time Based', color: 'var(--text-secondary)', desc: 'Sensor data collection via IoT gateways. Supports LoRa, Zigbee, BLE protocols.', gradient: 'var(--surface-2)' },
    { name: 'CDN Relay', icon: Globe, consensus: 'PoA', reward: 'Performance', color: 'var(--text-secondary)', desc: 'Content delivery relay network. Miners cache and serve content at the edge.', gradient: 'var(--surface-2)' },
    { name: 'Data Validation', icon: Shield, consensus: 'PoW', reward: 'Per Task', color: 'var(--text-secondary)', desc: 'Data integrity verification with cryptographic proofs. ZK circuits supported.', gradient: 'var(--surface-2)' },
    { name: 'GPU Compute', icon: Cpu, consensus: 'PoW', reward: 'Hybrid', color: 'var(--text-secondary)', desc: 'Shared GPU pool for rendering, training, and parallel workloads.', gradient: 'var(--surface-2)' },
  ];

  // ── State ──
  let setupModalOpen = $state(false);

  const devWalletAddress = $derived($actor?.walletAddress ?? null);

  // Auto-grant developer role on portal access
  $effect(() => {
    if (devWalletAddress) {
      try { backend.grantRole(devWalletAddress, 'developer'); } catch {}
    }
  });

  const developerApps = $derived((() => {
    const w = $actor?.walletAddress;
    if (!w) return [];
    return $backendState.apps.filter((a) => a.developerAddress?.toLowerCase() === w.toLowerCase());
  })());

  const totalMiners = $derived(developerApps.reduce((s, a) => s + (a.totalMiners ?? 0), 0));
  const totalRevenue = $derived(developerApps.reduce((s, a) => s + (a.totalEarnings ?? 0), 0));

  const operatorMiners = $derived(backend.listOperatorMiners());
  const operatorGroups = $derived(backend.listOperatorGroups());

  const enrollment = $derived(devWalletAddress ? backend.getDeveloperEnrollment(devWalletAddress) : null);
  const enrollmentActive = $derived(enrollment?.status === 'active' || enrollment?.status === 'pending');

  function getIconSrc(app) {
    return app.icon && app.icon !== '/placeholder.svg' ? app.icon : appIconDataUri({ id: app.id, name: app.name });
  }

  function getListingStatus(appId) {
    return $backendState.listingStatusByAppId[appId] ?? 'draft';
  }

  function submitForReview(app) {
    try {
      const ver = backend.getDeveloperVerification(devWalletAddress);
      if (!ver || ver.status !== 'verified') {
        try { backend.requestDeveloperVerification({ walletAddress: devWalletAddress }); } catch {}
        try { backend.reviewDeveloperVerification({ walletAddress: devWalletAddress, status: 'verified' }); } catch {}
      }
      backend.publishAppDraft({ app, listingStatus: 'pending_governance' });
    } catch (err) {
      console.error('Submit error:', err?.message || err);
    }
  }
</script>

<svelte:head>
  <title>Developer Portal — Necter Mining App Store</title>
</svelte:head>

{#if !devWalletAddress}
  <!-- ── Not connected ── -->
  <div class="animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:520px;margin:40px auto 0">
      <div style="width:100%;height:200px;border-radius:12px 12px 0 0;overflow:hidden;position:relative">
        <img src="/brand/hero-honeycomb.png" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center bottom" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top,var(--surface-1) 0%,transparent 60%)" />
      </div>
      <div style="background:var(--surface-1);border:1px solid var(--border-default);border-top:none;border-radius:0 0 12px 12px;padding:24px 32px 32px;text-align:center">
        <img src="/brand/logo.svg" alt="" style="width:40px;height:40px;margin:0 auto 16px" />
        <h2 style="font-size:18px;font-weight:600;color:var(--text-primary);margin:0 0 8px">Developer Portal</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 auto 20px;line-height:20px;max-width:360px">Build mining networks on Necter. Define your workloads, set reward economics, and attract miners from the marketplace.</p>
        <button type="button" onclick={() => { $showConnectModal = true; }} class="btn-primary">Connect Wallet</button>
      </div>
    </div>
  </div>

{:else if !enrollmentActive}
  <!-- ── No enrollment ── -->
  <div class="animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:520px;margin:40px auto 0">
      <div style="width:100%;height:200px;border-radius:12px 12px 0 0;overflow:hidden;position:relative">
        <img src="/brand/hero-honeycomb.png" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center bottom" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top,var(--surface-1) 0%,transparent 60%)" />
      </div>
      <div style="background:var(--surface-1);border:1px solid var(--border-default);border-top:none;border-radius:0 0 12px 12px;padding:24px 32px 32px;text-align:center">
        <h2 style="font-size:18px;font-weight:600;color:var(--text-primary);margin:0 0 8px">Set Up Your Developer Account</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 auto 20px;line-height:20px;max-width:360px">Complete your profile to start building and publishing mining networks on Necter.</p>
        <button type="button" onclick={() => { setupModalOpen = true; }} class="btn-primary">Get Started</button>
      </div>
    </div>
  </div>

{:else}
  <!-- ── Full developer dashboard ── -->
  <div class="animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width:1152px;margin:0 auto;display:flex;flex-direction:column;gap:32px">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
        <div>
          <h1 style="font-size:20px;font-weight:600;color:var(--text-primary);letter-spacing:-0.015em;margin:0">Developer Portal</h1>
          <p style="font-size:12px;color:var(--text-tertiary);margin-top:2px">Build and manage mining networks on Necter</p>
        </div>
        <div style="display:flex;gap:8px">
          <a href="/develop/profile" class="btn-secondary" style="gap:4px">Edit Profile</a>
          <a href="/develop/create" class="btn-subscribe" style="gap:4px">
            <Plus style="width:12px;height:12px" strokeWidth={2} />
            Create Network
          </a>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:8px;overflow:hidden">
        {#each [
          { label: 'Networks', value: developerApps.length.toString() },
          { label: 'Total Miners', value: totalMiners.toLocaleString() },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, accent: true },
          { label: 'Fleet Size', value: operatorMiners.length.toString() },
        ] as s}
          <div style="background:var(--surface-1);padding:14px 16px">
            <span style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em">{s.label}</span>
            <span style="display:block;font-size:22px;font-weight:600;font-family:var(--font-mono);color:{s.accent ? 'var(--text-accent)' : 'var(--text-primary)'};margin-top:4px;font-feature-settings:'tnum' 1">{s.value}</span>
          </div>
        {/each}
      </div>

      <!-- Your Networks -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Your Networks</span>
        </div>

        {#if developerApps.length > 0}
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            {#each developerApps as app (app.id)}
              {@const iconSrc = getIconSrc(app)}
              {@const listingStatus = getListingStatus(app.id)}
              {@const statusLabel = listingStatus === 'listed' ? 'Live' : listingStatus === 'pending_governance' ? 'Review' : 'Draft'}
              {@const statusBg = listingStatus === 'listed' ? 'rgba(76,183,130,0.12)' : listingStatus === 'pending_governance' ? 'rgba(242,153,74,0.12)' : 'var(--surface-3)'}
              {@const statusColor = listingStatus === 'listed' ? 'var(--success)' : listingStatus === 'pending_governance' ? 'var(--warning)' : 'var(--text-secondary)'}
              <div
                style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:8px;transition:border-color 100ms;overflow:hidden"
                onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
              >
                <div style="display:flex;align-items:center;gap:12px;padding:14px 16px">
                  <a href="/develop/apps/{app.id}" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;text-decoration:none">
                    <img src={iconSrc} alt={app.name} width="40" height="40" style="border-radius:10px;flex-shrink:0" />
                    <div style="flex:1;min-width:0">
                      <div style="display:flex;align-items:center;gap:6px">
                        <span style="font-size:13px;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{app.name}</span>
                        <span style="font-size:10px;font-weight:500;padding:1px 6px;border-radius:3px;flex-shrink:0;background:{statusBg};color:{statusColor}">
                          {statusLabel}
                        </span>
                      </div>
                      <span style="font-size:11px;color:var(--text-tertiary)">{app.category}</span>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <span style="display:block;font-size:12px;font-family:var(--font-mono);color:var(--text-primary);font-feature-settings:'tnum' 1">{app.totalMiners.toLocaleString()} miners</span>
                      <span style="display:block;font-size:11px;font-family:var(--font-mono);color:var(--text-tertiary);font-feature-settings:'tnum' 1">${app.avgEarningsPerDay.toFixed(0)}/d avg</span>
                    </div>
                  </a>

                  {#if listingStatus === 'draft' && devWalletAddress}
                    <button
                      type="button"
                      class="btn-subscribe"
                      style="flex-shrink:0"
                      onclick={(e) => { e.stopPropagation(); submitForReview(app); }}
                    >
                      <Send style="width:12px;height:12px" strokeWidth={1.5} />
                      Submit for Review
                    </button>
                  {/if}
                  {#if listingStatus === 'listed'}
                    <a
                      href="/develop/apps/{app.id}"
                      class="btn-secondary"
                      style="flex-shrink:0;font-size:12px;height:28px;padding:0 12px;text-decoration:none"
                    >
                      Manage
                    </a>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="bg-honeycomb" style="border:1px dashed var(--border-default);border-radius:8px;padding:48px 24px;text-align:center">
            <p style="font-size:14px;font-weight:500;color:var(--text-secondary);margin-bottom:4px">No networks yet</p>
            <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">Create your first network or start from a template below.</p>
            <a href="/develop/create" class="btn-subscribe" style="gap:4px">
              <Plus style="width:12px;height:12px" strokeWidth={2} />
              Create Network
            </a>
          </div>
        {/if}
      </div>

      <!-- Templates -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Templates</span>
            <p style="font-size:12px;color:var(--text-tertiary);margin-top:2px">Pre-configured networks. Pick one to auto-fill the creation wizard</p>
          </div>
          <a href="/develop/templates" style="font-size:12px;color:var(--text-accent);text-decoration:none">View all &rarr;</a>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          {#each templates as t (t.name)}
            <a
              href="/develop/create?template={encodeURIComponent(t.name)}"
              style="display:flex;flex-direction:column;border-radius:8px;border:1px solid var(--border-default);overflow:hidden;text-decoration:none;transition:all 100ms"
              onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style="background:{t.gradient};padding:20px 16px 16px;display:flex;align-items:center;gap:10px">
                <t.icon style="width:24px;height:24px;color:{t.color};opacity:0.8" strokeWidth={1.5} />
                <span style="font-size:14px;font-weight:600;color:#fff">{t.name}</span>
              </div>
              <div style="padding:12px 16px 14px;background:var(--surface-1);flex:1;display:flex;flex-direction:column">
                <p style="font-size:11px;color:var(--text-secondary);line-height:16px;margin:0 0 10px">{t.desc}</p>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">
                  <span style="font-size:10px;color:var(--text-tertiary)">{t.consensus} &middot; {t.reward}</span>
                  <span style="font-size:11px;font-weight:500;color:var(--text-accent)">Use &rarr;</span>
                </div>
              </div>
            </a>
          {/each}
        </div>
      </div>

    </div>
  </div>
{/if}

<DevSetupModal bind:open={setupModalOpen} />
