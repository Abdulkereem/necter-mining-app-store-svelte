<script lang="ts">
	/*
	 * First-party proof-of-work app listing (POW-APPS.md): "Monero" (the RandomX app: treasury target coin set by
	 * Necter, Tari merge-mined with Monero) and "Verus" (VerusHash 2.2). Web store: the listing, terms and disclosure.
	 * Local mode (miner dashboard / desktop app): the opt-in toggle (one PoW app per device), the CPU cap and live
	 * hashing status.
	 */
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import toast from 'svelte-french-toast';
	import { ChevronLeft, Cpu, ExternalLink, Layers, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-svelte';
	import { APP_MODE } from '$lib/config';
	import { useQuery } from '$lib/api/query.svelte';
	import {
		pow,
		POW_ICONS,
		deviceClassLabel,
		powHeadline,
		treasuryEarnsLabel,
		algorithmLabel,
		websiteHost,
		auxSummary,
		versionAtLeast,
		type PowTreasury
	} from '$lib/api/pow';
	import { minerApi, connectMiner, powDisclosureFor, powEnableBody, powMiningApp, type MinerPowStatus } from '$lib/local/miner';
	import { formatAmount } from '$lib/format';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import PowIcon from '$lib/components/pow/PowIcon.svelte';
	import CoinChip from '$lib/components/pow/CoinChip.svelte';

	const appId = $derived(page.params.app ?? '');
	const q = useQuery(() => pow.app(appId));
	const app = $derived(q.data ?? null);
	const icon = $derived(POW_ICONS[appId]);
	// Treasury metadata (what Necter earns); only the RandomX app has targets / merge mining to show.
	const treasuryQ = useQuery(() => pow.treasury(appId).catch((): PowTreasury | null => null), { enabled: () => !!app?.randomx });
	const treasury = $derived(treasuryQ.data ?? null);
	const headline = $derived(app ? powHeadline(app) : '');

	// ── local miner (desktop app / miner dashboard) ──
	let status = $state<MinerPowStatus | null>(null);
	let minerVersion = $state<string | null>(null);
	let minerError = $state<string | null>(null);
	let accepted = $state(false);
	let cpu = $state(50);
	let busy = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;

	async function refresh() {
		try {
			status = await minerApi.powStatus();
			minerError = null;
			if (!busy) cpu = status.settings.max_cpu_pct;
		} catch (e) {
			minerError = e instanceof Error ? e.message : 'miner not reachable';
		}
	}

	onMount(async () => {
		if (APP_MODE !== 'local') return;
		await connectMiner();
		await refresh();
		minerApi
			.status()
			.then((s) => (minerVersion = s.versions?.miner ?? null))
			.catch(() => {});
		timer = setInterval(refresh, 3000);
	});
	onDestroy(() => timer && clearInterval(timer));

	const disclosure = $derived(status ? powDisclosureFor(status, appId) : null);
	const minesThis = $derived(status ? powMiningApp(status, appId) : false);
	/** The other PoW app this device mines now (one app per device). */
	const minesOther = $derived(status && status.settings.enabled && !minesThis ? status.settings.app || status.app : null);
	const tooOld = $derived(!!(app?.min_miner_version && minerVersion && !versionAtLeast(minerVersion, app.min_miner_version)));

	async function enable() {
		if (!status || !app) return;
		const body = powEnableBody(status, appId, cpu);
		if (!body) {
			toast.error(`Update necter-miner to ${app.min_miner_version ?? 'the latest version'} or later to mine ${app.name}.`);
			return;
		}
		busy = true;
		try {
			status = await minerApi.powSet(body);
			accepted = false;
			toast.success(`${app.name} mining is on`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'could not change the setting');
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		try {
			status = await minerApi.powSet({ enabled: false });
			toast.success(`${app?.name ?? 'Proof-of-work'} mining is off`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'could not change the setting');
		} finally {
			busy = false;
		}
	}

	async function saveCpu() {
		busy = true;
		try {
			status = await minerApi.powSet({ max_cpu_pct: cpu });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'could not save');
		} finally {
			busy = false;
		}
	}

	const REASONS: Record<string, string> = {
		not_opted_in: 'Off — turn it on below to start.',
		not_compiled: 'This build of the miner does not include proof-of-work.',
		ios_excluded: 'Not available on iOS.',
		mobile_disabled: 'Not available on phones and tablets yet.',
		mobile_platform: 'Phones and tablets: Android only.',
		device_class: 'This device class cannot run this app.',
		insufficient_memory: 'This device does not have enough memory.',
		stopped: 'Paused — the miner is stopped.',
		thermal: 'Paused — the device is too warm.',
		battery_temp: 'Paused — the battery is too warm.',
		on_battery: 'Paused — running on battery; plug in to mine.',
		battery: 'Paused — battery level too low.',
		low_power_mode: 'Paused — low power mode is on.',
		user_active: 'Paused while you use the computer; resumes after 2 minutes idle.',
		memory: 'Paused — not enough free memory right now.',
		unbound: 'Paused — bind this device to your wallet first.',
		miner_update_required: 'Paused — the Hub needs a newer necter-miner for this app. Update the miner to keep mining.'
	};
	const decisionText = $derived.by(() => {
		const d = status?.decision;
		if (!d) return '';
		if (d.state === 'running') return `Mining with ${d.threads} thread${d.threads === 1 ? '' : 's'} (${d.mode} mode).`;
		return REASONS[d.reason ?? ''] ?? `${d.state}: ${d.reason}`;
	});
	const appName = (id: string) => (id === 'monero' ? 'Monero' : id === 'verus' ? 'Verus' : id);

	const chip = 'px-2 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]';
</script>

<svelte:head><title>{app?.name ?? 'Proof of work'} · Necter</title></svelte:head>

<div class="max-w-[860px] mx-auto px-4 md:px-6 py-5">
	<a href="/discover" class="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] no-underline mb-4">
		<ChevronLeft size={14} /> Discover
	</a>

	{#if q.error}
		<ErrorState error={q.error} retry={() => q.refresh()} />
	{:else if !app}
		<LoadingBlock />
	{:else}
		<header class="flex items-start gap-4 mb-5">
			<PowIcon appId={app.app_id} coin={app.coin} accent={app.accent_color} size={72} />
			<div class="min-w-0">
				<h1 class="text-[22px] md:text-[26px] font-semibold text-[var(--text-primary)] m-0">{app.name}</h1>
				<p class="text-[14px] text-[var(--text-secondary)] mt-1 mb-1">{app.tagline}</p>
				<p class="text-[12px] text-[var(--text-accent)] mt-0 mb-2" data-testid="pow-headline">{headline}</p>
				<div class="flex flex-wrap gap-1.5 text-[11px]">
					<span class={chip}>Necter default app</span>
					<span class={chip}>Proof of work · {algorithmLabel(app)}</span>
					<span class={chip}><Cpu size={10} class="inline -mt-px" /> {deviceClassLabel(app.device_classes)} only</span>
					{#if app.min_miner_version}
						<span class={chip}>Requires necter-miner {app.min_miner_version} or later</span>
					{/if}
				</div>
			</div>
		</header>

		{#if app.testnet_note}
			<div class="flex gap-2 p-3 mb-5 rounded-[8px] border border-[var(--accent-base)] bg-[var(--surface-1)] text-[13px] text-[var(--text-primary)]">
				<TriangleAlert size={16} class="shrink-0 mt-0.5 text-[var(--text-accent)]" />
				<span>{app.testnet_note}</span>
			</div>
		{/if}

		{#if !app.mobile_enabled}
			<p class="flex gap-2 items-start text-[12px] text-[var(--text-secondary)] mt-0 mb-5">
				<Smartphone size={14} class="shrink-0 mt-px text-[var(--text-tertiary)]" />
				{#if app.mobile_candidate}
					<span>Phones: off. {app.name} is the candidate if phone mining is ever enabled ({app.family_name} needs little memory and suits ARM).</span>
				{:else}
					<span>Phones and tablets: off for this app.</span>
				{/if}
			</p>
		{/if}

		{#if APP_MODE === 'local'}
			<section class="p-4 mb-5 rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)]">
				<h2 class="text-[15px] font-semibold text-[var(--text-primary)] m-0 mb-2">Mine on this device</h2>
				{#if minerError}
					<p class="text-[13px] text-[var(--text-secondary)] m-0">The local miner is not reachable: {minerError}</p>
				{:else if !status}
					<LoadingBlock />
				{:else if !status.compiled}
					<p class="text-[13px] text-[var(--text-secondary)] m-0">{REASONS.not_compiled}</p>
				{:else if tooOld || !disclosure}
					<p class="text-[13px] text-[var(--text-secondary)] m-0">
						{app.name} needs necter-miner {app.min_miner_version ?? 'a newer version'} or later{minerVersion ? ` (this device runs ${minerVersion})` : ''}. Update the miner to turn it on.
					</p>
				{:else}
					{#if minesThis}
						<p class="text-[13px] text-[var(--text-secondary)] mt-0 mb-3">{decisionText}</p>
					{:else if minesOther}
						<p class="text-[13px] text-[var(--text-secondary)] mt-0 mb-3">
							This device mines {appName(minesOther)} now. One device mines one proof-of-work app at a time: switching to {app.name} stops {appName(minesOther)} mining.
						</p>
					{:else}
						<p class="text-[13px] text-[var(--text-secondary)] mt-0 mb-3">{REASONS.not_opted_in}</p>
					{/if}
					{#if !minesThis}
						<div class="text-[13px] leading-relaxed text-[var(--text-primary)] p-3 rounded-[8px] bg-[var(--surface-2)] mb-3" data-testid="pow-disclosure">
							{disclosure.text}
						</div>
						<label class="flex items-start gap-2 text-[13px] text-[var(--text-primary)] mb-3">
							<input type="checkbox" bind:checked={accepted} class="mt-0.5" />
							<span>I understand that this device will mine {app.randomx ? `${app.family_name} coins` : app.name} for Necter and that I am paid in NECTA.</span>
						</label>
					{/if}
					<label class="block text-[13px] text-[var(--text-primary)] mb-3">
						CPU limit: <span class="font-mono">{cpu}%</span> of the processor cores
						<input type="range" min="10" max="100" step="5" bind:value={cpu} onchange={() => minesThis && saveCpu()}
							class="w-full mt-1" aria-label="CPU limit in percent" />
						<span class="text-[11px] text-[var(--text-tertiary)]">Default {app.default_cpu_pct}%. Laptops mine only on mains power; mining pauses while you use the computer and when it gets warm.</span>
					</label>
					{#if minesThis}
						<button type="button" class="px-4 py-2 rounded-[8px] border border-[var(--border-default)] text-[13px]" disabled={busy}
							onclick={disable}>Turn off {app.name} mining</button>
					{:else}
						<button type="button" class="px-4 py-2 rounded-[8px] bg-[var(--accent-base)] text-black text-[13px] font-medium disabled:opacity-50"
							disabled={busy || !accepted} onclick={enable}>{minesOther ? `Switch to ${app.name} mining` : `Turn on ${app.name} mining`}</button>
					{/if}
					{#if status.stats && minesThis}
						<dl class="grid grid-cols-3 gap-3 mt-4 text-[12px]">
							<div><dt class="text-[var(--text-tertiary)]">Hashrate</dt><dd class="m-0 font-mono">{status.stats.hashrate_hs} H/s</dd></div>
							<div><dt class="text-[var(--text-tertiary)]">Shares sent</dt><dd class="m-0 font-mono">{status.stats.shares.accepted}</dd></div>
							<div><dt class="text-[var(--text-tertiary)]">Rejected</dt><dd class="m-0 font-mono">{status.stats.shares.rejected}</dd></div>
						</dl>
						{#if status.stats.job?.algo || status.stats.job?.coin}
							<p class="text-[11px] text-[var(--text-tertiary)] mt-2 mb-0">Current job: <span class="font-mono">{status.stats.job.coin ?? ''} {status.stats.job.algo ?? ''}</span></p>
						{/if}
					{/if}
				{/if}
			</section>
		{/if}

		{#if app.randomx}
			<section class="p-4 mb-5 rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)]" data-testid="pow-treasury">
				<h2 class="text-[15px] font-semibold text-[var(--text-primary)] m-0 mb-1">Treasury target</h2>
				<p class="text-[13px] leading-relaxed text-[var(--text-secondary)] mt-0 mb-3">
					Necter sets which {app.family_name} coin its treasury mines. You are always paid in NECTA per verified share, whatever the target.
				</p>
				<div class="flex flex-wrap gap-1.5 mb-3">
					{#each app.randomx.targets as t (t.id)}
						<CoinChip coin={t.coin} name={t.name} active={t.active} note={t.active ? (t.default ? 'active · default' : 'active') : t.default ? 'default' : null} />
					{/each}
				</div>
				<p class="text-[13px] text-[var(--text-primary)] m-0 mb-3">
					Treasury earns: <span class="font-mono font-semibold text-[var(--text-accent)]">{treasuryEarnsLabel(app)}</span>
				</p>
				{#each app.merge_mining as mm (mm.id)}
					{@const total = treasury ? auxSummary(treasury, mm.id) : null}
					<div class="flex gap-2 items-start pt-3 border-t border-[var(--border-default)]">
						<Layers size={14} class="shrink-0 mt-0.5 text-[var(--text-tertiary)]" />
						<div class="min-w-0 text-[13px]">
							<div class="flex flex-wrap items-center gap-1.5 mb-1">
								<CoinChip coin={mm.coin} name={mm.name} active={mm.active} />
								<span class="text-[12px] text-[var(--text-secondary)]">
									merge-mined with {appName(mm.with)} · {mm.active ? (mm.mode === 'simulated' ? 'on (simulated on testnet)' : 'on') : `off while the target is not ${appName(mm.with)}`}
								</span>
							</div>
							<p class="text-[12px] leading-relaxed text-[var(--text-secondary)] m-0">{mm.note}</p>
							{#if total}
								<p class="text-[12px] text-[var(--text-primary)] mt-1 mb-0" data-testid="pow-aux-total">
									{mm.name}{total.mode === 'simulated' ? ' (simulated on testnet)' : ''}: <span class="font-mono">{total.blocks}</span>
									block{total.blocks === 1 ? '' : 's'} over the last {total.epochs} epoch{total.epochs === 1 ? '' : 's'}
								</p>
							{/if}
						</div>
					</div>
				{/each}
				<p class="text-[11px] text-[var(--text-tertiary)] mt-3 mb-0">Treasury figures are metadata only: your NECTA does not depend on them.</p>
			</section>

		{:else}
			<section class="p-4 mb-5 rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)]" data-testid="pow-treasury">
				<h2 class="text-[15px] font-semibold text-[var(--text-primary)] m-0 mb-2">Treasury</h2>
				<div class="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-primary)]">
					Treasury earns: <span class="font-mono font-semibold text-[var(--text-accent)]">{treasuryEarnsLabel(app)}</span>
				</div>
				<p class="text-[13px] leading-relaxed text-[var(--text-secondary)] mt-2 mb-0">
					Necter keeps the mined {app.name}. You are always paid in NECTA per verified share.
				</p>
			</section>
		{/if}

		<section class="mb-5">
			<h2 class="text-[15px] font-semibold text-[var(--text-primary)] mb-2">About</h2>
			<p class="text-[14px] leading-relaxed text-[var(--text-secondary)]">{app.description}</p>
			<ul class="text-[13px] leading-relaxed text-[var(--text-secondary)] pl-5">
				<li>Opt-in only and off by default. You choose the CPU limit (default {app.default_cpu_pct}% of the cores) and can turn it off at any time.</li>
				<li>Your device does {app.family_name} work; the Hub checks your shares with {app.family_name} before they count.</li>
				<li>Necter keeps the mined coins ({treasuryEarnsLabel(app)}). You are paid in NECTA per verified share, settled per epoch.</li>
				<li>One device mines one proof-of-work app at a time.</li>
				<li>Mining uses electricity and warms the device. You pay for the electricity, and earnings may be taxable where you live.</li>
			</ul>
		</section>

		<section class="mb-5">
			<h2 class="text-[15px] font-semibold text-[var(--text-primary)] mb-2">Terms on this network</h2>
			<dl class="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
				<div><dt class="text-[var(--text-tertiary)]">Mode</dt><dd class="m-0">{app.pool_mode === 'test' ? 'Pool test mode' : app.pool_mode}</dd></div>
				<div><dt class="text-[var(--text-tertiary)]">Share difficulty</dt><dd class="m-0 font-mono">{app.share_difficulty}</dd></div>
				<div><dt class="text-[var(--text-tertiary)]">Units per share</dt><dd class="m-0 font-mono">{app.units_per_share}</dd></div>
				<div><dt class="text-[var(--text-tertiary)]">Per unit</dt><dd class="m-0 font-mono">{formatAmount(app.reward.reward_per_unit)} NECTA</dd></div>
			</dl>
			<p class="text-[11px] text-[var(--text-tertiary)] mt-2 flex items-center gap-1"><ShieldCheck size={12} /> {app.reward.settlement}</p>
		</section>

		<footer class="text-[11px] leading-relaxed text-[var(--text-tertiary)] border-t border-[var(--border-default)] pt-3" data-testid="pow-credits">
			{#if icon}
				{icon.credit}, <a href={icon.license} target="_blank" rel="noopener noreferrer" class="underline">{icon.licenseName}</a>; used to name the coin, not an endorsement by {icon.owner}.
			{/if}
			{#if icon && (app.randomx || app.merge_mining.length)}
				Other coins are named in plain text; no other project's logo is used, and naming a coin does not imply that its project endorses Necter.
			{:else if !icon}
				{app.name} ({app.coin}) is named in plain text; no {app.name} logo is used, and naming the coin does not imply that its project endorses Necter.
			{/if}
			<a href={app.website} target="_blank" rel="noopener noreferrer" class="underline inline-flex items-center gap-0.5">{websiteHost(app.website)} <ExternalLink size={10} /></a>
		</footer>
	{/if}
</div>
