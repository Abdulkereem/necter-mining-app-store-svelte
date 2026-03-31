<script>
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Error — Necter Mining App Store</title>
</svelte:head>

<div
	style="
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-0);
		padding: 24px;
	"
>
	<div
		style="
			max-width: 420px;
			width: 100%;
			text-align: center;
			background: var(--surface-1);
			border: 1px solid var(--border-default);
			border-radius: 12px;
			padding: 48px 32px;
		"
	>
		<img
			src="/brand/logo.svg"
			alt="Necter"
			style="width: 48px; height: 48px; margin: 0 auto 24px;"
		/>

		<p
			style="
				font-size: 48px;
				font-weight: 700;
				color: var(--text-tertiary);
				font-family: var(--font-mono);
				line-height: 1;
				margin: 0 0 8px;
			"
		>
			{$page.status}
		</p>

		<h1
			style="
				font-size: 18px;
				font-weight: 600;
				color: var(--text-primary);
				margin: 0 0 8px;
			"
		>
			{$page.error?.message || 'Something went wrong'}
		</h1>

		<p
			style="
				font-size: 13px;
				color: var(--text-secondary);
				line-height: 20px;
				margin: 0 0 24px;
			"
		>
			The page you were looking for could not be loaded. Please try again or navigate back.
		</p>

		<div style="display: flex; gap: 10px; justify-content: center;">
			<button
				type="button"
				onclick={() => history.back()}
				style="
					height: 36px;
					padding: 0 20px;
					border-radius: 6px;
					font-size: 13px;
					font-weight: 500;
					border: 1px solid var(--border-default);
					background: var(--surface-2);
					color: var(--text-primary);
					cursor: pointer;
					transition: background 100ms;
				"
			>
				Go back
			</button>
			<a
				href="/discover"
				style="
					display: inline-flex;
					align-items: center;
					height: 36px;
					padding: 0 20px;
					border-radius: 6px;
					font-size: 13px;
					font-weight: 500;
					border: none;
					background: var(--accent-base);
					color: #fff;
					text-decoration: none;
					cursor: pointer;
					transition: opacity 100ms;
				"
			>
				Go to Discover
			</a>
		</div>
	</div>
</div>
