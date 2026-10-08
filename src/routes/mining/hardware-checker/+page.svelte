<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckCircle2, AlertCircle, XCircle, Cpu, Download, Terminal, Smartphone, RefreshCw, Loader2 } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { collectPages, errorMessage } from '$lib/api/http';
	import type { Compatibility, Device, DeviceClass, Engine, HardwareProfile, ProjectSummary } from '$lib/api/types';
	import { APP_MODE, MINER_DOWNLOADS } from '$lib/config';
	import { minerApi, minerConnection, waitMinerRequest, type MinerHardware } from '$lib/local/miner';
	import { signedIn } from '$lib/stores/wallet';
	import { DEVICE_CLASS_LABEL, formatMb, formatToken, categoryShort } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	type Source = 'manual' | 'miner' | 'device';
	type Row = { project: ProjectSummary; result: Compatibility | null; error: string | null };

	const CLASSES: DeviceClass[] = ['phone', 'tablet', 'laptop', 'desktop', 'server'];

	let source = $state<Source>(APP_MODE === 'local' ? 'miner' : 'manual');

	// Manual profile (web mode). Values are what the Hub compares against scheduling.requirements.
	let deviceClass = $state<DeviceClass>('laptop');
	let engine = $state<Engine>('native');
	let cpuCores = $state(8);
	let ramGb = $state(16);
	let storageGb = $state(100);
	let battery = $state(true);

	// Local miner profile
	let minerHw = $state<MinerHardware | null>(null);
	let minerError = $state<string | null>(null);
	let benchmarking = $state(false);

	// Bound devices (signed in)
	let devices = $state<Device[]>([]);
	let deviceId = $state<string>('');

	let projects = $state<ProjectSummary[] | null>(null);
	let projectsError = $state<unknown>(null);
	let rows = $state<Row[]>([]);
	let checking = $state(false);

	const os = $derived.by(() => {
		if (typeof navigator === 'undefined') return 'linux';
		const ua = navigator.userAgent.toLowerCase();
		if (/iphone|ipad|ios/.test(ua)) return 'ios';
		if (/android/.test(ua)) return 'android';
		if (/mac os|macintosh/.test(ua)) return 'macos';
		if (/windows/.test(ua)) return 'windows';
		return 'linux';
	});

	const downloads = [
		{ id: 'macos', label: 'macOS', sub: 'Desktop app (.dmg) · Apple silicon & Intel', href: MINER_DOWNLOADS.macos, icon: Download },
		{ id: 'windows', label: 'Windows', sub: 'Desktop app (.msi)', href: MINER_DOWNLOADS.windows, icon: Download },
		{ id: 'linux', label: 'Linux', sub: 'AppImage / .deb / .rpm, or the server daemon', href: MINER_DOWNLOADS.linux, icon: Terminal },
		{ id: 'android', label: 'Android', sub: 'Mobile app (mines while charging)', href: MINER_DOWNLOADS.android, icon: Smartphone },
		{ id: 'ios', label: 'iOS', sub: 'Mobile app (foreground & charging windows)', href: MINER_DOWNLOADS.ios, icon: Smartphone }
	] as const;

	function manualProfile(): HardwareProfile {
		return {
			cpu_cores: Math.max(0, Math.floor(cpuCores)),
			cpu_threads: Math.max(0, Math.floor(cpuCores)),
			ram_mb: Math.max(0, Math.round(ramGb * 1024)),
			storage_free_mb: Math.max(0, Math.round(storageGb * 1024)),
			gpu: null,
			battery
		};
	}

	async function loadProjects() {
		projectsError = null;
		try {
			projects = await collectPages((cursor) => hub.projects({ limit: 100, cursor }), 200);
		} catch (e) {
			projectsError = e;
			projects = null;
		}
	}

	async function loadMiner() {
		minerError = null;
		try {
			minerHw = await minerApi.hardware();
		} catch (e) {
			minerHw = null;
			minerError = errorMessage(e);
		}
	}

	async function runBenchmark() {
		benchmarking = true;
		try {
			const { request_id } = await minerApi.runBenchmark();
			const r = await waitMinerRequest(request_id, 300_000);
			if (r.state === 'failed') minerError = r.error ?? 'Benchmark failed';
			await loadMiner();
		} catch (e) {
			minerError = errorMessage(e);
		} finally {
			benchmarking = false;
		}
	}

	async function loadDevices() {
		try {
			devices = (await hub.myDevices({ limit: 200 })).items ?? [];
			if (!deviceId && devices[0]) deviceId = devices[0].node_id;
		} catch {
			devices = [];
		}
	}

	function requestBody() {
		if (source === 'device' && deviceId) return { node_id: deviceId };
		if (source === 'miner' && minerHw) {
			return {
				// The Hub requires `class` without a node_id and an integer benchmark score.
				class: (minerHw.class as DeviceClass | undefined) ?? deviceClass,
				engine: (minerHw.engine as Engine | undefined) ?? undefined,
				hardware: minerHw.hardware,
				benchmark_score: minerHw.benchmark?.score != null ? Math.round(minerHw.benchmark.score) : undefined
			};
		}
		return { class: deviceClass, engine, hardware: manualProfile() };
	}

	/** Runs the Hub compatibility check for every listed project (4 at a time). */
	async function check() {
		if (!projects) return;
		checking = true;
		const body = requestBody();
		const out: Row[] = projects.map((p) => ({ project: p, result: null, error: null }));
		let next = 0;
		async function worker() {
			while (next < out.length) {
				const i = next++;
				try {
					out[i].result = await hub.compatibility(out[i].project.project_id, body);
				} catch (e) {
					out[i].error = errorMessage(e);
				}
			}
		}
		await Promise.all(Array.from({ length: Math.min(4, out.length) }, worker));
		rows = out;
		checking = false;
	}

	onMount(() => {
		void loadProjects();
		if (APP_MODE === 'local') void loadMiner();
	});

	$effect(() => {
		if ($signedIn) void loadDevices();
	});

	// Re-check whenever the inputs change (debounced).
	$effect(() => {
		void [source, deviceClass, engine, cpuCores, ramGb, storageGb, battery, deviceId, minerHw, projects];
		const t = setTimeout(() => void check(), 350);
		return () => clearTimeout(t);
	});

	const tier = (r: Row) => (r.result ? r.result.tier : 'error');
	const compatibleRows = $derived(rows.filter((r) => tier(r) === 'compatible'));
	const marginalRows = $derived(rows.filter((r) => tier(r) === 'marginal'));
	const incompatibleRows = $derived(rows.filter((r) => tier(r) === 'incompatible'));
	const errorRows = $derived(rows.filter((r) => tier(r) === 'error'));

	const inputStyle =
		'width:100%;padding:8px 12px;border:1px solid var(--border-default);border-radius:5px;background:var(--surface-0);color:var(--text-primary);font-size:13px;outline:none';
	const labelStyle = 'font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:8px';
