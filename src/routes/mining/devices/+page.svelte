<script lang="ts">
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, showConnectModal } from '$lib/stores/wallet';
	import { appIconDataUri } from '$lib/app-icon';
	import {
		Monitor,
		Server,
		Laptop,
		Cpu,
		ChevronLeft,
		ChevronDown,
		Wifi,
		HardDrive,
		Clock
	} from 'lucide-svelte';

	const typeIcons: Record<string, typeof Monitor> = {
		desktop: Monitor,
		server: Server,
		laptop: Laptop,
		custom: Cpu
	};

	const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
		online: { label: 'Online', color: 'var(--success)', dot: 'rgba(76,183,130,0.3)' },
		offline: { label: 'Offline', color: 'var(--text-tertiary)', dot: 'transparent' },
		idle: { label: 'Idle', color: 'var(--warning)', dot: 'rgba(242,153,74,0.3)' }
	};

	let minerId = $derived($actor?.minerId ?? null);

	let devices = $derived(minerId ? backend.listDevices(minerId) : []);
	let appsById = $derived(new Map($backendState.apps.map((a) => [a.id, a])));

	let expandedDevice = $state<string | null>(null);

	let totalEarned = $derived(devices.reduce((sum, d) => sum + d.totalEarned, 0));
	let onlineCount = $derived(devices.filter((d) => d.status === 'online').length);
	let avgUptime = $derived(
		devices.length > 0 ? devices.reduce((sum, d) => sum + d.uptime, 0) / devices.length : 0
	);

	function lastSeenText(device: (typeof devices)[0]) {
		if (device.status === 'online') return 'Now';
		const sec = Math.floor((Date.now() - new Date(device.lastSeenAt).getTime()) / 1000);
		if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
		if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
		return `${Math.floor(sec / 86400)}d ago`;
	}
</script>

