<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { ArrowLeft, CheckCircle2, AlertCircle, Cpu, Loader2, Smartphone, Laptop, Server, Monitor } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Compatibility, Device } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { balances, nectaOf, refreshBalances } from '$lib/stores/balances';
	import { subscribe } from '$lib/flows';
	import { DEVICE_CLASS_LABEL, formatAmount, formatToken, parseUnits, formatUnitsExact, bpToPercent, formatDuration } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	const NECTA_DECIMALS = 18;
	const id = $derived((page.params.id ?? '').toLowerCase());

	const projectQ = useQuery(() => hub.project(id));
	const economicsQ = useQuery(() => hub.economics(id));
	const devicesQ = useQuery(() => hub.myDevices({ limit: 200 }), { enabled: () => $signedIn });
	const subsQ = useQuery(() => hub.mySubscriptions({ project_id: id, limit: 200 }), { enabled: () => $signedIn });

	let nodeId = $state<string>('');
	let amount = $state('');
	let agreed = $state(false);
	let running = $state(false);
	let stepLabel = $state('');
	let compat = $state<Record<string, Compatibility | 'error'>>({});

	const minCollateral = $derived(economicsQ.data?.min_collateral ?? projectQ.data?.min_collateral ?? null);
	const subscribedNodes = $derived(new Set((subsQ.data?.items ?? []).filter((s) => s.status !== 'closed').map((s) => s.node_id)));
	const devices = $derived((devicesQ.data?.items ?? []) as Device[]);
	const selectable = $derived(devices.filter((d) => !subscribedNodes.has(d.node_id) && d.status !== 'banned'));

	$effect(() => {
		if (minCollateral && amount === '') amount = formatUnitsExact(minCollateral, NECTA_DECIMALS);
	});
	$effect(() => {
		if (!nodeId && selectable[0]) nodeId = selectable[0].node_id;
	});

	// Hub compatibility per device (PLATFORM.md §j.1 HardwareCompatibility).
	const requested = new Set<string>();
	$effect(() => {
		const list = selectable;
		const pid = id;
		for (const d of list) {
			if (requested.has(d.node_id)) continue;
			requested.add(d.node_id);
			hub.compatibility(pid, { node_id: d.node_id })
				.then((c) => (compat = { ...compat, [d.node_id]: c }))
				.catch(() => (compat = { ...compat, [d.node_id]: 'error' }));
		}
	});

	const amountWei = $derived.by(() => {
		try {
			return parseUnits(amount || '0', NECTA_DECIMALS);
		} catch {
			return null;
		}
	});
	const necta = $derived(nectaOf($balances));
	const belowMin = $derived(!!amountWei && !!minCollateral && BigInt(amountWei) < BigInt(minCollateral));
	const insufficient = $derived(!!amountWei && necta !== null && BigInt(amountWei) > BigInt(necta.amount));
	const selected = $derived(compat[nodeId]);
	const incompatible = $derived(selected !== undefined && selected !== 'error' && !selected.compatible);
	const canSubmit = $derived(!!nodeId && !!amountWei && amountWei !== '0' && !belowMin && !insufficient && agreed && !incompatible && !running);

	const classIcon = (c: Device['class']) => (c === 'phone' || c === 'tablet' ? Smartphone : c === 'server' ? Server : c === 'desktop' ? Monitor : Laptop);

	async function submit() {
		if (!amountWei) return;
		running = true;
		try {
			const sub = await subscribe(id, nodeId, amountWei, (s) => (stepLabel = s));
			void refreshBalances();
			toast.success(sub?.status === 'active' ? 'Subscribed — mining starts with the next snapshot' : 'Subscription submitted');
			if (sub) await goto(`/mining/${sub.subscription_id}`);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			running = false;
			stepLabel = '';
		}
	}
</script>

<svelte:head>
	<title>{projectQ.data ? `Mine ${projectQ.data.name}` : 'Subscribe'} · Necter</title>
</svelte:head>

