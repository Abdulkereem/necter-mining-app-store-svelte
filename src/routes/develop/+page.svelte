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
    <div class="max-w-[520px] mt-10 mx-auto">
      <div class="w-full h-[200px] rounded-t-[12px] overflow-hidden relative">
        <img src="/brand/hero-honeycomb.png" alt="" class="w-full h-full object-cover object-bottom" />
        <div class="absolute inset-0" style="background:linear-gradient(to top,var(--surface-1) 0%,transparent 60%)" />
      </div>
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] border-t-0 rounded-b-[12px] px-8 pt-6 pb-8 text-center">
        <img src="/brand/logo.svg" alt="" class="w-10 h-10 mx-auto mb-4" />
        <h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-2">Developer Portal</h2>
        <p class="text-[13px] text-[var(--text-secondary)] mx-auto mb-5 leading-5 max-w-[360px]">Build mining networks on Necter. Define your workloads, set reward economics, and attract miners from the marketplace.</p>
        <button type="button" onclick={() => { $showConnectModal = true; }} class="btn-primary">Connect Wallet</button>
      </div>
    </div>
  </div>

{:else if !enrollmentActive}
  <!-- ── No enrollment ── -->
  <div class="animate-fadeIn px-6 pt-6 pb-12">
    <div class="max-w-[520px] mt-10 mx-auto">
      <div class="w-full h-[200px] rounded-t-[12px] overflow-hidden relative">
        <img src="/brand/hero-honeycomb.png" alt="" class="w-full h-full object-cover object-bottom" />
        <div class="absolute inset-0" style="background:linear-gradient(to top,var(--surface-1) 0%,transparent 60%)" />
      </div>
      <div class="bg-[var(--surface-1)] border border-[var(--border-default)] border-t-0 rounded-b-[12px] px-8 pt-6 pb-8 text-center">
        <h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-2">Set Up Your Developer Account</h2>
        <p class="text-[13px] text-[var(--text-secondary)] mx-auto mb-5 leading-5 max-w-[360px]">Complete your profile to start building and publishing mining networks on Necter.</p>
        <button type="button" onclick={() => { setupModalOpen = true; }} class="btn-primary">Get Started</button>
      </div>
    </div>
  </div>