{#if !$actor}
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
		<div class="text-center" style="padding-top:120px">
			<p class="text-[13px] text-[var(--text-secondary)] mb-4">
				Connect your wallet to view your devices.
			</p>
			<button class="btn-pill" onclick={() => showConnectModal.set(true)}>Connect Wallet</button>
		</div>
	</div>
{:else}
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
		<!-- Header -->
		<div class="mb-6">
			<div class="flex items-center gap-3 mb-1">
				<a
					href="/mining"
					class="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors no-underline"
				>
					<ChevronLeft size={16} strokeWidth={1.5} />
				</a>
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
					Devices
				</h1>
			</div>
			<p class="text-[13px] text-[var(--text-secondary)] ml-7">
				Machines running Necter with your account. Devices are detected automatically when you
				install and sign in.
			</p>
		</div>

		<!-- Stats grid: 4-col desktop, 2-col mobile -->
		<div
			class="grid grid-cols-2 md:grid-cols-4 overflow-hidden rounded-[8px] border border-[var(--border-default)] mb-6"
			style="gap:1px;background:var(--border-default)"
		>
			{#each [
				{ label: 'Devices', value: devices.length.toString() },
				{ label: 'Online', value: `${onlineCount} of ${devices.length}` },
				{ label: 'Total Earned', value: `$${totalEarned.toFixed(0)}` },
				{ label: 'Avg Uptime', value: `${avgUptime.toFixed(1)}%` }
			] as s (s.label)}
				<div style="background:var(--surface-1);padding:12px 14px">
					<span
						style="font-size:10px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em"
						>{s.label}</span
					>
					<p
						style="font-size:18px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary);margin:4px 0 0"
					>
						{s.value}
					</p>
				</div>
			{/each}
		</div>

		<!-- Device list -->
		{#if devices.length === 0}
			<div
				class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-12 text-center"
			>
				<Cpu class="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" strokeWidth={1} />
				<p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
					No devices detected
				</p>
				<p class="text-[13px] text-[var(--text-secondary)] max-w-[360px] mx-auto">
					Install the Necter miner on your machine and sign in with this wallet. Your device will
					appear here automatically.
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each devices as device (device.id)}
					{@const TypeIcon = typeIcons[device.type] ?? Cpu}
					{@const status = statusConfig[device.status] ?? statusConfig.offline}
					{@const isExpanded = expandedDevice === device.id}

					<div
						class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden"
					>
						<!-- Main card -->
						<button
							type="button"
							onclick={() => (expandedDevice = isExpanded ? null : device.id)}
							class="w-full text-left bg-transparent border-none cursor-pointer p-4 hover:bg-[var(--surface-2)] transition-colors"
						>
							<div class="flex items-start gap-4">
								<!-- Icon + status -->
								<div class="relative flex-shrink-0">
									<div
										class="w-11 h-11 rounded-[10px] bg-[var(--surface-3)] flex items-center justify-center"
									>
										<TypeIcon class="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
									</div>
									<div
										class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-1)]"
										style="background:{status.color};box-shadow:0 0 6px {status.dot}"
									></div>
								</div>

								<!-- Info -->
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<h3 class="text-[14px] font-semibold text-[var(--text-primary)] truncate">
											{device.name}
										</h3>
										<span
											class="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[var(--text-tertiary)] uppercase"
											>{device.type}</span
										>
										<span class="text-[10px] font-medium" style="color:{status.color}"
											>{status.label}</span
										>
									</div>

									<!-- Hardware specs -->
									<div class="flex flex-wrap gap-1.5 mb-2">
										{#if device.hardware.gpu}
											<span
												class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] font-mono"
												>{device.hardware.gpu}</span
											>
										{/if}
										{#if device.hardware.cpu}
											<span
												class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] font-mono"
												>{device.hardware.cpu}</span
											>
										{/if}
										{#if device.hardware.ram}
											<span
												class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] font-mono"
												>{device.hardware.ram}</span
											>
										{/if}
									</div>

									<!-- Stats row -->
									<div class="flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
										<span
											>{device.subscribedAppIds.length} project{device.subscribedAppIds
												.length !== 1
												? 's'
												: ''}</span
										>
										<span class="font-mono text-[var(--text-accent)]"
											>${device.totalEarned.toFixed(2)}</span
										>
										<span>{device.uptime.toFixed(1)}% uptime</span>
										<span class="flex items-center gap-1"
											><Clock class="h-3 w-3" /> {lastSeenText(device)}</span
										>
									</div>
								</div>

								<!-- Expand chevron -->
								<ChevronDown
									class="h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-150 flex-shrink-0 mt-1 {isExpanded
										? 'rotate-180'
										: ''}"
									strokeWidth={1.5}
								/>
							</div>
						</button>

						<!-- Expanded details -->
						{#if isExpanded}
							<div class="border-t border-[var(--border-default)] p-4 space-y-4">
								<!-- Hardware grid -->
								<div>
									<p
										class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2"
									>
										Hardware
									</p>
									<div class="grid grid-cols-2 gap-2">
										{#each [
											{
												icon: Cpu,
												label: 'GPU',
												value: device.hardware.gpu
													? `${device.hardware.gpu}${device.hardware.gpuVram ? ` (${device.hardware.gpuVram}GB)` : ''}`
													: 'None'
											},
											{
												icon: Cpu,
												label: 'CPU',
												value: `${device.hardware.cpu ?? 'Unknown'}${device.hardware.cpuCores ? ` \u00b7 ${device.hardware.cpuCores} cores` : ''}`
											},
											{
												icon: HardDrive,
												label: 'RAM',
												value: device.hardware.ram ?? 'Unknown'
											},
											{
												icon: HardDrive,
												label: 'Storage',
												value: device.hardware.storage ?? 'Unknown'
											},
											{
												icon: Wifi,
												label: 'Bandwidth',
												value: device.hardware.bandwidth ?? 'Unknown'
											},
											{
												icon: Monitor,
												label: 'Location',
												value: device.location ?? 'Unknown'
											}
										] as spec (spec.label)}
											<div
												class="flex items-center gap-2 p-2 rounded-[5px] bg-[var(--surface-2)]"
											>
												<spec.icon
													class="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0"
													strokeWidth={1.5}
												/>
												<div>
													<p class="text-[10px] text-[var(--text-tertiary)]">{spec.label}</p>
													<p class="text-[11px] text-[var(--text-primary)] font-mono">
														{spec.value}
													</p>
												</div>
											</div>
										{/each}
									</div>
								</div>

								<!-- Subscribed projects -->
								{#if device.subscribedAppIds.length > 0}
									<div>
										<p
											class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2"
										>
											Running Projects
										</p>
										<div class="flex flex-wrap gap-2">
											{#each device.subscribedAppIds as appId (appId)}
												{@const app = appsById.get(appId)}
												{#if app}
													<a
														href="/apps/{appId}"
														class="flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors no-underline"
													>
														<img
															src={app.icon ||
																appIconDataUri({
																	id: app.id,
																	name: app.name,
																	category: app.category
																})}
															alt=""
															class="w-5 h-5 rounded-[3px]"
														/>
														<span class="text-[11px] text-[var(--text-primary)]"
															>{app.name}</span
														>
													</a>
												{/if}
											{/each}
										</div>
									</div>
								{/if}

								<!-- Meta -->
								<div
									class="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-default)]"
								>
									<span>Device ID: <span class="font-mono">{device.id}</span></span>
									<span
										>Registered: {new Date(device.createdAt).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}</span
									>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
