<script lang="ts">
	/*
	 * First-party proof-of-work app listing (POW-APPS.md): "Monero". Web store: the listing, terms and disclosure.
	 * Local mode (miner dashboard / desktop app): the opt-in toggle, the CPU cap and live hashing status.
	 */
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import toast from 'svelte-french-toast';
	import { ChevronLeft, Cpu, ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-svelte';
	import { APP_MODE } from '$lib/config';
	import { useQuery } from '$lib/api/query.svelte';
	import { pow, POW_ICONS, deviceClassLabel } from '$lib/api/pow';
	import { minerApi, connectMiner, type MinerPowStatus } from '$lib/local/miner';
	import { formatAmount } from '$lib/format';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	const appId = $derived(page.params.app ?? '');
	const q = useQuery(() => pow.app(appId));
	const app = $derived(q.data ?? null);
	const icon = $derived(POW_ICONS[appId]);

	// ── local miner (desktop app / miner dashboard) ──
	let status = $state<MinerPowStatus | null>(null);
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
		timer = setInterval(refresh, 3000);
	});
	onDestroy(() => timer && clearInterval(timer));

	async function setEnabled(on: boolean) {
		if (!status) return;
		busy = true;
		try {
			status = on
				? await minerApi.powSet({ enabled: true, accepted_disclosure: status.disclosure.version, app: appId, max_cpu_pct: cpu })
				: await minerApi.powSet({ enabled: false });
			toast.success(on ? 'Monero mining is on' : 'Monero mining is off');
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
		unbound: 'Paused — bind this device to your wallet first.'
	};
	const decisionText = $derived.by(() => {
		const d = status?.decision;
		if (!d) return '';
		if (d.state === 'running') return `Mining with ${d.threads} thread${d.threads === 1 ? '' : 's'} (${d.mode} mode).`;
		return REASONS[d.reason ?? ''] ?? `${d.state}: ${d.reason}`;
	});
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
			{#if icon}
				<img src={icon.src} alt="{app.name} logo" width="72" height="72" class="rounded-[16px] bg-white p-1.5 shrink-0" />
			{/if}
			<div class="min-w-0">
				<h1 class="text-[22px] md:text-[26px] font-semibold text-[var(--text-primary)] m-0">{app.name}</h1>
				<p class="text-[14px] text-[var(--text-secondary)] mt-1 mb-2">{app.tagline}</p>
				<div class="flex flex-wrap gap-1.5 text-[11px]">
					<span class="px-2 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">Necter default app</span>
					<span class="px-2 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">Proof of work · RandomX</span>
					<span class="px-2 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
						<Cpu size={10} class="inline -mt-px" /> {deviceClassLabel(app.device_classes)} only
					</span>
				</div>
			</div>
		</header>

		{#if app.testnet_note}
			<div class="flex gap-2 p-3 mb-5 rounded-[8px] border border-[var(--accent-base)] bg-[var(--surface-1)] text-[13px] text-[var(--text-primary)]">
				<TriangleAlert size={16} class="shrink-0 mt-0.5 text-[var(--text-accent)]" />
				<span>{app.testnet_note}</span>
			</div>
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
				{:else}
					<p class="text-[13px] text-[var(--text-secondary)] mt-0 mb-3">{decisionText}</p>
					{#if !status.settings.enabled}
						<div class="text-[13px] leading-relaxed text-[var(--text-primary)] p-3 rounded-[8px] bg-[var(--surface-2)] mb-3">
							{status.disclosure.text}
						</div>
						<label class="flex items-start gap-2 text-[13px] text-[var(--text-primary)] mb-3">
							<input type="checkbox" bind:checked={accepted} class="mt-0.5" />
							<span>I understand that this device will mine Monero for Necter and that I am paid in NECTA.</span>
						</label>
					{/if}
					<label class="block text-[13px] text-[var(--text-primary)] mb-3">
						CPU limit: <span class="font-mono">{cpu}%</span> of the processor cores
						<input type="range" min="10" max="100" step="5" bind:value={cpu} onchange={() => status?.settings.enabled && saveCpu()}
							class="w-full mt-1" aria-label="CPU limit in percent" />
						<span class="text-[11px] text-[var(--text-tertiary)]">Default 50%. Laptops mine only on mains power; mining pauses while you use the computer and when it gets warm.</span>
					</label>
					{#if status.settings.enabled}
						<button type="button" class="px-4 py-2 rounded-[8px] border border-[var(--border-default)] text-[13px]" disabled={busy}
							onclick={() => setEnabled(false)}>Turn off Monero mining</button>
					{:else}
						<button type="button" class="px-4 py-2 rounded-[8px] bg-[var(--accent-base)] text-black text-[13px] font-medium disabled:opacity-50"
							disabled={busy || !accepted} onclick={() => setEnabled(true)}>Turn on Monero mining</button>
					{/if}
					{#if status.stats && status.settings.enabled}
						<dl class="grid grid-cols-3 gap-3 mt-4 text-[12px]">
							<div><dt class="text-[var(--text-tertiary)]">Hashrate</dt><dd class="m-0 font-mono">{status.stats.hashrate_hs} H/s</dd></div>
							<div><dt class="text-[var(--text-tertiary)]">Shares sent</dt><dd class="m-0 font-mono">{status.stats.shares.accepted}</dd></div>
							<div><dt class="text-[var(--text-tertiary)]">Rejected</dt><dd class="m-0 font-mono">{status.stats.shares.rejected}</dd></div>
						</dl>
					{/if}
				{/if}
			</section>
		{/if}

		<section class="mb-5">
			<h2 class="text-[15px] font-semibold text-[var(--text-primary)] mb-2">About</h2>
			<p class="text-[14px] leading-relaxed text-[var(--text-secondary)]">{app.description}</p>
			<ul class="text-[13px] leading-relaxed text-[var(--text-secondary)] pl-5">
				<li>Opt-in only and off by default. You choose the CPU limit (default 50% of the cores) and can turn it off at any time.</li>
				<li>Your device does RandomX work; the Hub checks your shares with RandomX before they count.</li>
				<li>Necter keeps the mined Monero. You are paid in NECTA per verified share, settled per epoch.</li>
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

		<footer class="text-[11px] text-[var(--text-tertiary)] border-t border-[var(--border-default)] pt-3">
			{#if icon}
				{icon.credit}, <a href={icon.license} target="_blank" rel="noopener noreferrer" class="underline">CC BY-SA 4.0</a>; used to name the coin, not an endorsement by the Monero Project.
			{/if}
			<a href={app.website} target="_blank" rel="noopener noreferrer" class="underline inline-flex items-center gap-0.5">getmonero.org <ExternalLink size={10} /></a>
		</footer>
	{/if}
</div>
