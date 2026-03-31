<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, showConnectModal } from '$lib/stores/wallet';
	import { showToast } from '$lib/stores/toast';
	import { mockMiningProfiles, mockMiningProfileTrustScores } from '$lib/mock-data';
	import { appIconDataUri } from '$lib/app-icon';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { getAppScreenshots } from '$lib/app-screenshots';
	import { shareOrCopy } from '$lib/share';
	import NodeSetupWizard from '$lib/components/NodeSetupWizard.svelte';
	import {
		Star,
		Cpu,
		HardDrive,
		Wifi,
		Monitor,
		Shield,
		ExternalLink,
		CheckCircle2,
		AlertCircle,
		Award,
		Share2,
		ChevronLeft,
		Lock,
		Eye,
		Database,
		MapPin,
		History,
		ThumbsUp,
		Flag,
		MessageSquare,
		Play,
		Pause,
		Activity,
	} from 'lucide-svelte';

	// ─── Route param (from $app/state) ──────────────────────────────────────────
	const id = $derived(page.params.id);

	// ─── Mock data constants ─────────────────────────────────────────────────────
	const versionHistory = [
		{ version: 'v2.1.0', date: 'Jan 28, 2026', notes: 'Performance improvements, bug fixes, and new proof verification algorithm' },
		{ version: 'v2.0.5', date: 'Jan 15, 2026', notes: 'Security patch for consensus mechanism' },
		{ version: 'v2.0.0', date: 'Dec 10, 2025', notes: 'Major update: New reward distribution model, improved SLA tracking' },
		{ version: 'v1.9.2', date: 'Nov 22, 2025', notes: 'Bug fixes and stability improvements' },
	];

	const privacyLabels = {
		dataCollected: [
			{ type: 'Hardware Specs', purpose: 'Task Assignment', icon: 'cpu' as const },
			{ type: 'Network Stats', purpose: 'Performance Monitoring', icon: 'wifi' as const },
			{ type: 'Location (Region)', purpose: 'Network Optimization', icon: 'map-pin' as const },
			{ type: 'Wallet Address', purpose: 'Rewards Distribution', icon: 'database' as const },
		],
		dataNotCollected: ['Personal Identity', 'Browsing History', 'Contacts'],
		dataLinkedToYou: ['Wallet Address', 'Mining Performance'],
		dataNotLinkedToYou: ['Hardware Benchmarks', 'Network Latency'],
	};

	const ratingDistribution = [
		{ stars: 5, count: 1247, percentage: 68 },
		{ stars: 4, count: 384, percentage: 21 },
		{ stars: 3, count: 128, percentage: 7 },
		{ stars: 2, count: 52, percentage: 3 },
		{ stars: 1, count: 23, percentage: 1 },
	];

	const variantClasses: Record<string, string> = {
		neutral: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
		accent: 'bg-[var(--accent-subtle)] text-[var(--text-accent)]',
		success: 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]',
		warning: 'bg-[rgba(242,153,74,0.12)] text-[var(--warning)]',
		error: 'bg-[rgba(235,87,87,0.12)] text-[var(--error)]',
		info: 'bg-[rgba(110,159,255,0.12)] text-[var(--info)]',
	};

	// ─── Derived state from backend ──────────────────────────────────────────────
	const app = $derived($backendState.apps.find((a) => String(a.id) === String(id)) ?? null);
	const profile = $derived(
		$backendState.miningProfiles?.find((p) => String(p.appId) === String(id)) ??
			mockMiningProfiles.find((p) => String(p.appId) === String(id))
	);
	const trustScore = $derived(mockMiningProfileTrustScores.find((t) => String(t.appId) === String(id)));
	const relatedApps = $derived(
		app ? $backendState.apps.filter((a) => String(a.id) !== String(id) && a.category === app.category).slice(0, 4) : []
	);
	const listingStatus = $derived($backendState.listingStatusByAppId?.[id] ?? 'draft');

	const pricingModel = $derived(app?.rewardPricingModel ?? null);
	const baseRewardPerTask = $derived(typeof app?.baseRewardPerTask === 'number' ? Number(app.baseRewardPerTask) : null);
	const minRewardPerTask = $derived(typeof app?.minRewardPerTask === 'number' ? Number(app.minRewardPerTask) : null);
	const maxRewardPerTask = $derived(typeof app?.maxRewardPerTask === 'number' ? Number(app.maxRewardPerTask) : null);
	const feeMinerPct = $derived(typeof app?.feeSplitMinerPct === 'number' ? Number(app.feeSplitMinerPct) : 80);
	const feeDevPct = $derived(typeof app?.feeSplitDeveloperPct === 'number' ? Number(app.feeSplitDeveloperPct) : 15);
	const feeTreasuryPct = $derived(typeof app?.feeSplitTreasuryPct === 'number' ? Number(app.feeSplitTreasuryPct) : 5);
	const feeSum = $derived(feeMinerPct + feeDevPct + feeTreasuryPct);
	const feeValid = $derived(Math.abs(feeSum - 100) < 0.0001 && feeMinerPct >= 0 && feeDevPct >= 0 && feeTreasuryPct >= 0);

	const minerId = $derived($actor?.minerId ?? null);
	const walletAddress = $derived($actor?.walletAddress);
	const attestationReqs = $derived(app?.attestationRequirements ?? []);
	const attCaps = $derived(minerId ? ($backendState as any).attestationCapabilitiesByMinerId?.[minerId] ?? null : null);
	const missingAttestations = $derived.by(() => {
		if (!attestationReqs || attestationReqs.length === 0) return [];
		const caps = attCaps ?? { tpm: false, tee: false, sgx: false };
		const missing: string[] = [];
		for (const r of attestationReqs) {
			if (r === 'TPM' && !caps.tpm) missing.push('TPM');
			if (r === 'TEE' && !caps.tee) missing.push('TEE');
			if (r === 'SGX' && !caps.sgx) missing.push('SGX');
		}
		return missing;
	});

	const existingSubscription = $derived.by(() => {
		if (!minerId) return null;
		const subs = $backendState.subscriptions.filter((s) => s.appId === id && s.minerId === minerId);
		return subs[0] ?? null;
	});

	const derivedStatus = $derived<'not-subscribed' | 'subscribed' | 'mining'>(
		existingSubscription
			? existingSubscription.status === 'active'
				? 'mining'
				: 'subscribed'
			: 'not-subscribed'
	);

	const developerVerification = $derived(app ? backend.getDeveloperVerification(app.developerAddress) : null);
	const developerVerificationStatus = $derived(developerVerification?.status ?? 'unverified');

	const stakeAmount = $derived(
		app?.slaRequirements?.slashingPenalty ? Math.max(0, Math.round((app.slaRequirements.slashingPenalty / 100) * 10000)) : 0
	);

	// ─── Earnings estimator ──────────────────────────────────────────────────────
	let hoursPerDay = $state(24);
	const estimatedDaily = $derived(app ? app.avgEarningsPerDay * (hoursPerDay / 24) : 0);
	const estimatedMonthly = $derived(estimatedDaily * 30);
	const estimatedYearly = $derived(estimatedDaily * 365);

	// ─── Local state ─────────────────────────────────────────────────────────────
	let miningStatus = $state<'not-subscribed' | 'subscribed' | 'mining'>('not-subscribed');
	let miningStats = $state({ tasksCompleted: 0, earnings: 0, uptime: 0, proofs: 0 });

	let isWizardOpen = $state(false);
	let pendingSubId = $state<string | null>(null);

	let activeTab = $state('overview');
	let shareOpen = $state(false);
	let shareUrl = $state('');
	let reportOpen = $state(false);
	let reportCategory = $state('scam');
	let reportSeverity = $state('medium');
	let reportReason = $state('');

	const tabLabels = ['overview', 'economics', 'requirements', 'reviews'] as const;

	// ─── Effects ─────────────────────────────────────────────────────────────────
	$effect(() => {
		const proofsCount = existingSubscription
			? $backendState.proofs.filter((p) => p.subscriptionId === existingSubscription.id).length
			: 0;
		miningStatus = derivedStatus;
		miningStats = {
			tasksCompleted: existingSubscription?.tasksCompleted || 0,
			earnings: existingSubscription?.totalEarned || 0,
			uptime: existingSubscription?.uptime || 0,
			proofs: proofsCount,
		};
	});

	// ─── Handlers ────────────────────────────────────────────────────────────────
	function handleSubscribe() {
		if (!$actor) {
			$showConnectModal = true;
			return;
		}
		if (existingSubscription) {
			pendingSubId = existingSubscription.id;
			isWizardOpen = true;
			return;
		}
		// Open wizard -- the wizard itself handles subscription on completion
		isWizardOpen = true;
	}

	function handleStartMining() {
		if (existingSubscription) backend.resumeSubscription(existingSubscription.id);
		miningStatus = 'mining';
	}

	function handleStopMining() {
		if (existingSubscription) backend.pauseSubscription(existingSubscription.id);
		miningStatus = 'subscribed';
	}

	function handlePrimary() {
		if (miningStatus === 'not-subscribed') handleSubscribe();
		else if (miningStatus === 'subscribed') handleStartMining();
		else handleStopMining();
	}

	function getTrustLabel(score: number) {
		if (score >= 90) return 'Platinum';
		if (score >= 80) return 'Gold';
		if (score >= 70) return 'Verified';
		return 'Unverified';
	}

	function getTrustVariant(score: number): string {
		if (score >= 90) return 'success';
		if (score >= 75) return 'warning';
		return 'error';
	}

	function appIcon(a: { id: string; name: string; category: string; icon?: string }) {
		return a.icon && a.icon !== '/placeholder.svg' ? a.icon : appIconDataUri({ id: a.id, name: a.name, category: a.category });
	}

	async function handleShare() {
		try {
			const res = await shareOrCopy({ title: `${app!.name} - Necter`, text: `Check out ${app!.name} on Necter`, url: shareUrl });
			if (res.method === 'copy') showToast('Link copied!');
		} catch {
			showToast("Couldn't share link. Try copying the URL from the address bar.");
		}
	}

	async function handleCopyLink() {
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(shareUrl);
				showToast('Link copied!');
			}
		} catch {
			showToast('Copy failed');
		}
	}

	function handleSubmitReport() {
		try {
			backend.submitAppReport({
				appId: app!.id,
				category: reportCategory,
				severity: reportSeverity,
				reason: reportReason,
			});
			showToast('Report submitted. Governance can now vote to keep or delist.');
			reportOpen = false;
			reportReason = '';
		} catch (e: any) {
			showToast(e?.message ?? 'Please try again.');
		}
	}

	function openShareFromUrl() {
		const url = typeof window !== 'undefined' ? window.location.href : `/apps/${app!.id}`;
		shareUrl = url;
		shareOpen = true;
	}