{:else}
  <!-- ── Full developer dashboard ── -->
  <div class="animate-fadeIn px-6 pt-6 pb-12">
    <div class="max-w-[1152px] mx-auto flex flex-col gap-8">

      <!-- Header -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-[-0.015em]">Developer Portal</h1>
          <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">Build and manage mining networks on Necter</p>
        </div>
        <div class="flex gap-2">
          <a href="/develop/profile" class="btn-secondary gap-1">Edit Profile</a>
          <a href="/develop/create" class="btn-subscribe gap-1">
            <Plus class="w-3 h-3" strokeWidth={2} />
            Create Network
          </a>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
        {#each [
          { label: 'Networks', value: developerApps.length.toString() },
          { label: 'Total Miners', value: totalMiners.toLocaleString() },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, accent: true },
          { label: 'Fleet Size', value: operatorMiners.length.toString() },
        ] as s}
          <div class="bg-[var(--surface-1)] px-4 py-3.5">
            <span class="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">{s.label}</span>
            <span class="block text-[22px] font-semibold font-mono mt-1 tabular-nums" style="color:{s.accent ? 'var(--text-accent)' : 'var(--text-primary)'}">{s.value}</span>
          </div>
        {/each}
      </div>

      <!-- Your Networks -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <span class="text-[14px] font-semibold text-[var(--text-primary)]">Your Networks</span>
        </div>

        {#if developerApps.length > 0}
          <div class="grid grid-cols-3 gap-2.5">
            {#each developerApps as app (app.id)}
              {@const iconSrc = getIconSrc(app)}
              {@const listingStatus = getListingStatus(app.id)}
              {@const statusLabel = listingStatus === 'listed' ? 'Live' : listingStatus === 'pending_governance' ? 'Review' : 'Draft'}
              {@const statusBg = listingStatus === 'listed' ? 'rgba(76,183,130,0.12)' : listingStatus === 'pending_governance' ? 'rgba(242,153,74,0.12)' : 'var(--surface-3)'}
              {@const statusColor = listingStatus === 'listed' ? 'var(--success)' : listingStatus === 'pending_governance' ? 'var(--warning)' : 'var(--text-secondary)'}
              <div
                class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] transition-colors overflow-hidden hover:border-[var(--border-hover)]"
              >
                <div class="flex items-center gap-3 px-4 py-3.5">
                  <a href="/develop/apps/{app.id}" class="flex items-center gap-3 flex-1 min-w-0 no-underline">
                    <img src={iconSrc} alt={app.name} width="40" height="40" class="rounded-[10px] shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[13px] font-medium text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">{app.name}</span>
                        <span class="text-[10px] font-medium px-1.5 py-px rounded-[3px] shrink-0" style="background:{statusBg};color:{statusColor}">
                          {statusLabel}
                        </span>
                      </div>
                      <span class="text-[11px] text-[var(--text-tertiary)]">{app.category}</span>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="block text-[12px] font-mono text-[var(--text-primary)] tabular-nums">{app.totalMiners.toLocaleString()} miners</span>
                      <span class="block text-[11px] font-mono text-[var(--text-tertiary)] tabular-nums">${app.avgEarningsPerDay.toFixed(0)}/d avg</span>
                    </div>
                  </a>

                  {#if listingStatus === 'draft' && devWalletAddress}
                    <button
                      type="button"
                      class="btn-subscribe shrink-0"
                      onclick={(e) => { e.stopPropagation(); submitForReview(app); }}
                    >
                      <Send class="w-3 h-3" strokeWidth={1.5} />
                      Submit for Review
                    </button>
                  {/if}
                  {#if listingStatus === 'listed'}
                    <a
                      href="/develop/apps/{app.id}"
                      class="btn-secondary shrink-0 text-[12px] h-7 px-3 no-underline"
                    >
                      Manage
                    </a>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="bg-honeycomb border border-dashed border-[var(--border-default)] rounded-[8px] px-6 py-12 text-center">
            <p class="text-[14px] font-medium text-[var(--text-secondary)] mb-1">No networks yet</p>
            <p class="text-[12px] text-[var(--text-tertiary)] mb-4">Create your first network or start from a template below.</p>
            <a href="/develop/create" class="btn-subscribe gap-1">
              <Plus class="w-3 h-3" strokeWidth={2} />
              Create Network
            </a>
          </div>
        {/if}
      </div>

      <!-- Templates -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <div>
            <span class="text-[14px] font-semibold text-[var(--text-primary)]">Templates</span>
            <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">Pre-configured networks. Pick one to auto-fill the creation wizard</p>
          </div>
          <a href="/develop/templates" class="text-[12px] text-[var(--text-accent)] no-underline">View all &rarr;</a>
        </div>
        <div class="grid grid-cols-3 gap-2.5">
          {#each templates as t (t.name)}
            <a
              href="/develop/create?template={encodeURIComponent(t.name)}"
              class="flex flex-col rounded-[8px] border border-[var(--border-default)] overflow-hidden no-underline transition-all hover:border-[var(--border-hover)] hover:-translate-y-px"
            >
              <div class="flex items-center gap-2.5 px-4 pt-5 pb-4" style="background:{t.gradient}">
                <t.icon style="width:24px;height:24px;color:{t.color};opacity:0.8" strokeWidth={1.5} />
                <span class="text-[14px] font-semibold text-white">{t.name}</span>
              </div>
              <div class="px-4 pt-3 pb-3.5 bg-[var(--surface-1)] flex-1 flex flex-col">
                <p class="text-[11px] text-[var(--text-secondary)] leading-4 mb-2.5">{t.desc}</p>
                <div class="flex items-center justify-between mt-auto">
                  <span class="text-[10px] text-[var(--text-tertiary)]">{t.consensus} &middot; {t.reward}</span>
                  <span class="text-[11px] font-medium text-[var(--text-accent)]">Use &rarr;</span>
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
