<script lang="ts">
	import { page } from '$app/state';
	import toast from 'svelte-french-toast';
	import { ChevronLeft, ExternalLink, Activity, Star, BadgeCheck } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Announcement, ProjectSummary, ProjectVersion, Subscription } from '$lib/api/types';
	import { wallet, signedIn, showConnectModal, signIn } from '$lib/stores/wallet';
	import { preferences, toggleWatchlist } from '$lib/stores/account';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import {
		addressUrl,
		bpToPercent,
		categoryShort,
		compactNumber,
		formatAmount,
		formatNumber,
		formatRating,
		isAmount,
		shortAddress,
		shortHex,
		txUrl
	} from '$lib/format';
	import { shareOrCopy } from '$lib/share';
	import { Modal } from '$lib/components/ui';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import AppHeader from '$lib/components/apps/AppHeader.svelte';
	import OverviewTab from '$lib/components/apps/OverviewTab.svelte';
	import EconomicsTab from '$lib/components/apps/EconomicsTab.svelte';
	import RequirementsTab from '$lib/components/apps/RequirementsTab.svelte';
	import ReviewsTab from '$lib/components/apps/ReviewsTab.svelte';

	const PROJECT_ID_RE = /^0x[0-9a-fA-F]{64}$/;
	const NECTA_DECIMALS = 18;

	type ReportCategory = 'scam' | 'malware' | 'economics' | 'impersonation' | 'spam' | 'other';
	type ReportSeverity = 'low' | 'medium' | 'high';

	const variantClasses: Record<string, string> = {
		neutral: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
		accent: 'bg-[var(--accent-subtle)] text-[var(--text-accent)]',
		success: 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]',
		warning: 'bg-[rgba(242,153,74,0.12)] text-[var(--warning)]',
		error: 'bg-[rgba(235,87,87,0.12)] text-[var(--error)]',
		info: 'bg-[rgba(110,159,255,0.12)] text-[var(--info)]'
	};

	const SUB_STATUS: Record<Subscription['status'], { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
		pending_collateral: { label: 'Waiting for collateral', tone: 'warning' },
		active: { label: 'Mining active', tone: 'success' },
		paused: { label: 'Paused', tone: 'warning' },
		jailed: { label: 'Jailed', tone: 'error' },
		unbonding: { label: 'Unbonding', tone: 'warning' },
		withdrawable: { label: 'Collateral withdrawable', tone: 'neutral' },
		closed: { label: 'Closed', tone: 'neutral' }
	};

	// ─── Route param ─────────────────────────────────────────────────────────────
	const id = $derived((page.params.id ?? '').toLowerCase());
	const validId = $derived(PROJECT_ID_RE.test(id));

	// ─── Data ────────────────────────────────────────────────────────────────────
	const projectQ = useQuery(() => (validId ? hub.project(id) : Promise.resolve(null)));
	const economicsQ = useQuery(() => hub.economics(id), { enabled: () => validId });
	const statsQ = useQuery(() => hub.stats(id, '7d'), { enabled: () => validId });
	const announcementsQ = useQuery(() => hub.announcements(id), { enabled: () => validId });
	const versionsQ = useQuery(() => hub.versions(id), { enabled: () => validId });
	const mySubsQ = useQuery(() => hub.mySubscriptions({ project_id: id, limit: 20 }), {
		enabled: () => validId && $signedIn
	});
	const relatedQ = useQuery(() => {
		const c = projectQ.data?.category;
		return c ? hub.projects({ category: c, sort: 'trending', limit: 5 }) : Promise.resolve(null);
	});

	const project = $derived(projectQ.data ?? null);
	const stats = $derived(statsQ.data ?? project?.stats ?? null);
	const economics = $derived(economicsQ.data ?? project?.economics ?? null);
	const explorer = $derived(explorerBase($descriptor));
	const announcements = $derived((announcementsQ.data?.items ?? []) as Announcement[]);
	const versions = $derived(
		((versionsQ.data?.items ?? []) as ProjectVersion[]).slice().sort((a, b) => b.version - a.version)
	);
	const mySubs = $derived(((mySubsQ.data?.items ?? []) as Subscription[]).filter((s) => s.status !== 'closed'));
	const subscription = $derived(mySubs[0] ?? null);
	const related = $derived(((relatedQ.data?.items ?? []) as ProjectSummary[]).filter((p) => p.project_id !== id).slice(0, 4));
	const screenshots = $derived((project?.listing.screenshots ?? []).filter((s) => s.startsWith('https://')).slice(0, 8));

	const watched = $derived(($preferences?.watchlist ?? []).includes(id));

	const avgDaily = $derived.by(() => {
		const v = stats?.avg_daily_reward_per_miner ?? project?.avg_daily_reward_per_miner;
		return isAmount(v) && v !== '0' ? v : null;
	});
	const minCollateral = $derived(economics?.min_collateral ?? project?.consensus.economics.min_collateral ?? null);

	// ─── Local state ─────────────────────────────────────────────────────────────
	let activeTab = $state<'overview' | 'economics' | 'requirements' | 'reviews'>('overview');
	const tabLabels = ['overview', 'economics', 'requirements', 'reviews'] as const;

	let watchPending = $state(false);
	let shareOpen = $state(false);
	let shareUrl = $state('');
	let reportOpen = $state(false);
	let reportCategory = $state<ReportCategory>('scam');
	let reportSeverity = $state<ReportSeverity>('medium');
	let reportReason = $state('');
	let reportPending = $state(false);

	// ─── Handlers ────────────────────────────────────────────────────────────────
	async function ensureSession(): Promise<boolean> {
		if ($signedIn) return true;
		if (!$wallet) {
			showConnectModal.set(true);
			return false;
		}
		try {
			await signIn();
			return true;
		} catch (e) {
			toast.error(errorMessage(e));
			return false;
		}
	}

	async function onWatch() {
		if (watchPending) return;
		watchPending = true;
		try {
			await toggleWatchlist(id);
			toast.success(watched ? 'Added to your watchlist' : 'Removed from your watchlist');
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			watchPending = false;
		}
	}

	async function onReport() {
		if (await ensureSession()) reportOpen = true;
	}

	async function handleShare() {
		if (!project) return;
		try {
			const res = await shareOrCopy({ title: `${project.name} - Necter`, text: `Check out ${project.name} on Necter`, url: shareUrl });
			if (res.method === 'copy') toast.success('Link copied');
		} catch {
			toast.error("Couldn't share link. Try copying the URL from the address bar.");
		}
	}

	async function handleCopyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			toast.success('Link copied');
		} catch {
			toast.error('Copy failed');
		}
	}

	async function handleSubmitReport() {
		if (!reportReason.trim() || reportPending) return;
		reportPending = true;
		try {
			await hub.report(id, { category: reportCategory, severity: reportSeverity, reason: reportReason.trim().slice(0, 2000) });
			toast.success('Report submitted. The Necter operator will review it.');
			reportOpen = false;
			reportReason = '';
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			reportPending = false;
		}
	}

	function openShareFromUrl() {
		shareUrl = typeof window !== 'undefined' ? window.location.href : `/apps/${id}`;
		shareOpen = true;
	}
