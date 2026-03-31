<script lang="ts">
	import {
		CheckCircle2,
		Cpu,
		Shield,
		Download,
		Terminal,
		Loader2,
		HardDrive,
		Wifi,
		ExternalLink,
		AlertTriangle,
		ArrowRight,
		Copy,
		Check,
		Rocket,
		Server,
		Lock,
		Coins,
		X,
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { backend } from '$lib/stores/backend';
	import { actor } from '$lib/stores/wallet';

	type WizardStep = 'system-check' | 'staking' | 'resources' | 'launch';

	interface Props {
		appId: string;
		appName: string;
		requirements?: {
			gpu?: string;
			ram?: number | string;
			storage?: string;
		};
		stakingAmount?: number;
		onClose: () => void;
		onComplete: (subscriptionId?: string) => void;
	}

	let {
		appId,
		appName,
		requirements = {},
		stakingAmount = 0,
		onClose,
		onComplete,
	}: Props = $props();

	// ─── Steps definition ────────────────────────────────────────────────────────
	const STEPS: { id: WizardStep; label: string; icon: typeof Cpu }[] = [
		{ id: 'system-check', label: 'System Check', icon: Cpu },
		{ id: 'staking', label: 'Staking', icon: Lock },
		{ id: 'resources', label: 'Resources', icon: Download },
		{ id: 'launch', label: 'Launch', icon: Rocket },
	];

	// ─── State ───────────────────────────────────────────────────────────────────
	let currentStep = $state<WizardStep>('system-check');
	let hwChecks = $state<Record<string, 'checking' | 'pass' | 'fail'>>({
		gpu: 'checking',
		storage: 'checking',
		network: 'checking',
	});
	let stakingStatus = $state<'idle' | 'approving' | 'staking' | 'complete'>('idle');
	let downloadProgress = $state(0);
	let downloadStage = $state('');
	let installMode = $state<'auto' | 'cli'>('auto');
	let copiedCommand = $state<string | null>(null);

	// ─── Derived ─────────────────────────────────────────────────────────────────
	const currentIdx = $derived(STEPS.findIndex((s) => s.id === currentStep));
	const allChecksPassed = $derived(Object.values(hwChecks).every((v) => v === 'pass'));

	const safeName = $derived((appName || 'app').trim().replace(/\s+/g, '-').toLowerCase());
	const cli = $derived({
		install: `necter miner install --app ${safeName}`,
		run: `necter miner run --app ${safeName} --mode daemon`,
		status: `necter miner status --app ${safeName}`,
		logs: `necter miner logs --app ${safeName} --follow`,
	});

	// ─── Hardware check simulation ───────────────────────────────────────────────
	$effect(() => {
		if (currentStep !== 'system-check') return;

		// Reset checks
		hwChecks = { gpu: 'checking', storage: 'checking', network: 'checking' };

		const t1 = setTimeout(() => (hwChecks.network = 'pass'), 1200);
		const t2 = setTimeout(() => (hwChecks.storage = 'pass'), 2000);
		const t3 = setTimeout(() => (hwChecks.gpu = 'pass'), 2800);

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
	});

	// ─── Download simulation ─────────────────────────────────────────────────────
	$effect(() => {
		if (currentStep !== 'resources' || installMode !== 'auto') return;

		downloadProgress = 0;
		downloadStage = 'Pulling container image...';

		let p = 0;
		const interval = setInterval(() => {
			p += Math.random() * 4 + 1;
			if (p >= 40 && p < 45) downloadStage = 'Verifying manifest...';
			if (p >= 70 && p < 75) downloadStage = 'Initializing runtime...';
			if (p >= 100) {
				p = 100;
				clearInterval(interval);
				downloadStage = 'Container ready';
				setTimeout(() => (currentStep = 'launch'), 800);
			}
			downloadProgress = Math.min(100, p);
		}, 180);

		return () => clearInterval(interval);
	});

	// ─── Handlers ────────────────────────────────────────────────────────────────
	function goNext() {
		if (currentStep === 'system-check') {
			currentStep = stakingAmount > 0 ? 'staking' : 'resources';
		} else if (currentStep === 'staking') {
			currentStep = 'resources';
		} else if (currentStep === 'resources') {
			currentStep = 'launch';
		}
	}

	function handleStake() {
		stakingStatus = 'approving';
		setTimeout(() => {
			stakingStatus = 'staking';
			setTimeout(() => {
				stakingStatus = 'complete';
			}, 2000);
		}, 1500);
	}

	async function handleCopy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedCommand = text;
			setTimeout(() => (copiedCommand = null), 2000);
		} catch {
			// Fallback: user copies manually
		}
	}

	function handleComplete() {
		// Perform the actual subscription via backend
		const minerId = $actor?.minerId;
		const walletAddress = $actor?.walletAddress;
		if (minerId) {
			const sub = backend.subscribeToApp({
				appId,
				minerId,
				walletAddress,
				stakeAmount: stakingAmount,
			});
			onComplete(sub?.id);
		} else {
			onComplete();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
	<!-- Backdrop -->
	<div
		class="absolute inset-0 bg-black/60"
		style="backdrop-filter: blur(4px);"
		onclick={onClose}
		role="presentation"
	></div>

	<!-- Modal -->
	<div
		class="relative w-full md:w-[640px] max-h-[90vh] overflow-y-auto bg-[var(--surface-1)] border-t md:border border-[var(--border-default)] rounded-t-xl md:rounded-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- ── Header ── -->
		<div class="px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-[var(--border-default)]">
			<div class="flex items-center justify-between">
				<div>
					<h2
						class="text-[18px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
					>
						Setup {appName} Node
					</h2>
					<p class="text-[13px] text-[var(--text-secondary)] mt-1">
						Configure and deploy your mining node in a few steps.
					</p>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer text-[18px] leading-none self-start p-1"
				>
					<X size={16} strokeWidth={2} />
				</button>
			</div>

			<!-- ── Step indicator ── -->
			<div class="flex items-center gap-1 mt-5">
				{#each STEPS as step, idx}
					<!-- Skip staking step in indicator if no staking required -->
					{#if !(step.id === 'staking' && stakingAmount <= 0)}
						{@const isActive = step.id === currentStep}
						{@const isCompleted = currentIdx > idx}
						<div class="flex items-center gap-1 flex-1">
							<div
								class="flex items-center gap-2 px-3 py-1.5 rounded-[6px] flex-1 transition-all duration-200
									{isActive
									? 'bg-[var(--accent-subtle)] border border-[var(--border-accent)]'
									: isCompleted
										? 'bg-[rgba(76,183,130,0.06)]'
										: 'bg-transparent'}"
							>
								{#if isCompleted}
									<CheckCircle2
										size={14}
										strokeWidth={2}
										class="text-[var(--success)] shrink-0"
									/>
								{:else if isActive}
									<svelte:component
										this={step.icon}
										size={14}
										strokeWidth={1.5}
										class="shrink-0 text-[var(--text-accent)]"
									/>
								{:else}
									<svelte:component
										this={step.icon}
										size={14}
										strokeWidth={1.5}
										class="shrink-0 text-[var(--text-tertiary)]"
									/>
								{/if}
								<span
									class="text-[11px] font-medium truncate
										{isActive
										? 'text-[var(--text-accent)]'
										: isCompleted
											? 'text-[var(--success)]'
											: 'text-[var(--text-tertiary)]'}"
								>
									{step.label}
								</span>
							</div>
							<!-- Connector line between steps -->
							{#if idx < STEPS.length - 1 && !(STEPS[idx + 1].id === 'staking' && stakingAmount <= 0)}
								<div class="w-3 h-px bg-[var(--border-default)] shrink-0"></div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- ── Step content ── -->
		<div class="px-6 py-5 min-h-[340px] flex flex-col">
			<!-- ═══ STEP 1: System Check ═══ -->
			{#if currentStep === 'system-check'}
				<div class="flex-1 flex flex-col gap-3">
					<p class="text-[12px] text-[var(--text-secondary)] mb-1">
						Verifying your hardware meets the minimum requirements for {appName}.
					</p>

					<!-- GPU -->
					<div
						class="flex items-center gap-3 py-3 px-4 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border-default)]"
					>
						<div
							class="h-9 w-9 rounded-[6px] flex items-center justify-center shrink-0 transition-colors duration-200
								{hwChecks.gpu === 'pass'
								? 'bg-[rgba(76,183,130,0.12)]'
								: hwChecks.gpu === 'fail'
									? 'bg-[rgba(235,87,87,0.12)]'
									: 'bg-[var(--surface-3)]'}"
						>
							<Cpu
								size={18}
								strokeWidth={1.5}
								class={hwChecks.gpu === 'pass'
									? 'text-[var(--success)]'
									: hwChecks.gpu === 'fail'
										? 'text-[var(--error)]'
										: 'text-[var(--text-secondary)]'}
							/>
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between">
								<span class="text-[13px] font-medium text-[var(--text-primary)]"
									>GPU / Compute</span
								>
								{#if hwChecks.gpu === 'checking'}
									<Loader2 size={14} class="animate-spin text-[var(--text-tertiary)]" />
								{:else if hwChecks.gpu === 'pass'}
									<span class="text-[11px] font-medium text-[var(--success)]">Passed</span>
								{:else}
									<span class="text-[11px] font-medium text-[var(--error)]">Failed</span>
								{/if}
							</div>
							<div class="flex items-center gap-2 mt-0.5">
								<span class="text-[11px] text-[var(--text-tertiary)]"
									>Required: {requirements.gpu ?? 'Any GPU'}</span
								>
								{#if hwChecks.gpu !== 'checking'}
									<span class="text-[11px] text-[var(--text-tertiary)]">&middot;</span>
									<span class="text-[11px] text-[var(--text-secondary)]"
										>Found: NVIDIA RTX 4090 (24 GB VRAM)</span
									>
								{/if}
							</div>
						</div>
					</div>

					<!-- Storage -->
					<div
						class="flex items-center gap-3 py-3 px-4 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border-default)]"
					>
						<div
							class="h-9 w-9 rounded-[6px] flex items-center justify-center shrink-0 transition-colors duration-200
								{hwChecks.storage === 'pass'
								? 'bg-[rgba(76,183,130,0.12)]'
								: hwChecks.storage === 'fail'
									? 'bg-[rgba(235,87,87,0.12)]'
									: 'bg-[var(--surface-3)]'}"
						>
							<HardDrive
								size={18}
								strokeWidth={1.5}
								class={hwChecks.storage === 'pass'
									? 'text-[var(--success)]'
									: hwChecks.storage === 'fail'
										? 'text-[var(--error)]'
										: 'text-[var(--text-secondary)]'}
							/>
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between">
								<span class="text-[13px] font-medium text-[var(--text-primary)]">Storage</span
								>
								{#if hwChecks.storage === 'checking'}
									<Loader2 size={14} class="animate-spin text-[var(--text-tertiary)]" />
								{:else if hwChecks.storage === 'pass'}
									<span class="text-[11px] font-medium text-[var(--success)]">Passed</span>
								{:else}
									<span class="text-[11px] font-medium text-[var(--error)]">Failed</span>
								{/if}
							</div>
							<div class="flex items-center gap-2 mt-0.5">
								<span class="text-[11px] text-[var(--text-tertiary)]"
									>Required: {requirements.storage ?? '50 GB free'}</span
								>
								{#if hwChecks.storage !== 'checking'}
									<span class="text-[11px] text-[var(--text-tertiary)]">&middot;</span>
									<span class="text-[11px] text-[var(--text-secondary)]"
										>Found: 512 GB NVMe (380 GB free)</span
									>
								{/if}
							</div>
						</div>
					</div>

					<!-- Network -->
					<div
						class="flex items-center gap-3 py-3 px-4 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border-default)]"
					>
						<div
							class="h-9 w-9 rounded-[6px] flex items-center justify-center shrink-0 transition-colors duration-200
								{hwChecks.network === 'pass'
								? 'bg-[rgba(76,183,130,0.12)]'
								: hwChecks.network === 'fail'
									? 'bg-[rgba(235,87,87,0.12)]'
									: 'bg-[var(--surface-3)]'}"
						>
							<Wifi
								size={18}
								strokeWidth={1.5}
								class={hwChecks.network === 'pass'
									? 'text-[var(--success)]'
									: hwChecks.network === 'fail'
										? 'text-[var(--error)]'
										: 'text-[var(--text-secondary)]'}
							/>
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between">
								<span class="text-[13px] font-medium text-[var(--text-primary)]">Network</span
								>
								{#if hwChecks.network === 'checking'}
									<Loader2 size={14} class="animate-spin text-[var(--text-tertiary)]" />
								{:else if hwChecks.network === 'pass'}
									<span class="text-[11px] font-medium text-[var(--success)]">Passed</span>
								{:else}
									<span class="text-[11px] font-medium text-[var(--error)]">Failed</span>
								{/if}
							</div>
							<div class="flex items-center gap-2 mt-0.5">
								<span class="text-[11px] text-[var(--text-tertiary)]"
									>Required: 10 Mbps symmetric</span
								>
								{#if hwChecks.network !== 'checking'}
									<span class="text-[11px] text-[var(--text-tertiary)]">&middot;</span>
									<span class="text-[11px] text-[var(--text-secondary)]"
										>Found: 245 Mbps down / 120 Mbps up</span
									>
								{/if}
							</div>
						</div>
					</div>

					<div class="flex-1"></div>

					<button
						class="w-full h-10 rounded-[6px] text-[13px] font-semibold cursor-pointer border-0 flex items-center justify-center gap-2 transition-opacity duration-150
							{allChecksPassed
							? 'bg-[var(--accent-base)] text-[#0C0C0E]'
							: 'bg-[var(--surface-3)] text-[var(--text-tertiary)] cursor-not-allowed'}"
						disabled={!allChecksPassed}
						onclick={goNext}
					>
						{#if allChecksPassed}
							Continue
							<ArrowRight size={14} strokeWidth={2} />
						{:else}
							<Loader2 size={14} class="animate-spin" />
							Scanning hardware...
						{/if}
					</button>
				</div>

			<!-- ═══ STEP 2: Staking ═══ -->
			{:else if currentStep === 'staking'}
				<div class="flex-1 flex flex-col gap-4">
					<!-- Staking card -->
					<div class="rounded-[8px] border border-[var(--border-accent)] bg-[var(--accent-subtle)] p-5">
						<div class="flex items-start gap-4">
							<div
								class="h-10 w-10 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border-default)] flex items-center justify-center shrink-0"
							>
								<Shield size={20} strokeWidth={1.5} class="text-[var(--text-accent)]" />
							</div>
							<div class="flex-1">
								<h3 class="text-[15px] font-semibold text-[var(--text-primary)]">
									Collateral Required
								</h3>
								<p class="text-[12px] text-[var(--text-secondary)] mt-1 leading-[1.5]">
									{appName} requires staking
									<span class="text-[var(--text-primary)] font-semibold font-mono"
										>{stakingAmount.toLocaleString()} NCR</span
									>
									as collateral. This protects the project and is returned when you exit.
								</p>
							</div>
						</div>
					</div>

					<!-- Slashing conditions -->
					<div
						class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4"
					>
						<div class="flex items-center gap-2 mb-3">
							<AlertTriangle size={13} strokeWidth={1.5} class="text-[var(--warning)]" />
							<span class="text-[12px] font-semibold text-[var(--warning)]"
								>Slashing Conditions</span
							>
						</div>
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between text-[12px]">
								<span class="text-[var(--text-secondary)]">Uptime below 95%</span>
								<span class="text-[var(--warning)] font-mono font-medium">-5% stake</span>
							</div>
							<div class="h-px bg-[var(--border-default)]"></div>
							<div class="flex items-center justify-between text-[12px]">
								<span class="text-[var(--text-secondary)]">Invalid proof submission</span>
								<span class="text-[var(--error)] font-mono font-medium">-100% stake</span>
							</div>
						</div>
					</div>

					<div class="flex-1"></div>

					<!-- Action buttons -->
					<div class="flex gap-3">
						<button
							onclick={onClose}
							class="flex-1 h-10 rounded-[6px] text-[13px] font-semibold cursor-pointer border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)]"
						>
							Cancel
						</button>
						<button
							class="flex-1 h-10 rounded-[6px] text-[13px] font-semibold cursor-pointer border-0 flex items-center justify-center gap-2
								{stakingStatus === 'idle'
								? 'bg-[var(--accent-base)] text-[#0C0C0E]'
								: stakingStatus === 'complete'
									? 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]'
									: 'bg-[var(--surface-3)] text-[var(--text-tertiary)] cursor-not-allowed'}"
							disabled={stakingStatus !== 'idle' && stakingStatus !== 'complete'}
							onclick={handleStake}
						>
							{#if stakingStatus === 'idle'}
								<Lock size={14} strokeWidth={1.5} />
								Approve & Stake
							{:else if stakingStatus === 'approving'}
								<Loader2 size={14} class="animate-spin" />
								Approving token...
							{:else if stakingStatus === 'staking'}
								<Loader2 size={14} class="animate-spin" />
								Staking...
							{:else}
								<CheckCircle2 size={14} strokeWidth={2} />
								Staked
							{/if}
						</button>
					</div>

					{#if stakingStatus === 'complete'}
						<button
							class="w-full h-10 rounded-[6px] text-[13px] font-semibold cursor-pointer border-0 flex items-center justify-center gap-2 bg-[var(--accent-base)] text-[#0C0C0E]"
							onclick={goNext}
						>
							Continue
							<ArrowRight size={14} strokeWidth={2} />
						</button>
					{/if}
				</div>

			<!-- ═══ STEP 3: Resources ═══ -->
			{:else if currentStep === 'resources'}
				<div class="flex-1 flex flex-col gap-4">
					<!-- Mode toggle -->
					<div
						class="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border-default)] self-start"
					>
						<button
							onclick={() => (installMode = 'auto')}
							class="px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all duration-150 flex items-center gap-1.5
								{installMode === 'auto'
								? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] border border-[var(--border-accent)]'
								: 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--text-primary)]'}"
						>
							<Server size={12} strokeWidth={1.5} />
							Auto Install
						</button>
						<button
							onclick={() => (installMode = 'cli')}
							class="px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all duration-150 flex items-center gap-1.5
								{installMode === 'cli'
								? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] border border-[var(--border-accent)]'
								: 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--text-primary)]'}"
						>
							<Terminal size={12} strokeWidth={1.5} />
							Manual CLI
						</button>
					</div>

					{#if installMode === 'auto'}
						<!-- Download progress -->
						<div
							class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4"
						>
							<div class="flex items-center justify-between mb-2">
								<span class="text-[12px] font-medium text-[var(--text-primary)] font-mono">
									necter/{safeName}:latest
								</span>
								<span
									class="text-[12px] text-[var(--text-secondary)] font-mono"
									style="font-feature-settings: 'tnum';"
								>
									{Math.round(downloadProgress)}%
								</span>
							</div>
							<!-- Progress bar -->
							<div class="w-full h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
								<div
									class="h-full rounded-full bg-[var(--accent-base)] transition-all duration-150"
									style="width: {downloadProgress}%;"
								></div>
							</div>
							<p class="text-[11px] text-[var(--text-tertiary)] mt-2">
								{downloadStage}
							</p>
						</div>

						<!-- What's being installed -->
						<div
							class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4"
						>
							<p
								class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-2"
							>
								Installing
							</p>
							<div class="flex flex-col gap-2">
								{#each [
									{ name: 'Container runtime', size: '48 MB' },
									{ name: 'Node client', size: '124 MB' },
									{ name: 'Proof engine', size: '67 MB' },
								] as item}
									<div class="flex items-center justify-between text-[12px]">
										<span class="text-[var(--text-secondary)]">{item.name}</span>
										<span class="text-[var(--text-tertiary)] font-mono">{item.size}</span>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<!-- CLI commands -->
						<div
							class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4"
						>
							<p
								class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
							>
								Run these commands on your machine
							</p>
							<div class="flex flex-col gap-2">
								{#each [
									{ command: cli.install, label: 'Install command' },
									{ command: cli.run, label: 'Run command' },
									{ command: cli.status, label: 'Status command' },
									{ command: cli.logs, label: 'Logs command' },
								] as row}
									<div
										class="flex items-center gap-2 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border-default)] px-3 py-2"
									>
										<span
											class="text-[11px] text-[var(--text-tertiary)] font-mono shrink-0"
											>$</span
										>
										<code
											class="text-[12px] font-mono text-[var(--text-primary)] flex-1 overflow-x-auto whitespace-nowrap"
											>{row.command}</code
										>
										<button
											onclick={() => handleCopy(row.command, row.label)}
											class="shrink-0 h-7 w-7 rounded-[4px] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-all duration-150 bg-transparent border-none cursor-pointer"
										>
											{#if copiedCommand === row.command}
												<Check size={13} strokeWidth={2} />
											{:else}
												<Copy size={13} strokeWidth={1.5} />
											{/if}
										</button>
									</div>
								{/each}
							</div>
						</div>

						<p class="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
							The Necter Miner CLI installs the runtime, connects to the JobManager, receives
							jobs, runs workloads, and submits proofs. Rewards are released from JobEscrow when
							proofs are verified.
						</p>

						<div class="flex-1"></div>

						<div class="flex gap-3">
							<a
								href="/learn/guides/real-miner-flow"
								class="flex-1 h-10 rounded-[6px] text-[13px] font-semibold border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] flex items-center justify-center gap-2 no-underline"
							>
								Full guide
								<ExternalLink size={12} strokeWidth={1.5} />
							</a>
							<button
								class="flex-1 h-10 rounded-[6px] text-[13px] font-semibold cursor-pointer border-0 flex items-center justify-center gap-2 bg-[var(--accent-base)] text-[#0C0C0E]"
								onclick={goNext}
							>
								I've run the commands
								<ArrowRight size={14} strokeWidth={2} />
							</button>
						</div>
					{/if}
				</div>

			<!-- ═══ STEP 4: Launch ═══ -->
			{:else if currentStep === 'launch'}
				<div
					class="flex-1 flex flex-col items-center justify-center text-center gap-5 py-4"
				>
					<!-- Success icon -->
					<div class="relative">
						<div
							class="h-16 w-16 rounded-full bg-[rgba(76,183,130,0.12)] flex items-center justify-center"
						>
							<CheckCircle2 size={28} strokeWidth={1.5} class="text-[var(--success)]" />
						</div>
						<div
							class="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[var(--surface-1)] border-2 border-[var(--surface-1)] flex items-center justify-center"
						>
							<CheckCircle2 size={16} strokeWidth={2} class="text-[var(--success)]" />
						</div>
					</div>

					<div>
						<h3
							class="text-[20px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]"
						>
							Node Active
						</h3>
						<p class="text-[13px] text-[var(--text-secondary)] mt-1 max-w-[360px]">
							Your {appName} node is live and ready to receive jobs. Keep the application running
							to earn rewards.
						</p>
					</div>

					<!-- Status indicators -->
					<div
						class="flex items-center gap-6 py-3 px-5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border-default)]"
					>
						<div class="flex items-center gap-2">
							<div class="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse"></div>
							<span class="text-[12px] text-[var(--text-secondary)]">Status</span>
							<span class="text-[12px] font-semibold text-[var(--success)]">Live</span>
						</div>
						<div class="h-4 w-px bg-[var(--border-default)]"></div>
						<div class="flex items-center gap-2">
							<Coins size={12} strokeWidth={1.5} class="text-[var(--text-accent)]" />
							<span class="text-[12px] text-[var(--text-secondary)]">Earnings</span>
							<span class="text-[12px] font-semibold text-[var(--text-primary)]">Active</span>
						</div>
					</div>

					<button
						class="w-full max-w-[320px] h-11 rounded-[6px] text-[14px] font-semibold cursor-pointer border-0 flex items-center justify-center gap-2 bg-[var(--accent-base)] text-[#0C0C0E]"
						onclick={handleComplete}
					>
						Open Dashboard
						<ArrowRight size={14} strokeWidth={2} />
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
