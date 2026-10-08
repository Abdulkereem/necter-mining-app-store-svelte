<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import toast from 'svelte-french-toast';
  import {
    ArrowLeft, ArrowRight, Cpu, Upload, X, Image as ImageIcon, Package, Check, AlertTriangle, Fuel, Cloud, Lock,
  } from 'lucide-svelte';
  import { hub } from '$lib/api/hub';
  import { errorMessage } from '$lib/api/http';
  import { useQuery } from '$lib/api/query.svelte';
  import type { Category, DeviceClass, Engine, Manifest, Module, TxRequest } from '$lib/api/types';
  import { account, signedIn, sendTransaction } from '$lib/stores/wallet';
  import { descriptor, loadDescriptor, loadParams } from '$lib/stores/network';
  import { publishProject, ManifestRejected } from '$lib/flows';
  import {
    validateManifest, paramsFromHub, sortedUnique, EPOCH_SECS_ALLOWED, DEVICE_CLASSES, ENGINES, TESTNET_PARAMS,
    type ManifestParams, type ManifestProblem,
  } from '$lib/protocol/manifest';
  import { canonicalJson } from '$lib/protocol/canonical';
  import { projectId, SLUG_RE } from '$lib/protocol/ids';
  import {
    CATEGORIES, DEVICE_CLASS_LABEL, bpToPercent, formatDuration, formatMb, formatNumber, parseUnits, shortHex,
    rewardModelLabel, categoryName,
  } from '$lib/format';
  import { CHAIN_ID, NETWORK_ID } from '$lib/config';
  import { uploadImage, fileToBase64, IMAGE_ACCEPT } from '$lib/develop/upload';
  import { savePendingTx } from '$lib/develop/pending-tx';
  import SignInGate from '$lib/components/common/SignInGate.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import CopyText from '$lib/components/common/CopyText.svelte';
  import TxRequestCard from '$lib/components/develop/TxRequestCard.svelte';

  // ── Wizard form (strings mirror the inputs; the manifest is derived from them) ──
  interface WizardForm {
    name: string; slug: string; tagline: string; description: string; category: Category;
    worker: string; functions: string[]; functionsText: string;
    taskSource: 'api' | 'schedule'; schedFunction: string; schedInterval: string; schedGas: string;
    maxGas: string; committeeSize: string; backups: string; minSize: string; weightCap: string;
    roundSecs: string; leaseSecs: string; epochSecs: number; disputeSecs: string;
    rewardToken: string; tokenDecimals: string; rewardModel: 'per-unit' | 'epoch-pool';
    rewardPerUnit: string; dailyEmission: string; feeMiner: string; feeDeveloper: string; feeTreasury: string;
    maxUnits: string; maxRecipients: string; minCollateral: string; slashInvalid: string; slashMissed: string;
    deviceClasses: DeviceClass[]; cpu: string; ramMb: string; storageMb: string; minBenchmark: string; engines: Engine[];
    slaLatency: string; slaUptime: string; publicTasks: boolean;
    icon: string; banner: string; screenshots: string[]; video: string; website: string; docs: string; support: string;
    featuresText: string; tagsText: string; accentColor: string;
  }

  /** Starting values (PLATFORM.md §a.1 example manifest); every value is editable. */
  function defaults(): WizardForm {
    return {
      name: '', slug: '', tagline: '', description: '', category: 'compute',
      worker: '', functions: [], functionsText: '',
      taskSource: 'api', schedFunction: '', schedInterval: '60', schedGas: '10000000',
      maxGas: '50000000', committeeSize: '5', backups: '3', minSize: '3', weightCap: '10',
      roundSecs: '60', leaseSecs: '30', epochSecs: 3600, disputeSecs: '86400',
      rewardToken: '', tokenDecimals: '18', rewardModel: 'per-unit',
      rewardPerUnit: '0.001', dailyEmission: '1000', feeMiner: '85', feeDeveloper: '10', feeTreasury: '5',
      maxUnits: '1000000', maxRecipients: '2000', minCollateral: '10', slashInvalid: '10', slashMissed: '1',
      deviceClasses: ['desktop', 'laptop', 'phone', 'server'], cpu: '2', ramMb: '2048', storageMb: '512', minBenchmark: '0',
      engines: [...ENGINES],
      slaLatency: '2000', slaUptime: '95', publicTasks: false,
      icon: '', banner: '', screenshots: [], video: '', website: '', docs: '', support: '',
      featuresText: '', tagsText: '', accentColor: '#FFC933',
    };
  }

  const stepLabels = ['Details', 'Work', 'Economics', 'Requirements', 'Branding', 'Review'];
  const LAST = stepLabels.length;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  let f = $state<WizardForm>(defaults());
  let step = $state(1);
  let attempted = $state<Record<number, boolean>>({});

  // ── Network context ──
  let params = $state<ManifestParams>({ ...TESTNET_PARAMS, network: NETWORK_ID, chain_id: CHAIN_ID });
  const necta = $derived($descriptor?.chain.contracts.necta ?? $descriptor?.chain.token ?? null);
  const isNecta = $derived(!!necta && f.rewardToken.toLowerCase() === necta.toLowerCase());
  const tokenDecimals = $derived(isNecta ? 18 : Number.parseInt(f.tokenDecimals, 10));
  const tokenSymbol = $derived(isNecta ? 'NECTA' : 'tokens');

  onMount(async () => {
    try {
      const [d, p] = await Promise.all([loadDescriptor(), loadParams()]);
      params = paramsFromHub(p.params, d.network, d.chain.id);
      if (!f.rewardToken) f.rewardToken = (d.chain.contracts.necta ?? d.chain.token ?? '').toLowerCase();
    } catch (e) {
      toast.error(`Could not load network parameters: ${errorMessage(e)}`);
    }
  });

  // ── Developer ──
  const devQ = useQuery(() => hub.myDeveloper(), { enabled: () => $signedIn });
  const enrolled = $derived(devQ.data?.enrollment?.status === 'active');
  const developer = $derived(($account ?? '').toLowerCase());

  // ── Modules ──
  const modulesQ = useQuery(() => hub.modules({ developer: $account ?? undefined, limit: 100 }), { enabled: () => $signedIn && !!$account });
  const myModules = $derived(modulesQ.data?.items ?? []);
  let lookedUp = $state<{ address: string; module: Module | null } | null>(null);
  const workerOk = $derived(/^0x[0-9a-f]{64}$/.test(f.worker));
  const selectedModule = $derived(
    myModules.find((m) => m.manifest_address === f.worker) ?? (lookedUp?.address === f.worker ? lookedUp.module : null)
  );
  let uploadingModule = $state(false);

  $effect(() => {
    const w = f.worker;
    if (!/^0x[0-9a-f]{64}$/.test(w) || myModules.some((m) => m.manifest_address === w) || lookedUp?.address === w) return;
    hub.module(w).then(
      (m) => { if (f.worker === w) lookedUp = { address: w, module: m }; },
      () => { if (f.worker === w) lookedUp = { address: w, module: null }; },
    );
  });

  function pickModule(m: Module) {
    f.worker = m.manifest_address;
    f.functions = sortedUnique(m.functions ?? []);
    if (f.taskSource === 'schedule' && !f.functions.includes(f.schedFunction)) f.schedFunction = f.functions[0] ?? '';
  }

  async function handleModuleUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error('.hbc artifacts must be 16 MiB or smaller'); return; }
    uploadingModule = true;
    try {
      const m = await hub.uploadModule(await fileToBase64(file));
      toast.success(`Uploaded ${m.name}`);
      await modulesQ.refresh();
      pickModule(m);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      uploadingModule = false;
    }
  }

  function toggleFn(fn: string) {
    f.functions = f.functions.includes(fn) ? f.functions.filter((x) => x !== fn) : sortedUnique([...f.functions, fn]);
  }
  function toggleClass(c: DeviceClass) {
    f.deviceClasses = f.deviceClasses.includes(c) ? f.deviceClasses.filter((x) => x !== c) : sortedUnique([...f.deviceClasses, c]);
  }
  function toggleEngine(e: Engine) {
    f.engines = f.engines.includes(e) ? f.engines.filter((x) => x !== e) : sortedUnique([...f.engines, e]);
  }

  // ── Derived ids ──
  const slugOk = $derived(SLUG_RE.test(f.slug));
  const pid = $derived(slugOk && /^0x[0-9a-f]{40}$/.test(developer) ? projectId(developer, f.slug) : null);

  /** Vault learned from `prepare` (the descriptor has the factory but not the implementation address). */
  let vaultCache = $state<{ pid: string; vault: string } | null>(null);
  const vault = $derived(vaultCache && vaultCache.pid === pid ? vaultCache.vault : null);

  // ── Manifest build ──
  const functionsList = $derived(
    selectedModule ? sortedUnique(f.functions) : sortedUnique(f.functionsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))
  );

  function built(): { manifest: Manifest; conversion: ManifestProblem[] } {
    const conv: ManifestProblem[] = [];
    const int = (s: string, path: string) => {
      const t = s.trim();
      if (!/^\d+$/.test(t)) { conv.push({ path, code: 'invalid_value', message: 'whole number' }); return 0; }
      return Number.parseInt(t, 10);
    };
    const bp = (s: string, path: string) => {
      const t = s.trim();
      if (!/^\d+(\.\d{1,2})?$/.test(t)) { conv.push({ path, code: 'invalid_value', message: 'percentage with at most 2 decimals' }); return 0; }
      return Math.round(Number.parseFloat(t) * 100);
    };
    const amount = (s: string, decimals: number, path: string) => {
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) { conv.push({ path, code: 'invalid_value', message: 'set the token decimals first' }); return '0'; }
      try { return parseUnits(s, decimals); } catch (e) { conv.push({ path, code: 'invalid_value', message: e instanceof Error ? e.message : 'invalid amount' }); return '0'; }
    };
    const url = (s: string) => (s.trim() ? s.trim() : null);
    const tags = sortedUnique(f.tagsText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean));
    const features = f.featuresText.split('\n').map((x) => x.trim()).filter(Boolean);
    const perUnit = f.rewardModel === 'epoch-pool' ? '0' : amount(f.rewardPerUnit, tokenDecimals, 'consensus.economics.reward_per_unit');

    const manifest: Manifest = {
      v: 1,
      network: params.network,
      chain_id: params.chain_id,
      developer,
      slug: f.slug,
      version: 1,
      previous: null,
      consensus: {
        modules: { worker: f.worker, verifier: null },
        work: {
          class: 'deterministic',
          verification: 'redundant-execution',
          execution: 'committee',
          functions: functionsList,
          task_source: f.taskSource === 'api'
            ? { kind: 'api' }
            : {
                kind: 'schedule',
                function: f.schedFunction,
                interval_secs: int(f.schedInterval, 'consensus.work.task_source.interval_secs'),
                gas_limit: int(f.schedGas, 'consensus.work.task_source.gas_limit'),
              },
          max_gas_limit: int(f.maxGas, 'consensus.work.max_gas_limit'),
          committee: {
            size: int(f.committeeSize, 'consensus.work.committee.size'),
            backups: int(f.backups, 'consensus.work.committee.backups'),
            min_size: int(f.minSize, 'consensus.work.committee.min_size'),
            selection: 'collateral-reputation-sortition-v1',
            weight_cap_multiple: int(f.weightCap, 'consensus.work.committee.weight_cap_multiple'),
          },
          round_secs: int(f.roundSecs, 'consensus.work.round_secs'),
          lease_secs: int(f.leaseSecs, 'consensus.work.lease_secs'),
          epoch_secs: f.epochSecs as Manifest['consensus']['work']['epoch_secs'],
          dispute_window_secs: int(f.disputeSecs, 'consensus.work.dispute_window_secs'),
        },
        economics: {
          reward_token: f.rewardToken.trim().toLowerCase(),
          vault: vault ?? ZERO_ADDRESS,
          reward_model: f.rewardModel,
          reward_per_unit: perUnit,
          daily_emission: amount(f.dailyEmission, tokenDecimals, 'consensus.economics.daily_emission'),
          fee_split_bp: {
            miner: bp(f.feeMiner, 'consensus.economics.fee_split_bp'),
            developer: bp(f.feeDeveloper, 'consensus.economics.fee_split_bp'),
            treasury: bp(f.feeTreasury, 'consensus.economics.fee_split_bp'),
          },
          max_units_per_epoch: int(f.maxUnits, 'consensus.economics.max_units_per_epoch'),
          max_recipients_per_epoch: int(f.maxRecipients, 'consensus.economics.max_recipients_per_epoch'),
          min_collateral: amount(f.minCollateral, 18, 'consensus.economics.min_collateral'),
          slashing_bp: {
            invalid_result: bp(f.slashInvalid, 'consensus.economics.slashing_bp.invalid_result'),
            missed_sla: bp(f.slashMissed, 'consensus.economics.slashing_bp.missed_sla'),
          },
        },
      },
      scheduling: {
        requirements: {
          device_classes: sortedUnique(f.deviceClasses),
          cpu_cores: int(f.cpu, 'scheduling.requirements.cpu_cores'),
          ram_mb: int(f.ramMb, 'scheduling.requirements.ram_mb'),
          storage_mb: int(f.storageMb, 'scheduling.requirements.storage_mb'),
          gpu: null,
          min_benchmark: int(f.minBenchmark, 'scheduling.requirements.min_benchmark'),
          engines: sortedUnique(f.engines),
          attestation: [],
        },
        sla: {
          max_latency_ms: int(f.slaLatency, 'scheduling.sla.max_latency_ms'),
          min_uptime_bp: bp(f.slaUptime, 'scheduling.sla.min_uptime_bp'),
        },
        public_tasks: f.publicTasks,
      },
      listing: {
        name: f.name.trim(),
        tagline: f.tagline.trim(),
        description: f.description.trim(),
        category: f.category,
        tags,
        icon: f.icon,
        banner: url(f.banner),
        screenshots: [...f.screenshots],
        video: url(f.video),
        website: url(f.website),
        docs: url(f.docs),
        support: url(f.support),
        features,
        accent_color: f.accentColor.trim() ? f.accentColor.trim().toUpperCase() : null,
      },
    };
    return { manifest, conversion: conv };
  }

  const build = $derived(built());
  const manifest = $derived(build.manifest);
  const canonical = $derived.by(() => { try { return canonicalJson(manifest); } catch { return null; } });

  /** Problems reported by the Hub's prepare for the exact canonical bytes they were computed for. */
  let hubCheck = $state<{ canonical: string; problems: ManifestProblem[] } | null>(null);

  const problems = $derived.by(() => {
    const conv = build.conversion;
    const convPaths = new Set(conv.map((p) => p.path));
    const local = validateManifest(manifest, params).filter((p) => {
      if (convPaths.has(p.path)) return false;
      if (p.path === 'consensus.economics.vault' && !vault) return false; // learned from the Hub
      if (p.path === 'developer' && !developer) return false;
      return true;
    });
    const all = [...conv, ...local];
    if (hubCheck && hubCheck.canonical === canonical) {
      for (const p of hubCheck.problems) if (!all.some((q) => q.path === p.path && q.message === p.message)) all.push(p);
    }
    return all;
  });

  function stepOf(path: string): number {
    if (path.startsWith('consensus.economics')) return 3;
    if (path.startsWith('consensus')) return 2;
    if (path.startsWith('scheduling')) return 4;
    if (['listing.name', 'listing.tagline', 'listing.description', 'listing.category'].includes(path)) return 1;
    if (path.startsWith('listing')) return 5;
    return 1; // slug, developer, network, chain_id, version, size
  }
  const problemsByStep = $derived.by(() => {
    const out: Record<number, ManifestProblem[]> = {};
    for (const p of problems) (out[stepOf(p.path)] ??= []).push(p);
    return out;
  });

  /** First problem at `path` (or below it), shown once the step was attempted or on review. */
  function err(path: string, s: number): string | null {
    if (!attempted[s] && step !== LAST) return null;
    const p = problems.find((x) => x.path === path || x.path.startsWith(path + '.'));
    return p ? p.message : null;
  }

  function next() {
    attempted = { ...attempted, [step]: true };
    if ((problemsByStep[step]?.length ?? 0) > 0) {
      toast.error('Fix the highlighted fields to continue');
      return;
    }
    step = Math.min(LAST, step + 1);
  }

  // ── Vault + Hub validation on the review step ──
  let checking = $state(false);
  async function checkWithHub() {
    if (!pid) return;
    checking = true;
    try {
      if (!vault) {
        const prep = await hub.prepareManifest(built().manifest);
        let v: string | undefined = prep.vault;
        if (!v) {
          // Fallback: some Hub builds only name the expected vault in the problem message.
          const hint = prep.problems.find((p) => p.path === 'consensus.economics.vault')?.message.match(/0x[0-9a-fA-F]{40}/)?.[0];
          v = hint;
        }
        if (v) vaultCache = { pid, vault: v.toLowerCase() };
      }
      const m = built().manifest;
      const c = canonicalJson(m);
      const prep = await hub.prepareManifest(m);
      hubCheck = { canonical: c, problems: prep.valid ? [] : prep.problems };
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      checking = false;
    }
  }

  $effect(() => {
    if (step === LAST && pid && !vault && !checking && enrolled) void checkWithHub();
  });

  // ── Drafts ──
  let draftId = $state<string | null>(null);
  let draftLoading = $state(false);
  let draftStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let draftReady = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    const id = page.url.searchParams.get('draft');
    if (!id) { draftReady = true; return; }
    draftId = id;
    draftLoading = true;
    hub.draft(id).then(
      (d) => {
        const form = (d?.data as { form?: Partial<WizardForm> } | undefined)?.form;
        if (d && form) {
          f = { ...defaults(), ...form };
          step = Math.min(LAST, Math.max(1, d.current_step + 1));
        } else if (!d) {
          draftId = null;
          toast.error('Draft not found; starting a new project');
        }
      },
      (e) => toast.error(errorMessage(e)),
    ).finally(() => { draftLoading = false; draftReady = true; });
    return () => { if (saveTimer) clearTimeout(saveTimer); };
  });

  $effect(() => {
    const snapshot = JSON.stringify(f);
    const s = step;
    if (!draftReady || !enrolled || published) return;
    if (!draftId && !f.name.trim() && !f.slug.trim() && !f.worker) return; // nothing worth saving yet
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      draftStatus = 'saving';
      try {
        const body = { current_step: s - 1, data: { kind: 'wizard', form: JSON.parse(snapshot) } };
        if (draftId) await hub.saveDraft(draftId, body);
        else draftId = (await hub.createDraft(body)).draft_id;
        draftStatus = 'saved';
      } catch {
        draftStatus = 'error';
      }
    }, 1500);
  });

  // ── Media ──
  let uploading = $state<string | null>(null);
  async function uploadInto(e: Event, target: 'icon' | 'banner' | 'screenshots') {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    uploading = target;
    try {
      if (target === 'screenshots') {
        for (const file of files.slice(0, 8 - f.screenshots.length)) f.screenshots = [...f.screenshots, await uploadImage(file)];
      } else {
        f[target] = await uploadImage(files[0]);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      uploading = null;
    }
  }
  function removeScreenshot(idx: number) {
    f.screenshots = f.screenshots.filter((_, j) => j !== idx);
  }

  // ── Publish ──
  let sendNow = $state(true);
  let publishing = $state(false);
  let progress = $state('');
  let published = $state<{ projectId: string; tx: TxRequest | null; pendingDraft: string | null } | null>(null);

  const canPublish = $derived(problems.length === 0 && !!vault && !!pid && enrolled && !publishing);

  async function finishTx(hash: string) {
    if (published?.pendingDraft) await hub.deleteDraft(published.pendingDraft).catch(() => {});
    toast.success('Registration sent. The project moves to review once the transaction is indexed.');
    void hash;
    await goto(`/develop/apps/${published?.projectId}`);
  }

  async function publish() {
    if (!canPublish) return;
    publishing = true;
    progress = '';
    try {
      const res = await publishProject(built().manifest, (l) => (progress = l), { sendRegisterTx: false });
      const projectIdOut = res.project.project_id;
      let pendingDraft: string | null = null;
      if (res.registerTx) {
        try { pendingDraft = (await savePendingTx(projectIdOut, 'register', 1, res.registerTx)).draft_id; } catch { /* still shown below */ }
      }
      if (draftId) { await hub.deleteDraft(draftId).catch(() => {}); draftId = null; }
      published = { projectId: projectIdOut, tx: res.registerTx ?? null, pendingDraft };
      if (sendNow && res.registerTx) {
        progress = 'Confirm the registry transaction in your wallet';
        try {
          const hash = await sendTransaction(res.registerTx);
          await finishTx(hash);
        } catch (e) {
          toast.error(`Manifest submitted, but the transaction was not sent: ${errorMessage(e)}`);
        }
      } else {
        toast.success('Manifest signed and submitted');
      }
    } catch (e) {
      if (e instanceof ManifestRejected) {
        const c = canonical;
        if (c) hubCheck = { canonical: c, problems: e.problems };
        const first = e.problems[0];
        attempted = { 1: true, 2: true, 3: true, 4: true, 5: true };
        if (first) step = stepOf(first.path);
        toast.error('The network rejected the manifest; see the highlighted fields');
      } else {
        toast.error(errorMessage(e));
      }
    } finally {
      publishing = false;
      progress = '';
    }
  }

  // ── Summary ──
  const summaryRows = $derived([
    { label: 'Name', value: f.name || '—' },
    { label: 'Category', value: categoryName(f.category) },
    { label: 'Slug', value: f.slug || '—' },
    { label: 'Worker', value: f.worker ? shortHex(f.worker, 8, 6) : '—' },
    { label: 'Functions', value: functionsList.join(', ') || '—' },
    { label: 'Tasks', value: f.taskSource === 'api' ? 'API submitted' : `Every ${formatDuration(Number(f.schedInterval) || 0)}` },
    { label: 'Committee', value: `${f.committeeSize} + ${f.backups} backups` },
    { label: 'Epoch', value: formatDuration(f.epochSecs) },
    { label: 'Reward Model', value: rewardModelLabel(f.rewardModel) },
    { label: f.rewardModel === 'per-unit' ? 'Reward / Unit' : 'Pool', value: f.rewardModel === 'per-unit' ? `${f.rewardPerUnit} ${tokenSymbol}` : 'Daily emission' },
    { label: 'Daily Emission', value: `${f.dailyEmission} ${tokenSymbol}` },
    { label: 'Fee Split', value: `${f.feeMiner} / ${f.feeDeveloper} / ${f.feeTreasury} %` },
    { label: 'Min Collateral', value: `${f.minCollateral} NECTA` },
    { label: 'Devices', value: f.deviceClasses.map((c) => DEVICE_CLASS_LABEL[c]).join(', ') || '—' },
    { label: 'RAM', value: formatMb(Number(f.ramMb) || 0) },
    { label: 'Dispute Window', value: formatDuration(Number(f.disputeSecs) || 0) },
  ]);

  const inp = 'n-input';
  const inpTextarea = 'n-textarea';
</script>

{#snippet fieldError(msg: string | null)}
  {#if msg}<p class="text-[11px] text-[var(--error)] mt-1 m-0">{msg}</p>{/if}
{/snippet}

{#snippet soon()}
  <span class="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.04em] px-1.5 py-px rounded-[3px] bg-[var(--surface-3)] text-[var(--text-tertiary)]"><Lock size={9} strokeWidth={2} /> Coming soon</span>
{/snippet}

<svelte:head>
  <title>Create Project — Necter Mining App Store</title>
</svelte:head>

<SignInGate title="Create a project" description="Sign in with your developer wallet to build and publish a mining project." illustration="platform">
<div class="min-h-screen animate-fadeIn">
  <div class="max-w-[720px] mx-auto p-4 md:p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)]">Create Project</h1>
        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
          Step {step} of {LAST} &middot; {stepLabels[step - 1]}
          {#if draftStatus === 'saving'}&middot; Saving draft…{:else if draftStatus === 'saved'}&middot; <span class="text-[var(--success)]">Draft saved</span>{:else if draftStatus === 'error'}&middot; <span class="text-[var(--error)]">Draft not saved</span>{/if}
        </p>
      </div>
      <a href="/develop" class="back-link m-0"><ArrowLeft size={14} strokeWidth={1.5} /> Back</a>
    </div>

    {#if devQ.loading && !devQ.data || draftLoading}
      <LoadingBlock rows={4} height="80px" />
    {:else if devQ.error}
      <ErrorState error={devQ.error} retry={devQ.refresh} />
    {:else if !enrolled}
      <EmptyState illustration="platform" title="Enroll as a developer first" description="Publishing a project needs an active, verified developer enrollment. On the testnet verification is automatic.">
        <a href="/develop" class="btn-subscribe no-underline">Enroll</a>
      </EmptyState>
    {:else if published}
      <!-- ── Submitted ── -->
      <div class="flex flex-col gap-4">
        <div class="n-card text-center bg-honeycomb">
          <img src="/brand/3d/mining-platform.png" alt="" class="w-24 h-auto mx-auto mb-3 opacity-90" />
          <h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Manifest signed and submitted</h3>
          <p class="text-[12px] text-[var(--text-secondary)] max-w-[440px] mx-auto leading-[18px]">
            Version 1 must be registered on-chain with <span class="font-mono">ProjectRegistry.register</span>. After the transaction confirms, the Hub indexes it and the project moves to operator review.
          </p>
          <p class="text-[11px] text-[var(--text-tertiary)] mt-2 font-mono flex items-center justify-center gap-1.5">project_id <CopyText value={published.projectId} /></p>
        </div>
        {#if published.tx}
          <TxRequestCard tx={published.tx} title="Registration transaction" onsent={finishTx} />
          <p class="text-[11px] text-[var(--text-tertiary)]">
            Not ready to pay gas? It is saved to your private drafts; send it later from the project dashboard.
          </p>
        {/if}
        <div class="flex justify-end">
          <a href="/develop/apps/{published.projectId}" class="btn-subscribe no-underline">Open project dashboard <ArrowRight size={12} strokeWidth={2} /></a>
        </div>
      </div>
    {:else}
    <!-- Step bar -->
    <div class="grid grid-cols-3 md:grid-cols-6 gap-1 mb-6">
      {#each stepLabels as label, i}
        {@const n = i + 1}
        {@const bad = attempted[n] && (problemsByStep[n]?.length ?? 0) > 0}
        <button
          type="button"
          onclick={() => { if (n <= step || attempted[n - 1]) step = n; }}
          class="h-[34px] rounded-[6px] border-none text-[12px] font-medium"
          style="cursor:{n <= step ? 'pointer' : 'default'};background:{step === n ? 'var(--accent-subtle)' : bad ? 'rgba(235,87,87,0.08)' : n < step ? 'rgba(76,183,130,0.08)' : 'var(--surface-1)'};color:{step === n ? 'var(--text-accent)' : bad ? 'var(--error)' : n < step ? 'var(--success)' : 'var(--text-tertiary)'}"
        >
          {n}. {label}
        </button>
      {/each}
    </div>

    <!-- STEP 1: Details -->
    {#if step === 1}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-3.5">Project Details</h3>
          <div class="flex flex-col gap-3">
            <div>
              <label class="field-label" for="w-name">Project Name <span class="text-[var(--error)]">*</span></label>
              <input id="w-name" type="text" bind:value={f.name} maxlength="64" placeholder="e.g. Weather Oracle" class={inp} />
              {@render fieldError(err('listing.name', 1))}
            </div>
            <div>
              <label class="field-label" for="w-slug">Slug <span class="text-[var(--error)]">*</span></label>
              <input
                id="w-slug" type="text" bind:value={f.slug} maxlength="48" placeholder="weather-oracle" class="{inp} font-mono"
                oninput={() => { f.slug = f.slug.toLowerCase(); }}
              />
              <p class="field-hint">3–48 characters: a–z, 0–9 and inner hyphens. Fixed forever; it is part of the project id.</p>
              {@render fieldError(err('slug', 1))}
              {#if pid}
                <p class="text-[11px] text-[var(--text-tertiary)] mt-1.5 flex items-center gap-1.5">project_id <CopyText value={pid} /></p>
              {/if}
            </div>
            <div>
              <label class="field-label" for="w-tag">Tagline</label>
              <input id="w-tag" type="text" bind:value={f.tagline} maxlength="120" placeholder="One line miners see in Discover" class={inp} />
              {@render fieldError(err('listing.tagline', 1))}
            </div>
            <div>
              <label class="field-label" for="w-desc">Description</label>
              <textarea id="w-desc" bind:value={f.description} maxlength="8000" placeholder="What does your project do? What work will miners run?" rows="4" class={inpTextarea}></textarea>
              {@render fieldError(err('listing.description', 1))}
            </div>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Category</h3>
          <p class="field-hint mb-3">Where your project appears in Discover.</p>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            {#each CATEGORIES as c (c.slug)}
              {@const sel = f.category === c.slug}
              <button
                type="button"
                onclick={() => { f.category = c.slug; }}
                class="flex flex-col gap-1 p-3 rounded-[8px] cursor-pointer text-left"
                style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
              >
                <span class="text-[13px] font-semibold" style="color:{sel ? 'var(--text-accent)' : 'var(--text-primary)'}">{c.name}</span>
              </button>
            {/each}
          </div>
          {@render fieldError(err('listing.category', 1))}
        </div>
      </div>
    {/if}

    <!-- STEP 2: Work -->
    {#if step === 2}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-1">Work Class</h3>
          <p class="field-hint mb-3">How miners prove their work.</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-1.5">
            <div class="p-2.5 rounded-[6px] text-left" style="border:1px solid var(--border-accent);background:var(--accent-subtle)">
              <span class="block text-[12px] font-semibold text-[var(--text-accent)]">Deterministic</span>
              <span class="block text-[10px] text-[var(--text-tertiary)] mt-0.5">Committee re-executes each task; quorum on the receipt, validator finality</span>
            </div>
            {#each [
              { label: 'Resource proof', desc: 'Storage, bandwidth or uptime challenges' },
              { label: 'Off-chain compute', desc: 'Docker/VM workloads, spot checks or TEE' },
            ] as c}
              <div class="p-2.5 rounded-[6px] text-left opacity-60" style="border:1px solid var(--border-default);background:var(--surface-2)">
                <span class="flex items-center justify-between text-[12px] font-semibold text-[var(--text-primary)]">{c.label} {@render soon()}</span>
                <span class="block text-[10px] text-[var(--text-tertiary)] mt-0.5">{c.desc}</span>
              </div>
            {/each}
          </div>
          <div class="flex items-center gap-3 mt-3 text-[11px] text-[var(--text-tertiary)] flex-wrap">
            <span>Execution: <span class="text-[var(--text-primary)] font-medium">Committee</span></span>
            <span class="flex items-center gap-1.5">Validators (stateful) {@render soon()}</span>
            <span>Runtime: <span class="text-[var(--text-primary)] font-medium">NDSR (wasm)</span></span>
            <span class="flex items-center gap-1.5">Docker / VM {@render soon()}</span>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Worker Module</h3>
          <p class="field-hint mb-3">A stateless HiveKit .hbc module (no storage or hive.call imports). <a href="/develop/templates" class="text-[var(--text-accent)] no-underline">Templates &rarr;</a></p>
          {#if modulesQ.loading && !modulesQ.data}
            <LoadingBlock rows={1} height="44px" />
          {:else if myModules.length > 0}
            <div class="flex flex-col gap-1.5 mb-3">
              {#each myModules as m (m.manifest_address)}
                {@const sel = f.worker === m.manifest_address}
                <button
                  type="button"
                  onclick={() => pickModule(m)}
                  class="flex items-center gap-3 p-2.5 rounded-[6px] text-left cursor-pointer"
                  style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
                >
                  <Package size={16} strokeWidth={1.5} style="color:{sel ? 'var(--text-accent)' : 'var(--text-tertiary)'}" />
                  <span class="flex-1 min-w-0">
                    <span class="block text-[12px] font-semibold" style="color:{sel ? 'var(--text-accent)' : 'var(--text-primary)'}">{m.name} <span class="font-normal text-[var(--text-tertiary)]">· {m.language}</span></span>
                    <span class="block text-[10px] font-mono text-[var(--text-tertiary)] truncate">{shortHex(m.manifest_address, 10, 8)} · {(m.functions ?? []).length} functions</span>
                  </span>
                  {#if m.stateless === false}
                    <span class="text-[10px] font-medium px-1.5 py-px rounded-[3px]" style="background:rgba(242,153,74,0.12);color:var(--warning)">Stateful</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
          <div class="flex gap-2 items-start">
            <div class="flex-1">
              <input type="text" bind:value={f.worker} placeholder="0x… module address (64 hex)" class="{inp} font-mono" oninput={() => { f.worker = f.worker.trim().toLowerCase(); }} />
            </div>
            <label class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[5px] text-[12px] font-medium cursor-pointer bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] shrink-0">
              <Upload size={12} strokeWidth={1.5} /> {uploadingModule ? 'Uploading…' : 'Upload .hbc'}
              <input type="file" accept=".hbc,application/octet-stream" onchange={handleModuleUpload} class="hidden" disabled={uploadingModule} />
            </label>
          </div>
          {@render fieldError(err('consensus.modules.worker', 2))}
          {#if workerOk && lookedUp?.address === f.worker && !lookedUp.module}
            <p class="text-[11px] text-[var(--error)] mt-1 m-0">No module with this address is deployed on the Hub. Upload the .hbc first.</p>
          {:else if selectedModule?.stateless === false}
            <p class="text-[11px] text-[var(--warning)] mt-1 m-0 flex items-center gap-1"><AlertTriangle size={11} strokeWidth={1.5} /> This module uses storage or hive.call; committee workers must be stateless and the Hub will reject it.</p>
          {/if}
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Functions</h3>
          <p class="field-hint mb-3">Which module functions miners execute as tasks.</p>
          {#if selectedModule}
            <div class="flex gap-1.5 flex-wrap">
              {#each sortedUnique(selectedModule.functions ?? []) as fn}
                {@const sel = f.functions.includes(fn)}
                <button
                  type="button"
                  onclick={() => toggleFn(fn)}
                  class="px-3 py-1.5 rounded-[5px] text-[12px] font-mono cursor-pointer"
                  style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'};color:{sel ? 'var(--text-accent)' : 'var(--text-secondary)'}"
                >{fn}</button>
              {/each}
            </div>
          {:else}
            <input type="text" bind:value={f.functionsText} placeholder="score, validate" class="{inp} font-mono" />
            <p class="field-hint">Comma-separated names from the worker manifest.</p>
          {/if}
          {@render fieldError(err('consensus.work.functions', 2))}

          <div class="mt-4">
            <span class="field-label">Task Source</span>
            <div class="flex gap-1.5 flex-wrap mb-3">
              {#each [{ v: 'api', l: 'API (you submit tasks)' }, { v: 'schedule', l: 'Schedule (Hub generates tasks)' }] as const as t}
                {@const sel = f.taskSource === t.v}
                <button
                  type="button"
                  onclick={() => { f.taskSource = t.v; if (t.v === 'schedule' && !functionsList.includes(f.schedFunction)) f.schedFunction = functionsList[0] ?? ''; }}
                  class="px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer"
                  style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'};color:{sel ? 'var(--text-accent)' : 'var(--text-secondary)'}"
                >{t.l}</button>
              {/each}
            </div>
            {#if f.taskSource === 'schedule'}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="field-label" for="w-sf">Function</label>
                  <select id="w-sf" bind:value={f.schedFunction} class={inp}>
                    {#each functionsList as fn}<option value={fn}>{fn}</option>{/each}
                  </select>
                  {@render fieldError(err('consensus.work.task_source.function', 2))}
                </div>
                <div>
                  <label class="field-label" for="w-si">Interval (s)</label>
                  <input id="w-si" type="text" inputmode="numeric" bind:value={f.schedInterval} class={inp} />
                  {@render fieldError(err('consensus.work.task_source.interval_secs', 2))}
                </div>
                <div>
                  <label class="field-label" for="w-sg">Gas Limit</label>
                  <input id="w-sg" type="text" inputmode="numeric" bind:value={f.schedGas} class={inp} />
                  {@render fieldError(err('consensus.work.task_source.gas_limit', 2))}
                </div>
              </div>
            {/if}
          </div>
          <div class="mt-3">
            <label class="field-label" for="w-mg">Max Gas per Task</label>
            <input id="w-mg" type="text" inputmode="numeric" bind:value={f.maxGas} class={inp} />
            {@render fieldError(err('consensus.work.max_gas_limit', 2))}
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Committee & Timing</h3>
          <p class="field-hint mb-3">Miners are drawn by collateral-and-reputation sortition for each task slot.</p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label class="field-label" for="w-cs">Size</label>
              <input id="w-cs" type="text" inputmode="numeric" bind:value={f.committeeSize} class={inp} />
              {@render fieldError(err('consensus.work.committee.size', 2))}
            </div>
            <div>
              <label class="field-label" for="w-cb">Backups</label>
              <input id="w-cb" type="text" inputmode="numeric" bind:value={f.backups} class={inp} />
              {@render fieldError(err('consensus.work.committee.backups', 2))}
            </div>
            <div>
              <label class="field-label" for="w-cm">Min Size</label>
              <input id="w-cm" type="text" inputmode="numeric" bind:value={f.minSize} class={inp} />
              {@render fieldError(err('consensus.work.committee.min_size', 2))}
            </div>
            <div>
              <label class="field-label" for="w-cw">Weight Cap ×</label>
              <input id="w-cw" type="text" inputmode="numeric" bind:value={f.weightCap} class={inp} />
              {@render fieldError(err('consensus.work.committee.weight_cap_multiple', 2))}
            </div>
            <div>
              <label class="field-label" for="w-rs">Round (s)</label>
              <input id="w-rs" type="text" inputmode="numeric" bind:value={f.roundSecs} class={inp} />
              {@render fieldError(err('consensus.work.round_secs', 2))}
            </div>
            <div>
              <label class="field-label" for="w-ls">Lease (s)</label>
              <input id="w-ls" type="text" inputmode="numeric" bind:value={f.leaseSecs} class={inp} />
              {@render fieldError(err('consensus.work.lease_secs', 2))}
            </div>
            <div>
              <label class="field-label" for="w-es">Epoch</label>
              <select id="w-es" bind:value={f.epochSecs} class={inp}>
                {#each EPOCH_SECS_ALLOWED as e}<option value={e}>{formatDuration(e)}</option>{/each}
              </select>
              {@render fieldError(err('consensus.work.epoch_secs', 2))}
            </div>
            <div>
              <label class="field-label" for="w-dw">Dispute Window (s)</label>
              <input id="w-dw" type="text" inputmode="numeric" bind:value={f.disputeSecs} class={inp} />
              {@render fieldError(err('consensus.work.dispute_window_secs', 2))}
            </div>
          </div>
          <p class="field-hint mt-2">Committee {params.committee_min_size}–{params.committee_max_size}, up to {params.committee_max_backups} backups. Dispute window {formatDuration(params.dispute_window_secs_min)}–{formatDuration(params.dispute_window_secs_max)}. The epoch length cannot change after publishing.</p>
        </div>
      </div>
    {/if}

    <!-- STEP 3: Economics -->
    {#if step === 3}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-1">Reward Token</h3>
          <p class="field-hint mb-3">Any standard ERC-20 on Sepolia. Collateral is always NECTA.</p>
          <div class="flex gap-2 items-start">
            <input type="text" bind:value={f.rewardToken} placeholder="0x… token address" class="{inp} font-mono flex-1" oninput={() => { f.rewardToken = f.rewardToken.trim().toLowerCase(); }} />
            {#if necta && !isNecta}
              <button type="button" class="btn-secondary shrink-0 h-9" onclick={() => { f.rewardToken = (necta ?? '').toLowerCase(); }}>Use NECTA</button>
            {/if}
          </div>
          {@render fieldError(err('consensus.economics.reward_token', 3))}
          {#if isNecta}
            <p class="field-hint">NECTA · 18 decimals</p>
          {:else}
            <div class="mt-2 max-w-[160px]">
              <label class="field-label" for="w-td">Token Decimals</label>
              <input id="w-td" type="text" inputmode="numeric" bind:value={f.tokenDecimals} class={inp} />
            </div>
          {/if}
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Reward Model</h3>
          <p class="field-hint mb-3">How miners get paid for their work.</p>
          <div class="flex gap-1.5 flex-wrap mb-4">
            {#each [{ v: 'per-unit', l: 'Per Task' }, { v: 'epoch-pool', l: 'Per Epoch Pool' }] as const as r}
              {@const sel = f.rewardModel === r.v}
              <button
                type="button"
                onclick={() => { f.rewardModel = r.v; }}
                class="px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer"
                style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'};color:{sel ? 'var(--text-accent)' : 'var(--text-secondary)'}"
              >{r.l}</button>
            {/each}
            {#each ['Fixed per Epoch', 'Time Based', 'Stake Weighted', 'Variable Pricing', 'Marketplace'] as label}
              <span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium opacity-60" style="border:1px solid var(--border-default);background:var(--surface-2);color:var(--text-tertiary)">{label} {@render soon()}</span>
            {/each}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            {#if f.rewardModel === 'per-unit'}
              <div>
                <label class="field-label" for="w-rpu">Reward / Unit ({tokenSymbol})</label>
                <input id="w-rpu" type="text" inputmode="decimal" bind:value={f.rewardPerUnit} class={inp} />
                {@render fieldError(err('consensus.economics.reward_per_unit', 3))}
              </div>
            {/if}
            <div>
              <label class="field-label" for="w-de">Daily Emission Cap ({tokenSymbol})</label>
              <input id="w-de" type="text" inputmode="decimal" bind:value={f.dailyEmission} class={inp} />
              {@render fieldError(err('consensus.economics.daily_emission', 3))}
            </div>
          </div>
          <p class="field-hint mt-2">{f.rewardModel === 'per-unit' ? 'Each compute unit pays the reward; payouts scale down pro rata when an epoch exceeds the daily cap.' : 'Each epoch distributes its share of the daily emission pro rata to units.'}</p>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Fee Split</h3>
          <p class="field-hint mb-3">Shares of each epoch's rewards, in percent. Miners get at least 50%; the total must be 100%.</p>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="field-label" for="w-fm">Miner %</label>
              <input id="w-fm" type="text" inputmode="decimal" bind:value={f.feeMiner} class={inp} />
            </div>
            <div>
              <label class="field-label" for="w-fd">Developer %</label>
              <input id="w-fd" type="text" inputmode="decimal" bind:value={f.feeDeveloper} class={inp} />
            </div>
            <div>
              <label class="field-label" for="w-ft">Treasury %</label>
              <input id="w-ft" type="text" inputmode="decimal" bind:value={f.feeTreasury} class={inp} />
            </div>
          </div>
          {@render fieldError(err('consensus.economics.fee_split_bp', 3))}
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Caps, Collateral & Slashing</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label class="field-label" for="w-mu">Max Units / Epoch</label>
              <input id="w-mu" type="text" inputmode="numeric" bind:value={f.maxUnits} class={inp} />
              {@render fieldError(err('consensus.economics.max_units_per_epoch', 3))}
            </div>
            <div>
              <label class="field-label" for="w-mr">Max Recipients / Epoch</label>
              <input id="w-mr" type="text" inputmode="numeric" bind:value={f.maxRecipients} class={inp} />
              {@render fieldError(err('consensus.economics.max_recipients_per_epoch', 3))}
            </div>
            <div>
              <label class="field-label" for="w-mc">Min Collateral (NECTA)</label>
              <input id="w-mc" type="text" inputmode="decimal" bind:value={f.minCollateral} class={inp} />
              {@render fieldError(err('consensus.economics.min_collateral', 3))}
            </div>
            <div></div>
            <div>
              <label class="field-label" for="w-si2">Slash: Invalid Result %</label>
              <input id="w-si2" type="text" inputmode="decimal" bind:value={f.slashInvalid} class={inp} />
              <p class="field-hint">Max {bpToPercent(params.slash_invalid_result_bp_max)}</p>
              {@render fieldError(err('consensus.economics.slashing_bp.invalid_result', 3))}
            </div>
            <div>
              <label class="field-label" for="w-sm">Slash: Missed SLA %</label>
              <input id="w-sm" type="text" inputmode="decimal" bind:value={f.slashMissed} class={inp} />
              <p class="field-hint">Max {bpToPercent(params.slash_missed_sla_bp_max)}; reputation-only on the testnet</p>
              {@render fieldError(err('consensus.economics.slashing_bp.missed_sla', 3))}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- STEP 4: Requirements -->
    {#if step === 4}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-1">Device Classes</h3>
          <p class="field-hint mb-3">Which devices may subscribe. Every engine produces identical receipts, so phones can join committees.</p>
          <div class="flex gap-1.5 flex-wrap">
            {#each DEVICE_CLASSES as c}
              {@const sel = f.deviceClasses.includes(c)}
              <button
                type="button"
                onclick={() => toggleClass(c)}
                class="px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer"
                style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'};color:{sel ? 'var(--text-accent)' : 'var(--text-secondary)'}"
              >{DEVICE_CLASS_LABEL[c]}</button>
            {/each}
          </div>
          {@render fieldError(err('scheduling.requirements.device_classes', 4))}
          <span class="field-label mt-4">Engines</span>
          <div class="flex gap-1.5 flex-wrap">
            {#each ENGINES as e}
              {@const sel = f.engines.includes(e)}
              <button
                type="button"
                onclick={() => toggleEngine(e)}
                class="px-3.5 py-1.5 rounded-[5px] text-[12px] font-mono cursor-pointer"
                style="border:{sel ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sel ? 'var(--accent-subtle)' : 'var(--surface-2)'};color:{sel ? 'var(--text-accent)' : 'var(--text-secondary)'}"
              >{e}</button>
            {/each}
          </div>
          {@render fieldError(err('scheduling.requirements.engines', 4))}
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Hardware Requirements</h3>
          <p class="field-hint mb-3">Minimum specs miners need to participate.</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="field-label" for="w-cpu">Min CPU Cores</label>
              <input id="w-cpu" type="text" inputmode="numeric" bind:value={f.cpu} class={inp} />
              {@render fieldError(err('scheduling.requirements.cpu_cores', 4))}
            </div>
            <div>
              <label class="field-label" for="w-ram">Min RAM (MB)</label>
              <input id="w-ram" type="text" inputmode="numeric" bind:value={f.ramMb} class={inp} />
              {@render fieldError(err('scheduling.requirements.ram_mb', 4))}
            </div>
            <div>
              <label class="field-label" for="w-st">Min Free Storage (MB)</label>
              <input id="w-st" type="text" inputmode="numeric" bind:value={f.storageMb} class={inp} />
              {@render fieldError(err('scheduling.requirements.storage_mb', 4))}
            </div>
            <div>
              <label class="field-label" for="w-bm">Min Benchmark Score</label>
              <input id="w-bm" type="text" inputmode="numeric" bind:value={f.minBenchmark} class={inp} />
              {@render fieldError(err('scheduling.requirements.min_benchmark', 4))}
            </div>
            <div>
              <span class="field-label flex items-center gap-1.5">GPU {@render soon()}</span>
              <button type="button" disabled class="n-input flex items-center justify-center font-medium opacity-60 cursor-not-allowed" style="color:var(--text-tertiary)">
                <Cpu size={12} strokeWidth={1.5} class="mr-1.5" /> No, CPU Only
              </button>
            </div>
            <div>
              <span class="field-label flex items-center gap-1.5">Device Attestation {@render soon()}</span>
              <div class="flex gap-1 flex-wrap opacity-60">
                {#each ['Play Integrity', 'App Attest', 'TPM', 'TEE'] as a}
                  <span class="px-2 py-1 rounded-[4px] text-[11px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-tertiary)]">{a}</span>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-1">Service Level & Access</h3>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="field-label" for="w-lat">Max Latency (ms)</label>
              <input id="w-lat" type="text" inputmode="numeric" bind:value={f.slaLatency} class={inp} />
              {@render fieldError(err('scheduling.sla.max_latency_ms', 4))}
            </div>
            <div>
              <label class="field-label" for="w-up">Min Uptime %</label>
              <input id="w-up" type="text" inputmode="decimal" bind:value={f.slaUptime} class={inp} />
              {@render fieldError(err('scheduling.sla.min_uptime_bp', 4))}
            </div>
          </div>
          <button
            type="button"
            onclick={() => { f.publicTasks = !f.publicTasks; }}
            class="mt-3 w-full flex items-center justify-between p-3 rounded-[6px] cursor-pointer text-left"
            style="border:{f.publicTasks ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{f.publicTasks ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
          >
            <span>
              <span class="block text-[12px] font-semibold" style="color:{f.publicTasks ? 'var(--text-accent)' : 'var(--text-primary)'}">Public tasks</span>
              <span class="block text-[11px] text-[var(--text-tertiary)]">Anyone may submit tasks (rate-limited). Off: only your API keys.</span>
            </span>
            <span class="text-[12px] font-medium" style="color:{f.publicTasks ? 'var(--text-accent)' : 'var(--text-tertiary)'}">{f.publicTasks ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>
    {/if}

    <!-- STEP 5: Branding -->
    {#if step === 5}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-3.5">Branding & Media</h3>
          <div class="flex flex-col gap-4">
            <!-- Icon -->
            <div>
              <span class="field-label">App Icon <span class="text-[var(--error)]">*</span></span>
              <div class="flex items-center gap-3">
                <div class="w-16 h-16 rounded-[14px] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden shrink-0" style="border:{f.icon ? 'none' : '2px dashed var(--border-default)'}">
                  {#if f.icon}
                    <img src={f.icon} alt="Icon" width="64" height="64" class="rounded-[14px] object-cover w-16 h-16" />
                  {:else}
                    <ImageIcon size={24} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
                  {/if}
                </div>
                <div>
                  <label class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                    <Upload size={12} strokeWidth={1.5} /> {uploading === 'icon' ? 'Uploading…' : 'Upload Icon'}
                    <input type="file" accept={IMAGE_ACCEPT} onchange={(e) => uploadInto(e, 'icon')} class="hidden" disabled={!!uploading} />
                  </label>
                  <p class="field-hint">512×512 PNG, JPEG or WebP, up to 2 MB.</p>
                </div>
              </div>
              {@render fieldError(err('listing.icon', 5))}
            </div>

            <!-- Banner -->
            <div>
              <span class="field-label">Banner</span>
              <div class="flex items-center gap-3">
                <div class="w-40 aspect-[3/1] rounded-[8px] bg-[var(--surface-2)] overflow-hidden flex items-center justify-center shrink-0" style="border:{f.banner ? 'none' : '2px dashed var(--border-default)'}">
                  {#if f.banner}<img src={f.banner} alt="Banner" class="w-full h-full object-cover" />{:else}<ImageIcon size={18} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />{/if}
                </div>
                <div class="flex gap-2 flex-wrap">
                  <label class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                    <Upload size={12} strokeWidth={1.5} /> {uploading === 'banner' ? 'Uploading…' : 'Upload Banner'}
                    <input type="file" accept={IMAGE_ACCEPT} onchange={(e) => uploadInto(e, 'banner')} class="hidden" disabled={!!uploading} />
                  </label>
                  {#if f.banner}<button type="button" class="btn-secondary" onclick={() => { f.banner = ''; }}>Remove</button>{/if}
                </div>
              </div>
              {@render fieldError(err('listing.banner', 5))}
            </div>

            <!-- Screenshots -->
            <div>
              <span class="field-label">Screenshots ({f.screenshots.length}/8)</span>
              <div class="grid grid-cols-4 gap-2">
                {#each f.screenshots as src, i}
                  <div class="relative aspect-[16/10] rounded-[6px] overflow-hidden border border-[var(--border-default)]">
                    <img {src} alt="Screenshot {i + 1}" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      onclick={() => removeScreenshot(i)}
                      class="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 border-none cursor-pointer flex items-center justify-center"
                      aria-label="Remove screenshot"
                    >
                      <X size={12} strokeWidth={2} class="text-white" />
                    </button>
                  </div>
                {/each}
                {#if f.screenshots.length < 8}
                  <label class="aspect-[16/10] rounded-[6px] border border-dashed border-[var(--border-default)] bg-[var(--surface-2)] flex flex-col items-center justify-center cursor-pointer gap-1">
                    <Upload size={16} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
                    <span class="text-[10px] text-[var(--text-tertiary)]">{uploading === 'screenshots' ? 'Uploading…' : 'Add'}</span>
                    <input type="file" accept={IMAGE_ACCEPT} multiple onchange={(e) => uploadInto(e, 'screenshots')} class="hidden" disabled={!!uploading} />
                  </label>
                {/if}
              </div>
              {@render fieldError(err('listing.screenshots', 5))}
            </div>

            <!-- Accent -->
            <div>
              <label class="field-label" for="w-acc">Accent Color</label>
              <div class="flex items-center gap-3">
                <input type="color" value={f.accentColor || '#FFC933'} oninput={(e) => { f.accentColor = (e.currentTarget as HTMLInputElement).value.toUpperCase(); }} class="w-9 h-9 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] cursor-pointer p-0.5" />
                <input id="w-acc" type="text" bind:value={f.accentColor} placeholder="#FFC933" class="{inp} font-mono" style="flex:1" oninput={() => { f.accentColor = f.accentColor.toUpperCase(); }} />
              </div>
              {@render fieldError(err('listing.accent_color', 5))}
            </div>

            <!-- Features -->
            <div>
              <label class="field-label" for="w-feat">Features</label>
              <textarea id="w-feat" bind:value={f.featuresText} rows="3" placeholder={"Verified results from a miner committee\nRuns on phones and desktops"} class={inpTextarea}></textarea>
              <p class="field-hint">One per line, up to 12. Shown on the app detail page.</p>
              {@render fieldError(err('listing.features', 5))}
            </div>

            <!-- Tags -->
            <div>
              <label class="field-label" for="w-tags">Tags</label>
              <input id="w-tags" type="text" bind:value={f.tagsText} placeholder="oracle, weather" class={inp} />
              <p class="field-hint">Comma-separated, up to 8: lowercase letters, digits and hyphens.</p>
              {@render fieldError(err('listing.tags', 5))}
            </div>
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-3.5">Links</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            {#each [
              { k: 'website', l: 'Website' },
              { k: 'docs', l: 'Documentation' },
              { k: 'support', l: 'Support' },
              { k: 'video', l: 'Video' },
            ] as const as link}
              <div>
                <label class="field-label" for="w-{link.k}">{link.l}</label>
                <input id="w-{link.k}" type="url" bind:value={f[link.k]} placeholder="https://" class={inp} />
                {@render fieldError(err(`listing.${link.k}`, 5))}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- STEP 6: Review -->
    {#if step === LAST}
      <div class="flex flex-col gap-4">
        <div class="n-card">
          <h3 class="section-title mb-3">Summary</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
            {#each summaryRows as row}
              <div class="flex justify-between gap-3 py-[7px] border-b border-[var(--border-default)]">
                <span class="text-[12px] text-[var(--text-tertiary)] shrink-0">{row.label}</span>
                <span class="text-[12px] font-medium text-[var(--text-primary)] text-right truncate">{row.value}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="n-card">
          <h3 class="section-title mb-3">Identifiers</h3>
          <div class="flex flex-col gap-2 text-[12px]">
            <div class="flex justify-between gap-3"><span class="text-[var(--text-tertiary)]">Developer</span>{#if developer}<CopyText value={developer} />{:else}—{/if}</div>
            <div class="flex justify-between gap-3"><span class="text-[var(--text-tertiary)]">Project ID</span>{#if pid}<CopyText value={pid} />{:else}<span class="text-[var(--text-tertiary)]">set a valid slug</span>{/if}</div>
            <div class="flex justify-between gap-3">
              <span class="text-[var(--text-tertiary)]">Reward Vault</span>
              {#if vault}<CopyText value={vault} />{:else if checking}<span class="text-[var(--text-tertiary)]">Resolving…</span>{:else}<span class="text-[var(--text-tertiary)]">Resolved by the network once the manifest is valid</span>{/if}
            </div>
            <div class="flex justify-between gap-3"><span class="text-[var(--text-tertiary)]">Network</span><span class="font-mono text-[var(--text-secondary)]">{params.network} · chain {params.chain_id}</span></div>
          </div>
        </div>

        {#if problems.length > 0}
          <div class="n-card" style="border-color:rgba(235,87,87,0.3)">
            <h3 class="section-title mb-2 flex items-center gap-1.5" style="color:var(--error)"><AlertTriangle size={13} strokeWidth={1.5} /> {problems.length} problem{problems.length === 1 ? '' : 's'} to fix</h3>
            <div class="flex flex-col gap-1">
              {#each problems as p}
                <button type="button" class="flex justify-between gap-3 text-left bg-transparent border-none cursor-pointer p-1 rounded hover:bg-[var(--surface-2)]" onclick={() => { attempted = { ...attempted, [stepOf(p.path)]: true }; step = stepOf(p.path); }}>
                  <span class="text-[11px] font-mono text-[var(--text-secondary)]">{p.path || 'manifest'}</span>
                  <span class="text-[11px] text-[var(--error)] text-right">{p.message}</span>
                </button>
              {/each}
            </div>
          </div>
        {:else if vault && hubCheck?.canonical === canonical}
          <div class="flex items-center gap-2 text-[12px] text-[var(--success)]"><Check size={14} strokeWidth={2} /> The network accepted this manifest.</div>
        {/if}

        <div class="n-card">
          <h3 class="section-title mb-2">Sign & Publish</h3>
          <p class="text-[12px] text-[var(--text-secondary)] leading-[18px] mb-3">
            Your wallet signs the exact manifest bytes (free). Version 1 is then registered on-chain with <span class="font-mono">ProjectRegistry.register</span>, a transaction from your wallet that needs a little Sepolia ETH for gas.
          </p>
          <button
            type="button"
            onclick={() => { sendNow = !sendNow; }}
            class="w-full flex items-center justify-between p-3 rounded-[6px] cursor-pointer text-left mb-3"
            style="border:{sendNow ? '1px solid var(--border-accent)' : '1px solid var(--border-default)'};background:{sendNow ? 'var(--accent-subtle)' : 'var(--surface-2)'}"
          >
            <span class="flex items-center gap-2">
              <Fuel size={14} strokeWidth={1.5} style="color:{sendNow ? 'var(--text-accent)' : 'var(--text-tertiary)'}" />
              <span>
                <span class="block text-[12px] font-semibold" style="color:{sendNow ? 'var(--text-accent)' : 'var(--text-primary)'}">Send the registration transaction now</span>
                <span class="block text-[11px] text-[var(--text-tertiary)]">Off: sign and submit only; the transaction data is kept so you can send it later.</span>
              </span>
            </span>
            <span class="text-[12px] font-medium" style="color:{sendNow ? 'var(--text-accent)' : 'var(--text-tertiary)'}">{sendNow ? 'On' : 'Off'}</span>
          </button>
          <div class="flex items-start gap-2 p-3 rounded-[6px] bg-[var(--surface-2)] text-[11px] text-[var(--text-tertiary)] leading-[16px]">
            <Cloud size={13} strokeWidth={1.5} class="shrink-0 mt-px" />
            <span>Before miners can be paid, the reward vault is created and funded with {tokenSymbol}. Doing that from the portal is <span class="text-[var(--text-secondary)] font-medium">coming soon</span>.</span>
          </div>
          {#if progress}
            <p class="text-[12px] text-[var(--text-accent)] mt-3">{progress}…</p>
          {/if}
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

      {#if step < LAST}
        <button
          type="button"
          onclick={next}
          class="h-9 px-5 rounded-[6px] text-[13px] font-semibold bg-[var(--accent-base)] text-[#0C0C0E] border-none cursor-pointer flex items-center gap-1.5"
        >
          Next <ArrowRight size={14} strokeWidth={2} />
        </button>
      {:else}
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" disabled={checking || !pid} onclick={checkWithHub}>
            {checking ? 'Checking…' : 'Check with network'}
          </button>
          <button
            type="button"
            disabled={!canPublish}
            onclick={publish}
            class="h-9 px-5 rounded-[6px] text-[13px] font-semibold bg-[var(--accent-base)] text-[#0C0C0E] border-none cursor-pointer flex items-center gap-1.5"
            style="opacity:{canPublish ? 1 : 0.4}"
          >
            {publishing ? 'Publishing…' : 'Sign & Publish'}
          </button>
        </div>
      {/if}
    </div>
    {/if}
  </div>
</div>
</SignInGate>
