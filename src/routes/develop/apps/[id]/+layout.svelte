<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { ArrowLeft, Eye } from 'lucide-svelte';
	import type { Project } from '$lib/api/types';
	import { listingStatusLabel, categoryName } from '$lib/format';
	import { setDevProject } from '$lib/develop/context';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { account, signedIn } from '$lib/stores/wallet';

	let { children }: { children: Snippet } = $props();

	const id = $derived(page.params.id ?? '');
	const base = $derived(`/develop/apps/${id}`);
	const tabs = [
		{ href: '', label: 'Overview' },
		{ href: '/versions', label: 'Versions' },
		{ href: '/deployments', label: 'Deployments' },
		{ href: '/settings', label: 'Listing' },
		{ href: '/announcements', label: 'Announcements' },
		{ href: '/analytics', label: 'Analytics' },
		{ href: '/health', label: 'Health' },
		{ href: '/miners', label: 'Miners' },
		{ href: '/proofs', label: 'Rounds' },
		{ href: '/revenue', label: 'Revenue' }
	];

	const q = useQuery(() => hub.project(id.toLowerCase()), { enabled: () => $signedIn && !!id, keepPrevious: true });
	const project = $derived((q.data ?? null) as Project | null);
	const isOwner = $derived(!!project && !!$account && project.developer === $account);
	setDevProject({
		get project() {
			return project as Project;
		},
		refresh: () => q.refresh()
	});

	const variant: Record<string, string> = {
		success: 'background:rgba(76,183,130,0.12);color:var(--success)',
		warning: 'background:rgba(242,153,74,0.12);color:var(--warning)',
		error: 'background:rgba(235,87,87,0.12);color:var(--error)',
		neutral: 'background:var(--surface-3);color:var(--text-secondary)',
		accent: 'background:var(--accent-subtle);color:var(--text-accent)'
	};
</script>

<SignInGate title="Developer Portal" description="Sign in with your developer wallet to manage this project." illustration="platform">
	{#if q.loading && !q.data}
		<div class="max-w-[960px] mx-auto px-4 md:px-6 pt-6 pb-12"><LoadingBlock rows={4} height="72px" /></div>
	{:else if q.error && !q.data}
		<div class="max-w-[960px] mx-auto px-4 md:px-6 pt-6 pb-12"><ErrorState error={q.error} retry={q.refresh} /></div>
	{:else if !project}
		<div class="max-w-[880px] mx-auto px-4 md:px-6 pt-8 pb-12">
			<EmptyState illustration="hourglass" title="Project not found" description="A project that was just submitted appears once its registration is indexed.">
				<a href="/develop" class="btn-subscribe no-underline">Back to Developer Portal</a>
			</EmptyState>
		</div>
	{:else if !isOwner}
		<div class="max-w-[880px] mx-auto px-4 md:px-6 pt-8 pb-12">
			<EmptyState illustration="security" title="Not your project" description="Only the developer wallet that published this project can manage it.">
				<a href="/apps/{project.project_id}" class="btn-secondary no-underline">View listing</a>
				<a href="/develop" class="btn-subscribe no-underline">Developer Portal</a>
			</EmptyState>
		</div>
	{:else}
				{@const st = listingStatusLabel(project.listing_status)}
				<div class="min-h-screen animate-fadeIn">
					<div class="max-w-[960px] mx-auto px-4 md:px-6 pt-6 pb-12">
						<div class="flex items-center justify-between gap-3 mb-5 flex-wrap">
							<div class="flex items-center gap-3">
								<a href="/develop" class="w-7 h-7 flex items-center justify-center rounded-[5px] no-underline" aria-label="Back"><ArrowLeft class="w-4 h-4 text-[var(--text-tertiary)]" strokeWidth={1.5} /></a>
								<ProjectIcon {project} size={44} rounded="12px" />
								<div>
									<div class="flex items-center gap-2">
										<h1 class="text-[18px] font-semibold text-[var(--text-primary)]">{project.name}</h1>
										<span class="text-[11px] font-medium px-2 py-0.5 rounded-[3px]" style={variant[st.variant]}>{st.label}</span>
									</div>
									<p class="text-[12px] text-[var(--text-tertiary)]">{categoryName(project.category)} · v{project.version} · <span class="font-mono">{project.slug}</span></p>
								</div>
							</div>
							<div class="flex gap-2">
								<a href="{base}/preview" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-[5px] text-[12px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] no-underline"><Eye size={12} strokeWidth={1.5} /> Preview</a>
								{#if project.listing_status === 'listed' || project.listing_status === 'paused'}
									<a href="/apps/{project.project_id}" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-[5px] text-[12px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] no-underline">View on store</a>
								{/if}
							</div>
						</div>
						<div class="flex gap-1 mb-5 border-b border-[var(--border-default)] overflow-x-auto">
							{#each tabs as t (t.href)}
								{@const active = page.url.pathname === base + t.href}
								<a href="{base}{t.href}" class="h-[34px] px-3 text-[13px] font-medium no-underline whitespace-nowrap -mb-px flex items-center" style="border-bottom:2px solid {active ? 'var(--accent-base)' : 'transparent'};color:{active ? 'var(--text-primary)' : 'var(--text-tertiary)'}">{t.label}</a>
							{/each}
						</div>
						{@render children()}
					</div>
				</div>
	{/if}
</SignInGate>
