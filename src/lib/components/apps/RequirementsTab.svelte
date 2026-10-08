<script lang="ts">
	import { Cpu, HardDrive, MemoryStick, Smartphone, Gauge, Boxes, Timer, Activity } from 'lucide-svelte';
	import type { Project } from '$lib/api/types';
	import { DEVICE_CLASS_LABEL, bpToPercent, formatMb, formatMs, formatNumber } from '$lib/format';

	let { project, signedIn }: { project: Project; signedIn: boolean } = $props();

	const ENGINE_LABEL: Record<string, string> = { native: 'Native', pulley64: 'Pulley (64-bit)', pulley32: 'Pulley (32-bit)' };

	const req = $derived(project.scheduling.requirements);
	const sla = $derived(project.scheduling.sla);

	const items = $derived([
		{
			icon: Smartphone,
			label: 'Device classes',
			value: req.device_classes.length > 0 ? req.device_classes.map((c) => DEVICE_CLASS_LABEL[c]).join(', ') : 'Any'
		},
		{ icon: Cpu, label: 'CPU', value: req.cpu_cores > 0 ? `${req.cpu_cores}+ core${req.cpu_cores === 1 ? '' : 's'}` : 'Any' },
		{ icon: MemoryStick, label: 'Memory', value: req.ram_mb > 0 ? `${formatMb(req.ram_mb)}+ RAM` : 'Any' },
		{ icon: HardDrive, label: 'Free storage', value: req.storage_mb > 0 ? `${formatMb(req.storage_mb)}+` : 'Any' },
		{ icon: Gauge, label: 'Minimum benchmark', value: req.min_benchmark > 0 ? `Score ${formatNumber(req.min_benchmark)}+` : 'None' },
		{ icon: Boxes, label: 'Engines', value: req.engines.length > 0 ? req.engines.map((e) => ENGINE_LABEL[e] ?? e).join(', ') : 'Any' }
	]);
</script>

<div class="flex flex-col gap-4">
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Hardware Requirements</p>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			{#each items as item (item.label)}
				{@const Icon = item.icon}
				<div class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3">
					<Icon size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
					<div class="flex-1 min-w-0">
						<p class="text-[12px] font-semibold text-[var(--text-primary)]">{item.label}</p>
						<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 break-words">{item.value}</p>
					</div>
				</div>
			{/each}
		</div>
		<p class="text-[10px] text-[var(--text-tertiary)] mt-3">
			GPU workloads aren't supported yet. Compatibility is checked by the network against your device's reported hardware and
			benchmark when you subscribe.
		</p>
	</div>

	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Service Level</p>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<div class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3">
				<Activity size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
				<div class="flex-1 min-w-0">
					<p class="text-[12px] font-semibold text-[var(--text-primary)]">Minimum uptime</p>
					<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{bpToPercent(sla.min_uptime_bp)}</p>
				</div>
			</div>
			<div class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3">
				<Timer size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
				<div class="flex-1 min-w-0">
					<p class="text-[12px] font-semibold text-[var(--text-primary)]">Max latency</p>
					<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{formatMs(sla.max_latency_ms)}</p>
				</div>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2 mt-4">
			<a
				href="/apps/{project.project_id}/subscribe"
				class="inline-flex items-center h-8 px-3 rounded-[5px] bg-[var(--accent-base)] text-[#0C0C0E] text-[12px] font-semibold no-underline"
			>
				{signedIn ? 'Check my devices' : 'Check compatibility'}
			</a>
			<a
				href="/mining/hardware-checker"
				class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
			>
				Hardware checker
			</a>
		</div>
	</div>
</div>
