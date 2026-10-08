<script lang="ts">
	import { CheckCircle2, History, Megaphone, ExternalLink, Globe, BookOpen, LifeBuoy, CirclePlay } from 'lucide-svelte';
	import type { Announcement, Project, ProjectVersion } from '$lib/api/types';
	import { formatDate, formatDuration, rewardModelLabel, shortHex, timeAgo, txUrl } from '$lib/format';

	const variantClasses: Record<string, string> = {
		neutral: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
		accent: 'bg-[var(--accent-subtle)] text-[var(--text-accent)]',
		success: 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]',
		warning: 'bg-[rgba(242,153,74,0.12)] text-[var(--warning)]',
		error: 'bg-[rgba(235,87,87,0.12)] text-[var(--error)]',
		info: 'bg-[rgba(110,159,255,0.12)] text-[var(--info)]'
	};

	const ANNOUNCEMENT_VARIANT: Record<Announcement['type'], string> = {
		update: 'info',
		maintenance: 'warning',
		feature: 'accent',
		alert: 'error'
	};

	const VERSION_VARIANT: Record<ProjectVersion['status'], string> = {
		submitted: 'neutral',
		registered: 'info',
		pending: 'warning',
		active: 'success',
		superseded: 'neutral',
		rejected: 'error'
	};

	let {
		project,
		announcements,
		versions,
		explorer
	}: {
		project: Project;
		announcements: Announcement[];
		versions: ProjectVersion[];
		explorer: string;
	} = $props();

	const work = $derived(project.consensus.work);
	const listing = $derived(project.listing);
	const isSafeUrl = (u: string | null | undefined): u is string => !!u && u.startsWith('https://');

	const links = $derived(
		[
			{ label: 'Website', href: listing.website, icon: Globe },
			{ label: 'Documentation', href: listing.docs, icon: BookOpen },
			{ label: 'Support', href: listing.support, icon: LifeBuoy },
			{ label: 'Video', href: listing.video, icon: CirclePlay }
		].filter((l): l is { label: string; href: string; icon: typeof Globe } => isSafeUrl(l.href))
	);

	const technical = $derived([
		{ label: 'Consensus', value: 'Committee (redundant execution)' },
		{ label: 'Verification', value: work.verification === 'redundant-execution' ? 'Redundant execution' : work.verification },
		{ label: 'Reward Model', value: rewardModelLabel(project.consensus.economics.reward_model) },
		{ label: 'Committee', value: `${work.committee.size} miners (+${work.committee.backups} backup)` },
		{ label: 'Round length', value: formatDuration(work.round_secs) },
		{ label: 'Epoch length', value: formatDuration(work.epoch_secs) },
		{ label: 'Tasks', value: work.task_source.kind === 'schedule' ? `Scheduled every ${formatDuration(work.task_source.interval_secs)}` : 'Submitted via API' }
	]);
</script>