</script>

{#if !app}
	<div class="min-h-screen flex items-center justify-center text-[var(--text-tertiary)] text-[13px]">App not found.</div>
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
			<!-- ═══════════════════════════════════════════════════════
			     HEADER -- App Store style: icon + name + subscribe
			════════════════════════════════════════════════════════ -->
			<div class="mb-5 md:mb-7">
				<div class="flex gap-3 md:gap-4 items-center">
					<!-- Icon -->
					<div class="shrink-0">
						<img
							src={appIcon(app)}
							alt={app.name}
							width="56"
							height="56"
							class="rounded-[12px] block md:w-[64px] md:h-[64px]"
						/>
					</div>

					<!-- Name + developer + rating -->
					<div class="flex-1 min-w-0">
						<h1
							class="text-[18px] md:text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] m-0 leading-6 md:leading-8 truncate"
						>
							{app.name}
						</h1>
						<a
							href="/profiles/{app.developerAddress}"
							class="text-[12px] md:text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors mt-0.5 block no-underline truncate"
						>
							{app.developer}
						</a>
						<div class="flex items-center gap-[3px] mt-1">
							{#each Array(5) as _, i}
								<Star
									size={10}
									strokeWidth={0}
									fill={i < Math.round(app.averageRating || 4.5) ? 'var(--accent-base)' : 'var(--surface-3)'}
								/>
							{/each}
							<span class="text-[11px] text-[var(--text-tertiary)] font-mono ml-1"
								>{(app.averageRating || 4.5).toFixed(1)}</span
							>
							<span class="text-[11px] text-[var(--text-tertiary)] ml-1">· {app.category}</span>
						</div>
					</div>

					<!-- CTA + share -->
					<div class="flex items-center gap-2 shrink-0">
						{#if miningStatus === 'not-subscribed'}
							<button class="btn-subscribe font-semibold" onclick={handleSubscribe}>Subscribe</button>
						{/if}
						{#if miningStatus === 'subscribed'}
							<button
								class="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] border border-[var(--success)] bg-[rgba(76,183,130,0.12)] text-[var(--success)] text-[12px] font-semibold cursor-pointer"
								onclick={handleStartMining}
							>
								<Play size={11} /> Start
							</button>
						{/if}
						{#if miningStatus === 'mining'}
							<button
								class="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] border border-[var(--error)] bg-[rgba(235,87,87,0.12)] text-[var(--error)] text-[12px] font-semibold cursor-pointer"
								onclick={handleStopMining}
							>
								<Pause size={11} /> Stop
							</button>
						{/if}
						<!-- Share icon -- mobile only -->
						<button
							class="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-2)] cursor-pointer"
							onclick={openShareFromUrl}
						>
							<Share2 size={14} strokeWidth={1.5} class="text-[var(--text-secondary)]" />
						</button>
					</div>
				</div>

				<!-- Badges + Share + Report -- desktop only -->
				<div class="hidden md:flex items-center gap-2 mt-3 flex-wrap">
					<span
						class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.accent}"
						>{app.category}</span
					>
					{#if trustScore}
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[getTrustVariant(trustScore.overallScore)]}"
							>{getTrustLabel(trustScore.overallScore)}</span
						>
					{/if}
					<span
						class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[developerVerificationStatus === 'verified' ? 'success' : developerVerificationStatus === 'pending' ? 'warning' : 'neutral']}"
					>
						{developerVerificationStatus === 'verified'
							? 'Verified Dev'
							: developerVerificationStatus === 'pending'
								? 'Verification Pending'
								: 'Unverified'}
					</span>
					{#if listingStatus === 'beta'}
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.warning}"
							>Beta</span
						>
					{/if}
					<div class="flex-1"></div>
					<button
						onclick={handlePrimary}
						class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] text-[12px] font-semibold cursor-pointer border-0
							{miningStatus === 'not-subscribed'
							? 'bg-[var(--accent-base)] text-[#0C0C0E]'
							: miningStatus === 'subscribed'
								? 'bg-[var(--success)] text-[#0C0C0E]'
								: 'bg-[var(--error)] text-white'}"
					>
						{#if miningStatus === 'not-subscribed'}Subscribe{:else if miningStatus === 'subscribed'}Start Mining{:else}Stop Mining{/if}
					</button>
					<button
						onclick={openShareFromUrl}
						class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] cursor-pointer"
					>
						<Share2 size={12} strokeWidth={1.5} />
						Share
					</button>
					<button
						onclick={() => {
							if (!$actor) {
								$showConnectModal = true;
								return;
							}
							reportOpen = true;
						}}
						class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-tertiary)] text-[12px] cursor-pointer"
					>
						<Flag size={12} strokeWidth={1.5} />
						Report
					</button>
				</div>

				<!-- Status hint -- desktop only -->
				<p class="hidden md:block text-[12px] text-[var(--text-tertiary)] mt-2">
					{#if miningStatus === 'not-subscribed'}Subscribe to run guided node setup, then jobs and proofs start flowing.{/if}
					{#if miningStatus === 'subscribed'}Node configured. Start mining to queue jobs and generate proofs.{/if}
					{#if miningStatus === 'mining'}Mining active. Jobs queued, proofs verified, rewards credited.{/if}
				</p>
			</div>

			<!-- ═══════════════════════════════════════════════════════
			     QUICK STATS ROW -- 5 cols desktop, 2 cols mobile
			════════════════════════════════════════════════════════ -->
			<div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
				>
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Earnings / Day</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						${app.avgEarningsPerDay.toFixed(2)}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">avg per miner</p>
				</div>
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
				>
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Stake Required</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						{stakeAmount > 0 ? `${stakeAmount.toLocaleString()} NCT` : 'None'}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">{stakeAmount > 0 ? 'slashing applies' : 'no stake needed'}</p>
				</div>
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
				>
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Miners</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						{app.totalMiners >= 1000 ? `${(app.totalMiners / 1000).toFixed(1)}K` : app.totalMiners}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">active nodes</p>
				</div>
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
				>
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Uptime SLA</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						{app.slaRequirements?.minUptime ?? 95}%
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">minimum required</p>
				</div>
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
				>
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Attestations</p>
					<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
						{app.attestations}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)]">on-chain verified</p>
				</div>
			</div>

			<!-- ═══════════════════════════════════════════════════════
			     ACTIVE MINING STATUS BANNER
			════════════════════════════════════════════════════════ -->
			{#if miningStatus !== 'not-subscribed'}
				<div
					class="rounded-[8px] px-4 md:px-5 py-4 mb-7"
					style="background: {miningStatus === 'mining'
						? 'rgba(76,183,130,0.06)'
						: 'rgba(242,153,74,0.06)'}; border: 1px solid {miningStatus === 'mining'
						? 'rgba(76,183,130,0.20)'
						: 'rgba(242,153,74,0.20)'};"
				>
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-2">
							<span
								class={miningStatus === 'mining' ? 'status-dot status-dot-active' : 'status-dot status-dot-proving'}
							></span>
							<span
								class="text-[13px] font-semibold"
								style="color: {miningStatus === 'mining' ? 'var(--success)' : 'var(--warning)'}"
							>
								{miningStatus === 'mining' ? 'Mining Active' : 'Subscribed, Ready to Start'}
							</span>
						</div>
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[miningStatus === 'mining' ? 'success' : 'warning']}"
						>
							<Activity size={10} class="mr-1" />
							{miningStatus === 'mining' ? 'Live' : 'Idle'}
						</span>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
						{#each [
							{ label: 'Tasks Done', value: miningStats.tasksCompleted },
							{ label: 'Earned', value: `$${miningStats.earnings.toFixed(2)}` },
							{ label: 'Uptime', value: `${miningStats.uptime.toFixed(1)}%` },
							{ label: 'Proofs', value: miningStats.proofs },
						] as s}
							<div class="bg-[var(--surface-0)] border border-[var(--border-default)] rounded-[6px] px-[14px] py-[10px]">
								<p class="text-[18px] font-semibold text-[var(--text-primary)] font-mono">{s.value}</p>
								<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">{s.label}</p>
							</div>
						{/each}
					</div>

					{#if miningStatus === 'subscribed'}
						<p class="text-[12px] text-[var(--warning)] bg-[rgba(242,153,74,0.10)] rounded-[5px] px-3 py-2 mb-3">
							Click "Start" to begin earning rewards. Confirm your hardware meets requirements below.
						</p>
					{/if}

					<div class="flex gap-2 flex-wrap">
						<a
							href="/mining"
							class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>Mining Dashboard</a
						>
						<a
							href="/mining?tab=proofs"
							class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>Proof Queue</a
						>
						<a
							href="/mining/earnings"
							class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
							>Earnings</a
						>
						{#if miningStatus === 'subscribed'}
							<button
								onclick={handleStartMining}
								class="inline-flex items-center gap-1 h-8 px-3 rounded-[5px] bg-[var(--success)] text-[#0C0C0E] text-[12px] font-semibold cursor-pointer border-0"
							>
								<Play size={11} />
								Start jobs
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<!-- ═══════════════════════════════════════════════════════
			     ATTESTATION ALERT
			════════════════════════════════════════════════════════ -->
			<div
				class="flex items-start gap-[10px] bg-[rgba(255,191,0,0.06)] border border-[var(--border-accent)] rounded-[8px] px-[14px] py-3 mb-8"
			>
				<Shield size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[1px]" />
				<div>
					<p class="text-[13px] text-[var(--text-primary)]">
						<span class="font-semibold">Community Verified</span>
						{' · '}
						<span class="text-[var(--text-secondary)]"
							>{app.attestations} on-chain attestations from governance members</span
						>
					</p>
					{#if attestationReqs.length > 0}
						<p class="text-[12px] text-[var(--text-secondary)] mt-1">
							<span class="font-medium">Required attestations: </span>
							{attestationReqs.join(', ')}
							{#if missingAttestations.length > 0}
								<span class="text-[var(--warning)] ml-[6px]">(missing: {missingAttestations.join(', ')})</span>
							{/if}
						</p>
					{/if}
				</div>
			</div>

			<!-- ═══════════════════════════════════════════════════════
			     TABS -- horizontally scrollable on mobile
			════════════════════════════════════════════════════════ -->
			<div
				class="flex gap-0 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-[3px] mb-6 w-fit max-w-full overflow-x-auto"
				style="-webkit-overflow-scrolling: touch;"
			>
				{#each tabLabels as tab}
					<button
						class="h-7 px-3 rounded-[5px] text-[12px] font-medium cursor-pointer border-0 transition-colors duration-100 whitespace-nowrap shrink-0
              {activeTab === tab
							? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
							: 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}"
						onclick={() => (activeTab = tab)}
					>
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				{/each}
			</div>

			<!-- ── OVERVIEW TAB ── -->
			{#if activeTab === 'overview'}
				<div class="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
					<!-- Description -->
					<div
						class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 md:col-span-2 overflow-hidden"
					>
						<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
							Description
						</p>
						<p class="text-[13px] text-[var(--text-secondary)] leading-5 m-0 break-words">{app.description}</p>
					</div>

					<!-- Network Features -->
					<div
						class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 overflow-hidden"
					>
						<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
							Network Features
						</p>
						<ul class="list-none p-0 m-0 flex flex-col gap-2">
							{#each (app.features ?? []).slice(0, 6) as feature}
								<li
									class="flex items-start gap-2 text-[13px] text-[var(--text-secondary)] leading-[18px]"
								>
									<CheckCircle2 size={13} strokeWidth={1.5} class="text-[var(--success)] shrink-0 mt-[3px]" />
									<span class="break-words">{feature}</span>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Technical Details -->
					<div
						class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 overflow-hidden"
					>
						<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
							Technical Details
						</p>
						<div class="flex flex-col gap-2.5">
							{#each [
								{ label: 'Consensus', value: profile?.consensusMechanism || app.consensusMechanism },
								{ label: 'Verification', value: profile?.verificationMethod || app.verificationMethod },
								{ label: 'Reward Model', value: profile?.rewardModel || app.rewardModel },
							] as row}
								<div class="flex justify-between items-start gap-3">
									<span class="text-[12px] text-[var(--text-tertiary)] flex-shrink-0">{row.label}</span>
									<span
										class="text-[12px] md:text-[13px] text-[var(--text-primary)] font-medium text-right break-words min-w-0"
										>{row.value}</span
									>
								</div>
							{/each}
						</div>
					</div>

					<!-- Trust Score -->
					{#if trustScore}
						<div
							class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 md:col-span-2"
						>
							<div class="flex items-center justify-between mb-4">
								<div class="flex items-center gap-2">
									<Award size={14} strokeWidth={1.5} class="text-[var(--text-accent)]" />
									<p
										class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-0"
									>
										Trust Score
									</p>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-[20px] font-semibold font-mono text-[var(--text-primary)]">
										{trustScore.overallScore}<span class="text-[13px] text-[var(--text-tertiary)] font-normal"
											>/100</span
										>
									</span>
									{#if trustScore.trendingDirection === 'improving'}
										<span
											class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.success}"
											>Improving</span
										>
									{/if}
									{#if trustScore.trendingDirection === 'declining'}
										<span
											class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.error}"
											>Declining</span
										>
									{/if}
								</div>
							</div>

							<div class="grid grid-cols-2 gap-3">
								{#each [
									{ label: 'Developer Track Record', value: trustScore.developerTrackRecord },
									{ label: 'Network Security', value: trustScore.networkSecurity },
									{ label: 'Consensus Health', value: trustScore.consensusHealth },
									{ label: 'Community Votes', value: trustScore.communityVotes },
								] as item}
									<div>
										<div class="flex justify-between mb-[6px]">
											<span class="text-[12px] text-[var(--text-tertiary)]">{item.label}</span>
											<span class="text-[12px] font-mono text-[var(--text-primary)] font-medium"
												>{item.value}%</span
											>
										</div>
										<div class="h-[3px] bg-[var(--surface-3)] rounded-full overflow-hidden">
											<div
												class="h-full rounded-full"
												style="width: {item.value}%; background: {item.value >= 80
													? 'var(--success)'
													: item.value >= 60
														? 'var(--warning)'
														: 'var(--error)'};"
											></div>
										</div>
									</div>
								{/each}
							</div>

							{#if trustScore.redFlags.length > 0}
								<div
									class="mt-4 bg-[rgba(235,87,87,0.08)] border border-[rgba(235,87,87,0.20)] rounded-[6px] px-3 py-[10px]"
								>
									<p
										class="text-[11px] font-semibold text-[var(--error)] mb-[6px] uppercase tracking-[0.04em]"
									>
										Warnings
									</p>
									{#each trustScore.redFlags as flag}
										<p class="text-[12px] text-[var(--error)] opacity-85">· {flag}</p>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Privacy & Attestation (collapsible) -->
					<details
						class="md:col-span-2 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden"
					>
						<summary
							class="flex items-center gap-2 px-4 md:px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
						>
							<Lock size={14} strokeWidth={1.5} class="text-[var(--text-accent)]" />
							<span class="text-[14px] font-semibold text-[var(--text-primary)]">Privacy & Attestation</span>
						</summary>
						<div class="px-4 md:px-5 pb-5">
							<p class="text-[13px] text-[var(--text-secondary)] mb-6 leading-5">
								The developer indicated that this app's privacy practices may include handling of data as described
								below.
							</p>

							<p
								class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
							>
								Data Used to Track You
							</p>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
								{#each privacyLabels.dataCollected as item}
									<div
										class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
									>
										{#if item.icon === 'cpu'}
											<Cpu
												size={14}
												strokeWidth={1.5}
												class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
											/>
										{:else if item.icon === 'wifi'}
											<Wifi
												size={14}
												strokeWidth={1.5}
												class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
											/>
										{:else if item.icon === 'map-pin'}
											<MapPin
												size={14}
												strokeWidth={1.5}
												class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
											/>
										{:else if item.icon === 'database'}
											<Database
												size={14}
												strokeWidth={1.5}
												class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
											/>
										{/if}
										<div>
											<p class="text-[13px] font-medium text-[var(--text-primary)]">{item.type}</p>
											<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{item.purpose}</p>
										</div>
									</div>
								{/each}
							</div>

							<hr class="border-0 border-t border-[var(--border-default)] my-6" />

							<p
								class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
							>
								Data Linked to You
							</p>
							<div class="flex flex-wrap gap-[6px] mb-6">
								{#each privacyLabels.dataLinkedToYou as item}
									<span
										class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.warning}"
									>
										<Eye size={10} class="mr-1" />
										{item}
									</span>
								{/each}
							</div>

							<p
								class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
							>
								Data Not Linked to You
							</p>
							<div class="flex flex-wrap gap-[6px] mb-6">
								{#each privacyLabels.dataNotLinkedToYou as item}
									<span
										class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.neutral}"
										>{item}</span
									>
								{/each}
							</div>

							<hr class="border-0 border-t border-[var(--border-default)] my-6" />

							<p
								class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
							>
								Data Not Collected
							</p>
							<div class="flex flex-wrap gap-[6px]">
								{#each privacyLabels.dataNotCollected as item}
									<span
										class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.success}"
									>
										<CheckCircle2 size={10} class="mr-1" />
										{item}
									</span>
								{/each}
							</div>
						</div>
					</details>

					<!-- Version History (collapsible) -->
					<details
						class="md:col-span-2 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden"
					>
						<summary
							class="flex items-center gap-2 px-4 md:px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
						>
							<History size={14} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
							<span class="text-[14px] font-semibold text-[var(--text-primary)]">Version History</span>
						</summary>
						<div class="px-4 md:px-5 pb-5">
							<div class="relative">
								<div class="absolute bg-[var(--border-default)] left-[7px] top-[8px] bottom-[8px] w-px"></div>
								<div class="flex flex-col gap-6">
									{#each versionHistory as version, index}
										<div class="pl-7 relative">
											<div
												class="absolute rounded-full"
												style="left: 0; top: 4px; width: 15px; height: 15px; background: {index === 0
													? 'var(--accent-base)'
													: 'var(--surface-3)'}; border: 2px solid {index === 0
													? 'var(--accent-base)'
													: 'var(--border-strong)'};"
											></div>
											<div class="flex items-center gap-[10px] mb-[6px]">
												<span class="text-[13px] font-semibold text-[var(--text-primary)] font-mono"
													>{version.version}</span
												>
												<span class="text-[12px] text-[var(--text-tertiary)]">{version.date}</span>
												{#if index === 0}
													<span
														class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.accent}"
														>Latest</span
													>
												{/if}
											</div>
											<p class="text-[13px] text-[var(--text-secondary)] leading-5">{version.notes}</p>
										</div>
									{/each}
								</div>
							</div>
						</div>
					</details>
				</div>
			{/if}

			<!-- ── ECONOMICS TAB ── -->
			{#if activeTab === 'economics'}
				<div class="flex flex-col gap-4">
					<!-- Earnings Estimator -->
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
						<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
							Earnings Estimator
						</p>
						<p class="text-[12px] text-[var(--text-tertiary)] mb-4">
							Estimate your potential earnings based on hours online per day.
						</p>
						<div class="flex flex-col gap-3">
							<div class="flex items-center gap-3">
								<label for="hours-slider" class="text-[13px] text-[var(--text-secondary)] shrink-0 w-[120px]"
									>Hours / day</label
								>
								<input
									id="hours-slider"
									type="range"
									min="1"
									max="24"
									step="1"
									bind:value={hoursPerDay}
									class="flex-1 accent-[var(--accent-base)]"
								/>
								<span class="text-[13px] font-mono text-[var(--text-primary)] w-[36px] text-right"
									>{hoursPerDay}h</span
								>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<div
									class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[6px] px-3 py-[10px] text-center"
								>
									<p class="text-[16px] font-semibold text-[var(--text-accent)] font-mono">
										${estimatedDaily.toFixed(2)}
									</p>
									<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">per day</p>
								</div>
								<div
									class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[6px] px-3 py-[10px] text-center"
								>
									<p class="text-[16px] font-semibold text-[var(--text-accent)] font-mono">
										${estimatedMonthly.toFixed(0)}
									</p>
									<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">per month</p>
								</div>
								<div
									class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[6px] px-3 py-[10px] text-center"
								>
									<p class="text-[16px] font-semibold text-[var(--text-accent)] font-mono">
										${estimatedYearly.toFixed(0)}
									</p>
									<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">per year</p>
								</div>
							</div>
							<p class="text-[11px] text-[var(--text-tertiary)]">
								Estimates based on average {app.rewardToken} earnings. Actual results vary by hardware and network
								conditions.
							</p>
						</div>
					</div>

					<!-- Reward Structure -->
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
						<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
							Reward Structure
						</p>
						<div class="flex flex-col gap-2">
							{#each [
								{ label: 'Model', value: app.rewardModel },
								{ label: 'Pricing', value: pricingModel ?? 'fixed' },
								...(baseRewardPerTask != null
									? [
											{
												label: 'Per-Task Reward',
												value: `${baseRewardPerTask.toFixed(4)} ${app.rewardToken}${minRewardPerTask != null && maxRewardPerTask != null ? ` (${minRewardPerTask.toFixed(4)}--${maxRewardPerTask.toFixed(4)})` : ''}`,
											},
										]
									: []),
								{ label: 'Miner Split', value: `${feeValid ? feeMinerPct : 80}%` },
								{ label: 'Developer Split', value: `${feeValid ? feeDevPct : 15}%` },
								{ label: 'Treasury Split', value: `${feeValid ? feeTreasuryPct : 5}%` },
								{ label: 'Daily Average', value: `$${app.avgEarningsPerDay.toFixed(2)} / miner` },
								{
									label: 'Monthly Average',
									value: `$${(app.avgEarningsPerDay * 30).toFixed(2)} / miner`,
								},
							] as row}
								<div class="flex justify-between items-center py-2 border-b border-[var(--border-default)]">
									<span class="text-[13px] text-[var(--text-tertiary)]">{row.label}</span>
									<span class="text-[13px] text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']"
										>{row.value}</span
									>
								</div>
							{/each}
						</div>
						<p class="text-[12px] text-[var(--text-tertiary)] mt-3">
							Payouts secured via JobEscrow. Top miners may receive a progressive pool bonus.
						</p>
					</div>

					<!-- Reward Tiers -->
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
						<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
							Reward Tiers
						</p>
						<p class="text-[12px] text-[var(--text-tertiary)] mb-3">
							Progressive reward pools incentivize top-performing miners with higher multipliers.
						</p>
						<div class="flex flex-col">
							{#each [
								{
									tier: 'Tier 1',
									range: 'Top 10%',
									multiplier: '1.5x',
									color: 'var(--text-accent)',
									bg: 'var(--accent-subtle)',
								},
								{
									tier: 'Tier 2',
									range: 'Top 25%',
									multiplier: '1.25x',
									color: 'var(--success)',
									bg: 'rgba(76,183,130,0.12)',
								},
								{
									tier: 'Tier 3',
									range: 'Top 50%',
									multiplier: '1.0x',
									color: 'var(--text-primary)',
									bg: 'var(--surface-3)',
								},
								{
									tier: 'Tier 4',
									range: 'Bottom 50%',
									multiplier: '0.85x',
									color: 'var(--text-secondary)',
									bg: 'var(--surface-3)',
								},
							] as t, i}
								<div
									class="flex items-center justify-between py-[10px] {i < 3
										? 'border-b border-[var(--border-default)]'
										: ''}"
								>
									<div class="flex items-center gap-3">
										<span
											class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap"
											style="background: {t.bg}; color: {t.color};"
										>
											{t.tier}
										</span>
										<span class="text-[13px] text-[var(--text-tertiary)]">{t.range}</span>
									</div>
									<div class="flex items-center gap-4">
										<span
											class="text-[13px] font-semibold font-mono [font-feature-settings:'tnum']"
											style="color: {t.color};"
										>
											{t.multiplier}
										</span>
										<span
											class="text-[12px] text-[var(--text-tertiary)] font-mono [font-feature-settings:'tnum'] w-[90px] text-right"
										>
											~${(app.avgEarningsPerDay * parseFloat(t.multiplier.replace('x', ''))).toFixed(2)}/day
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- SLA -->
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
						<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
							SLA & Penalties
						</p>
						<div class="flex flex-col gap-2">
							{#each [
								{
									label: 'Minimum Uptime Required',
									value: `${app.slaRequirements?.minUptime || 95}%`,
								},
								{
									label: 'Slashing Penalty',
									value: `${app.slaRequirements?.slashingPenalty || 5}%`,
								},
								{ label: 'Max Latency', value: `${app.slaRequirements?.maxLatency || 500}ms` },
							] as row}
								<div class="flex justify-between py-2 border-b border-[var(--border-default)]">
									<span class="text-[13px] text-[var(--text-tertiary)]">{row.label}</span>
									<span class="text-[13px] text-[var(--text-primary)] font-mono">{row.value}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- ── REQUIREMENTS TAB ── -->
			{#if activeTab === 'requirements'}
				<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
						Hardware Requirements
					</p>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<!-- CPU -->
						<div
							class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
						>
							<Cpu size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
							<div class="flex-1 min-w-0">
								<p class="text-[12px] font-semibold text-[var(--text-primary)]">CPU</p>
								<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{app.requirements.cpu || '2+ cores'}</p>
							</div>
							<div class="flex-shrink-0 mt-[2px]" title="Compatible">
								<CheckCircle2 size={14} strokeWidth={2} class="text-[var(--success)]" />
							</div>
						</div>
						<!-- Storage -->
						<div
							class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
						>
							<HardDrive size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
							<div class="flex-1 min-w-0">
								<p class="text-[12px] font-semibold text-[var(--text-primary)]">Storage</p>
								<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
									{app.requirements.storage || '100 GB'}
								</p>
							</div>
							<div class="flex-shrink-0 mt-[2px]" title="Compatible">
								<CheckCircle2 size={14} strokeWidth={2} class="text-[var(--success)]" />
							</div>
						</div>
						<!-- Bandwidth -->
						<div
							class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
						>
							<Wifi size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
							<div class="flex-1 min-w-0">
								<p class="text-[12px] font-semibold text-[var(--text-primary)]">Bandwidth</p>
								<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
									{app.requirements.bandwidth || '10 Mbps'}
								</p>
							</div>
							<div class="flex-shrink-0 mt-[2px]" title="Compatible">
								<CheckCircle2 size={14} strokeWidth={2} class="text-[var(--success)]" />
							</div>
						</div>
						<!-- GPU (conditional) -->
						{#if app.requirements.gpu}
							<div
								class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
							>
								<Monitor size={14} strokeWidth={1.5} class="text-[var(--text-accent)] shrink-0 mt-[2px]" />
								<div class="flex-1 min-w-0">
									<p class="text-[12px] font-semibold text-[var(--text-primary)]">GPU</p>
									<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{app.requirements.gpu}</p>
								</div>
								<div class="flex-shrink-0 mt-[2px]" title="Check your hardware">
									<AlertCircle size={14} strokeWidth={2} class="text-[var(--warning)]" />
								</div>
							</div>
						{/if}
					</div>
					<p class="text-[10px] text-[var(--text-tertiary)] mt-3">
						Compatibility is estimated from your browser. Run the Necter miner for full accuracy.
					</p>
				</div>
			{/if}

			<!-- ── REVIEWS TAB ── -->
			{#if activeTab === 'reviews'}
				<div class="grid gap-4 grid-cols-1 md:[grid-template-columns:220px_1fr]">
					<!-- Rating summary -->
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
						<div class="text-center mb-4">
							<p class="text-[40px] font-semibold text-[var(--text-primary)] font-mono leading-none">
								{(app.averageRating || 4.5).toFixed(1)}
							</p>
							<div class="flex justify-center gap-[3px] my-2">
								{#each Array(5) as _, i}
									<Star
										size={12}
										strokeWidth={0}
										fill={i < Math.round(app.averageRating || 4.5)
											? 'var(--accent-base)'
											: 'var(--surface-3)'}
									/>
								{/each}
							</div>
							<p class="text-[11px] text-[var(--text-tertiary)]">
								{ratingDistribution.reduce((a, b) => a + b.count, 0).toLocaleString()} ratings
							</p>
						</div>

						<div class="flex flex-col gap-[6px]">
							{#each ratingDistribution as item}
								<div class="flex items-center gap-[6px]">
									<span class="text-[11px] text-[var(--text-tertiary)] w-[10px]">{item.stars}</span>
									<Star size={9} strokeWidth={0} fill="var(--accent-base)" />
									<div class="flex-1 h-[3px] bg-[var(--surface-3)] rounded-full overflow-hidden">
										<div
											class="h-full bg-[var(--accent-base)] rounded-full"
											style="width: {item.percentage}%;"
										></div>
									</div>
									<span class="text-[11px] text-[var(--text-tertiary)] w-7 text-right font-mono"
										>{item.count}</span
									>
								</div>
							{/each}
						</div>
					</div>

					<!-- Review list -->
					<div>
						<div class="flex items-center justify-between mb-3">
							<p
								class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-0"
							>
								Miner Reviews
							</p>
							<select
								class="h-7 px-2 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] cursor-pointer"
							>
								<option>Most Helpful</option>
								<option>Most Recent</option>
								<option>Highest Rated</option>
								<option>Lowest Rated</option>
							</select>
						</div>

						<div class="flex flex-col gap-2">
							{#each (app.reviews ?? []).slice(0, 5) as review}
								<div
									class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px]"
								>
									<div class="flex items-start justify-between mb-2">
										<div>
											<div class="flex items-center gap-2">
												<img
													src={minerAvatarDataUri(review.minerId)}
													alt=""
													class="w-[22px] h-[22px] rounded-[5px]"
												/>
												<p class="text-[13px] font-semibold text-[var(--text-primary)]">
													{review.minerUsername}
												</p>
												<span
													class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.neutral}"
													>Verified Miner</span
												>
											</div>
											<div class="flex items-center gap-[6px] mt-1">
												<div class="flex gap-0.5">
													{#each Array(5) as _, i}
														<Star
															size={10}
															strokeWidth={0}
															fill={i < review.rating
																? 'var(--accent-base)'
																: 'var(--surface-3)'}
														/>
													{/each}
												</div>
												<span class="text-[11px] text-[var(--text-tertiary)]">Jan 15, 2026</span>
											</div>
										</div>
									</div>
									<p class="text-[13px] font-semibold text-[var(--text-primary)] mb-1">
										Great mining experience
									</p>
									<p class="text-[13px] text-[var(--text-secondary)] leading-5 mb-[10px]">
										{review.comment}
									</p>
									<div class="flex gap-4">
										<button
											type="button"
											class="inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] bg-transparent border-0 cursor-pointer p-0"
										>
											<ThumbsUp size={12} strokeWidth={1.5} />
											Helpful ({review.helpful})
										</button>
										<button
											type="button"
											class="inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] bg-transparent border-0 cursor-pointer p-0"
											onclick={() => {
												if (!$actor) {
													$showConnectModal = true;
													return;
												}
												reportOpen = true;
											}}
										>
											<Flag size={12} strokeWidth={1.5} />
											Report
										</button>
									</div>
								</div>
							{/each}

							<div class="flex items-center gap-2 mt-1">
								<a
									href="/apps/{app.id}/reviews"
									class="inline-flex items-center justify-center gap-[6px] h-8 px-4 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[13px] no-underline"
								>
									<MessageSquare size={13} strokeWidth={1.5} />
									View All Reviews
								</a>
								<a
									href="/apps/{app.id}/reviews"
									class="inline-flex items-center justify-center gap-[6px] h-8 px-4 rounded-[5px] bg-[var(--accent-base)] text-[#0C0C0E] text-[13px] font-medium no-underline"
								>
									Write a Review
								</a>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- ═══════════════════════════════════════════════════════
			     SCREENSHOTS
			════════════════════════════════════════════════════════ -->
			<div class="mt-8">
				<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
					Screenshots
				</p>
				<div class="flex gap-3 overflow-x-auto pb-1">
					{#each getAppScreenshots(app) as src, i}
						<img
							{src}
							alt="{app.name} screenshot {i + 1}"
							class="shrink-0 border border-[var(--border-default)] rounded-[12px] w-[280px] md:w-[440px] h-[180px] md:h-[280px] object-cover"
						/>
					{/each}
				</div>
			</div>

			<!-- ═══════════════════════════════════════════════════════
			     DEVELOPER INFO
			════════════════════════════════════════════════════════ -->
			<div class="mt-8 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
				<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Developer</p>
				<div class="flex justify-between items-start">
					<div>
						<a
							href="/profiles/{app.developerAddress}"
							class="text-[14px] font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] transition-colors duration-100 mb-[6px] block no-underline"
						>
							{app.developer}
						</a>
						<p class="text-[12px] text-[var(--text-tertiary)] font-mono mb-[10px]">
							{app.developerAddress
								? `${app.developerAddress.slice(0, 6)}...${app.developerAddress.slice(-4)}`
								: 'No address'}
						</p>
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[developerVerificationStatus === 'verified' ? 'success' : developerVerificationStatus === 'pending' ? 'warning' : 'neutral']}"
						>
							{developerVerificationStatus === 'verified'
								? 'Verified Developer'
								: developerVerificationStatus === 'pending'
									? 'Verification Pending'
									: 'Unverified Developer'}
						</span>
					</div>
					<a
						href="#"
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1 h-7 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
					>
						View Smart Contract
						<ExternalLink size={11} strokeWidth={1.5} />
					</a>
				</div>
			</div>

			<!-- ═══════════════════════════════════════════════════════
			     RELATED APPS
			════════════════════════════════════════════════════════ -->
			{#if relatedApps.length > 0}
				<div class="mt-8">
					<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
						You Might Also Like
					</p>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
						{#each relatedApps as relatedApp}
							<a href="/apps/{relatedApp.id}" class="no-underline">
								<div
									class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-3 cursor-pointer transition-[border-color] duration-100 ease-out hover:border-[var(--border-hover)]"
								>
									<div class="flex items-center gap-[10px] mb-[10px]">
										<img
											src={appIcon(relatedApp)}
											alt={relatedApp.name}
											width="36"
											height="36"
											class="rounded-[5px] shrink-0"
										/>
										<div class="min-w-0">
											<p
												class="text-[13px] font-semibold text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap"
											>
												{relatedApp.name}
											</p>
											<p class="text-[11px] text-[var(--text-tertiary)] mt-[1px]">
												{relatedApp.category}
											</p>
										</div>
									</div>
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-[3px]">
											<Star size={10} strokeWidth={0} fill="var(--accent-base)" />
											<span class="text-[11px] text-[var(--text-secondary)] font-mono"
												>{relatedApp.reputationScore}</span
											>
										</div>
										<span class="text-[11px] text-[var(--text-accent)] font-mono font-medium"
											>${relatedApp.avgEarningsPerDay}/day</span
										>
									</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- ═══════════════════════════════════════════════════════
		     STICKY CTA BAR
		════════════════════════════════════════════════════════ -->
		<div
			class="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-default)] bg-[var(--surface-1)]/95 backdrop-blur-sm md:hidden"
		>
			<div class="max-w-[960px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<img src={appIcon(app)} alt="" width="28" height="28" class="rounded-[6px]" />
					<div>
						<p class="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">{app.name}</p>
						<p class="text-[11px] text-[var(--text-tertiary)]">
							{#if miningStatus === 'not-subscribed'}
								{stakeAmount > 0 ? `${stakeAmount.toLocaleString()} NCT stake` : 'No stake required'}
							{:else if miningStatus === 'subscribed'}
								Ready to mine
							{:else}
								Mining active
							{/if}
						</p>
					</div>
				</div>
				<button
					onclick={handlePrimary}
					class="h-8 px-4 rounded-[6px] text-[13px] font-semibold cursor-pointer border-0
            {miningStatus === 'not-subscribed'
						? 'bg-[var(--accent-base)] text-[#0C0C0E]'
						: miningStatus === 'subscribed'
							? 'bg-[var(--success)] text-[#0C0C0E]'
							: 'bg-[var(--error)] text-white'}"
				>
					{#if miningStatus === 'not-subscribed'}Subscribe{:else if miningStatus === 'subscribed'}Start
						Mining{:else}Stop Mining{/if}
				</button>
			</div>
		</div>

		<!-- ═══════════════════════════════════════════════════════
		     NODE SETUP WIZARD
		════════════════════════════════════════════════════════ -->
		{#if isWizardOpen && app}
			<NodeSetupWizard
				appId={app.id}
				appName={app.name}
				requirements={{
					gpu: app.requirements?.gpu,
					ram: app.requirements?.ram,
					storage: app.requirements?.storage,
				}}
				stakingAmount={stakeAmount}
				onClose={() => {
					isWizardOpen = false;
					pendingSubId = null;
				}}
				onComplete={(subscriptionId) => {
					isWizardOpen = false;
					const subId = subscriptionId ?? pendingSubId;
					if (subId) {
						goto(`/mining/${encodeURIComponent(subId)}`);
					}
					pendingSubId = null;
				}}
			/>
		{/if}

		<!-- ═══════════════════════════════════════════════════════
		     SHARE DIALOG
		════════════════════════════════════════════════════════ -->
		{#if shareOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
				onclick={() => (shareOpen = false)}
			>
				<div
					class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[12px] p-6 w-[420px] max-w-[90vw] shadow-xl"
					onclick={(e) => e.stopPropagation()}
				>
					<h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Share {app.name}</h3>
					<p class="text-[13px] text-[var(--text-secondary)] mb-4">
						Copy a link or open the native share sheet.
					</p>

					<p class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase mb-[6px]">
						Shareable link
					</p>
					<input
						type="text"
						value={shareUrl}
						readonly
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
						<a
							href={shareUrl}
							target="_blank"
							rel="noreferrer"
							class="inline-flex items-center h-8 px-[14px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[13px] no-underline"
							>Open</a
						>
					</div>
				</div>
			</div>
		{/if}

		<!-- ═══════════════════════════════════════════════════════
		     REPORT DIALOG
		════════════════════════════════════════════════════════ -->
		{#if reportOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
				onclick={() => {
					reportOpen = false;
					reportReason = '';
				}}
			>
				<div
					class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[12px] p-6 w-[480px] max-w-[90vw] shadow-xl"
					onclick={(e) => e.stopPropagation()}
				>
					<h3 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Report {app.name}</h3>
					<p class="text-[13px] text-[var(--text-secondary)] mb-4">
						Flag suspicious behavior so governance can review and, if needed, delist. This is a prototype flow.
					</p>

					<div class="flex flex-col gap-[14px]">
						<div class="flex flex-col gap-[6px]">
							<p
								class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase"
							>
								Category
							</p>
							<select
								bind:value={reportCategory}
								class="h-9 px-3 py-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[13px] cursor-pointer outline-none"
							>
								<option value="scam">Scam</option>
								<option value="malware">Malware</option>
								<option value="economics">Economics / payout manipulation</option>
								<option value="impersonation">Impersonation</option>
								<option value="spam">Spam</option>
								<option value="other">Other</option>
							</select>
						</div>

						<div class="flex flex-col gap-[6px]">
							<p
								class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase"
							>
								Severity
							</p>
							<select
								bind:value={reportSeverity}
								class="h-9 px-3 py-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[13px] cursor-pointer outline-none"
							>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
							</select>
						</div>

						<div class="flex flex-col gap-[6px]">
							<p
								class="text-[11px] text-[var(--text-tertiary)] font-semibold tracking-[0.04em] uppercase"
							>
								Reason
							</p>
							<textarea
								bind:value={reportReason}
								rows="5"
								placeholder="Explain what's wrong. Fake rewards, suspicious URLs, malware behavior, abusive economics..."
								class="w-full px-3 py-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] text-[13px] resize-y outline-none"
							></textarea>
						</div>
					</div>

					<div class="flex justify-end gap-2 mt-4">
						<button
							onclick={() => (reportOpen = false)}
							class="h-8 px-[14px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[13px] cursor-pointer"
							>Cancel</button
						>
						<button
							disabled={!reportReason.trim()}
							onclick={handleSubmitReport}
							class="h-8 px-[14px] rounded-[5px] bg-[var(--error)] text-white text-[13px] font-semibold cursor-pointer border-0 disabled:opacity-40"
						>
							Submit report
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
