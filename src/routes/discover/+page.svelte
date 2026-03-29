<script lang="ts">
	import { backendState, backend } from '$lib/stores/backend';
	import { appIconDataUri } from '$lib/app-icon';

	const apps = $derived(backend.listApps());
</script>

<div class="min-h-screen pb-12 px-6 pt-6">
	<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-6">
		Discover
	</h1>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
		{#each apps as app}
			<a
				href="/apps/{app.id}"
				class="flex items-start gap-3.5 p-3.5 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-[border-color,background-color] duration-100 cursor-pointer no-underline"
			>
				<img
					src={app.icon && app.icon !== '/placeholder.svg'
						? app.icon
						: appIconDataUri({ id: app.id, name: app.name, category: app.category })}
					alt=""
					class="w-[52px] h-[52px] rounded-[10px] flex-shrink-0"
				/>
				<div class="flex-1 min-w-0">
					<p class="text-[13px] font-semibold text-[var(--text-primary)] truncate">
						{app.name}
					</p>
					<p
						class="text-[12px] text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-[16px]"
					>
						{app.description}
					</p>
					<div
						class="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-tertiary)]"
					>
						<span class="font-mono">{app.reputationScore}%</span>
						<span>${app.avgEarningsPerDay?.toFixed(0) ?? '0'}/day</span>
						<span>{app.category}</span>
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>
