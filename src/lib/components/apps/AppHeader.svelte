<script lang="ts">
	import { Star, Share2, Flag, Heart, BadgeCheck } from 'lucide-svelte';
	import type { Project, Subscription } from '$lib/api/types';
	import { categoryName, formatRating, listingStatusLabel, shortAddress } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';

	const variantClasses: Record<string, string> = {
		neutral: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
		accent: 'bg-[var(--accent-subtle)] text-[var(--text-accent)]',
		success: 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]',
		warning: 'bg-[rgba(242,153,74,0.12)] text-[var(--warning)]',
		error: 'bg-[rgba(235,87,87,0.12)] text-[var(--error)]',
		info: 'bg-[rgba(110,159,255,0.12)] text-[var(--info)]'
	};

	let {
		project,
		subscription,
		signedIn,
		watched,
		watchPending = false,
		onWatch,
		onShare,
		onReport
	}: {
		project: Project;
		/** The viewer's live subscription to this project (first one), if any. */
		subscription: Subscription | null;
		signedIn: boolean;
		watched: boolean;
		watchPending?: boolean;
		onWatch: () => void;
		onShare: () => void;
		onReport: () => void;
	} = $props();

	const status = $derived(listingStatusLabel(project.listing_status));
	const rating = $derived(project.average_rating_x100 ?? null);
	const hasRating = $derived(rating !== null && (project.review_count ?? 0) > 0);
	const ctaHref = $derived(subscription ? `/mining/${subscription.subscription_id}` : `/apps/${project.project_id}/subscribe`);
	const ctaLabel = $derived(subscription ? 'Manage mining' : 'Mine this project');
	const canMine = $derived(project.listing_status === 'listed' || !!subscription);
	const developerLabel = $derived(project.developer_name || shortAddress(project.developer));
</script>

<div class="mb-5 md:mb-7">
	<div class="flex gap-3 md:gap-4 items-center">
		<!-- Icon -->
		<div class="shrink-0">
			<ProjectIcon {project} size={64} rounded="12px" class="block !w-12 !h-12 md:!w-16 md:!h-16" />
		</div>

		<!-- Name + developer + rating -->
		<div class="flex-1 min-w-0">
			<h1
				class="text-[18px] md:text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] m-0 leading-6 md:leading-8 truncate"
			>
				{project.name}
			</h1>
			<a
				href="/profiles/{project.developer}"
				class="inline-flex items-center gap-1 max-w-full text-[12px] md:text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors mt-0.5 no-underline"
			>
				<span class="truncate">{developerLabel}</span>
				{#if project.developer_verified}
					<BadgeCheck size={13} strokeWidth={2} class="text-[var(--text-accent)] shrink-0" aria-label="Verified developer" />
				{/if}
			</a>
			<div class="flex items-center gap-[3px] mt-1 overflow-hidden">
				{#if hasRating}
					{#each Array(5) as _, i (i)}
						<Star
							size={10}
							strokeWidth={0}
							fill={i < Math.round((rating ?? 0) / 100) ? 'var(--accent-base)' : 'var(--surface-3)'}
							class="shrink-0"
						/>
					{/each}
					<span class="text-[11px] text-[var(--text-tertiary)] font-mono ml-1 shrink-0">{formatRating(rating)}</span>
					<span class="text-[11px] text-[var(--text-tertiary)] ml-1 truncate">· {categoryName(project.category)}</span>
				{:else}
					<span class="text-[11px] text-[var(--text-tertiary)] truncate">No ratings yet · {categoryName(project.category)}</span>
				{/if}
			</div>
		</div>

		<!-- CTA + share — mobile only (desktop has it in badges row) -->
		<div class="flex md:hidden items-center gap-2 shrink-0">
			{#if canMine}
				<a href={ctaHref} class="btn-subscribe font-semibold no-underline">{subscription ? 'Manage' : 'Mine'}</a>
			{/if}
			<button
				aria-label="Share"
				class="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-2)] cursor-pointer"
				onclick={onShare}
			>
				<Share2 size={14} strokeWidth={1.5} class="text-[var(--text-secondary)]" />
			</button>
		</div>
	</div>

	<!-- Badges + Share + Report -- desktop only -->
	<div class="hidden md:flex items-center gap-2 mt-3 flex-wrap">
		<a
			href="/category/{project.category}"
			class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap no-underline {variantClasses.accent}"
			>{categoryName(project.category)}</a
		>
		<span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[status.variant]}">
			{status.label}
		</span>
		<span
			class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[
				project.developer_verified ? 'success' : 'neutral'
			]}"
		>
			{project.developer_verified ? 'Verified Dev' : 'Unverified Dev'}
		</span>
		<span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap font-mono {variantClasses.neutral}">
			v{project.version}
		</span>
		<div class="flex-1"></div>
		{#if canMine}
			<a
				href={ctaHref}
				class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] text-[12px] font-semibold no-underline border-0 {subscription
					? 'bg-[var(--success)] text-[#0C0C0E]'
					: 'bg-[var(--accent-base)] text-[#0C0C0E]'}"
			>
				{ctaLabel}
			</a>
		{/if}
		{#if signedIn}
			<button
				onclick={onWatch}
				disabled={watchPending}
				aria-pressed={watched}
				class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[12px] cursor-pointer disabled:opacity-50 {watched
					? 'text-[var(--text-accent)]'
					: 'text-[var(--text-secondary)]'}"
			>
				<Heart size={12} strokeWidth={1.8} fill={watched ? 'var(--accent-base)' : 'none'} />
				{watched ? 'Watching' : 'Watch'}
			</button>
		{/if}
		<button
			onclick={onShare}
			class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] cursor-pointer"
		>
			<Share2 size={12} strokeWidth={1.5} />
			Share
		</button>
		<button
			onclick={onReport}
			class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-tertiary)] text-[12px] cursor-pointer"
		>
			<Flag size={12} strokeWidth={1.5} />
			Report
		</button>
	</div>

	<!-- Status hint -- desktop only -->
	<p class="hidden md:block text-[12px] text-[var(--text-tertiary)] mt-2">
		{#if subscription}
			You're mining this project. Rounds, proofs and rewards show up on your subscription page.
		{:else if project.listing_status === 'listed'}
			Pick a device, check compatibility and bond collateral to start receiving rounds. Bonding is gasless.
		{:else}
			This project isn't accepting new miners right now ({status.label.toLowerCase()}).
		{/if}
	</p>
</div>
