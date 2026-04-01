<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { appIconDataUri } from '$lib/app-icon';
  import {
    ArrowLeft, ArrowRight, Cpu, Database, Network, Shield, Server, Wifi, Globe, Upload, X, Image as ImageIcon, Settings,
  } from 'lucide-svelte';

  // ── Types ──
  /** @typedef {'compute-inference'|'compute-training'|'data-storage'|'data-retrieval'|'network-relay'|'network-coverage'|'data-validation'|'content-delivery'|'custom'} TaskDomain */
  /** @typedef {'PoW'|'PoS'|'PoST'|'PoC'|'PoA'|'DPoS'} ConsensusMechanism */
  /** @typedef {'per-task'|'time-based'|'performance-based'|'stake-weighted'|'hybrid'} RewardModel */

  const taskDomains = [
    { type: 'compute-inference', label: 'AI Inference', desc: 'Serve model predictions', icon: Cpu },
    { type: 'compute-training', label: 'AI Training', desc: 'Distributed model training', icon: Server },
    { type: 'data-storage', label: 'Storage', desc: 'Decentralized file storage', icon: Database },
    { type: 'data-retrieval', label: 'Data Retrieval', desc: 'Indexed data access', icon: Database },
    { type: 'network-relay', label: 'Network Relay', desc: 'P2P message routing', icon: Network },
    { type: 'network-coverage', label: 'Coverage', desc: 'Wireless network coverage', icon: Wifi },
    { type: 'data-validation', label: 'Validation', desc: 'Data integrity proofs', icon: Shield },
    { type: 'content-delivery', label: 'CDN', desc: 'Edge content delivery', icon: Globe },
    { type: 'custom', label: 'Custom', desc: 'Define your own', icon: Settings },
  ];

  const consensusOptions = [
    { type: 'PoW', label: 'Proof of Work', desc: 'Miners solve computational puzzles' },
    { type: 'PoS', label: 'Proof of Stake', desc: 'Validators stake tokens' },
    { type: 'PoST', label: 'Proof of Space-Time', desc: 'Prove storage over time' },
    { type: 'PoC', label: 'Proof of Coverage', desc: 'Verify geographic coverage' },
    { type: 'PoA', label: 'Proof of Authority', desc: 'Trusted validator set' },
    { type: 'DPoS', label: 'Delegated PoS', desc: 'Token holders vote for validators' },
  ];

  const rewardModels = [
    { type: 'per-task', label: 'Per Task' },
    { type: 'time-based', label: 'Time Based' },
    { type: 'performance-based', label: 'Performance' },
    { type: 'stake-weighted', label: 'Stake Weighted' },
    { type: 'hybrid', label: 'Hybrid' },
  ];

  const categoryMap = {
    'compute-inference': 'AI/ML', 'compute-training': 'AI/ML', 'data-storage': 'Storage',
    'data-retrieval': 'Storage', 'network-relay': 'Bandwidth', 'network-coverage': 'DePIN',
    'data-validation': 'Data Sovereignty', 'content-delivery': 'Bandwidth', 'custom': 'Compute',
  };

  const stepLabels = ['Details & Domain', 'Economics & Hardware', 'Branding'];

  // ── State ──
  let step = $state(1);
  let name = $state('');
  let description = $state('');
  let taskDomain = $state('compute-inference');
  let consensus = $state('PoW');
  let gpuRequired = $state(false);
  let minRam = $state('8');
  let rewardModel = $state('per-task');
  let rewardAmount = $state('100');
  let dailyEmission = $state('1000');
  let collateral = $state('5000');
  let iconPreview = $state(null);
  let screenshotPreviews = $state([]);
  let featuresStr = $state('');
  let tagsStr = $state('');
  let creating = $state(false);

  // Apply template from URL params
  $effect(() => {
    const tpl = page.url.searchParams.get('template');
    if (!tpl) return;
    const map = {
      'AI Inference': { domain: 'compute-inference', consensus: 'PoW', reward: 'per-task' },
      'Storage Provider': { domain: 'data-storage', consensus: 'PoST', reward: 'time-based' },
      'IoT Sensor Grid': { domain: 'network-coverage', consensus: 'PoC', reward: 'time-based' },
      'CDN Relay': { domain: 'content-delivery', consensus: 'PoA', reward: 'performance-based' },
      'Data Validation': { domain: 'data-validation', consensus: 'PoW', reward: 'per-task' },
      'GPU Compute': { domain: 'compute-inference', consensus: 'PoW', reward: 'hybrid' },
    };
    const m = map[tpl];
    if (m) { taskDomain = m.domain; consensus = m.consensus; rewardModel = m.reward; }
  });

  const category = $derived(categoryMap[taskDomain] || 'Compute');
  const canNext = $derived(step === 1 ? name.trim().length > 0 && description.trim().length > 0 : true);

  // ── File reading ──
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function handleIconUpload(e) {
    const f = e.target.files?.[0];
    if (f) iconPreview = await readFileAsDataUrl(f);
  }

  async function handleScreenshotUpload(e) {
    const files = Array.from(e.target.files || []).slice(0, 5 - screenshotPreviews.length);
    const urls = await Promise.all(files.map(readFileAsDataUrl));
    screenshotPreviews = [...screenshotPreviews, ...urls].slice(0, 5);
  }

  function removeScreenshot(idx) {
    screenshotPreviews = screenshotPreviews.filter((_, j) => j !== idx);
  }

  // ── Create ──
  function handleCreate() {
    creating = true;
    try {
      const appId = `app_${Date.now()}`;
      const walletAddress = $actor?.walletAddress || '0x0000';
      const appDraft = {
        id: appId, name: name.trim(), description: description.trim(), category,
        developer: $actor?.walletAddress ? `Dev ${$actor.walletAddress.slice(2, 8)}` : 'Developer',
        developerAddress: walletAddress,
        icon: iconPreview || appIconDataUri({ id: appId, name: name.trim(), category }),
        status: 'active', reputationScore: 85, totalMiners: 0, totalEarnings: 0,
        avgEarningsPerDay: Number(rewardAmount) || 100,
        requirements: { cpu: '2 cores', ram: `${minRam}GB`, gpu: gpuRequired ? 'Required' : undefined },
        tags: tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [category],
        features: featuresStr ? featuresStr.split('\n').map((f) => f.trim()).filter(Boolean) : [],
        resourceTypes: [taskDomain.split('-')[0]], createdAt: new Date().toISOString(),
        rewardModel, rewardToken: 'NCR', trending: false, screenshots: screenshotPreviews,
        slaRequirements: { minUptime: 95 },
        consensusMechanism: consensus,
      };
      try { backend.grantRole(walletAddress, 'developer'); } catch {}
      backend.publishAppDraft({
        app: appDraft,
        miningProfile: { id: `mp_${appId}`, appId, taskDomain, consensusMechanism: consensus, rewardModel, rewardAmount: Number(rewardAmount), dailyEmission: Number(dailyEmission), collateralRequired: Number(collateral) },
        listingStatus: 'draft',
      });
      goto(`/develop/apps/${appId}`);
    } catch (e) {
      console.error('Create failed:', e?.message || e);
    } finally { creating = false; }
  }

  // ── Summary rows ──
  const summaryRows = $derived([
    { label: 'Name', value: name || '\u2014' },
    { label: 'Category', value: category },
    { label: 'Domain', value: taskDomains.find((d) => d.type === taskDomain)?.label || taskDomain },
    { label: 'Consensus', value: consensusOptions.find((c) => c.type === consensus)?.label || consensus },
    { label: 'Reward Model', value: rewardModels.find((r) => r.type === rewardModel)?.label || rewardModel },
    { label: 'Reward / Task', value: `$${rewardAmount}` },
    { label: 'GPU', value: gpuRequired ? 'Required' : 'Not required' },
    { label: 'Collateral', value: `${Number(collateral).toLocaleString()} NCR` },
  ]);

  const inp = 'n-input';
  const inpTextarea = 'n-textarea';