<SignInGate title="Sign in to start mining" description="Subscribing bonds NECTA collateral for one of your devices. Sign in with the wallet your miner is bound to." illustration="platform">
	<div class="space-y-6 md:space-y-8 max-w-4xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-12">
		<a href="/apps/{id}" class="btn-secondary inline-flex items-center gap-2">
			<ArrowLeft class="h-4 w-4" /> Back to project
		</a>

		{#if projectQ.loading}
			<LoadingBlock rows={3} height="96px" />
		{:else if projectQ.error}
			<ErrorState error={projectQ.error} retry={projectQ.refresh} />
		{:else if !projectQ.data}
			<EmptyState illustration="platform" title="Project not found" description="It may not be listed yet, or the link is wrong.">
				<a href="/discover" class="btn-subscribe">Browse projects</a>
			</EmptyState>
		{:else}
			{@const p = projectQ.data}
			{@const eco = economicsQ.data}
			<div class="flex items-start gap-4 md:gap-6">
				<ProjectIcon project={p} size={72} />
				<div class="flex-1">
					<h1 class="text-[20px] font-semibold mb-2 text-[var(--text-primary)]">Mine {p.name}</h1>
					<p class="text-[13px] text-[var(--text-secondary)]">
						Pick a device, bond NECTA collateral and your miner starts receiving tasks from the next committee snapshot. No Sepolia ETH
						needed: you sign an EIP-712 bond and a NECTA permit, and the network relays them.
					</p>
				</div>
			</div>

			<div class="p-6 bg-[var(--accent-subtle)] border border-[var(--border-accent)] rounded-[8px]">
				<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
					<div>
						<p class="text-[12px] text-[var(--text-secondary)] mb-1">Recent average per miner per day</p>
						<p class="text-[24px] font-semibold text-[var(--text-accent)] mb-1 font-mono">
							{p.avg_daily_reward_per_miner ? formatToken(p.avg_daily_reward_per_miner, p.token, { maxFrac: 2 }) : '—'}
						</p>
						<p class="text-[12px] text-[var(--text-secondary)]">From recent epochs — not a guarantee</p>
					</div>
					<div class="md:text-right">
						<p class="text-[12px] text-[var(--text-secondary)] mb-1">Minimum collateral</p>
						<p class="text-[20px] font-semibold text-[var(--text-primary)] font-mono">{minCollateral ? `${formatAmount(minCollateral, NECTA_DECIMALS)} NECTA` : '—'}</p>
					</div>
				</div>
			</div>

			<!-- Device -->
			<div>
				<h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-4">1. Choose a device</h2>
				{#if devicesQ.loading}
					<LoadingBlock rows={2} height="72px" />
				{:else if devicesQ.error}
					<ErrorState error={devicesQ.error} retry={devicesQ.refresh} />
				{:else if devices.length === 0}
					<EmptyState
						illustration="compute"
						title="No devices bound to this wallet yet"
						description="Install the Necter miner on a phone, laptop, desktop or server and bind it to this wallet. The device then appears here."
					>
						<a href="/mining/hardware-checker" class="btn-subscribe">Install the miner</a>
					</EmptyState>
				{:else if selectable.length === 0}
					<EmptyState illustration="compute" compact title="All your devices already mine this project" description="Manage them under My Mining.">
						<a href="/mining/subscriptions" class="btn-secondary">My subscriptions</a>
					</EmptyState>
				{:else}
					<div class="p-4 md:p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] space-y-3" role="radiogroup">
						{#each selectable as d (d.node_id)}
							{@const c = compat[d.node_id]}
							{@const Icon = classIcon(d.class)}
							<label class="flex items-start justify-between gap-3 p-4 rounded-[8px] bg-[var(--surface-2)] cursor-pointer border {nodeId === d.node_id ? 'border-[var(--border-accent)]' : 'border-transparent'}">
								<div class="flex items-start gap-3">
									<input type="radio" name="device" value={d.node_id} bind:group={nodeId} class="mt-3 accent-[var(--accent-base)]" />
									<div class="h-10 w-10 rounded-[8px] flex items-center justify-center shrink-0 bg-[var(--accent-subtle)]">
										<Icon class="h-5 w-5 text-[var(--text-accent)]" />
									</div>
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)]">{d.label ?? d.node_id}</p>
										<p class="text-[12px] text-[var(--text-secondary)]">
											{d.class ? DEVICE_CLASS_LABEL[d.class] : 'Device'} · {d.hardware?.cpu_cores ?? '—'} cores · {d.hardware?.ram_mb ? `${Math.round(d.hardware.ram_mb / 1024)} GB RAM` : '—'} · {d.status}
										</p>
										{#if c && c !== 'error'}
											{#each [...c.missing, ...c.warnings] as m}<p class="text-[11px] text-[var(--text-tertiary)]">• {m}</p>{/each}
										{/if}
									</div>
								</div>
								{#if c === undefined}
									<Loader2 class="h-5 w-5 animate-spin text-[var(--text-tertiary)] shrink-0" />
								{:else if c === 'error'}
									<span class="text-[11px] text-[var(--text-tertiary)]">Check unavailable</span>
								{:else if c.compatible}
									<div class="text-right shrink-0">
										<CheckCircle2 class="h-6 w-6 text-[var(--text-accent)] ml-auto" />
										{#if c.est_monthly_reward}<p class="text-[11px] text-[var(--text-secondary)] font-mono mt-1">~{formatToken(c.est_monthly_reward, p.token, { maxFrac: 1 })}/mo</p>{/if}
									</div>
								{:else}
									<AlertCircle class="h-6 w-6 text-[var(--error)] shrink-0" />
								{/if}
							</label>
						{/each}
					</div>
				{/if}
			</div>

			{#if selectable.length > 0}
				<!-- Collateral -->
				<div>
					<h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-4">2. Bond collateral</h2>
					<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
						<label for="collateral" class="text-[12px] font-medium text-[var(--text-secondary)] block mb-2">Amount (NECTA)</label>
						<div class="flex items-center gap-2">
							<input
								id="collateral"
								inputmode="decimal"
								bind:value={amount}
								class="flex-1 h-[40px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[15px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent-base)]"
							/>
							<span class="text-[13px] text-[var(--text-secondary)]">NECTA</span>
						</div>
						<div class="flex flex-wrap justify-between gap-2 mt-2 text-[12px]">
							<span class="text-[var(--text-tertiary)]">Wallet balance: <span class="font-mono text-[var(--text-secondary)]">{necta ? formatAmount(necta.amount, NECTA_DECIMALS, { maxFrac: 2 }) : '—'} NECTA</span></span>
							{#if amountWei === null}<span class="text-[var(--error)]">Enter a valid amount</span>
							{:else if belowMin}<span class="text-[var(--error)]">Below the project minimum</span>
							{:else if insufficient}<span class="text-[var(--warning)]">Not enough NECTA — <a href="/faucet" class="text-[var(--text-accent)]">get testnet NECTA</a></span>{/if}
						</div>
						{#if eco}
							<p class="text-[12px] text-[var(--text-tertiary)] mt-4">
								Collateral weights your committee seats (capped) and can be slashed by up to {bpToPercent(eco.slashing_bp?.invalid_result)} for a proven invalid result.
								Disputes are possible for {formatDuration(eco.dispute_window_secs)}. Leaving starts a 24-hour unbonding period.
							</p>
						{/if}
					</div>
				</div>

				<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
					<div class="flex items-center gap-3 mb-6 p-4 rounded-[8px] bg-[var(--surface-2)]">
						<input type="checkbox" id="terms" bind:checked={agreed} class="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-base)] cursor-pointer" />
						<label for="terms" class="text-[13px] text-[var(--text-primary)] cursor-pointer">
							I understand collateral is bonded on Sepolia and can be slashed for invalid results or equivocation.
						</label>
					</div>
					<div class="flex flex-col-reverse md:flex-row gap-3">
						<button type="button" class="btn-subscribe flex-1 inline-flex items-center justify-center gap-2" disabled={!canSubmit} style="opacity:{canSubmit || running ? 1 : 0.4}" onclick={submit} data-testid="subscribe-submit">
							{#if running}<Loader2 class="h-4 w-4 animate-spin" />{stepLabel || 'Working…'}{:else}<Cpu class="h-4 w-4" />Subscribe & start mining{/if}
						</button>
						<a href="/apps/{id}" class="btn-secondary text-center">Cancel</a>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</SignInGate>