<div class="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
	<!-- Description -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 md:col-span-2 overflow-hidden">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Description</p>
		{#if listing.tagline}
			<p class="text-[14px] font-medium text-[var(--text-primary)] leading-5 m-0 mb-2 break-words">{listing.tagline}</p>
		{/if}
		<p class="text-[13px] text-[var(--text-secondary)] leading-5 m-0 break-words whitespace-pre-line">
			{listing.description || 'The developer has not added a description yet.'}
		</p>
		{#if listing.tags.length > 0}
			<div class="flex flex-wrap gap-[6px] mt-3">
				{#each listing.tags as tag (tag)}
					<span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.neutral}">
						{tag}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Network Features -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 overflow-hidden">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Features</p>
		{#if listing.features.length > 0}
			<ul class="list-none p-0 m-0 flex flex-col gap-2">
				{#each listing.features.slice(0, 8) as feature, i (i)}
					<li class="flex items-start gap-2 text-[13px] text-[var(--text-secondary)] leading-[18px]">
						<CheckCircle2 size={13} strokeWidth={1.5} class="text-[var(--success)] shrink-0 mt-[3px]" />
						<span class="break-words">{feature}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-[12px] text-[var(--text-tertiary)] m-0">No features listed.</p>
		{/if}
	</div>

	<!-- Technical Details -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 overflow-hidden">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Technical Details</p>
		<div class="flex flex-col gap-2.5">
			{#each technical as row (row.label)}
				<div class="flex justify-between items-start gap-3">
					<span class="text-[12px] text-[var(--text-tertiary)] flex-shrink-0">{row.label}</span>
					<span class="text-[12px] md:text-[13px] text-[var(--text-primary)] font-medium text-right break-words min-w-0">{row.value}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Links -->
	{#if links.length > 0}
		<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 md:col-span-2">
			<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Links</p>
			<div class="flex flex-wrap gap-2">
				{#each links as l (l.label)}
					{@const Icon = l.icon}
					<a
						href={l.href}
						target="_blank"
						rel="noopener noreferrer nofollow"
						class="inline-flex items-center gap-1.5 h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[12px] no-underline transition-colors"
					>
						<Icon size={13} strokeWidth={1.5} />
						{l.label}
						<ExternalLink size={11} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Announcements -->
	{#if announcements.length > 0}
		<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 md:col-span-2">
			<div class="flex items-center gap-2 mb-3">
				<Megaphone size={14} strokeWidth={1.5} class="text-[var(--text-accent)]" />
				<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] m-0">Announcements</p>
			</div>
			<div class="flex flex-col divide-y divide-[var(--border-default)]">
				{#each announcements.slice(0, 5) as a (a.announcement_id)}
					<div class="py-3 first:pt-0 last:pb-0">
						<div class="flex items-center gap-2 mb-1 flex-wrap">
							<span
								class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap capitalize {variantClasses[
									ANNOUNCEMENT_VARIANT[a.type]
								]}">{a.type}</span
							>
							<span class="text-[13px] font-semibold text-[var(--text-primary)]">{a.title}</span>
							<span class="text-[11px] text-[var(--text-tertiary)] ml-auto" title={formatDate(a.created_at)}>{timeAgo(a.created_at)}</span>
						</div>
						<p class="text-[13px] text-[var(--text-secondary)] leading-5 m-0 whitespace-pre-line break-words">{a.content}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Version History (collapsible) -->
	{#if versions.length > 0}
		<details class="md:col-span-2 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
			<summary class="flex items-center gap-2 px-4 md:px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
				<History size={14} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
				<span class="text-[14px] font-semibold text-[var(--text-primary)]">Version History</span>
			</summary>
			<div class="px-4 md:px-5 pb-5">
				<div class="relative">
					<div class="absolute bg-[var(--border-default)] left-[7px] top-[8px] bottom-[8px] w-px"></div>
					<div class="flex flex-col gap-6">
						{#each versions as version (version.version)}
							{@const current = version.version === project.version}
							<div class="pl-7 relative">
								<div
									class="absolute rounded-full"
									style="left: 0; top: 4px; width: 15px; height: 15px; background: {current
										? 'var(--accent-base)'
										: 'var(--surface-3)'}; border: 2px solid {current ? 'var(--accent-base)' : 'var(--border-strong)'};"
								></div>
								<div class="flex items-center gap-[10px] mb-[6px] flex-wrap">
									<span class="text-[13px] font-semibold text-[var(--text-primary)] font-mono">v{version.version}</span>
									<span class="text-[12px] text-[var(--text-tertiary)]">{formatDate(version.published_at ?? version.submitted_at)}</span>
									<span
										class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap capitalize {variantClasses[
											VERSION_VARIANT[version.status]
										]}">{version.status}</span
									>
								</div>
								<p class="text-[13px] text-[var(--text-secondary)] leading-5 m-0">
									{#if version.tiers_changed.length > 0}
										Changed: {version.tiers_changed.join(', ')}.
									{:else}
										Initial version.
									{/if}
									{#if version.effective_epoch != null}
										Effective from epoch {version.effective_epoch}.
									{/if}
								</p>
								{#if version.publish_tx}
									<a
										href={txUrl(version.publish_tx, explorer)}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-accent)] no-underline mt-1"
									>
										{shortHex(version.publish_tx)}
										<ExternalLink size={10} strokeWidth={1.5} />
									</a>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		</details>
	{/if}
</div>
