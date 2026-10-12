<script lang="ts">
	/*
	 * Text chip for a coin (ticker + name, neutral colours). Used instead of logos for coins whose logo licence does
	 * not clearly allow use here (see static/apps/monero/ATTRIBUTION.txt).
	 */
	let {
		coin,
		name,
		active = false,
		note = null,
		href = null
	}: { coin: string; name: string; active?: boolean; note?: string | null; href?: string | null } = $props();
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	href={href ?? undefined}
	target={href ? '_blank' : undefined}
	rel={href ? 'noopener noreferrer' : undefined}
	class="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] border text-[12px] no-underline whitespace-nowrap {active
		? 'border-[var(--accent-base)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
		: 'border-[var(--border-default)] bg-[var(--surface-1)] text-[var(--text-secondary)]'}"
	aria-current={active ? 'true' : undefined}
>
	<span class="font-mono font-semibold text-[11px] {active ? 'text-[var(--text-accent)]' : 'text-[var(--text-primary)]'}">{coin}</span>
	<span>{name}</span>
	{#if note}
		<span class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{note}</span>
	{/if}
</svelte:element>
