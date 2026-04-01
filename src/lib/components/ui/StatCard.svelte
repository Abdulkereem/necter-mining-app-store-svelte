<script lang="ts">
	let {
		label,
		value,
		accent = false,
		color,
		class: className = '',
	}: {
		label: string;
		value: string;
		accent?: boolean;
		color?: string;
		class?: string;
	} = $props();
</script>

<div class="n-stat-card {className}">
	<p class="n-stat-label">{label}</p>
	<p
		class="n-stat-value"
		class:n-stat-value--accent={accent}
		style={color ? `color: ${color}` : undefined}
	>
		{value}
	</p>
</div>

<style>
	.n-stat-card {
		background-color: var(--surface-1);
		border: 1px solid var(--border-default);
		border-radius: 8px;
		padding: 16px;
	}

	.n-stat-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin: 0;
	}

	.n-stat-value {
		font-size: 18px;
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--text-primary);
		margin: 4px 0 0;
		line-height: 24px;
		font-feature-settings: "tnum" 1;
	}

	.n-stat-value--accent {
		color: var(--text-accent);
	}
</style>