</script>

<svelte:head>
	<title>Hardware checker · Necter</title>
</svelte:head>

<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12">
	<div style="margin-bottom:24px">
		<h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]" style="margin-bottom:4px">Hardware Compatibility Checker</h1>
		<p class="text-[13px] text-[var(--text-secondary)]" style="max-width:640px">
			{#if APP_MODE === 'local'}
				Your miner reported this device's hardware. See which projects it can join and what they paid recent miners.
			{:else}
				Enter your device's specs — or pick a device you already bound — to see which projects you can mine. For an exact
				profile and benchmark, install the Necter miner.
			{/if}
		</p>
	</div>

	{#if APP_MODE !== 'local'}
		<section class="hw-install mb-6" data-testid="install-miner">
			<div class="flex items-start gap-4 flex-wrap md:flex-nowrap">
				<img src="/brand/3d/compute.png" alt="" class="h-[72px] w-auto flex-shrink-0 hidden sm:block" />
				<div class="flex-1 min-w-0">
					<h2 class="text-[15px] font-semibold text-[var(--text-primary)]">Install the Necter miner</h2>
					<p class="text-[12px] text-[var(--text-secondary)] mt-1 max-w-[620px]">
						The miner profiles your hardware, runs the benchmark suite and binds the device to your wallet. Desktop and mobile
						apps open this store locally with your real device data.
					</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 mt-4">
						{#each downloads as d (d.id)}
							{@const Icon = d.icon}
							{#if d.href}
								<a href={d.href} class="hw-dl {os === d.id ? 'hw-dl--current' : ''}" rel="noopener">
									<Icon class="h-4 w-4" strokeWidth={1.7} />
									<span class="font-medium">{d.label}</span>
									<span class="hw-dl__sub">{d.sub}</span>
								</a>
							{:else}
								<div class="hw-dl hw-dl--soon {os === d.id ? 'hw-dl--current' : ''}" title="Release not published yet">
									<Icon class="h-4 w-4" strokeWidth={1.7} />
									<span class="font-medium">{d.label} <span class="hw-soon">Soon</span></span>
									<span class="hw-dl__sub">{d.sub}</span>
								</div>
							{/if}
						{/each}
					</div>
					<p class="text-[11px] text-[var(--text-tertiary)] mt-3 font-mono">
						Servers: <span class="text-[var(--text-secondary)]">docker run -d -v necter:/data {MINER_DOWNLOADS.docker}</span> · then
						<span class="text-[var(--text-secondary)]">necter-miner bind --owner &lt;your wallet&gt;</span>
					</p>
				</div>
			</div>
		</section>
	{/if}

	<div class="hw-grid">
		<!-- Hardware input -->
		<div>
			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:24px;position:sticky;top:16px">
				<h2 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Your hardware</h2>

				<div class="flex gap-1 p-1 rounded-[6px] bg-[var(--surface-0)] mb-4" role="tablist">
					{#if APP_MODE === 'local'}
						<button type="button" class="hw-tab {source === 'miner' ? 'hw-tab--on' : ''}" onclick={() => (source = 'miner')}>This device</button>
					{/if}
					<button type="button" class="hw-tab {source === 'manual' ? 'hw-tab--on' : ''}" onclick={() => (source = 'manual')}>Manual</button>
					{#if $signedIn && devices.length > 0}
						<button type="button" class="hw-tab {source === 'device' ? 'hw-tab--on' : ''}" onclick={() => (source = 'device')}>My devices</button>
					{/if}
				</div>

				{#if source === 'miner'}
					{#if $minerConnection.state === 'absent'}
						<p class="text-[12px] text-[var(--warning)]">The miner's local API is not reachable. Is necter-miner running?</p>
					{:else if minerError}
						<p class="text-[12px] text-[var(--error)]">{minerError}</p>
						<button type="button" class="btn-secondary mt-3" style="width:100%" onclick={loadMiner}>Retry</button>
					{:else if !minerHw}
						<LoadingBlock rows={4} height="28px" />
					{:else}
						{@const hw = minerHw.hardware}
						<dl class="hw-dl-list">
							<div><dt>Class</dt><dd>{minerHw.class ? DEVICE_CLASS_LABEL[minerHw.class as DeviceClass] ?? minerHw.class : '—'}</dd></div>
							<div><dt>CPU</dt><dd>{hw.cpu_model ?? '—'} · {hw.cpu_cores ?? '—'} cores</dd></div>
							<div><dt>RAM</dt><dd>{formatMb(hw.ram_mb)}</dd></div>
							<div><dt>Free storage</dt><dd>{formatMb(hw.storage_free_mb)}</dd></div>
							<div><dt>Network</dt><dd class="capitalize">{hw.network ?? '—'}</dd></div>
							<div><dt>OS</dt><dd>{hw.os ?? '—'} · {hw.arch ?? ''}</dd></div>
							<div><dt>Engine</dt><dd>{minerHw.engine ?? '—'}</dd></div>
							<div><dt>Benchmark</dt><dd>{minerHw.benchmark ? `${minerHw.benchmark.score} (${minerHw.benchmark.suite})` : 'not run'}</dd></div>
						</dl>
						<button type="button" class="btn-secondary mt-4 inline-flex items-center justify-center gap-2" style="width:100%" onclick={runBenchmark} disabled={benchmarking}>
							{#if benchmarking}<Loader2 class="h-3.5 w-3.5 animate-spin" />Running benchmark…{:else}<RefreshCw class="h-3.5 w-3.5" />Run benchmark{/if}
						</button>
					{/if}
				{:else if source === 'device'}
					<label for="hw-device" style={labelStyle}>Bound device</label>
					<select id="hw-device" bind:value={deviceId} style={inputStyle}>
						{#each devices as d (d.node_id)}
							<option value={d.node_id}>{d.label ?? d.node_id} · {d.class ? DEVICE_CLASS_LABEL[d.class] : ''}</option>
						{/each}
					</select>
					<p class="text-[11px] text-[var(--text-tertiary)] mt-2">Uses the profile and benchmark the device reported to the network.</p>
				{:else}
					<div style="display:flex;flex-direction:column;gap:14px">
						<div>
							<label for="hw-class" style={labelStyle}>Device type</label>
							<select id="hw-class" bind:value={deviceClass} style={inputStyle}>
								{#each CLASSES as c (c)}<option value={c}>{DEVICE_CLASS_LABEL[c]}</option>{/each}
							</select>
						</div>
						<div>
							<label for="hw-cpu" style={labelStyle}>CPU cores</label>
							<input id="hw-cpu" type="number" min="1" max="512" bind:value={cpuCores} style={inputStyle} />
						</div>
						<div>
							<label for="hw-ram" style={labelStyle}>RAM (GB)</label>
							<input id="hw-ram" type="number" min="0" step="1" bind:value={ramGb} style={inputStyle} />
						</div>
						<div>
							<label for="hw-storage" style={labelStyle}>Free storage (GB)</label>
							<input id="hw-storage" type="number" min="0" step="1" bind:value={storageGb} style={inputStyle} />
						</div>
						<div>
							<label for="hw-engine" style={labelStyle}>Execution engine</label>
							<select id="hw-engine" bind:value={engine} style={inputStyle}>
								<option value="native">Native (desktop, server, Android)</option>
								<option value="pulley64">Pulley 64-bit (iOS)</option>
								<option value="pulley32">Pulley 32-bit (older Android)</option>
							</select>
						</div>
						<label class="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer">
							<input type="checkbox" bind:checked={battery} /> Runs on battery
						</label>
						<p class="text-[11px] text-[var(--text-tertiary)]">
							GPU requirements are not used on the testnet yet. Benchmark-gated projects need the miner's measured score.
						</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Results -->
		<div style="display:flex;flex-direction:column;gap:24px">
			{#if projectsError}
				<ErrorState error={projectsError} retry={loadProjects} />
			{:else if projects === null || (checking && rows.length === 0)}
				<LoadingBlock rows={3} height="140px" />
			{:else if projects.length === 0}
				<EmptyState
					illustration="platform"
					title="No projects to check against yet"
					description="Projects appear here as soon as the first ones are listed on the testnet. Install the miner now so your device is ready."
				>
					<a href="/discover" class="btn-secondary">Browse Discover</a>
				</EmptyState>
			{:else}
				{#if checking}
					<p class="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5"><Loader2 class="h-3 w-3 animate-spin" /> Checking {projects.length} projects…</p>
				{/if}
				{#each [
					{ list: compatibleRows, label: 'Fully compatible', icon: CheckCircle2, color: 'var(--success)' },
					{ list: marginalRows, label: 'Marginal', icon: AlertCircle, color: 'var(--warning)' },
					{ list: incompatibleRows, label: 'Incompatible', icon: XCircle, color: 'var(--error)' }
				] as group (group.label)}
					{#if group.list.length > 0}
						{@const Icon = group.icon}
						<div>
							<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
								<Icon size={20} style="color:{group.color}" />
								<h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">{group.label} ({group.list.length})</h3>
							</div>
							<div style="display:flex;flex-direction:column;gap:16px">
								{#each group.list as row (row.project.project_id)}
									{@render compatibilityCard(row)}
								{/each}
							</div>
						</div>
					{/if}
				{/each}
				{#if errorRows.length > 0}
					<p class="text-[12px] text-[var(--text-tertiary)]">{errorRows.length} project(s) could not be checked right now.</p>
				{/if}
			{/if}
		</div>
	</div>
</div>

{#snippet compatibilityCard(row: Row)}
	{@const r = row.result!}
	{@const c = r.tier}
	{@const borderColor = c === 'compatible' ? 'rgba(76,183,130,0.20)' : c === 'marginal' ? 'rgba(242,153,74,0.20)' : 'rgba(235,87,87,0.20)'}
	{@const bgColor = c === 'compatible' ? 'rgba(76,183,130,0.05)' : c === 'marginal' ? 'rgba(242,153,74,0.05)' : 'rgba(235,87,87,0.05)'}
	{@const badgeColor = c === 'compatible' ? 'var(--success)' : c === 'marginal' ? 'var(--warning)' : 'var(--error)'}
	{@const badgeBg = c === 'compatible' ? 'rgba(76,183,130,0.12)' : c === 'marginal' ? 'rgba(242,153,74,0.12)' : 'rgba(235,87,87,0.12)'}
	{@const badgeLabel = c === 'compatible' ? 'Compatible' : c === 'marginal' ? 'Marginal' : 'Incompatible'}
	{@const pct = Math.max(0, Math.min(100, Math.round((r.match_bp ?? 0) / 100)))}

	<div style="border:2px solid {borderColor};background:{bgColor};border-radius:8px;padding:16px" data-testid="compat-card">
		<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
			<ProjectIcon project={row.project} size={36} rounded="8px" />
			<div>
				<h4 style="font-size:13px;font-weight:600;color:var(--text-primary)">{row.project.name}</h4>
				<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
					<span style="font-size:11px;font-weight:500;padding:0 6px;height:20px;display:inline-flex;align-items:center;border-radius:3px;background:{badgeBg};color:{badgeColor}">{badgeLabel}</span>
					<span style="font-size:11px;color:var(--text-tertiary)">{pct}% match · {categoryShort(row.project.category)}</span>
				</div>
			</div>
		</div>

		<div style="height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden;margin-bottom:12px">
			<div style="height:100%;width:{pct}%;background:{badgeColor};border-radius:2px"></div>
		</div>

		<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px">
			<div>
				<p style="font-size:12px;color:var(--text-secondary)">Est. monthly reward</p>
				<p style="font-size:13px;font-weight:700;color:var(--text-accent);font-family:var(--font-mono)">
					{r.est_monthly_reward ? formatToken(r.est_monthly_reward, row.project.token, { maxFrac: 2 }) : '—'}
				</p>
				<p style="font-size:10px;color:var(--text-tertiary)">From recent epochs; not guaranteed</p>
			</div>
			<div>
				<p style="font-size:12px;color:var(--text-secondary)">Performance</p>
				<p style="font-size:13px;font-weight:700;color:var(--text-primary);text-transform:capitalize">{r.performance ?? '—'}</p>
			</div>
		</div>

		{#if r.missing.length > 0 || r.warnings.length > 0}
			<div style="background:var(--surface-0);border-radius:5px;padding:8px;margin-bottom:12px">
				{#if r.missing.length > 0}
					<p style="font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px">Missing requirements:</p>
					<ul style="font-size:11px;color:var(--text-tertiary);list-style:none;padding:0;margin:0 0 6px;display:flex;flex-direction:column;gap:4px">
						{#each r.missing as req}<li>&#8226; {req}</li>{/each}
					</ul>
				{/if}
				{#if r.warnings.length > 0}
					<p style="font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px">Notes:</p>
					<ul style="font-size:11px;color:var(--text-tertiary);list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
						{#each r.warnings as w}<li>&#8226; {w}</li>{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<a href="/apps/{row.project.project_id}" class={c === 'compatible' ? 'btn-subscribe' : 'btn-secondary'} style="display:block;width:100%;text-align:center">
			{c === 'compatible' ? 'Open project (start mining)' : 'View project'}
		</a>
	</div>
{/snippet}

<style>
	.hw-grid {
		display: grid;
		grid-template-columns: minmax(260px, 1fr) 2fr;
		gap: 32px;
	}
	@media (max-width: 900px) {
		.hw-grid {
			grid-template-columns: 1fr;
		}
	}
	.hw-install {
		padding: 20px;
		border-radius: 10px;
		border: 1px solid var(--border-accent);
		background:
			radial-gradient(ellipse at 100% 0%, rgba(255, 201, 51, 0.08), transparent 55%),
			var(--surface-1);
	}
	.hw-dl {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		border-radius: 8px;
		border: 1px solid var(--border-default);
		background: var(--surface-2);
		color: var(--text-primary);
		font-size: 13px;
		text-decoration: none;
		transition: border-color 120ms;
	}
	a.hw-dl:hover {
		border-color: var(--border-accent);
	}
	.hw-dl--current {
		border-color: var(--border-accent);
	}
	.hw-dl--soon {
		opacity: 0.75;
		cursor: default;
	}
	.hw-dl__sub {
		font-size: 11px;
		color: var(--text-tertiary);
	}
	.hw-soon {
		margin-left: 4px;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-tertiary);
		background: var(--surface-3);
		padding: 1px 5px;
		border-radius: 3px;
	}
	.hw-tab {
		flex: 1;
		height: 28px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.hw-tab--on {
		background: var(--surface-3);
		color: var(--text-primary);
	}
	.hw-dl-list {
		display: grid;
		gap: 8px;
		margin: 0;
	}
	.hw-dl-list div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 12px;
	}
	.hw-dl-list dt {
		color: var(--text-tertiary);
	}
	.hw-dl-list dd {
		margin: 0;
		color: var(--text-primary);
		text-align: right;
	}
</style>
