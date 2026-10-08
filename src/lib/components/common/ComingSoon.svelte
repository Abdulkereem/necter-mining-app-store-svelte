<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';

	let {
		title,
		description,
		phase = 'P4',
		features = [],
		backHref = '/discover',
		backLabel = 'Back to Discover'
	}: {
		title: string;
		description: string;
		phase?: 'P4' | 'P5';
		features?: string[];
		backHref?: string;
		backLabel?: string;
	} = $props();
</script>

<svelte:head>
	<title>{title} — Coming soon · Necter</title>
</svelte:head>

<div class="px-4 md:px-8 py-8 md:py-12 max-w-[960px] mx-auto">
	<section class="n-soon" data-testid="coming-soon">
		<div class="n-soon__copy">
			<span class="n-soon__pill">Coming soon · {phase === 'P4' ? 'Governance phase' : 'Later phase'}</span>
			<h1 class="n-soon__title">{title}</h1>
			<p class="n-soon__desc">{description}</p>
			{#if features.length}
				<ul class="n-soon__list">
					{#each features as f}
						<li>{f}</li>
					{/each}
				</ul>
			{/if}
			<a href={backHref} class="n-soon__back"><ArrowLeft class="h-3.5 w-3.5" strokeWidth={2} /> {backLabel}</a>
		</div>
		<div class="n-soon__art" aria-hidden="true">
			<img src="/brand/3d/hourglass.png" alt="" />
		</div>
	</section>
	<p class="mt-4 text-[12px] text-[var(--text-tertiary)] text-center">
		Not available on the testnet yet. The testnet focuses on discovery, mining, payouts and publishing projects.
	</p>
</div>

<style>
	.n-soon {
		position: relative;
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 24px;
		align-items: center;
		padding: 40px;
		border-radius: 16px;
		border: 1px solid var(--border-accent);
		background:
			radial-gradient(ellipse at 85% 50%, rgba(255, 201, 51, 0.12), transparent 55%),
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23FFC933' fill-opacity='0.07'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") right top / 56px 98px repeat,
			var(--surface-1);
		overflow: hidden;
	}
	@media (max-width: 720px) {
		.n-soon {
			grid-template-columns: 1fr;
			padding: 28px 20px;
		}
		.n-soon__art {
			order: -1;
			max-width: 220px;
		}
	}
	.n-soon__pill {
		display: inline-flex;
		height: 22px;
		align-items: center;
		padding: 0 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--text-accent);
		background: var(--accent-subtle);
		border: 1px solid var(--border-accent);
	}
	.n-soon__title {
		margin: 14px 0 0;
		font-size: 26px;
		line-height: 32px;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}
	.n-soon__desc {
		margin: 10px 0 0;
		font-size: 14px;
		line-height: 22px;
		color: var(--text-secondary);
		max-width: 460px;
	}
	.n-soon__list {
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 6px;
	}
	.n-soon__list li {
		position: relative;
		padding-left: 18px;
		font-size: 13px;
		color: var(--text-secondary);
	}
	.n-soon__list li::before {
		content: '';
		position: absolute;
		left: 2px;
		top: 6px;
		width: 8px;
		height: 8px;
		background: var(--accent-base);
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
	}
	.n-soon__back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 22px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary);
		text-decoration: none;
		padding: 0 14px;
		height: 34px;
		border-radius: 6px;
		background: var(--surface-3);
		transition: background 120ms;
	}
	.n-soon__back:hover {
		background: var(--surface-4);
	}
	.n-soon__art img {
		width: 100%;
		height: auto;
		filter: drop-shadow(0 20px 40px rgba(255, 201, 51, 0.15));
	}
</style>
