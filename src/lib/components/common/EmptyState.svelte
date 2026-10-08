<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Brand 3D illustrations in static/brand/3d. */
	const ILLUSTRATIONS = {
		bee: '/brand/3d/bee-dark.png',
		hourglass: '/brand/3d/hourglass.png',
		network: '/brand/3d/network-nodes.png',
		platform: '/brand/3d/mining-platform.png',
		compute: '/brand/3d/compute.png',
		security: '/brand/3d/security.png',
		ecosystem: '/brand/3d/ecosystem.png',
		blockchain: '/brand/3d/blockchain-network.png',
		cloud: '/brand/3d/cloud-infra.png',
		logo: '/brand/3d/logo-3d.png'
	} as const;

	let {
		illustration = 'bee',
		title,
		description = '',
		compact = false,
		class: className = '',
		children
	}: {
		illustration?: keyof typeof ILLUSTRATIONS;
		title: string;
		description?: string;
		compact?: boolean;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="n-empty {compact ? 'n-empty--compact' : ''} {className}" data-testid="empty-state">
	<div class="n-empty__art" aria-hidden="true">
		<div class="n-empty__glow"></div>
		<img src={ILLUSTRATIONS[illustration]} alt="" loading="lazy" />
	</div>
	<h3 class="n-empty__title">{title}</h3>
	{#if description}
		<p class="n-empty__desc">{description}</p>
	{/if}
	{#if children}
		<div class="n-empty__actions">{@render children()}</div>
	{/if}
</div>

<style>
	.n-empty {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 48px 24px;
		border: 1px solid var(--border-default);
		border-radius: 12px;
		background:
			radial-gradient(ellipse at 50% 0%, rgba(255, 201, 51, 0.06), transparent 60%),
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23FFC933' fill-opacity='0.07'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") center / 56px 98px repeat,
			var(--surface-1);
				overflow: hidden;
	}
	.n-empty--compact {
		padding: 28px 20px;
	}
	.n-empty__art {
		position: relative;
		width: 132px;
		height: 108px;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.n-empty--compact .n-empty__art {
		width: 92px;
		height: 72px;
		margin-bottom: 10px;
	}
	.n-empty__art img {
		position: relative;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 12px 28px rgba(255, 201, 51, 0.12));
	}
	.n-empty__glow {
		position: absolute;
		inset: 10% 15%;
		border-radius: 50%;
		background: var(--accent-glow);
		filter: blur(30px);
		opacity: 0.5;
	}
	.n-empty__title {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}
	.n-empty__desc {
		font-size: 13px;
		line-height: 20px;
		color: var(--text-secondary);
		max-width: 440px;
		margin: 6px 0 0;
	}
	.n-empty__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
		margin-top: 18px;
	}
</style>
