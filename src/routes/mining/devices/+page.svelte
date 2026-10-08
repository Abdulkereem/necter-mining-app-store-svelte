<script lang="ts">
	import { Monitor, Server, Laptop, Cpu, Smartphone, Tablet, ChevronLeft, ChevronDown, Wifi, HardDrive, Clock, Pencil, Check, X, Gauge, Unlink, Terminal, Battery, MapPin } from 'lucide-svelte';
	import toast from 'svelte-french-toast';
	import { hub } from '$lib/api/hub';
	import { errorMessage } from '$lib/api/http';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Device } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { bpToPercent, formatMb, formatNumber, formatDate, timeAgo, DEVICE_CLASS_LABEL } from '$lib/format';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import CopyText from '$lib/components/common/CopyText.svelte';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import { deviceStatus, ENGINE_LABEL, PLATFORM_LABEL, subStatus } from '$lib/components/mining/labels';
	import { iconProject } from '$lib/components/mining/projects.svelte';

	const typeIcons: Record<string, typeof Monitor> = {
		phone: Smartphone,
		tablet: Tablet,
		laptop: Laptop,
		desktop: Monitor,
		server: Server
	};

	const devicesQ = useQuery(() => hub.myDevices({ limit: 200 }), { enabled: () => $signedIn });
	const subsQ = useQuery(() => hub.mySubscriptions({ limit: 200 }), { enabled: () => $signedIn });
	const groupsQ = useQuery(() => hub.deviceGroups(), { enabled: () => $signedIn });

	let devices = $derived(devicesQ.data?.items ?? []);
	let subsById = $derived(new Map((subsQ.data?.items ?? []).map((s) => [s.subscription_id, s])));
	let groupName = $derived(new Map((groupsQ.data?.items ?? []).map((g) => [g.group_id, g.name])));

	let expandedDevice = $state<string | null>(null);
	let onlineCount = $derived(devices.filter((d) => d.status === 'online').length);
	let units7d = $derived(devices.reduce((s, d) => s + (d.units_7d ?? 0), 0));
	let avgUptime = $derived.by(() => {
		const withUptime = devices.filter((d) => d.uptime_bp_7d !== undefined);
		if (withUptime.length === 0) return null;
		return Math.round(withUptime.reduce((s, d) => s + (d.uptime_bp_7d ?? 0), 0) / withUptime.length);
	});

	// label editing
	let editing = $state<string | null>(null);
	let draft = $state('');
	let saving = $state(false);

	function startEdit(d: Device) {
		editing = d.node_id;
		draft = d.label ?? '';
	}

	async function saveLabel(d: Device) {
		const label = draft.trim().slice(0, 64);
		saving = true;
		try {
			const updated = await hub.updateDevice(d.node_id, { label });
			devicesQ.set({ ...(devicesQ.data ?? { items: [], next_cursor: null }), items: devices.map((x) => (x.node_id === d.node_id ? { ...x, ...updated } : x)) });
			editing = null;
			toast.success('Device renamed');
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			saving = false;
		}
	}

	function hwChips(d: Device): string[] {
		const h = d.hardware;
		if (!h) return [];
		const out: string[] = [];
		if (h.gpu && typeof h.gpu === 'object' && h.gpu.model) out.push(h.gpu.model);
		if (h.cpu_model) out.push(h.cpu_model);
		if (h.ram_mb) out.push(`${formatMb(h.ram_mb)} RAM`);
		return out;
	}

	function lastSeenText(d: Device) {
		if (d.status === 'online') return 'Now';
		return timeAgo(d.last_seen_at);
	}
</script>

<svelte:head>
	<title>Devices — Necter Mining App Store</title>
</svelte:head>

