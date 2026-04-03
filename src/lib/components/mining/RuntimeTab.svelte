<script lang="ts">
	import type { Subscription } from '$lib/types';
	import { HardDrive, Activity, Cpu } from 'lucide-svelte';
	import { showToast } from '$lib/stores/toast';
	import AreaChart from '$lib/components/AreaChart.svelte';

	let {
		subscription,
		resourceChartData,
		resourceChartMetric,
		usageRange,
		resourceAllocation,
		onResourceChartMetricChange,
		onUsageRangeChange,
		onResourceAllocationChange
	}: {
		subscription: Subscription;
		resourceChartData: { labels: string[]; data: number[] };
		resourceChartMetric: 'cpu' | 'gpu' | 'memory' | 'storage' | 'network';
		usageRange: '24h' | '7d' | '30d';
		resourceAllocation: { cpu: number; memory: number; storage: number; gpu: number };
		onResourceChartMetricChange: (m: 'cpu' | 'gpu' | 'memory' | 'storage' | 'network') => void;
		onUsageRangeChange: (r: '24h' | '7d' | '30d') => void;
		onResourceAllocationChange: (key: string, value: number) => void;
	} = $props();
</script>

<div class="space-y-6">
	<!-- Resource usage chart + reallocation -->
	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<h3
			class="text-[14px] font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"
		>
			NDSR Container Resources
		</h3>
		<p class="text-[13px] text-[var(--text-secondary)] mb-4">
			Resource usage and allocation for your NDSR container on this project.
		</p>

		<div class="mb-3">
			<p
				class="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2"
			>
				Chart: usage over time
			</p>
			<div class="flex flex-wrap gap-2">
				{#each ['cpu', 'gpu', 'memory', 'storage', 'network'] as m}
					<button
						type="button"
						class="rounded-[5px] text-[12px] font-medium h-7 px-2 flex items-center gap-1.5 {resourceChartMetric === m
							? 'bg-[var(--accent)] text-[#0C0C0E]'
							: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
						onclick={() => onResourceChartMetricChange(m as any)}
					>
						{#if m === 'cpu'}<Cpu class="h-3.5 w-3.5" />{/if}
						{#if m === 'storage'}<HardDrive class="h-3.5 w-3.5" />{/if}
						{#if m === 'network'}<Activity class="h-3.5 w-3.5" />{/if}
						{m === 'cpu'
							? 'CPU'
							: m === 'gpu'
								? 'GPU'
								: m === 'memory'
									? 'Memory'
									: m === 'storage'
										? 'Storage'
										: 'Network'}
					</button>
				{/each}
			</div>
		</div>
		<div class="flex flex-wrap gap-2 mb-4">
			{#each ['24h', '7d', '30d'] as r}
				<button
					type="button"
					class="rounded-[5px] text-[12px] font-medium h-7 px-2 {usageRange === r
						? 'bg-[var(--accent)] text-[#0C0C0E]'
						: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
					onclick={() => onUsageRangeChange(r as any)}
				>
					{r}
				</button>
			{/each}
		</div>
		<!-- Resource usage chart -->
		<div class="rounded-[8px] bg-[var(--surface-2)] overflow-hidden">
			<AreaChart data={resourceChartData.data} labels={resourceChartData.labels} color={resourceChartMetric === 'cpu' ? '#6E9FFF' : resourceChartMetric === 'gpu' ? '#A78BFA' : resourceChartMetric === 'memory' ? '#F2994A' : resourceChartMetric === 'storage' ? '#4CB782' : '#E06C9F'} height={220} />
		</div>

		<div class="mt-6 pt-6 border-t border-[var(--border)]">
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Reallocate resources (partition for this project)
			</h4>
			<p class="text-[13px] text-[var(--text-secondary)] mb-4">
				Set the share of each resource type dedicated to this subscription.
			</p>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{#each ['cpu', 'memory', 'storage', 'gpu'] as key}
					<div>
						<label
							class="text-[13px] font-medium text-[var(--text-primary)] capitalize"
							>{key}</label
						>
						<div class="flex items-center gap-3 mt-2">
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								value={resourceAllocation[key as keyof typeof resourceAllocation]}
								oninput={(e) =>
									onResourceAllocationChange(key, Number((e.target as HTMLInputElement).value))}
								class="w-full"
							/>
							<span
								class="text-[13px] font-semibold font-mono text-[var(--text-primary)] tabular-nums w-10"
								>{resourceAllocation[key as keyof typeof resourceAllocation]}%</span
							>
						</div>
					</div>
				{/each}
			</div>
			<button
				type="button"
				class="btn-subscribe mt-4"
				onclick={() => showToast('Allocation updated. Resource partition applied.')}
			>
				Apply allocation
			</button>
		</div>
	</div>

	<!-- NDSR Container status -->
	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<h3
			class="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
		>
			NDSR Container
		</h3>
		<div class="flex flex-wrap items-center gap-4">
			<span
				class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)]"
			>
				<span
					class="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse"
				></span>
				Running
			</span>
			<span class="text-[13px] text-[var(--text-secondary)]"
				>Container: ndsr-{subscription?.id?.slice(0, 8) ?? '—'}</span
			>
			<span class="text-[13px] text-[var(--text-secondary)] font-mono"
				>Uptime: {(subscription?.uptime ?? 0).toFixed(1)}%</span
			>
		</div>
	</div>

	<!-- Detailed resource metrics -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<!-- Storage -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4
				class="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"
			>
				<HardDrive class="h-4 w-4 text-[var(--text-tertiary)]" /> Storage
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">Disk (HDD):</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>120 GB / 500 GB (24%)</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">SSD:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>45 GB / 256 GB (18%)</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Object storage:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>2.1 TB used</span
					>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[24%]"
					></div>
				</div>
			</div>
		</div>
		<!-- Network -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4
				class="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"
			>
				<Activity class="h-4 w-4 text-[var(--text-tertiary)]" /> Network
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">Bandwidth:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>~85 Mbps</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Throughput:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>0.5 MB/s read, 0.2 MB/s write</span
					>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[32%]"
					></div>
				</div>
			</div>
		</div>
		<!-- I/O -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4
				class="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"
			>
				<Cpu class="h-4 w-4 text-[var(--text-tertiary)]" /> I/O (IOPS)
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">Read:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>1.2k IOPS</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Write:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>480 IOPS</span
					>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[28%]"
					></div>
				</div>
			</div>
		</div>
		<!-- GPU -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				GPU / Accelerators
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">GPU:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>RTX 3080 - 42% util</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">TPU/NPU:</span>
					<span class="font-medium text-[var(--text-primary)]">—</span>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[42%]"
					></div>
				</div>
			</div>
		</div>
		<!-- Latency -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Latency & compute
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">Latency (p99):</span>
					<span class="font-medium text-[var(--text-primary)] font-mono">12 ms</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Compute time:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>~0.8s/task</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Cycles:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>2.1B/s</span
					>
				</div>
			</div>
		</div>
		<!-- Power -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Power & energy
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">Power draw:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono">~85 W</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Energy (24h):</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>~2.0 kWh</span
					>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[35%]"
					></div>
				</div>
			</div>
		</div>
		<!-- Concurrency -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Concurrency / threads
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">Threads:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>24 active / 32 max</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Concurrent tasks:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono">8</span>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[75%]"
					></div>
				</div>
			</div>
		</div>
		<!-- Cache -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Cache
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">L1/L2 hit rate:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono">94%</span>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Cache size:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono">32 MB</span
					>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[94%]"
					></div>
				</div>
			</div>
		</div>
		<!-- Interconnect -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Interconnect / bus
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">Bus bandwidth:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>~8 GB/s</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">PCIe:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>Gen4 x16</span
					>
				</div>
			</div>
		</div>
		<!-- Persistent memory -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Persistent memory
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">NVMe:</span>
					<span class="font-medium text-[var(--text-primary)] font-mono"
						>256 GB - 18% used</span
					>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">PMem:</span>
					<span class="font-medium text-[var(--text-primary)]">—</span>
				</div>
				<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
					<div
						class="bg-[var(--accent)] h-2 rounded-full w-[18%]"
					></div>
				</div>
			</div>
		</div>
		<!-- Specialized -->
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Specialized hardware
			</h4>
			<div class="space-y-3 text-[13px]">
				<div>
					<span class="text-[var(--text-secondary)]">FPGA:</span>
					<span class="font-medium text-[var(--text-primary)]">—</span>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">ASIC:</span>
					<span class="font-medium text-[var(--text-primary)]">—</span>
				</div>
			</div>
		</div>
	</div>
</div>
