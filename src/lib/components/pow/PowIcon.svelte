<script lang="ts">
	/*
	 * Icon of a first-party proof-of-work app: the official logo when its licence allows it (POW_ICONS, credited in
	 * static/apps/<id>/ATTRIBUTION.txt), otherwise a plain ticker tile in the app's accent colour (no third-party logo).
	 */
	import { POW_ICONS } from '$lib/api/pow';

	let { appId, coin, accent = '#888888', size = 40 }: { appId: string; coin: string; accent?: string; size?: number } = $props();
	const icon = $derived(POW_ICONS[appId]);
	const color = $derived(/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#888888');
	const radius = $derived(Math.round(size * 0.24));
</script>

{#if icon}
	<img src={icon.src} alt="" width={size} height={size} class="bg-white shrink-0" style="border-radius:{radius}px;padding:{Math.round(size * 0.08)}px" />
{:else}
	<span
		aria-hidden="true"
		class="inline-flex items-center justify-center shrink-0 font-mono font-semibold text-white"
		style="width:{size}px;height:{size}px;border-radius:{radius}px;background:{color};font-size:{Math.max(9, Math.round(size / (coin.length > 3 ? 4.6 : 3.6)))}px"
	>{coin}</span>
{/if}
