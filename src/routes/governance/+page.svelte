<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast, showError } from '$lib/stores/toast';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
	import { getAppIcon } from '$lib/app-icon';
	import {
		CheckCircle2,
		XCircle,
		AlertCircle,
		Coins,
		Lock,
		ArrowRight,
		Clock,
		AlertTriangle,
	} from 'lucide-svelte';
	import { Button, Badge, Modal, Input, Textarea } from '$lib/components/ui';

	const PROPOSAL_STAKES: Record<string, number> = {
		'parameter-update': 10,
		'reward-change': 25,
		'treasury': 50,
		'other': 10,
	};

	// ─── Urgency helpers ─────────────────────────────────────────────────────
	function getUrgency(endsAt?: string) {
		if (!endsAt) return null;
		const ms = new Date(endsAt).getTime() - Date.now();
		if (ms <= 0) return { label: 'Ended', color: 'var(--text-tertiary)', bg: 'var(--surface-3)', pulsing: false };
		if (ms < 3600000) return { label: 'Final Hour', color: 'var(--error)', bg: 'rgba(239,68,68,0.15)', pulsing: true };
		if (ms < 6 * 3600000) return { label: 'Closing Soon', color: 'var(--error)', bg: 'rgba(239,68,68,0.10)', pulsing: true };
		if (ms < 24 * 3600000) return { label: 'Ending Soon', color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)', pulsing: false };
		return null;
	}

	function formatTimeLeft(endsAt?: string) {
		if (!endsAt) return 'Open';
		const ms = new Date(endsAt).getTime() - Date.now();
		if (ms <= 0) return 'Ended';
		const hours = Math.floor(ms / 3600000);
		const mins = Math.floor((ms % 3600000) / 60000);
		if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
		if (hours > 0) return `${hours}h ${mins}m left`;
		return `${mins}m left`;
	}

	// ─── Backend / Wallet ──────────────────────────────────────────────────────
	const pendingListings = $derived(
		$backendState.governance.filter(
			(g: any) => g.status === 'review' || g.status === 'voting' || g.status === 'executing'
		)
	);
	const proposals = $derived(backend.listGovernanceProposals());

	const roles = $derived($actor?.walletAddress ? backend.listRoles($actor.walletAddress) : []);
	const hasGovRole = $derived(roles.includes('governance'));
	const walletAddress = $derived($actor?.walletAddress ?? null);

	// Governance balance
	const walletBalance = $derived($wallet?.address ? ($backendState.walletBalancesByAddress[$wallet.address] ?? 0) : 0);
	const govStake = $derived(walletAddress ? backend.getGovernanceStake(walletAddress) : { total: 0, locked: 0, available: 0 });
	const vpBreakdown = $derived(walletAddress ? backend.getVotingPowerBreakdown(walletAddress) : null);

	// ─── Create proposal modal state ──────────────────────────────────────────
	let showCreateModal = $state(false);
	let createStep = $state<1 | 2 | 3>(1);
	let propTitle = $state('');
	let propDesc = $state('');
	let propType = $state<'parameter-update' | 'reward-change' | 'treasury' | 'other'>('parameter-update');
	let propDuration = $state(7);
	let propParam = $state('');
	let propCurrentValue = $state('');
	let propNewValue = $state('');
	let propImpact = $state('');

	const stakeRequired = $derived(PROPOSAL_STAKES[propType] ?? 500);
	const canAffordStake = $derived((walletBalance + govStake.available) >= stakeRequired);
	const canSubmitProp = $derived(propTitle.trim().length >= 6 && propDesc.trim().length >= 20);

	// Time ticker for urgency countdowns
	let tick = $state(0);
	$effect(() => {
		const interval = setInterval(() => { tick += 1; }, 60000);
		return () => clearInterval(interval);
	});

	function resetCreateModal() {
		createStep = 1;
		propTitle = ''; propDesc = ''; propParam = ''; propCurrentValue = ''; propNewValue = ''; propImpact = '';
		propType = 'parameter-update'; propDuration = 7;
	}

	// ─── Safe action wrapper ──────────────────────────────────────────────────
	function safe(fn: () => void) {
		try {
			fn();
		} catch (e: any) {
			showError('Action failed', e?.message ?? 'Please try again.');
		}
	}

	// ─── Derived: pending queue ───────────────────────────────────────────────
	const pendingQueue = $derived(
		pendingListings
			.map((g: any) => {
				const app = $backendState.apps.find((a: any) => a.id === g.appId) ?? null;
				return { g, app };
			})
			.sort((a: any, b: any) => new Date(b.g.createdAt).getTime() - new Date(a.g.createdAt).getTime())
	);

	// ─── Derived: developer verifications ─────────────────────────────────────
	const pendingDeveloperVerifications = $derived(
		Object.values(($backendState as any).developerVerificationByAddress ?? {}).filter(
			(r: any) => r.status === 'pending'
		)
	);

	const pendingDeveloperEnrollments = $derived(
		Object.values(($backendState as any).developerEnrollmentByAddress ?? {}).filter(
			(r: any) => r.status === 'pending'
		)
	);

	// ─── Derived: moderation cases & apps lookup ──────────────────────────────
	const moderationCases = $derived(backend.listModerationCases({ status: 'open', limit: 25 }));
	const appsById = $derived(new Map($backendState.apps.map((a: any) => [a.id, a])));

	// ─── Derived: stats ──────────────────────────────────────────────────────
	const activeProposalsForVote = $derived(proposals.filter((p: any) => p.status === 'active'));
	const activeProposalCount = $derived(activeProposalsForVote.length);
	const expiringToday = $derived(
		proposals.filter((p: any) => {
			if (p.status !== 'active' || !p.endsAt) return false;
			return new Date(p.endsAt).getTime() - Date.now() < 24 * 3600000;
		}).length
	);
	const totalVP = $derived(backend.getTotalVotingPower());

	// ─── Derived: vote items ──────────────────────────────────────────────────
	const voteItems = $derived(
		(() => {
			// Force reactive dependency on tick
			void tick;
			const activeProposals = proposals.filter((p: any) => p.status === 'active');
			const items = [
				...activeProposals.map((p: any) => ({ kind: 'proposal' as const, createdAt: p.createdAt, data: p })),
				...pendingQueue
					.filter(({ g }: any) => g.status === 'voting' || g.status === 'review')
					.map((item: any) => ({ kind: 'listing' as const, createdAt: item.g.createdAt, data: item })),
				...moderationCases.map((c: any) => ({ kind: 'moderation' as const, createdAt: c.createdAt, data: c })),
			];
			// Sort: urgency first (proposals ending soonest), then by date
			items.sort((a: any, b: any) => {
				const aEnd = a.kind === 'proposal' && a.data.endsAt ? new Date(a.data.endsAt).getTime() : Infinity;
				const bEnd = b.kind === 'proposal' && b.data.endsAt ? new Date(b.data.endsAt).getTime() : Infinity;
				if (aEnd !== bEnd) return aEnd - bEnd;
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});
			return items;
		})()
	);

	// ─── Derived: recent decisions ────────────────────────────────────────────
	const decisions = $derived(
		(() => {
			const completedProposals = proposals.filter(
				(p: any) => p.status === 'passed' || p.status === 'rejected' || p.status === 'executed'
			);
			const finalizedListings = $backendState.governance.filter(
				(g: any) => g.status === 'approved' || g.status === 'rejected'
			);
			return [
				...completedProposals.map((p: any) => ({
					kind: 'proposal' as const,
					title: p.title,
					status: p.status,
					date: p.createdAt,
				})),
				...finalizedListings.map((g: any) => {
					const app = $backendState.apps.find((a: any) => a.id === g.appId);
					return {
						kind: 'listing' as const,
						title: app?.name ?? g.appId,
						status: g.status,
						date: g.decidedAt ?? g.createdAt,
					};
				}),
			]
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
				.slice(0, 8);
		})()
	);

	function openCreateModal() {
		if (!$actor) {
			$showConnectModal = true;
			return;
		}
		if (!hasGovRole) {
			backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true });
		}
		resetCreateModal();
		showCreateModal = true;
	}

	const proposalTypes = [
		{ id: 'parameter-update' as const, label: 'Parameter Update', desc: 'Change a platform setting', stake: 10 },
		{ id: 'reward-change' as const, label: 'Reward Change', desc: 'Modify reward economics', stake: 25 },
		{ id: 'treasury' as const, label: 'Treasury Spend', desc: 'Allocate treasury funds', stake: 50 },
		{ id: 'other' as const, label: 'Other', desc: 'General proposal', stake: 10 },
	];