</script>

<div class="min-h-screen animate-fadeIn">
  <div class="max-w-[680px] mx-auto p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)]">Create Network</h1>
        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">Step {step} of 3 &middot; {stepLabels[step - 1]}</p>
      </div>
      <a href="/develop" class="back-link m-0"><ArrowLeft size={14} strokeWidth={1.5} /> Back</a>
    </div>

    <!-- Step bar -->
    <div class="flex gap-1 mb-6">
      {#each stepLabels as label, i}
        <button
          type="button"
          onclick={() => { if (i + 1 <= step) step = i + 1; }}
          class="flex-1 h-[34px] rounded-[6px] border-none text-[12px] font-medium"
          style="cursor:{i + 1 <= step ? 'pointer' : 'default'};background:{step === i + 1 ? 'var(--accent-subtle)' : i + 1 < step ? 'rgba(76,183,130,0.08)' : 'var(--surface-1)'};color:{step === i + 1 ? 'var(--text-accent)' : i + 1 < step ? 'var(--success)' : 'var(--text-tertiary)'}"
        >
          {i + 1}. {label}
        </button>
      {/each}
    </div>

    <!-- STEP 1: Details & Domain -->
    {#if step === 1}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-3.5">Network Details</h3>
          <div class="flex flex-col gap-3">
            <div>
              <label class="field-label">Network Name <span class="text-[var(--error)]">*</span></label>
              <input type="text" bind:value={name} placeholder="e.g. Helium Network" class={inp} />
            </div>
            <div>
              <label class="field-label">Description <span class="text-[var(--error)]">*</span></label>
              <textarea bind:value={description} placeholder="What does your network do? What problem does it solve for miners?" rows="3" class={inpTextarea}></textarea>
            </div>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Task Domain</h3>
          <p class="field-hint mb-3">What kind of work will miners do on your network?</p>
          <div class="grid grid-cols-3 gap-2">
            {#each taskDomains as td}
              {@const sel = taskDomain === td.type}
              <button
                type="button"
                onclick={() => { taskDomain = td.type; }}
                class="flex flex-col gap-1 p-3 rounded-[8px] cursor-pointer text-left"
                style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
              >
                <td.icon class="w-[18px] h-[18px] mb-0.5" style="color:{sel ? 'var(--text-accent)' : 'var(--text-tertiary)'}" strokeWidth={1.5} />
                <span class="text-[13px] font-semibold" style="color:{sel ? 'var(--text-accent)' : 'var(--text-primary)'}">{td.label}</span>
                <span class="text-[11px] text-[var(--text-tertiary)] leading-[14px]">{td.desc}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Consensus Mechanism</h3>
          <p class="field-hint mb-3">How will miners prove their work?</p>
          <div class="grid grid-cols-3 gap-1.5">
            {#each consensusOptions as c}
              {@const sel = consensus === c.type}
              <button
                type="button"
                onclick={() => { consensus = c.type; }}
                class="p-2.5 rounded-[6px] text-left cursor-pointer"
                style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
              >
                <span class="block text-[12px] font-semibold" style="color:{sel ? 'var(--text-accent)' : 'var(--text-primary)'}">{c.label}</span>
                <span class="block text-[10px] text-[var(--text-tertiary)] mt-0.5">{c.desc}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- STEP 2: Economics & Hardware -->
    {#if step === 2}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-1">Reward Model</h3>
          <p class="field-hint mb-3">How miners get paid for their work.</p>
          <div class="flex gap-1.5 flex-wrap mb-4">
            {#each rewardModels as r}
              {@const sel = rewardModel === r.type}
              <button
                type="button"
                onclick={() => { rewardModel = r.type; }}
                class="px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer"
                style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'};color:{sel ? 'var(--text-accent)' : 'var(--text-secondary)'}"
              >
                {r.label}
              </button>
            {/each}
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="field-label">Reward / Task ($)</label>
              <input type="number" bind:value={rewardAmount} class={inp} />
            </div>
            <div>
              <label class="field-label">Daily Emission</label>
              <input type="number" bind:value={dailyEmission} class={inp} />
            </div>
            <div>
              <label class="field-label">Collateral (NCR)</label>
              <input type="number" bind:value={collateral} class={inp} />
            </div>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Hardware Requirements</h3>
          <p class="field-hint mb-3">Minimum specs miners need to participate.</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="field-label">Min RAM (GB)</label>
              <input type="number" bind:value={minRam} class={inp} />
            </div>
            <div>
              <label class="field-label">GPU Required</label>
              <button
                type="button"
                onclick={() => { gpuRequired = !gpuRequired; }}
                class="n-input flex items-center justify-center cursor-pointer font-medium"
                style="border:{gpuRequired ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{gpuRequired ? 'var(--accent-subtle)' : 'var(--surface-0)'};color:{gpuRequired ? 'var(--text-accent)' : 'var(--text-secondary)'}"
              >
                {gpuRequired ? 'Yes, GPU Required' : 'No, CPU Only'}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- STEP 3: Branding -->
    {#if step === 3}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-3.5">Branding & Media</h3>
          <div class="flex flex-col gap-4">
            <!-- Icon -->
            <div>
              <label class="field-label">App Icon</label>
              <div class="flex items-center gap-3">
                <div class="w-16 h-16 rounded-[14px] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden shrink-0" style="border:{iconPreview ? 'none' : '2px dashed var(--border-default)'}">
                  {#if iconPreview}
                    <img src={iconPreview} alt="Icon" width="64" height="64" class="rounded-[14px] object-cover" />
                  {:else}
                    <ImageIcon size={24} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
                  {/if}
                </div>
                <div>
                  <label class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                    <Upload size={12} strokeWidth={1.5} /> Upload Icon
                    <input type="file" accept="image/*" onchange={handleIconUpload} class="hidden" />
                  </label>
                  <p class="field-hint">512x512 recommended. Auto-generated if empty.</p>
                </div>
              </div>
            </div>

            <!-- Screenshots -->
            <div>
              <label class="field-label">Screenshots ({screenshotPreviews.length}/5)</label>
              <div class="grid grid-cols-5 gap-2">
                {#each screenshotPreviews as src, i}
                  <div class="relative aspect-[16/10] rounded-[6px] overflow-hidden border border-[var(--border-default)]">
                    <img {src} alt="Screenshot {i + 1}" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      onclick={() => removeScreenshot(i)}
                      class="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 border-none cursor-pointer flex items-center justify-center"
                    >
                      <X size={12} strokeWidth={2} class="text-white" />
                    </button>
                  </div>
                {/each}
                {#if screenshotPreviews.length < 5}
                  <label class="aspect-[16/10] rounded-[6px] border border-dashed border-[var(--border-default)] bg-[var(--surface-2)] flex flex-col items-center justify-center cursor-pointer gap-1">
                    <Upload size={16} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
                    <span class="text-[10px] text-[var(--text-tertiary)]">Add</span>
                    <input type="file" accept="image/*" multiple onchange={handleScreenshotUpload} class="hidden" />
                  </label>
                {/if}
              </div>
            </div>

            <!-- Features -->
            <div>
              <label class="field-label">Features</label>
              <textarea bind:value={featuresStr} rows="3" placeholder={"Real-time coverage mapping\nAutomatic proof of coverage\nRewards tracking dashboard"} class={inpTextarea}></textarea>
              <p class="field-hint">One per line. Shown on the app detail page.</p>
            </div>

            <!-- Tags -->
            <div>
              <label class="field-label">Tags</label>
              <input type="text" bind:value={tagsStr} placeholder="IoT, DePIN, Wireless, 5G" class={inp} />
              <p class="field-hint">Comma-separated. Used for search and discovery.</p>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="n-card">
          <h3 class="section-title mb-3">Summary</h3>
          <div class="grid grid-cols-2">
            {#each summaryRows as row}
              <div class="flex justify-between py-[7px] border-b border-[var(--border-default)]">
                <span class="text-[12px] text-[var(--text-tertiary)]">{row.label}</span>
                <span class="text-[12px] font-medium text-[var(--text-primary)]">{row.value}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Navigation -->
    <div class="flex justify-between mt-6">
      {#if step > 1}
        <button type="button" onclick={() => { step = step - 1; }} class="btn-secondary gap-1">
          <ArrowLeft size={12} strokeWidth={1.5} /> Back
        </button>
      {:else}
        <div></div>
      {/if}

      {#if step < 3}
        <button
          type="button"
          disabled={!canNext}
          onclick={() => { step = step + 1; }}
          class="h-9 px-5 rounded-[6px] text-[13px] font-semibold bg-[var(--accent-base)] text-[#0C0C0E] border-none cursor-pointer flex items-center gap-1.5"
          style="opacity:{canNext ? 1 : 0.4}"
        >
          Next <ArrowRight size={14} strokeWidth={2} />
        </button>
      {:else}
        <button
          type="button"
          disabled={creating || !name.trim()}
          onclick={handleCreate}
          class="h-9 px-5 rounded-[6px] text-[13px] font-semibold bg-[var(--accent-base)] text-[#0C0C0E] border-none cursor-pointer flex items-center gap-1.5"
          style="opacity:{creating || !name.trim() ? 0.4 : 1}"
        >
          {creating ? 'Creating...' : 'Create Network'}
        </button>
      {/if}
    </div>
  </div>
</div>