</script>

<svelte:head>
	<title>{project ? `${project.name} — Necter Mining App Store` : 'Project — Necter Mining App Store'}</title>
</svelte:head>

{#if projectQ.loading && !projectQ.data}
	<div class="max-w-[960px] mx-auto px-4 md:px-6 pt-8 space-y-4">
		<LoadingBlock rows={1} height="72px" />
		<LoadingBlock rows={5} grid height="76px" />
		<LoadingBlock rows={3} height="120px" />
	</div>
{:else if projectQ.error}
	<div class="max-w-[960px] mx-auto px-4 md:px-6 pt-8">
		<ErrorState error={projectQ.error} retry={() => projectQ.refresh()} />
	</div>
{:else if !project}
	<div class="max-w-[960px] mx-auto px-4 md:px-6 pt-8 pb-12">
		<EmptyState
			illustration="network"
			title="Project not found"
			description="There's no Necter project at this address. It may have been delisted, or the link is incomplete."
		>
			<a href="/discover" class="btn-secondary h-8 px-3 no-underline">Browse projects</a>
			<a href="/search" class="btn-secondary h-8 px-3 no-underline">Search</a>
		</EmptyState>
	</div>
{:else}
	<div class="min-h-screen pb-28 bg-[var(--surface-0)]">
		<!-- ── Breadcrumb / Back nav ── -->
		<div class="border-b border-[var(--border-default)] bg-[var(--surface-1)]">
			<div class="max-w-[960px] mx-auto px-4 md:px-6">
				<a href="/discover" class="inline-flex items-center gap-1 h-11 text-[13px] text-[var(--text-secondary)] no-underline">
					<ChevronLeft size={14} strokeWidth={1.5} />
					Browse
				</a>
			</div>
		</div>

		<!-- ── Main content ── -->
		<div class="max-w-[960px] mx-auto px-4 md:px-6 pt-5 md:pt-8 pb-0">
			<!-- HEADER -->
			<AppHeader
				{project}
				{subscription}
				signedIn={$signedIn}
				{watched}
				{watchPending}
				{onWatch}
				onShare={openShareFromUrl}
				{onReport}
			/>

			{#if project.listing_status !== 'listed' && project.review?.reason}
				<p class="text-[12px] text-[var(--warning)] bg-[rgba(242,153,74,0.10)] rounded-[5px] px-3 py-2 -mt-3 mb-6">
					{project.review.reason}
				</p>
			{/if}

			<!-- QUICK STATS ROW -- 5 cols desktop, 2 cols mobile -->
			<div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
				<div class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1 min-w-0">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Earnings / Day</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum'] truncate">
						{avgDaily ? `${formatAmount(avgDaily, project.token.decimals, { maxFrac: 2, compact: true })} ${project.token.symbol}` : '—'}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">{avgDaily ? 'recent avg per miner' : 'no payouts yet'}</p>
				</div>
				<div class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1 min-w-0">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Collateral</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum'] truncate">
						{isAmount(minCollateral) ? `${formatAmount(minCollateral, NECTA_DECIMALS, { maxFrac: 2, compact: true })} NECTA` : '—'}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">minimum bond, slashable</p>
				</div>
				<div class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Miners</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						{compactNumber(stats?.miners_active ?? project.miners ?? 0)}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">
						{stats?.growth_bp != null && stats.growth_bp !== 0
							? `${stats.growth_bp > 0 ? '+' : '-'}${bpToPercent(Math.abs(stats.growth_bp))} vs prior 7d`
							: 'active, last 7 days'}
					</p>
				</div>
				<div class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Uptime SLA</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						{bpToPercent(project.scheduling.sla.min_uptime_bp)}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">minimum required</p>
				</div>
				<div class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Rounds</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						{compactNumber(stats?.rounds_finalized ?? 0)}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">finalized, last 7 days</p>
				</div>
			</div>

			<!-- ACTIVE MINING STATUS BANNER -->
			{#if subscription}
				{@const st = SUB_STATUS[subscription.status]}
				{@const subToken = subscription.token ?? project.token}
				<div
					class="rounded-[8px] px-4 md:px-5 py-4 mb-7"
					style="background: {st.tone === 'success'
						? 'rgba(76,183,130,0.06)'
						: st.tone === 'error'
							? 'rgba(235,87,87,0.06)'
							: 'rgba(242,153,74,0.06)'}; border: 1px solid {st.tone === 'success'
						? 'rgba(76,183,130,0.20)'
						: st.tone === 'error'
							? 'rgba(235,87,87,0.20)'
							: 'rgba(242,153,74,0.20)'};"
				>
					<div class="flex items-center justify-between mb-4 gap-2">
						<div class="flex items-center gap-2 min-w-0">
							<span class={subscription.status === 'active' ? 'status-dot status-dot-active' : 'status-dot status-dot-proving'}></span>
							<span
								class="text-[13px] font-semibold truncate"
								style="color: {st.tone === 'success' ? 'var(--success)' : st.tone === 'error' ? 'var(--error)' : 'var(--warning)'}"
							>
								{st.label}
							</span>
							{#if mySubs.length > 1}
								<span class="text-[12px] text-[var(--text-tertiary)]">· {mySubs.length} devices</span>
							{/if}
						</div>
						<span class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap font-mono {variantClasses[st.tone]}">
							<Activity size={10} class="mr-1" />
							{shortHex(subscription.node_id)}
						</span>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
						{#each [
							{ label: 'Rounds done', value: formatNumber(subscription.leases_completed ?? 0) },
							{ label: 'Earned', value: `${formatAmount(subscription.earned_total ?? '0', subToken.decimals, { maxFrac: 2, compact: true })} ${subToken.symbol}` },
							{ label: 'Uptime', value: bpToPercent(subscription.uptime_bp) },
							{ label: 'Collateral', value: `${formatAmount(subscription.collateral, NECTA_DECIMALS, { maxFrac: 2, compact: true })} NECTA` }
						] as s (s.label)}
							<div class="bg-[var(--surface-0)] border border-[var(--border-default)] rounded-[6px] px-[14px] py-[10px] min-w-0">
								<p class="text-[18px] font-semibold text-[var(--text-primary)] font-mono truncate">{s.value}</p>
								<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">{s.label}</p>
							</div>
						{/each}
					</div>

					{#if subscription.status === 'pending_collateral'}
						<p class="text-[12px] text-[var(--warning)] bg-[rgba(242,153,74,0.10)] rounded-[5px] px-3 py-2 mb-3">
							Your collateral bond hasn't confirmed yet. Open the subscription to finish bonding.
						</p>
					{/if}

					<div class="flex gap-2 flex-wrap">
						<a
							href="/mining/{subscription.subscription_id}"
							class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>Subscription</a
						>
						<a
							href="/mining/subscriptions"
							class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>All subscriptions</a
						>
						<a
							href="/withdraw"
							class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>Earnings</a
						>
						{#if project.listing_status === 'listed'}
							<a
								href="/apps/{project.project_id}/subscribe"
								class="inline-flex items-center gap-1 h-8 px-3 rounded-[5px] bg-[var(--accent-base)] text-[#0C0C0E] text-[12px] font-semibold no-underline"
							>
								Add another device
							</a>
						{/if}
					</div>
				</div>
			{/if}

			<!-- TABS -- horizontally scrollable on mobile -->
			<div
				class="flex gap-0 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-[3px] mb-6 w-full md:w-fit max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]"
			>
				{#each tabLabels as tab (tab)}
					<button
						class="h-7 px-3 rounded-[5px] text-[12px] font-medium cursor-pointer border-0 transition-colors duration-100 whitespace-nowrap flex-1 md:flex-none
              {activeTab === tab
							? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
							: 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}"
						onclick={() => (activeTab = tab)}
					>
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				{/each}
			</div>

			{#if activeTab === 'overview'}
				<OverviewTab {project} {announcements} {versions} {explorer} />
			{:else if activeTab === 'economics'}
				{#if economicsQ.error && !economics}
					<ErrorState error={economicsQ.error} retry={() => economicsQ.refresh()} />
				{:else}
					<EconomicsTab {project} {economics} {stats} {explorer} />
				{/if}
			{:else if activeTab === 'requirements'}
				<RequirementsTab {project} signedIn={$signedIn} />
			{:else}
				<ReviewsTab {project} signedIn={$signedIn} />
			{/if}

			<!-- SCREENSHOTS -->
			{#if screenshots.length > 0}
				<div class="mt-8">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Screenshots</p>
					<div class="flex gap-3 overflow-x-auto pb-1">
						{#each screenshots as src, i (src)}
							<img
								{src}
								alt="{project.name} screenshot {i + 1}"
								class="shrink-0 border border-[var(--border-default)] rounded-[12px] w-[280px] md:w-[440px] h-[180px] md:h-[280px] object-cover bg-[var(--surface-2)]"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
						{/each}
					</div>
				</div>
			{/if}

			<!-- DEVELOPER INFO -->
			<div class="mt-8 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
				<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Developer</p>
				<div class="flex justify-between items-start gap-3 flex-wrap">
					<div class="min-w-0">
						<a
							href="/profiles/{project.developer}"
							class="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] transition-colors duration-100 mb-[6px] no-underline"
						>
							{project.developer_name || shortAddress(project.developer)}
							{#if project.developer_verified}
								<BadgeCheck size={14} strokeWidth={2} class="text-[var(--text-accent)]" />
							{/if}
						</a>
						<p class="text-[12px] text-[var(--text-tertiary)] font-mono mb-[10px]">{shortAddress(project.developer)}</p>
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[
								project.developer_verified ? 'success' : 'neutral'
							]}"
						>
							{project.developer_verified ? 'Verified Developer' : 'Unverified Developer'}
						</span>
					</div>
					<div class="flex items-center gap-2 flex-wrap">
						{#if project.vault}
							<a
								href={addressUrl(project.vault, explorer)}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 h-7 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>
								View vault contract
								<ExternalLink size={11} strokeWidth={1.5} />
							</a>
						{/if}
						{#if project.registry_tx}
							<a
								href={txUrl(project.registry_tx, explorer)}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 h-7 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>
								Registration tx
								<ExternalLink size={11} strokeWidth={1.5} />
							</a>
						{/if}
					</div>
				</div>
			</div>

			<!-- RELATED PROJECTS -->
			{#if related.length > 0}
				<div class="mt-8">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">You Might Also Like</p>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
						{#each related as rel (rel.project_id)}
							<a href="/apps/{rel.project_id}" class="no-underline">
								<div
									class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-3 cursor-pointer transition-[border-color] duration-100 ease-out hover:border-[var(--border-hover)]"
								>
									<div class="flex items-center gap-[10px] mb-[10px]">
										<ProjectIcon project={rel} size={36} rounded="5px" />
										<div class="min-w-0">
											<p class="text-[13px] font-semibold text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">
												{rel.name}
											</p>
											<p class="text-[11px] text-[var(--text-tertiary)] mt-[1px]">{categoryShort(rel.category)}</p>
										</div>
									</div>
									<div class="flex items-center justify-between gap-2">
										<div class="flex items-center gap-[3px]">
											<Star size={10} strokeWidth={0} fill="var(--accent-base)" />
											<span class="text-[11px] text-[var(--text-secondary)] font-mono">
												{(rel.review_count ?? 0) > 0 ? formatRating(rel.average_rating_x100) : '—'}
											</span>
										</div>
										<span class="text-[11px] text-[var(--text-tertiary)] font-mono truncate">
											{compactNumber(rel.miners ?? 0)} miners
										</span>
									</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- STICKY CTA BAR -->
		<div
			class="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-default)] bg-[var(--surface-1)]/95 backdrop-blur-sm md:hidden"
		>
			<div class="max-w-[960px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
				<div class="flex items-center gap-3 min-w-0">
					<ProjectIcon {project} size={28} rounded="6px" />
					<div class="min-w-0">
						<p class="text-[13px] font-semibold text-[var(--text-primary)] leading-tight truncate">{project.name}</p>
						<p class="text-[11px] text-[var(--text-tertiary)] truncate">
							{#if subscription}
								{SUB_STATUS[subscription.status].label}
							{:else if isAmount(minCollateral)}
								{formatAmount(minCollateral, NECTA_DECIMALS, { maxFrac: 2, compact: true })} NECTA collateral
							{:else}
								Gasless collateral bond
							{/if}
						</p>
					</div>
				</div>
				{#if subscription}
					<a
						href="/mining/{subscription.subscription_id}"
						class="inline-flex items-center h-8 px-4 rounded-[6px] text-[13px] font-semibold no-underline bg-[var(--success)] text-[#0C0C0E] shrink-0"
					>
						Manage
					</a>
				{:else if project.listing_status === 'listed'}
					<a
						href="/apps/{project.project_id}/subscribe"
						class="inline-flex items-center h-8 px-4 rounded-[6px] text-[13px] font-semibold no-underline bg-[var(--accent-base)] text-[#0C0C0E] shrink-0"
					>
						Mine this project
					</a>
				{/if}
			</div>
		</div>

		<!-- SHARE DIALOG -->
		<Modal bind:open={shareOpen} maxWidth="420px">
			<h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Share {project.name}</h3>
			<p class="text-[13px] text-[var(--text-secondary)] mb-4">Copy a link or open the native share sheet.</p>

			<p class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase mb-[6px]">Shareable link</p>
			<input
				type="text"
				value={shareUrl}
				readonly
				aria-label="Shareable link"
				class="w-full h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[13px] font-mono mb-4"
			/>

			<div class="flex justify-end gap-2">
				<button
					onclick={handleShare}
					class="h-8 px-[14px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[13px] cursor-pointer"
					>Share / Copy</button
				>
				<button
					onclick={handleCopyLink}
					class="h-8 px-[14px] rounded-[5px] bg-[var(--accent-base)] text-[#0C0C0E] text-[13px] font-semibold cursor-pointer border-0"
					>Copy link</button
				>
			</div>
		</Modal>

		<!-- REPORT DIALOG -->
		<Modal bind:open={reportOpen} maxWidth="480px">
			<h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Report {project.name}</h3>
			<p class="text-[13px] text-[var(--text-secondary)] mb-4">
				Flag suspicious behavior. Reports go to the Necter operator, who can pause or delist a project.
			</p>

			<div class="flex flex-col gap-[14px]">
				<label class="flex flex-col gap-[6px]">
					<span class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase">Category</span>
					<select
						bind:value={reportCategory}
						class="h-9 px-3 py-2 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[13px] cursor-pointer outline-none"
					>
						<option value="scam">Scam</option>
						<option value="malware">Malware</option>
						<option value="economics">Economics / payout manipulation</option>
						<option value="impersonation">Impersonation</option>
						<option value="spam">Spam</option>
						<option value="other">Other</option>
					</select>
				</label>

				<label class="flex flex-col gap-[6px]">
					<span class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase">Severity</span>
					<select
						bind:value={reportSeverity}
						class="h-9 px-3 py-2 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[13px] cursor-pointer outline-none"
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</label>

				<label class="flex flex-col gap-[6px]">
					<span class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase">Reason</span>
					<textarea
						bind:value={reportReason}
						rows="5"
						maxlength="2000"
						placeholder="Explain what's wrong: misleading rewards, suspicious links, malicious behavior, abusive economics..."
						class="w-full px-3 py-2 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[13px] resize-y outline-none"
					></textarea>
				</label>
			</div>

			<div class="flex justify-end gap-2 mt-4">
				<button
					onclick={() => (reportOpen = false)}
					class="h-8 px-[14px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[13px] cursor-pointer"
					>Cancel</button
				>
				<button
					disabled={!reportReason.trim() || reportPending}
					onclick={handleSubmitReport}
					class="h-8 px-[14px] rounded-[5px] bg-[var(--error)] text-white text-[13px] font-semibold cursor-pointer border-0 disabled:opacity-40"
				>
					{reportPending ? 'Submitting…' : 'Submit report'}
				</button>
			</div>
		</Modal>
	</div>
{/if}
