<script lang="ts">
	import { RotateCw, WifiOff } from 'lucide-svelte';
	import { errorMessage } from '$lib/api/http';

	let { error, retry, compact = false }: { error: unknown; retry?: () => void; compact?: boolean } = $props();
</script>

<div
	class="flex flex-col items-center text-center rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] {compact ? 'px-4 py-6' : 'px-6 py-10'}"
	role="alert"
	data-testid="error-state"
>
	<div class="h-10 w-10 rounded-full bg-[rgba(235,87,87,0.1)] flex items-center justify-center mb-3">
		<WifiOff class="h-4.5 w-4.5 text-[var(--error)]" strokeWidth={1.8} />
	</div>
	<p class="text-[14px] font-medium text-[var(--text-primary)]">Couldn't load this</p>
	<p class="text-[12px] text-[var(--text-secondary)] mt-1 max-w-[420px]">{errorMessage(error)}</p>
	{#if retry}
		<button
			type="button"
			onclick={retry}
			class="mt-4 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] bg-[var(--surface-3)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-4)] transition-colors border-none cursor-pointer"
		>
			<RotateCw class="h-3.5 w-3.5" strokeWidth={2} /> Try again
		</button>
	{/if}
</div>
