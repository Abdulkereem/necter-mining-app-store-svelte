<script lang="ts">
	import { Copy, Check } from 'lucide-svelte';
	import { shortHex } from '$lib/format';

	let { value, short = true, class: className = '' }: { value: string; short?: boolean; class?: string } = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			setTimeout(() => (copied = false), 1200);
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

<button
	type="button"
	onclick={copy}
	title={value}
	class="inline-flex items-center gap-1 font-mono text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer p-0 {className}"
>
	<span>{short ? shortHex(value) : value}</span>
	{#if copied}<Check class="h-3 w-3 text-[var(--success)]" strokeWidth={2} />{:else}<Copy class="h-3 w-3" strokeWidth={2} />{/if}
</button>
