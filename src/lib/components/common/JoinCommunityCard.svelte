<script lang="ts">
	import { COMMUNITY, SOCIAL } from '$lib/config';
	import SocialIcon from './SocialIcon.svelte';

	let {
		title = 'Join the Necter community',
		line = 'Get testnet updates, help, and early access.'
	}: { title?: string; line?: string } = $props();

	const more = SOCIAL.filter((s) => s.key !== 'telegram' && s.key !== 'discord');
</script>

<section
	class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4"
	aria-label="Necter community"
>
	<div class="flex-1 min-w-0">
		<p class="text-[14px] font-semibold text-[var(--text-primary)] m-0">{title}</p>
		<p class="text-[12px] text-[var(--text-secondary)] leading-[17px] mt-1 mb-0">{line}</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<a
			href={COMMUNITY.telegram}
			target="_blank"
			rel="noopener"
			class="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-[var(--accent-base)] text-[#0C0C0E] text-[12px] font-semibold no-underline hover:opacity-90 transition-opacity"
			><SocialIcon name="telegram" size={14} />Telegram</a
		>
		<a
			href={COMMUNITY.discord}
			target="_blank"
			rel="noopener"
			class="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[12px] font-medium no-underline hover:border-[var(--border-hover)] transition-colors"
			><SocialIcon name="discord" size={14} />Discord</a
		>
		{#each more as s (s.key)}
			<a
				href={s.href}
				target="_blank"
				rel="noopener"
				aria-label="Necter on {s.name}"
				title="{s.name}: {s.handle}"
				class="h-8 w-8 inline-flex items-center justify-center rounded-[6px] text-[var(--text-secondary)] hover:text-[var(--text-accent)] hover:bg-[var(--surface-2)] transition-colors"
				><SocialIcon name={s.key} size={15} /></a
			>
		{/each}
	</div>
</section>
