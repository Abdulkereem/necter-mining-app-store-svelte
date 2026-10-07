<script lang="ts">
	import Skeleton from '$lib/components/Skeleton.svelte';

	let { rows = 3, height = '56px', grid = false }: { rows?: number; height?: string; grid?: boolean } = $props();
</script>

<div class={grid ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-2'} aria-busy="true" aria-label="Loading">
	{#each Array(rows) as _, i (i)}
		<Skeleton {height} />
	{/each}
</div>
