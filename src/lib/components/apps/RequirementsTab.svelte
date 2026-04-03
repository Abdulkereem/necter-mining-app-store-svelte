<script lang="ts">
	import {
		Cpu,
		HardDrive,
		Wifi,
		Monitor,
		CheckCircle2,
		AlertCircle,
	} from 'lucide-svelte';

	let {
		app,
	}: {
		app: any;
	} = $props();
</script>

<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
	<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
		Hardware Requirements
	</p>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<!-- CPU -->
		<div
			class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
		>
			<Cpu size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
			<div class="flex-1 min-w-0">
				<p class="text-[12px] font-semibold text-[var(--text-primary)]">CPU</p>
				<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{app.requirements.cpu || '2+ cores'}</p>
			</div>
			<div class="flex-shrink-0 mt-[2px]" title="Compatible">
				<CheckCircle2 size={14} strokeWidth={2} class="text-[var(--success)]" />
			</div>
		</div>
		<!-- Storage -->
		<div
			class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
		>
			<HardDrive size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
			<div class="flex-1 min-w-0">
				<p class="text-[12px] font-semibold text-[var(--text-primary)]">Storage</p>
				<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
					{app.requirements.storage || '100 GB'}
				</p>
			</div>
			<div class="flex-shrink-0 mt-[2px]" title="Compatible">
				<CheckCircle2 size={14} strokeWidth={2} class="text-[var(--success)]" />
			</div>
		</div>
		<!-- Bandwidth -->
		<div
			class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
		>
			<Wifi size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
			<div class="flex-1 min-w-0">
				<p class="text-[12px] font-semibold text-[var(--text-primary)]">Bandwidth</p>
				<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
					{app.requirements.bandwidth || '10 Mbps'}
				</p>
			</div>
			<div class="flex-shrink-0 mt-[2px]" title="Compatible">
				<CheckCircle2 size={14} strokeWidth={2} class="text-[var(--success)]" />
			</div>
		</div>
		<!-- GPU (conditional) -->
		{#if app.requirements.gpu}
			<div
				class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
			>
				<Monitor size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
				<div class="flex-1 min-w-0">
					<p class="text-[12px] font-semibold text-[var(--text-primary)]">GPU</p>
					<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{app.requirements.gpu}</p>
				</div>
				<div class="flex-shrink-0 mt-[2px]" title="Check your hardware">
					<AlertCircle size={14} strokeWidth={2} class="text-[var(--warning)]" />
				</div>
			</div>
		{/if}
	</div>
	<p class="text-[10px] text-[var(--text-tertiary)] mt-3">
		Compatibility is estimated from your browser. Run the Necter miner for full accuracy.
	</p>
</div>
