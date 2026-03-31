<script lang="ts">
	let { class: className = '', width = '100%', height = '20px' }: { class?: string; width?: string; height?: string } = $props();
</script>

<div class="animate-pulse rounded-[6px] bg-[var(--surface-2)] {className}" style="width:{width};height:{height}"></div>
