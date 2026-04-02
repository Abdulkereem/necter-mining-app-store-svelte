<script lang="ts">
	let { class: className = '', width = '100%', height = '20px' }: { class?: string; width?: string; height?: string } = $props();
</script>

<div class="skeleton-hex animate-pulse rounded-[6px] {className}" style="width:{width};height:{height}"></div>

<style>
.skeleton-hex {
	background-color: var(--surface-2);
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23FFC933' fill-opacity='0.08'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>
