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

  const inp = 'width:100%;height:36px;padding:0 12px;border-radius:6px;border:1px solid var(--border-default);background:var(--surface-0);color:var(--text-primary);font-size:13px;font-family:inherit;outline:none';
  const inpTextarea = inp.replace('height:36px;padding:0 12px', 'height:auto;padding:10px 12px') + ';line-height:1.5;resize:vertical';
</script>

<div class="min-h-screen animate-fadeIn">
  <div style="max-width:680px;margin:0 auto;padding:24px">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div>
        <h1 style="font-size:20px;font-weight:600;color:var(--text-primary);margin:0">Create Network</h1>
        <p style="font-size:12px;color:var(--text-tertiary);margin-top:2px">Step {step} of 3 &middot; {stepLabels[step - 1]}</p>
      </div>
      <a href="/develop" class="back-link" style="margin:0"><ArrowLeft size={14} strokeWidth={1.5} /> Back</a>
    </div>

    <!-- Step bar -->
    <div style="display:flex;gap:4px;margin-bottom:24px">
      {#each stepLabels as label, i}
        <button
          type="button"
          onclick={() => { if (i + 1 <= step) step = i + 1; }}
          style="flex:1;height:34px;border-radius:6px;border:none;font-size:12px;font-weight:500;cursor:{i + 1 <= step ? 'pointer' : 'default'};background:{step === i + 1 ? 'var(--accent-subtle)' : i + 1 < step ? 'rgba(76,183,130,0.08)' : 'var(--surface-1)'};color:{step === i + 1 ? 'var(--text-accent)' : i + 1 < step ? 'var(--success)' : 'var(--text-tertiary)'}"
        >
          {i + 1}. {label}
        </button>
      {/each}
    </div>

    <!-- STEP 1: Details & Domain -->
    {#if step === 1}
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="n-card">
          <h3 class="section-title" style="margin-bottom:14px">Network Details</h3>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div>
              <label class="field-label">Network Name <span style="color:var(--error)">*</span></label>
              <input type="text" bind:value={name} placeholder="e.g. Helium Network" style={inp} />
            </div>
            <div>
              <label class="field-label">Description <span style="color:var(--error)">*</span></label>
              <textarea bind:value={description} placeholder="What does your network do? What problem does it solve for miners?" rows="3" style={inpTextarea}></textarea>
            </div>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title" style="margin-bottom:4px">Task Domain</h3>
          <p class="field-hint" style="margin-bottom:12px">What kind of work will miners do on your network?</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            {#each taskDomains as td}
              {@const sel = taskDomain === td.type}
              <button
                type="button"
                onclick={() => { taskDomain = td.type; }}
                style="display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:8px;cursor:pointer;text-align:left;border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
              >
                <td.icon style="width:18px;height:18px;color:{sel ? 'var(--text-accent)' : 'var(--text-tertiary)'};margin-bottom:2px" strokeWidth={1.5} />
                <span style="font-size:13px;font-weight:600;color:{sel ? 'var(--text-accent)' : 'var(--text-primary)'}">{td.label}</span>
                <span style="font-size:11px;color:var(--text-tertiary);line-height:14px">{td.desc}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title" style="margin-bottom:4px">Consensus Mechanism</h3>
          <p class="field-hint" style="margin-bottom:12px">How will miners prove their work?</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            {#each consensusOptions as c}
              {@const sel = consensus === c.type}
              <button
                type="button"
                onclick={() => { consensus = c.type; }}
                style="padding:10px;border-radius:6px;text-align:left;cursor:pointer;border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
              >
                <span style="display:block;font-size:12px;font-weight:600;color:{sel ? 'var(--text-accent)' : 'var(--text-primary)'}">{c.label}</span>
                <span style="display:block;font-size:10px;color:var(--text-tertiary);margin-top:2px">{c.desc}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- STEP 2: Economics & Hardware -->
    {#if step === 2}
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="n-card">
          <h3 class="section-title" style="margin-bottom:4px">Reward Model</h3>
          <p class="field-hint" style="margin-bottom:12px">How miners get paid for their work.</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
            {#each rewardModels as r}
              {@const sel = rewardModel === r.type}
              <button
                type="button"
                onclick={() => { rewardModel = r.type; }}
                style="padding:6px 14px;border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'};color:{sel ? 'var(--text-accent)' : 'var(--text-secondary)'}"
              >
                {r.label}
              </button>
            {/each}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div>
              <label class="field-label">Reward / Task ($)</label>
              <input type="number" bind:value={rewardAmount} style={inp} />
            </div>
            <div>
              <label class="field-label">Daily Emission</label>
              <input type="number" bind:value={dailyEmission} style={inp} />
            </div>
            <div>
              <label class="field-label">Collateral (NCR)</label>
              <input type="number" bind:value={collateral} style={inp} />
            </div>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title" style="margin-bottom:4px">Hardware Requirements</h3>
          <p class="field-hint" style="margin-bottom:12px">Minimum specs miners need to participate.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="field-label">Min RAM (GB)</label>
              <input type="number" bind:value={minRam} style={inp} />
            </div>
            <div>
              <label class="field-label">GPU Required</label>
              <button
                type="button"
                onclick={() => { gpuRequired = !gpuRequired; }}
                style="{inp};display:flex;align-items:center;justify-content:center;cursor:pointer;border:{gpuRequired ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{gpuRequired ? 'var(--accent-subtle)' : 'var(--surface-0)'};color:{gpuRequired ? 'var(--text-accent)' : 'var(--text-secondary)'};font-weight:500"
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
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="n-card">
          <h3 class="section-title" style="margin-bottom:14px">Branding & Media</h3>
          <div style="display:flex;flex-direction:column;gap:16px">
            <!-- Icon -->
            <div>
              <label class="field-label">App Icon</label>
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:64px;height:64px;border-radius:14px;border:{iconPreview ? 'none' : '2px dashed var(--border-default)'};background:var(--surface-2);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
                  {#if iconPreview}
                    <img src={iconPreview} alt="Icon" width="64" height="64" style="border-radius:14px;object-fit:cover" />
                  {:else}
                    <ImageIcon size={24} strokeWidth={1.5} style="color:var(--text-tertiary)" />
                  {/if}
                </div>
                <div>
                  <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;background:var(--surface-2);border:1px solid var(--border-default);color:var(--text-secondary)">
                    <Upload size={12} strokeWidth={1.5} /> Upload Icon
                    <input type="file" accept="image/*" onchange={handleIconUpload} style="display:none" />
                  </label>
                  <p class="field-hint">512x512 recommended. Auto-generated if empty.</p>
                </div>
              </div>
            </div>

            <!-- Screenshots -->
            <div>
              <label class="field-label">Screenshots ({screenshotPreviews.length}/5)</label>
              <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
                {#each screenshotPreviews as src, i}
                  <div style="position:relative;aspect-ratio:16/10;border-radius:6px;overflow:hidden;border:1px solid var(--border-default)">
                    <img {src} alt="Screenshot {i + 1}" style="width:100%;height:100%;object-fit:cover" />
                    <button
                      type="button"
                      onclick={() => removeScreenshot(i)}
                      style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:4px;background:rgba(0,0,0,0.7);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center"
                    >
                      <X size={12} strokeWidth={2} style="color:#fff" />
                    </button>
                  </div>
                {/each}
                {#if screenshotPreviews.length < 5}
                  <label style="aspect-ratio:16/10;border-radius:6px;border:1px dashed var(--border-default);background:var(--surface-2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px">
                    <Upload size={16} strokeWidth={1.5} style="color:var(--text-tertiary)" />
                    <span style="font-size:10px;color:var(--text-tertiary)">Add</span>
                    <input type="file" accept="image/*" multiple onchange={handleScreenshotUpload} style="display:none" />
                  </label>
                {/if}
              </div>
            </div>

            <!-- Features -->
            <div>
              <label class="field-label">Features</label>
              <textarea bind:value={featuresStr} rows="3" placeholder={"Real-time coverage mapping\nAutomatic proof of coverage\nRewards tracking dashboard"} style={inpTextarea}></textarea>
              <p class="field-hint">One per line. Shown on the app detail page.</p>
            </div>

            <!-- Tags -->
            <div>
              <label class="field-label">Tags</label>
              <input type="text" bind:value={tagsStr} placeholder="IoT, DePIN, Wireless, 5G" style={inp} />
              <p class="field-hint">Comma-separated. Used for search and discovery.</p>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="n-card">
          <h3 class="section-title" style="margin-bottom:12px">Summary</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
            {#each summaryRows as row}
              <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border-default)">
                <span style="font-size:12px;color:var(--text-tertiary)">{row.label}</span>
                <span style="font-size:12px;font-weight:500;color:var(--text-primary)">{row.value}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Navigation -->
    <div style="display:flex;justify-content:space-between;margin-top:24px">
      {#if step > 1}
        <button type="button" onclick={() => { step = step - 1; }} class="btn-secondary" style="gap:4px">
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
          style="height:36px;padding:0 20px;border-radius:6px;font-size:13px;font-weight:600;background:var(--accent-base);color:#0C0C0E;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;opacity:{canNext ? 1 : 0.4}"
        >
          Next <ArrowRight size={14} strokeWidth={2} />
        </button>
      {:else}
        <button
          type="button"
          disabled={creating || !name.trim()}
          onclick={handleCreate}
          style="height:36px;padding:0 20px;border-radius:6px;font-size:13px;font-weight:600;background:var(--accent-base);color:#0C0C0E;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;opacity:{creating || !name.trim() ? 0.4 : 1}"
        >
          {creating ? 'Creating...' : 'Create Network'}
        </button>
      {/if}
    </div>
  </div>
</div>