</script>

<svelte:head>
	<title>Governance — Necter Mining App Store</title>
</svelte:head>

<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Governance</h1>
			<p class="text-[12px] text-[var(--text-secondary)] mt-0.5 hidden md:block">
				Vote on proposals, review listings, and moderate flagged projects.
			</p>
		</div>
		<div class="hidden md:block">
			<Button onclick={openCreateModal}>
				Create Proposal
			</Button>
		</div>
	</div>

	<!-- Stats Grid -->
	<div
		class="mobile-grid-2 grid grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden mb-6"
	>
		{#each [
			{ label: 'Active Proposals', value: activeProposalCount.toString(), accent: false },
			{ label: 'Pending Listings', value: pendingListings.length.toString(), accent: false },
			{ label: 'Expiring Today', value: expiringToday.toString(), accent: expiringToday > 0 },
			{ label: 'Your VP', value: vpBreakdown ? vpBreakdown.effectiveVP.toLocaleString() : '\u2014', accent: false },
		] as s}
			<div class="bg-[var(--surface-1)] px-3.5 py-3">
				<span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]"
					>{s.label}</span
				>
				<p
					class="text-[18px] font-semibold font-mono mt-1 {s.accent
						? 'text-[var(--warning)]'
						: 'text-[var(--text-primary)]'}"
				>
					{s.value}
				</p>
			</div>
		{/each}
	</div>

	<!-- Create Proposal — mobile, under stats -->
	<div class="md:hidden mt-4 mb-4">
		<Button class="w-full" onclick={openCreateModal}>
			Create Proposal
		</Button>
	</div>

	<!-- ═══════════════════════════════════════════
       SECTION: VOTING — split by type
      ═══════════════════════════════════════════ -->
	<div class="space-y-6">

		<!-- Active Proposals -->
		{#if activeProposalsForVote.length > 0}
			<div>
				<h2 class="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2.5">Proposals ({activeProposalsForVote.length})</h2>
				<div class="space-y-2">
					{#each activeProposalsForVote as proposal (proposal.id)}
						{@const totalVotes = proposal.votesFor + proposal.votesAgainst}
						{@const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0}
						{@const urgency = getUrgency(proposal.endsAt)}
						{@const quorumPct = totalVP > 0 ? (totalVotes / (totalVP * (proposal.quorumPercent / 100))) * 100 : 0}
						{@const quorumMet = quorumPct >= 100}
						<a
							href="/governance/proposals/{proposal.id}"
							class="block p-3 md:p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors no-underline cursor-pointer"
						>
							<div class="flex items-center gap-2 mb-1.5">
								{#if urgency}
									<span
										class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[9px] font-semibold uppercase flex-shrink-0 {urgency.pulsing ? 'animate-pulse' : ''}"
										style="background: {urgency.bg}; color: {urgency.color};"
									>{urgency.label}</span>
								{/if}
								<h3 class="text-[13px] font-semibold text-[var(--text-primary)] truncate flex-1 min-w-0">{proposal.title}</h3>
							</div>
							<div class="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] mb-2">
								<span class="flex items-center gap-1">
									<Clock class="h-3 w-3" />
									<span style="color: {urgency ? urgency.color : 'inherit'}; font-weight: {urgency ? 600 : 'inherit'};">{formatTimeLeft(proposal.endsAt)}</span>
								</span>
								<span>{totalVotes.toLocaleString()} VP</span>
								<span style="color: {quorumMet ? 'var(--success)' : 'var(--warning)'};">Quorum {quorumMet ? '\u2713' : `${quorumPct.toFixed(0)}%`}</span>
							</div>
							<div class="h-1.5 rounded-full w-full bg-[rgba(235,87,87,0.15)] overflow-hidden flex">
								<div class="h-full bg-[var(--success)] rounded-l-full transition-all duration-300" style="width: {forPct}%"></div>
							</div>
							<div class="flex justify-between text-[10px] mt-1">
								<span class="text-[var(--success)]">For {forPct.toFixed(0)}%</span>
								<span class="text-[var(--error)]">Against {(100 - forPct).toFixed(0)}%</span>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Listing Reviews -->
		{#if pendingListings.length > 0}
			<div>
				<h2 class="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2.5">Listing Reviews ({pendingListings.length})</h2>
				<div class="space-y-2">
					{#each pendingListings as g (g.appId)}
						{@const app = appsById.get(g.appId) ?? null}
						{@const totalVotes = g.yesVotes + g.noVotes}
						{@const yesPct = totalVotes > 0 ? (g.yesVotes / totalVotes) * 100 : 0}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="p-3 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors cursor-pointer"
							onclick={() => goto(`/governance/review/${g.appId}`)}
							onkeydown={(e) => { if (e.key === 'Enter') goto(`/governance/review/${g.appId}`); }}
						>
							<div class="flex items-center gap-2 mb-2">
								{#if app}
									<img src={getAppIcon(app)} alt="" class="w-7 h-7 rounded-[6px] shrink-0" />
								{/if}
								<div class="flex-1 min-w-0">
									<span class="text-[13px] font-semibold text-[var(--text-primary)] truncate block">{app?.name || `App ${g.appId}`}</span>
									<span class="text-[11px] text-[var(--text-tertiary)]">{g.yesVotes + g.noVotes} of {g.requiredAttestations} votes</span>
								</div>
							</div>
							<div class="h-1.5 rounded-full w-full bg-[rgba(235,87,87,0.15)] overflow-hidden flex mb-1">
								<div class="h-full bg-[var(--success)] rounded-l-full transition-all duration-300" style="width: {yesPct}%"></div>
							</div>
							<div class="flex justify-between text-[10px] mb-2.5">
								<span class="font-mono text-[var(--success)]">{g.yesVotes} yes</span>
								<span class="font-mono text-[var(--error)]">{g.noVotes} no</span>
							</div>
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="flex gap-2" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
								<Button variant="secondary" class="flex-1 h-[32px] text-[12px]"
									onclick={(e) => { e.stopPropagation(); if (!$actor) { $showConnectModal = true; return; } if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); } safe(() => { backend.castGovernanceAttestation({ appId: g.appId, attestor: $actor.walletAddress, direction: 'yes' }); showToast('Approved'); }); }}
								>Approve</Button>
								<Button variant="secondary" class="flex-1 h-[32px] text-[12px]"
									onclick={(e) => { e.stopPropagation(); if (!$actor) { $showConnectModal = true; return; } if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); } safe(() => { backend.castGovernanceAttestation({ appId: g.appId, attestor: $actor.walletAddress, direction: 'no' }); showToast('Rejected'); }); }}
								>Reject</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Flagged Projects -->
		{#if moderationCases.length > 0}
			<div>
				<h2 class="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2.5">Flagged Projects ({moderationCases.length})</h2>
				<div class="space-y-2">
					{#each moderationCases as c (c.appId)}
						{@const app = appsById.get(c.appId) ?? null}
						<div class="p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)]">
							<div class="flex items-center gap-2 mb-2">
								{#if app}
									<img src={getAppIcon(app)} alt="" class="w-6 h-6 rounded-[5px] shrink-0" />
								{/if}
								<div class="min-w-0 flex-1">
									<div class="text-[13px] font-medium text-[var(--text-primary)] truncate">{app?.name ?? c.appId}</div>
									<div class="text-[10px] text-[var(--text-tertiary)]">{c.reportCount} reports</div>
								</div>
								<Badge variant="error" class="flex-shrink-0 text-[9px] font-semibold uppercase">Flagged</Badge>
							</div>
							<div class="flex gap-2">
								<Button variant="secondary"
									onclick={() => { if (!$actor) { $showConnectModal = true; return; } if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); } safe(() => backend.castModerationVote({ appId: c.appId, voterId: $actor.walletAddress, direction: 'keep' })); }}
								>Keep</Button>
								<Button variant="secondary"
									onclick={() => { if (!$actor) { $showConnectModal = true; return; } if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); } safe(() => backend.castModerationVote({ appId: c.appId, voterId: $actor.walletAddress, direction: 'delist' })); }}
								>Delist</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Empty state -->
		{#if activeProposalsForVote.length === 0 && pendingListings.length === 0 && moderationCases.length === 0}
			<div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
				<div class="flex items-start gap-3">
					<AlertCircle class="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
					<div>
						<div class="text-[13px] font-semibold text-[var(--text-primary)]">Nothing to vote on right now</div>
						<div class="text-[12px] text-[var(--text-secondary)] mt-1">Active proposals, listing reviews, and moderation cases will appear here.</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Developer Applications — desktop only -->
		{#if hasGovRole && (pendingDeveloperVerifications.length > 0 || pendingDeveloperEnrollments.length > 0)}
			<div class="mb-8 hidden md:block mt-8">
				<h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">
					Developer Applications
				</h2>
				<div class="space-y-2">
					{#each pendingDeveloperVerifications as r (r.walletAddress)}
						<div
							class="p-3 rounded-[8px] border border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-1)]"
						>
							<div class="min-w-0">
								<div class="text-[12px] font-mono text-[var(--text-primary)] truncate">
									{r.walletAddress}
								</div>
								<div class="text-[11px] text-[var(--text-tertiary)]">Identity verification</div>
							</div>
							<div class="flex gap-2 flex-shrink-0">
								<Button variant="secondary"
									onclick={() =>
										safe(() =>
											backend.reviewDeveloperVerification({
												walletAddress: r.walletAddress,
												status: 'verified',
												notes: 'Approved.',
											})
										)}>Approve</Button>
								<Button
									variant="secondary"
									onclick={() =>
										safe(() =>
											backend.reviewDeveloperVerification({
												walletAddress: r.walletAddress,
												status: 'rejected',
												notes: 'Rejected.',
											})
										)}>Reject</Button>
							</div>
						</div>
					{/each}
					{#each pendingDeveloperEnrollments as r (r.walletAddress)}
						<div
							class="p-3 rounded-[8px] border border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-1)]"
						>
							<div class="min-w-0">
								<div class="text-[12px] font-mono text-[var(--text-primary)] truncate">
									{r.walletAddress}
								</div>
								<div class="text-[11px] text-[var(--text-tertiary)]">
									{r.displayName ? `${r.displayName} \u00b7 ` : ''}Enrollment
								</div>
							</div>
							<div class="flex gap-2 flex-shrink-0">
								<Button variant="secondary"
									onclick={() =>
										safe(() =>
											backend.reviewDeveloperEnrollment({
												walletAddress: r.walletAddress,
												status: 'active',
												notes: 'Approved.',
											})
										)}>Approve</Button>
								<Button
									variant="secondary"
									onclick={() =>
										safe(() =>
											backend.reviewDeveloperEnrollment({
												walletAddress: r.walletAddress,
												status: 'rejected',
												notes: 'Rejected.',
											})
										)}>Reject</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Recent Decisions — desktop only -->
		{#if decisions.length > 0}
			<div class="hidden md:block mt-8">
				<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Recent Decisions</h2>
				<div
					class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden divide-y divide-[var(--border-default)]"
				>
					{#each decisions as d, i}
						<div class="flex items-center justify-between px-4 py-2.5">
							<div class="flex items-center gap-2 min-w-0">
								<span
									class="text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[var(--text-tertiary)] uppercase"
									>{d.kind}</span
								>
								<span class="text-[13px] text-[var(--text-primary)] truncate">{d.title}</span>
							</div>
							<div class="flex items-center gap-2 flex-shrink-0">
								<span
									class="text-[11px] font-medium capitalize {d.status === 'passed' ||
									d.status === 'approved' ||
									d.status === 'executed'
										? 'text-[var(--success)]'
										: 'text-[var(--error)]'}">{d.status}</span
								>
								<span class="text-[10px] text-[var(--text-tertiary)] font-mono"
									>{new Date(d.date).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
									})}</span
								>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- ══════════════════════════════════════════
       CREATE PROPOSAL MODAL
      ══════════════════════════════════════════ -->
	<Modal bind:open={showCreateModal} maxWidth="520px" class="!p-0 max-h-[100vh] md:max-h-[85vh] overflow-y-auto">
				<!-- Modal header -->
				<div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
					<div>
						<p class="text-[14px] font-semibold text-[var(--text-primary)] m-0">Create Proposal</p>
						<p class="text-[11px] text-[var(--text-tertiary)] m-0 mt-0.5">Step {createStep} of 3</p>
					</div>
					<button
						onclick={() => (showCreateModal = false)}
						class="text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer text-[18px] leading-none"
						>&times;</button
					>
				</div>

				<!-- Progress indicators -->
				<div class="flex gap-[3px] px-6 pt-3">
					{#each [1, 2, 3] as s}
						<div
							class="flex-1 h-[2px] rounded-[1px] transition-colors duration-300 {s <= createStep
								? 'bg-[var(--accent-base)]'
								: 'bg-[var(--surface-3)]'}"
						></div>
					{/each}
				</div>

				<div class="p-6">
					<!-- Step 1: Type + Title + Duration -->
					{#if createStep === 1}
						<div class="space-y-5">
							<div>
								<p
									class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2"
								>
									Proposal Type
								</p>
								<div class="grid grid-cols-2 gap-2">
									{#each proposalTypes as t}
										<button
											type="button"
											onclick={() => (propType = t.id)}
											class="text-left p-3 rounded-[6px] border transition-colors {propType === t.id
												? 'border-[var(--border-accent)] bg-[var(--accent-subtle)]'
												: 'border-[var(--border-default)] bg-[var(--surface-2)]'}"
										>
											<p
												class="text-[13px] font-medium m-0 {propType === t.id
													? 'text-[var(--text-accent)]'
													: 'text-[var(--text-primary)]'}"
											>
												{t.label}
											</p>
											<p class="text-[11px] text-[var(--text-tertiary)] m-0 mt-0.5">{t.desc}</p>
											<p
												class="text-[10px] font-mono mt-1 m-0 {propType === t.id
													? 'text-[var(--text-accent)]'
													: 'text-[var(--text-tertiary)]'}"
											>
												Stake: {t.stake} NECTA
											</p>
										</button>
									{/each}
								</div>
							</div>
							<div>
								<label
									class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5"
									>Title *</label
								>
								<Input
									bind:value={propTitle}
									placeholder="e.g. Increase dispute window for proofs"
								/>
							</div>
							<div>
								<label
									class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5"
									>Voting Duration</label
								>
								<div class="flex gap-2">
									{#each [3, 5, 7, 14] as d}
										<button
											type="button"
											onclick={() => (propDuration = d)}
											class="h-8 px-3 rounded-[5px] text-[12px] font-medium border-none cursor-pointer {propDuration === d
												? 'bg-[var(--accent-subtle)] text-[var(--text-accent)]'
												: 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}"
										>
											{d} days
										</button>
									{/each}
								</div>
							</div>
							<Button variant="secondary"
								disabled={propTitle.trim().length < 6}
								onclick={() => (createStep = 2)}
								size="lg"
								class="w-full justify-center"
							>
								Continue <ArrowRight size={14} strokeWidth={2} />
							</Button>
						</div>

						<!-- Step 2: Description + optional params + impact -->
					{:else if createStep === 2}
						<div class="space-y-5">
							<div>
								<label
									class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5"
									>Description *</label
								>
								<Textarea
									bind:value={propDesc}
									placeholder="Explain what changes, why it matters, and what the expected impact is."
									rows={5}
									class="resize-none"
								/>
								<div class="text-[10px] text-[var(--text-tertiary)] font-mono mt-1">
									{propDesc.trim().length}/2000
								</div>
							</div>
							{#if propType === 'parameter-update' || propType === 'reward-change'}
								<div class="space-y-3">
									<div>
										<label
											class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5"
											>Parameter to change</label
										>
										<Input
											bind:value={propParam}
											placeholder="e.g. minStake, proofTimeout"
											class="font-mono"
										/>
									</div>
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label
												class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5"
												>Current Value</label
											>
											<Input
												bind:value={propCurrentValue}
												placeholder="e.g. 100"
												class="font-mono"
											/>
										</div>
										<div>
											<label
												class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5"
												>Proposed Value</label
											>
											<Input
												bind:value={propNewValue}
												placeholder="e.g. 200"
												class="font-mono"
											/>
										</div>
									</div>
								</div>
							{/if}
							<div>
								<label
									class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5"
									>Impact Analysis</label
								>
								<Textarea
									bind:value={propImpact}
									placeholder="How will this change affect miners, developers, and the ecosystem?"
									rows={3}
									class="resize-none"
								/>
							</div>
							<div class="flex gap-2">
								<Button variant="secondary"
									onclick={() => (createStep = 1)}
									size="lg"
									class="px-4">Back</Button>
								<Button
									disabled={propDesc.trim().length < 20}
									onclick={() => (createStep = 3)}
									size="lg"
									class="flex-1 justify-center"
								>
									Review & Stake <ArrowRight size={14} strokeWidth={2} />
								</Button>
							</div>
						</div>

						<!-- Step 3: Review + Stake -->
					{:else if createStep === 3}
						<div class="space-y-5">
							<p
								class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em]"
							>
								Review Your Proposal
							</p>
							<div
								class="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3"
							>
								<div class="flex justify-between">
									<span class="text-[11px] text-[var(--text-tertiary)]">Type</span>
									<span class="text-[12px] text-[var(--text-primary)] capitalize"
										>{propType.replace('-', ' ')}</span
									>
								</div>
								<div class="flex justify-between">
									<span class="text-[11px] text-[var(--text-tertiary)]">Title</span>
									<span class="text-[12px] text-[var(--text-primary)]">{propTitle}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-[11px] text-[var(--text-tertiary)]">Duration</span>
									<span class="text-[12px] text-[var(--text-primary)]">{propDuration} days</span>
								</div>
								{#if propParam}
									<div class="flex justify-between">
										<span class="text-[11px] text-[var(--text-tertiary)]">Parameter</span>
										<span class="text-[12px] text-[var(--text-primary)] font-mono"
											>{propParam}: {propCurrentValue} &rarr; {propNewValue}</span
										>
									</div>
								{/if}
							</div>
							<div
								class="rounded-[8px] border border-[var(--border-accent)] bg-[var(--accent-subtle)] p-4"
							>
								<div class="flex items-center gap-2 mb-2">
									<Coins class="h-4 w-4 text-[var(--text-accent)]" />
									<span class="text-[13px] font-semibold text-[var(--text-primary)]"
										>Stake Required</span
									>
								</div>
								<div class="flex items-baseline gap-2 mb-2">
									<span class="text-[24px] font-bold font-mono text-[var(--text-accent)]"
										>{stakeRequired}</span
									>
									<span class="text-[13px] text-[var(--text-secondary)]">NECTA</span>
								</div>
								<p class="text-[11px] text-[var(--text-tertiary)] leading-[16px] m-0">
									Your stake is locked until voting ends. If your proposal passes, you receive 2x
									your stake back.
								</p>
								{#if !canAffordStake}
									<p class="text-[11px] text-[var(--error)] mt-2 m-0 font-medium">
										Insufficient balance. You have {walletBalance.toFixed(0)} wallet + {govStake.available.toFixed(
											0
										)} staked = {(walletBalance + govStake.available).toFixed(0)} NECTA. Need {stakeRequired}.
									</p>
								{/if}
							</div>
							<div class="flex gap-2">
								<Button variant="secondary"
									onclick={() => (createStep = 2)}
									size="lg"
									class="px-4">Back</Button>
								<Button
									disabled={!canSubmitProp || !canAffordStake}
									size="lg"
									class="flex-1 justify-center"
									onclick={() => {
										if (!$actor?.walletAddress) { $showConnectModal = true; return; }
										if (!hasGovRole) { backend.setRoleEnabled({ walletAddress: $actor.walletAddress, role: 'governance', enabled: true }); }
										const fullDesc = [propDesc, propParam ? `\n\nParameter: ${propParam}\nCurrent: ${propCurrentValue}\nProposed: ${propNewValue}` : '', propImpact ? `\n\nImpact Analysis: ${propImpact}` : ''].join('');
										const p = backend.createGovernanceProposal({ title: propTitle, description: fullDesc, type: propType, createdBy: $actor.walletAddress, durationDays: propDuration });
										showCreateModal = false;
										resetCreateModal();
										showToast('Proposal created', `${stakeRequired} NECTA staked. Voting is now open.`);
										goto(`/governance/proposals/${p.id}`);
									}}
								>
									<Lock class="h-3.5 w-3.5" /> Stake {stakeRequired} NECTA & Submit
								</Button>
							</div>
						</div>
					{/if}
				</div>
	</Modal>
</div>
