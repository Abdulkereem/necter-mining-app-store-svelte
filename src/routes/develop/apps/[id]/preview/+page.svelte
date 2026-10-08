<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import { devProject } from '$lib/develop/context';
	import { categoryName, formatAmount, rewardModelLabel, DEVICE_CLASS_LABEL, formatMb } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';

	const ctx = devProject();
	const p = $derived(ctx.project);
	const l = $derived(p.listing);
</script>

<p class="text-[12px] text-[var(--text-tertiary)] mb-3">How your listing appears in the store (from the current signed manifest).</p>
<div class="rounded-[12px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
	{#if l.banner}<img src={l.banner} alt="" class="w-full h-[160px] object-cover" referrerpolicy="no-referrer" />{/if}
	<div class="p-6">
		<div class="flex items-start gap-4">
			<ProjectIcon project={p} size={64} rounded="14px" />
			<div class="flex-1 min-w-0">
				<h2 class="text-[20px] font-semibold" style="color:{l.accent_color ?? 'var(--text-primary)'}">{l.name}</h2>
				<p class="text-[13px] text-[var(--text-secondary)]">{l.tagline}</p>
				<div class="flex flex-wrap gap-1.5 mt-2">
					<span class="text-[11px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)]">{categoryName(l.category)}</span>
					{#each l.tags as t (t)}<span class="text-[11px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-tertiary)]">#{t}</span>{/each}
				</div>
			</div>
			<button type="button" class="btn-subscribe" disabled>Mine this project</button>
		</div>
		<p class="text-[13px] text-[var(--text-primary)] mt-5 whitespace-pre-line leading-relaxed">{l.description}</p>
		{#if l.features.length}<ul class="mt-4 space-y-1">{#each l.features as f}<li class="text-[13px] text-[var(--text-secondary)]">• {f}</li>{/each}</ul>{/if}
		{#if l.screenshots.length}
			<div class="flex gap-3 overflow-x-auto mt-5">{#each l.screenshots as s (s)}<img src={s} alt="" class="h-[180px] rounded-[8px]" referrerpolicy="no-referrer" />{/each}</div>
		{/if}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 text-[12px]">
			<div><p class="text-[var(--text-tertiary)]">Rewards</p><p>{rewardModelLabel(p.reward_model)} · {p.token.symbol}</p></div>
			<div><p class="text-[var(--text-tertiary)]">Min collateral</p><p class="font-mono">{formatAmount(p.min_collateral ?? '0', 18)} NECTA</p></div>
			<div><p class="text-[var(--text-tertiary)]">Devices</p><p>{p.scheduling.requirements.device_classes.map((c) => DEVICE_CLASS_LABEL[c]).join(', ')}</p></div>
			<div><p class="text-[var(--text-tertiary)]">Needs</p><p>{p.scheduling.requirements.cpu_cores} cores · {formatMb(p.scheduling.requirements.ram_mb)} RAM</p></div>
		</div>
		<div class="flex gap-3 mt-5">
			{#each [['Website', l.website], ['Docs', l.docs], ['Support', l.support], ['Video', l.video]] as [k, v] (k)}
				{#if v}<a href={v} target="_blank" rel="noopener noreferrer" class="text-[12px] text-[var(--text-accent)] inline-flex items-center gap-1">{k} <ExternalLink class="h-3 w-3" /></a>{/if}
			{/each}
		</div>
	</div>
</div>