<SignInGate title="Connect your wallet" description="Sign in to see the devices bound to your wallet." illustration="compute">
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
		<!-- Header -->
		<div class="mb-6">
			<div class="flex items-center gap-3 mb-1">
				<a href="/mining" class="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors no-underline" aria-label="Back to My Mining">
					<ChevronLeft size={16} strokeWidth={1.5} />
				</a>
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Devices</h1>
			</div>
			<p class="text-[13px] text-[var(--text-secondary)] ml-7">
				Machines bound to your wallet. A device adds itself when the Necter miner signs a binding with this wallet.
			</p>
		</div>

		<!-- Stats grid -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)] overflow-hidden rounded-[8px] border border-[var(--border-default)] mb-6">
			{#each [
				{ label: 'Devices', value: devicesQ.data ? devices.length.toString() : '—' },
				{ label: 'Online', value: devicesQ.data ? `${onlineCount} of ${devices.length}` : '—' },
				{ label: 'Units (7d)', value: devicesQ.data ? formatNumber(units7d) : '—' },
				{ label: 'Avg Uptime (7d)', value: bpToPercent(avgUptime) }
			] as s (s.label)}
				<div class="bg-[var(--surface-1)] p-3">
					<span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">{s.label}</span>
					<p class="text-[18px] font-semibold font-mono text-[var(--text-primary)] mt-1">{s.value}</p>
				</div>
			{/each}
		</div>

		<!-- How devices are added -->
		<div class="mb-6 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4 flex items-start gap-3">
			<div class="w-9 h-9 rounded-[8px] bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
				<Terminal class="h-4 w-4 text-[var(--text-accent)]" strokeWidth={1.6} />
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-[13px] font-semibold text-[var(--text-primary)]">Add a device</p>
				<p class="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-[18px]">
					Install the miner on the machine, then run <code class="font-mono text-[11px] px-1 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-primary)]">necter-miner bind</code>
					(or use “Bind wallet” in the desktop / mobile app). It shows a binding message for this wallet to sign; once both the wallet and the device key have
					signed, the device appears here. Phones and servers without a wallet can use the miner's embedded wallet.
				</p>
			</div>
			<a href="/mining/hardware-checker" class="btn-secondary no-underline shrink-0 hidden sm:inline-flex">Check hardware</a>
		</div>

		<!-- Device list -->
		{#if devicesQ.loading && !devicesQ.data}
			<LoadingBlock rows={3} height="96px" />
		{:else if devicesQ.error}
			<ErrorState error={devicesQ.error} retry={devicesQ.refresh} />
		{:else if devices.length === 0}
			<EmptyState
				illustration="compute"
				title="No devices bound yet"
				description="Install the Necter miner on a phone, laptop or server and bind it to this wallet. It will appear here automatically."
			>
				<a href="/mining/hardware-checker" class="btn-subscribe no-underline">Check your hardware</a>
				<a href="/learn" class="btn-secondary no-underline">How mining works</a>
			</EmptyState>
		{:else}
			<div class="space-y-3">
				{#each devices as device (device.node_id)}
					{@const TypeIcon = (device.class && typeIcons[device.class]) || Cpu}
					{@const status = deviceStatus(device.status)}
					{@const isExpanded = expandedDevice === device.node_id}
					{@const chips = hwChips(device)}

					<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
						<!-- Main card -->
						<div class="flex items-start gap-4 p-4 hover:bg-[var(--surface-2)] transition-colors">
							<div class="relative flex-shrink-0">
								<div class="w-11 h-11 rounded-[10px] bg-[var(--surface-3)] flex items-center justify-center">
									<TypeIcon class="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
								</div>
								<div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-1)]" style="background:{status.color}"></div>
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex flex-wrap items-center gap-2 mb-1">
									{#if editing === device.node_id}
										<input
											class="h-7 px-2 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-base)] w-[200px]"
											bind:value={draft}
											maxlength="64"
											placeholder="Device name"
											aria-label="Device name"
											onkeydown={(e) => {
												if (e.key === 'Enter') saveLabel(device);
												if (e.key === 'Escape') editing = null;
											}}
										/>
										<button type="button" class="p-1 bg-transparent border-none cursor-pointer text-[var(--success)]" disabled={saving} onclick={() => saveLabel(device)} aria-label="Save name">
											<Check class="h-4 w-4" />
										</button>
										<button type="button" class="p-1 bg-transparent border-none cursor-pointer text-[var(--text-tertiary)]" onclick={() => (editing = null)} aria-label="Cancel">
											<X class="h-4 w-4" />
										</button>
									{:else}
										<h3 class="text-[14px] font-semibold text-[var(--text-primary)] truncate">{device.label || device.node_id}</h3>
										<button type="button" class="p-0.5 bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" onclick={() => startEdit(device)} aria-label="Rename device">
											<Pencil class="h-3 w-3" />
										</button>
									{/if}
									{#if device.class}
										<span class="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[var(--text-tertiary)] uppercase">{DEVICE_CLASS_LABEL[device.class]}</span>
									{/if}
									<span class="text-[10px] font-medium" style="color:{status.color}" title={device.status_reason ?? status.hint ?? ''}>{status.label}</span>
									{#if device.group_id && groupName.get(device.group_id)}
										<span class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--accent-subtle)] text-[var(--text-accent)]">{groupName.get(device.group_id)}</span>
									{/if}
								</div>

								{#if chips.length > 0}
									<div class="flex flex-wrap gap-1.5 mb-2">
										{#each chips as c (c)}
											<span class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] font-mono">{c}</span>
										{/each}
									</div>
								{/if}

								<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
									<span>{device.subscriptions?.length ?? 0} subscription{(device.subscriptions?.length ?? 0) === 1 ? '' : 's'}</span>
									<span class="font-mono">{formatNumber(device.units_7d)} units (7d)</span>
									<span>{bpToPercent(device.uptime_bp_7d)} uptime</span>
									{#if device.benchmark}<span class="flex items-center gap-1"><Gauge class="h-3 w-3" /> score {device.benchmark.score}</span>{/if}
									<span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {lastSeenText(device)}</span>
								</div>
							</div>

							<button
								type="button"
								onclick={() => (expandedDevice = isExpanded ? null : device.node_id)}
								class="bg-transparent border-none cursor-pointer p-1 mt-0.5"
								aria-label={isExpanded ? 'Collapse' : 'Expand'}
							>
								<ChevronDown class="h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-150 {isExpanded ? 'rotate-180' : ''}" strokeWidth={1.5} />
							</button>
						</div>

						{#if isExpanded}
							<div class="border-t border-[var(--border-default)] p-4 space-y-4">
								<div>
									<p class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2">Hardware & runtime</p>
									<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
										{#each [
											{ icon: Cpu, label: 'CPU', value: device.hardware?.cpu_model ? `${device.hardware.cpu_model}${device.hardware.cpu_cores ? ` · ${device.hardware.cpu_cores} cores` : ''}` : '—' },
											{ icon: HardDrive, label: 'RAM', value: formatMb(device.hardware?.ram_mb) },
											{ icon: HardDrive, label: 'Free storage', value: formatMb(device.hardware?.storage_free_mb) },
											{ icon: Cpu, label: 'GPU', value: device.hardware?.gpu && typeof device.hardware.gpu === 'object' ? `${device.hardware.gpu.model ?? 'GPU'}${device.hardware.gpu.vram_mb ? ` (${formatMb(device.hardware.gpu.vram_mb)})` : ''}` : 'None' },
											{ icon: Wifi, label: 'Network', value: device.hardware?.network ?? '—' },
											{ icon: Battery, label: 'Battery', value: device.hardware?.battery === undefined ? '—' : device.hardware.battery ? 'Yes' : 'No' },
											{ icon: Monitor, label: 'Platform', value: `${device.platform ? PLATFORM_LABEL[device.platform] ?? device.platform : '—'}${device.os_version ? ` ${device.os_version}` : ''}${device.arch ? ` · ${device.arch}` : ''}` },
											{ icon: Gauge, label: 'Engine', value: device.engine ? ENGINE_LABEL[device.engine] ?? device.engine : '—' },
											{ icon: Gauge, label: 'Benchmark', value: device.benchmark ? `${device.benchmark.score} (${device.benchmark.suite})` : 'Not run' },
											{ icon: Terminal, label: 'Miner / NDSR', value: `${device.miner_version ?? '—'} / ${device.ndsr_version ?? '—'}` },
											{ icon: MapPin, label: 'Region', value: device.region ?? '—' },
											{ icon: Clock, label: 'Connected since', value: device.connected_since ? timeAgo(device.connected_since) : '—' }
										] as spec (spec.label)}
											<div class="flex items-center gap-2 p-2 rounded-[5px] bg-[var(--surface-2)]">
												<spec.icon class="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" strokeWidth={1.5} />
												<div class="min-w-0">
													<p class="text-[10px] text-[var(--text-tertiary)]">{spec.label}</p>
													<p class="text-[11px] text-[var(--text-primary)] font-mono truncate">{spec.value}</p>
												</div>
											</div>
										{/each}
									</div>
								</div>

								{#if (device.subscriptions?.length ?? 0) > 0}
									<div>
										<p class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2">Subscriptions</p>
										<div class="flex flex-wrap gap-2">
											{#each device.subscriptions ?? [] as sid (sid)}
												{@const s = subsById.get(sid)}
												<a
													href="/mining/{encodeURIComponent(sid)}"
													class="flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors no-underline"
												>
													{#if s}
														<ProjectIcon project={iconProject(s.project_id, s.project_name)} size={20} rounded="3px" />
														<span class="text-[11px] text-[var(--text-primary)]">{s.project_name ?? 'Project'}</span>
														<span class="text-[10px]" style="color: {subStatus(s.status).color};">{subStatus(s.status).label}</span>
													{:else}
														<span class="text-[11px] font-mono text-[var(--text-primary)]">{sid.slice(0, 10)}…</span>
													{/if}
												</a>
											{/each}
										</div>
									</div>
								{/if}

								<div class="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-default)]">
									<span class="flex items-center gap-1">Node ID: <CopyText value={device.node_id} short={false} class="!text-[10px]" /></span>
									<span>Bound: {formatDate(device.created_at)}</span>
									<button
										type="button"
										disabled
										title="Unbinding is signed by the device key or by your wallet over the unbind message — use the miner app."
										class="inline-flex items-center gap-1 h-6 px-2 rounded-[4px] border border-[var(--border-default)] bg-transparent text-[10px] text-[var(--text-tertiary)] cursor-not-allowed opacity-70"
									>
										<Unlink class="h-3 w-3" /> Unbind from the miner app
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</SignInGate>
