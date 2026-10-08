<script lang="ts">
	import { page } from '$app/stores';
	import { signedIn } from '$lib/stores/wallet';
	import { balances, nectaOf } from '$lib/stores/balances';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Token } from '$lib/api/types';
	import { formatAmount, formatNumber, bpToPercent, formatMs, timeAgo, shortHex } from '$lib/format';
	import EarningsPanel from '$lib/components/mining/EarningsPanel.svelte';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import { ArrowUpRight, AlertTriangle, Droplets, Gift, Cpu, Smartphone, Link2, Compass } from 'lucide-svelte';
	import { Button, Card, StatCard } from '$lib/components/ui';
	import {
		amountOf,
		bigOf,
		chartValue,
		deviceStatus,
		eventHref,
		eventMeta,
		proofStatus,
		subStatus,
		sumByToken,
		TONE_COLOR
	} from '$lib/components/mining/labels';
	import { iconProject, projectName, projectRef } from '$lib/components/mining/projects.svelte';

	type TabId = 'networks' | 'earnings' | 'proofs';

	let initialTab = $derived(($page.url.searchParams.get('tab') as TabId) || 'networks');
	let tab = $state<TabId>('networks');
	$effect(() => {
		tab = initialTab;
	});

	const on = { enabled: () => $signedIn };
	const devicesQ = useQuery(() => hub.myDevices({ limit: 200 }), on);
	const subsQ = useQuery(() => hub.mySubscriptions({ limit: 200 }), on);
	const earningsQ = useQuery(() => hub.earnings({ period: '30d', group_by: 'day' }), on);
	const topQ = useQuery(() => hub.earnings({ period: '30d', group_by: 'project' }), on);
	const collateralQ = useQuery(() => hub.collateral(), on);
	const statsQ = useQuery(() => hub.proofStats({ period: '30d' }), on);
	const alertsQ = useQuery(() => hub.alerts(), on);
	const claimsQ = useQuery(() => hub.claims(), on);
	const proofsQ = useQuery(() => hub.proofs({ limit: 200 }), on);
	const payoutsQ = useQuery(() => hub.epochPayouts({ limit: 8 }), on);
	const eventsQ = useQuery(() => hub.myEvents({ limit: 8 }), on);

	let devices = $derived(devicesQ.data?.items ?? []);
	let subs = $derived(subsQ.data?.items ?? []);
	let activeCount = $derived(subs.filter((s) => s.status === 'active').length);
	let alerts = $derived(alertsQ.data?.items ?? []);
	let proofs = $derived(proofsQ.data?.items ?? []);

	let primaryLoaded = $derived(devicesQ.settled && subsQ.settled);
	let freshWallet = $derived(primaryLoaded && !devicesQ.error && !subsQ.error && devices.length === 0 && subs.length === 0);

	// NECTA balance: chain read from the balances store, else the collateral summary.
	let nectaBalance = $derived.by(() => {
		const b = nectaOf($balances);
		if (b) return bigOf(b.amount);
		if (collateralQ.data?.necta_balance !== undefined) return bigOf(collateralQ.data.necta_balance);
		return null;
	});
	let needsFaucet = $derived(nectaBalance === 0n);

	let claimable = $derived(sumByToken(claimsQ.data?.items ?? []));
	let bonded = $derived(bigOf(collateralQ.data?.bonded));

	// Reward token for the stat cards / chart — amounts are per token, never summed across tokens.
	let tokens = $derived.by(() => {
		const m = new Map<string, Token>();
		for (const t of earningsQ.data?.totals ?? []) m.set(t.token.address.toLowerCase(), t.token);
		for (const s of subs) if (s.token) m.set(s.token.address.toLowerCase(), s.token);
		return [...m.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
	});
	let tokenAddr = $state<string | null>(null);
	let token = $derived(tokens.find((t) => t.address.toLowerCase() === tokenAddr) ?? tokens[0] ?? null);

	let series = $derived.by(() => {
		const now = new Date();
		const anchor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
		const keys = Array.from({ length: 30 }, (_, i) => new Date(anchor - (29 - i) * 86400000).toISOString().slice(0, 10));
		const map = new Map<string, bigint>();
		for (const r of earningsQ.data?.rows ?? []) if (r.key && token) map.set(r.key, amountOf(r.amounts, token.address));
		return keys.map((date) => ({ date, value: map.get(date) ?? 0n }));
	});
	const sumLast = (n: number) => series.slice(-n).reduce((s, p) => s + p.value, 0n);
	let earned30d = $derived(token ? amountOf(earningsQ.data?.totals, token.address) : 0n);
	let earned7d = $derived(sumLast(7));
	let earnedToday = $derived(sumLast(1));
	let chartMax = $derived(series.reduce((a, b) => (b.value > a ? b.value : a), 0n));
	const fmtTok = (v: bigint) => (token ? formatAmount(v, token.decimals) : '0');
	const barRatio = (v: bigint) => (chartMax > 0n ? chartValue((v * 10n ** 18n) / chartMax, 18) : 0);
	const shortDate = (k: string) => {
		const d = new Date(`${k}T00:00:00Z`);
		return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
	};

	let mobileTooltip = $state<{ index: number; x: number } | null>(null);
	let desktopTooltip = $state<{ index: number; x: number } | null>(null);

	let topProjects = $derived(
		(topQ.data?.rows ?? [])
			.filter((r) => r.key)
			.sort((a, b) => (b.units ?? 0) - (a.units ?? 0))
			.slice(0, 3)
	);

	// ── proofs tab ──
	let stats = $derived(statsQ.data);
	let proofsDailyRate = $derived.by(() => {
		const now = new Date();
		const anchor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
		const keys = Array.from({ length: 14 }, (_, i) => new Date(anchor - (13 - i) * 86400000).toISOString().slice(0, 10));
		const sub = new Map<string, number>();
		const ver = new Map<string, number>();
		for (const p of proofs) {
			const day = new Date(p.submitted_at * 1000).toISOString().slice(0, 10);
			sub.set(day, (sub.get(day) ?? 0) + 1);
			if (p.status === 'verified') ver.set(day, (ver.get(day) ?? 0) + 1);
		}
		const bars = keys.map((k) => ({ date: k, submitted: sub.get(k) ?? 0, verified: ver.get(k) ?? 0 }));
		return { bars, maxVal: Math.max(...bars.map((b) => b.submitted), 1), any: bars.some((b) => b.submitted > 0) };
	});
	let failureByProject = $derived.by(() => {
		const by = new Map<string, { total: number; failed: number }>();
		for (const p of proofs) {
			const e = by.get(p.project_id) ?? { total: 0, failed: 0 };
			e.total++;
			if (p.status === 'rejected' || p.status === 'missed') e.failed++;
			by.set(p.project_id, e);
		}
		return [...by.entries()].filter(([, v]) => v.failed > 0).sort((a, b) => b[1].failed - a[1].failed);
	});
	let successColor = $derived(
		stats?.success_bp === undefined ? 'var(--text-primary)' : stats.success_bp >= 9000 ? 'var(--success)' : stats.success_bp >= 5000 ? 'var(--text-primary)' : 'var(--error)'
	);

	function expected(p: { project_id: string; expected_amount?: string }) {
		const t = projectRef(p.project_id)?.token;
		if (!p.expected_amount || !t) return '—';
		return `${formatAmount(p.expected_amount, t.decimals)} ${t.symbol}`;
	}

	function subEarned(s: { earned_total?: string; token?: Token }) {
		if (!s.token || s.earned_total === undefined) return '—';
		return `${formatAmount(s.earned_total, s.token.decimals, { maxFrac: 2 })}`;
	}

	const steps = [
		{ icon: Cpu, title: 'Install the miner', desc: 'Run necter-miner on a phone, laptop or server and check your hardware.', href: '/mining/hardware-checker', cta: 'Check hardware' },
		{ icon: Link2, title: 'Bind your device', desc: 'The miner signs a binding with this wallet — the device appears here automatically.', href: '/mining/devices', cta: 'View devices' },
		{ icon: Droplets, title: 'Get testnet NECTA', desc: 'Collateral is NECTA. The faucet sends 1,000 testnet NECTA every 24 h.', href: '/faucet', cta: 'Open faucet' },
		{ icon: Compass, title: 'Subscribe to a project', desc: 'Pick a project, bond collateral (gasless) and start earning.', href: '/discover', cta: 'Discover projects' }
	];
</script>

<svelte:head>
	<title>My Mining — Necter Mining App Store</title>
</svelte:head>

<SignInGate title="Connect your wallet" description="Sign in with your wallet to see your devices, subscriptions and earnings." illustration="platform">
	<div class="animate-fadeIn px-0 md:px-6 pt-4 md:pt-6 pb-6 md:pb-12">
		<!-- ── Page header ── -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 px-4 md:px-0">
			<div>
				<h1 class="text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">My Mining</h1>
				<p class="text-[12px] mt-0.5 hidden md:block text-[var(--text-tertiary)]">
					<span class="text-[var(--text-secondary)]">{devices.length}</span> device{devices.length === 1 ? '' : 's'} &middot;
					<span class="text-[var(--text-secondary)]">{subs.length}</span> subscriptions &middot;
					<span class="text-[var(--text-secondary)]">{activeCount}</span> active
					{#if token}
						&middot; <span class="text-[var(--text-secondary)] font-mono">{fmtTok(earned30d)}</span> {token.symbol} earned (30d)
					{/if}
				</p>
			</div>
			<div class="flex gap-1">
				{#each [{ id: 'networks' as TabId, label: 'Dashboard' }, { id: 'earnings' as TabId, label: 'Earnings' }, { id: 'proofs' as TabId, label: 'Proofs' }] as btn (btn.id)}
					<Button
						variant="ghost"
						size="md"
						onclick={() => (tab = btn.id)}
						class="text-[13px] {tab === btn.id ? '!bg-[var(--accent-subtle)] !text-[var(--text-accent)]' : ''}"
					>
						{btn.label}
					</Button>
				{/each}
			</div>
		</div>

		<!-- ── Alerts / CTAs ── -->
		{#if alerts.length > 0 || claimable.length > 0 || needsFaucet}
			<div class="flex flex-col gap-2 mb-4 px-4 md:px-0">
				{#each alerts.slice(0, 4) as a (a.id)}
					{@const href = eventHref(a)}
					<div
						class="flex items-start gap-3 px-3.5 py-2.5 rounded-[8px] border bg-[var(--surface-1)]"
						style="border-color: {a.severity === 'critical' ? 'rgba(235,87,87,0.35)' : 'rgba(242,153,74,0.3)'};"
					>
						<AlertTriangle class="h-4 w-4 mt-0.5 shrink-0" style="color: {a.severity === 'critical' ? 'var(--error)' : 'var(--warning)'};" strokeWidth={1.8} />
						<div class="flex-1 min-w-0">
							<p class="text-[13px] text-[var(--text-primary)]">{a.message}</p>
							<p class="text-[11px] text-[var(--text-tertiary)]">{timeAgo(a.created_at)}</p>
						</div>
						{#if href}
							<a {href} class="text-[12px] font-medium no-underline text-[var(--text-accent)] shrink-0">View</a>
						{/if}
					</div>
				{/each}
				{#if claimable.length > 0}
					<a
						href="/withdraw"
						class="flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] border border-[var(--border-default)] bg-[var(--accent-subtle)] no-underline hover:border-[var(--border-hover)] transition-colors"
					>
						<Gift class="h-4 w-4 text-[var(--text-accent)] shrink-0" strokeWidth={1.8} />
						<span class="flex-1 text-[13px] text-[var(--text-primary)]">
							Rewards ready to claim:
							{#each claimable as c, i (c.token.address)}
								<span class="font-mono font-semibold">{formatAmount(c.amount, c.token.decimals)} {c.token.symbol}</span>{i < claimable.length - 1 ? ', ' : ''}
							{/each}
						</span>
						<span class="text-[12px] font-semibold text-[var(--text-accent)] shrink-0">Claim (gasless) →</span>
					</a>
				{/if}
				{#if needsFaucet && !freshWallet}
					<a
						href="/faucet"
						class="flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] no-underline hover:bg-[var(--surface-2)] transition-colors"
					>
						<Droplets class="h-4 w-4 text-[var(--text-accent)] shrink-0" strokeWidth={1.8} />
						<span class="flex-1 text-[13px] text-[var(--text-secondary)]">Your NECTA balance is 0. Collateral is bonded in NECTA — get testnet NECTA from the faucet.</span>
						<span class="text-[12px] font-semibold text-[var(--text-accent)] shrink-0">Open faucet →</span>
					</a>
				{/if}
			</div>
		{/if}

		<!-- ── Earnings tab ── -->
		{#if tab === 'earnings'}
			<div class="px-4 md:px-0">
				<EarningsPanel />
			</div>
		{/if}

		<!-- ── Proofs tab ── -->
		{#if tab === 'proofs'}
			<div class="px-4 md:px-0">
				{#if (proofsQ.loading && !proofsQ.data) || (statsQ.loading && !statsQ.data)}
					<LoadingBlock rows={4} />
				{:else if proofsQ.error}
					<ErrorState error={proofsQ.error} retry={proofsQ.refresh} />
				{:else if proofs.length === 0}
					<EmptyState
						illustration="network"
						title="No proofs yet"
						description="Proofs are your votes on task rounds. They appear once a subscribed device receives and completes its first task."
					>
						<a href="/discover"><Button size="sm">Discover projects</Button></a>
					</EmptyState>
				{:else}
					<div class="flex flex-col gap-4">
						<div class="grid grid-cols-2 md:grid-cols-5 gap-[1px] rounded-lg overflow-hidden border bg-[var(--border-default)] border-[var(--border-default)]">
							{#each [
								{ label: 'Verified (30d)', value: formatNumber(stats?.verified), color: 'var(--success)' },
								{ label: 'Rejected', value: formatNumber(stats?.rejected), color: 'var(--error)' },
								{ label: 'Missed', value: formatNumber(stats?.missed), color: 'var(--warning)' },
								{ label: 'Success Rate', value: bpToPercent(stats?.success_bp), color: successColor },
								{ label: 'Avg Finality', value: formatMs(stats?.avg_finality_ms), color: 'var(--text-primary)' }
							] as stat (stat.label)}
								<div class="p-3 md:p-4 flex flex-col gap-1 bg-[var(--surface-1)]">
									<span class="text-[10px] md:text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{stat.label}</span>
									<span class="text-[18px] md:text-[22px] font-semibold leading-7 -tracking-wide font-mono tabular-nums" style="color: {stat.color};">{stat.value}</span>
								</div>
							{/each}
						</div>

						{#if proofsDailyRate.any}
							<Card padding="px-4 py-3.5" class="overflow-hidden">
								<div class="flex items-center justify-between mb-2.5">
									<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Proof Rate (14d)</span>
								</div>
								<div class="flex items-end gap-[3px]" style="height: 60px;">
									{#each proofsDailyRate.bars as bar (bar.date)}
										{@const totalH = bar.submitted > 0 ? (bar.submitted / proofsDailyRate.maxVal) * 60 : 0}
										{@const verifiedH = bar.verified > 0 ? (bar.verified / proofsDailyRate.maxVal) * 60 : 0}
										<div title="{bar.date}: {bar.verified}/{bar.submitted}" style="flex: 1; position: relative; height: {totalH}px; cursor: default;">
											<div style="position: absolute; bottom: 0; left: 0; right: 0; height: {totalH}px; border-radius: 2px 2px 0 0; background: var(--surface-3);"></div>
											<div style="position: absolute; bottom: 0; left: 0; right: 0; height: {verifiedH}px; border-radius: 2px 2px 0 0; background: var(--success); opacity: 0.7;"></div>
										</div>
									{/each}
								</div>
								<div class="flex items-center gap-3 mt-1.5">
									<div class="flex items-center gap-1">
										<div class="w-2 h-2 rounded-sm bg-[var(--surface-3)]"></div>
										<span class="text-[10px] text-[var(--text-tertiary)]">Submitted</span>
									</div>
									<div class="flex items-center gap-1">
										<div class="w-2 h-2 rounded-sm bg-[var(--success)] opacity-70"></div>
										<span class="text-[10px] text-[var(--text-tertiary)]">Verified</span>
									</div>
								</div>
							</Card>
						{/if}

						{#if failureByProject.length > 0}
							<Card padding="px-4 py-3.5" class="overflow-hidden">
								<span class="text-[11px] font-semibold tracking-widest uppercase block mb-2.5 text-[var(--text-tertiary)]">Failure Rate by Project</span>
								<div class="flex flex-col gap-2">
									{#each failureByProject as [pid, p] (pid)}
										<div class="flex items-center gap-2.5">
											<span class="text-[12px] w-[120px] overflow-hidden text-ellipsis whitespace-nowrap shrink-0 text-[var(--text-primary)]">{projectName(pid)}</span>
											<div class="flex-1 h-1 rounded-sm overflow-hidden bg-[var(--surface-3)]">
												<div class="h-1 rounded-sm bg-[var(--error)] opacity-70" style="width: {(p.failed / p.total) * 100}%;"></div>
											</div>
											<span class="text-[11px] w-[55px] text-right shrink-0 font-mono text-[var(--error)]">{p.failed}/{p.total}</span>
										</div>
									{/each}
								</div>
							</Card>
						{/if}

						<Card padding="p-0" class="overflow-hidden">
							<div class="md:hidden">
								{#each proofs as proof, idx (proof.proof_id)}
									{@const st = proofStatus(proof.status)}
									<a
										href="/mining/proofs/{proof.proof_id}"
										class="flex items-center gap-3 px-3 py-2.5 no-underline transition-colors hover:bg-[var(--surface-2)]"
										style={idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}
									>
										<ProjectIcon project={iconProject(proof.project_id)} size={28} rounded="5px" />
										<div class="min-w-0 flex-1">
											<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">{projectName(proof.project_id)}</div>
											<div class="text-[11px] text-[var(--text-tertiary)]">{shortHex(proof.proof_id, 10, 0)} &middot; {timeAgo(proof.submitted_at)}</div>
										</div>
										<div class="flex flex-col items-end gap-0.5 shrink-0">
											<span class="text-[11px] font-medium" style="color: {st.color};">{st.label}</span>
											<span class="text-[12px] font-semibold font-mono text-[var(--text-primary)] tabular-nums">{expected(proof)}</span>
										</div>
									</a>
								{/each}
							</div>
							<div class="hidden md:block">
								<div class="grid h-8 px-3 items-center border-b border-[var(--border-default)] [grid-template-columns:1fr_120px_80px_60px_120px_80px]">
									{#each ['Project', 'Proof', 'Status', 'Units', 'Expected', 'Date'] as col, i (col)}
										<span class="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]" style="text-align: {i > 0 ? 'right' : 'left'};">{col}</span>
									{/each}
								</div>
								{#each proofs as proof, idx (proof.proof_id)}
									{@const st = proofStatus(proof.status)}
									<a
										href="/mining/proofs/{proof.proof_id}"
										class="grid h-10 px-3 items-center no-underline transition-colors hover:bg-[var(--surface-2)] [grid-template-columns:1fr_120px_80px_60px_120px_80px]"
										style={idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}
									>
										<div class="flex items-center gap-2 min-w-0">
											<ProjectIcon project={iconProject(proof.project_id)} size={22} rounded="4px" />
											<span class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">{projectName(proof.project_id)}</span>
										</div>
										<span class="text-[11px] text-right font-mono text-[var(--text-tertiary)]">{shortHex(proof.proof_id, 10, 0)}</span>
										<span class="text-[11px] font-medium text-right" style="color: {st.color};">{st.label}</span>
										<span class="text-[12px] text-right font-mono text-[var(--text-secondary)] tabular-nums">{proof.units ?? '—'}</span>
										<span class="text-[12px] font-semibold text-right font-mono text-[var(--text-primary)] tabular-nums">{expected(proof)}</span>
										<span class="text-[11px] text-right text-[var(--text-tertiary)]">{timeAgo(proof.submitted_at)}</span>
									</a>
								{/each}
							</div>
						</Card>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ── Dashboard tab ── -->
		{#if tab === 'networks'}
			{#if !primaryLoaded}
				<div class="px-4 md:px-0"><LoadingBlock rows={4} height="72px" /></div>
			{:else if subsQ.error || devicesQ.error}
				<div class="px-4 md:px-0"><ErrorState error={subsQ.error ?? devicesQ.error} retry={() => { subsQ.refresh(); devicesQ.refresh(); }} /></div>
			{:else if freshWallet}
				<!-- Fresh wallet onboarding -->
				<div class="px-4 md:px-0 flex flex-col gap-4">
					<EmptyState
						illustration="bee"
						title="Start mining with Necter"
						description="Your wallet has no devices or subscriptions yet. Four steps get a device earning — every on-chain step is gasless."
					/>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
						{#each steps as s, i (s.title)}
							<Card class="flex flex-col gap-2">
								<div class="flex items-center gap-2">
									<span class="h-6 w-6 rounded-full bg-[var(--accent-subtle)] text-[var(--text-accent)] text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
									<s.icon class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.6} />
								</div>
								<p class="text-[13px] font-semibold text-[var(--text-primary)]">{s.title}</p>
								<p class="text-[12px] text-[var(--text-secondary)] leading-[18px] flex-1">{s.desc}</p>
								<a href={s.href} class="text-[12px] font-medium no-underline text-[var(--text-accent)] inline-flex items-center gap-1">
									{s.cta} <ArrowUpRight size={12} strokeWidth={1.5} />
								</a>
							</Card>
						{/each}
					</div>
				</div>
			{:else}
				<!-- MOBILE -->
				<div class="md:hidden flex flex-col gap-3 px-4">
					<div class="grid grid-cols-3 gap-2">
						<StatCard label="Today" value={fmtTok(earnedToday)} />
						<StatCard label="7 Days" value={fmtTok(earned7d)} />
						<StatCard label="30 Days" value={fmtTok(earned30d)} />
					</div>

					<Card padding="p-0" class="overflow-hidden">
						<div class="px-3 py-2 border-b border-[var(--border-default)]">
							<span class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">30-day earnings{token ? ` · ${token.symbol}` : ''}</span>
						</div>
						<div class="px-2 py-2">
							<div class="relative" style="height: 180px;">
								{#if mobileTooltip !== null}
									{@const d = series[mobileTooltip.index]}
									<div
										class="absolute z-10 pointer-events-none bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] font-mono whitespace-nowrap mb-1"
										style="bottom: 100%; left: {mobileTooltip.x}px; transform: translateX(-50%);"
									>
										<span class="text-[var(--text-tertiary)]">{d.date}</span>: {fmtTok(d.value)} {token?.symbol ?? ''}
									</div>
								{/if}
								<div class="flex items-end gap-[2px] h-full">
									{#each series as d, i (d.date)}
										{@const h = d.value > 0n ? Math.max(3, barRatio(d.value) * 170) : 2}
										<div
											role="img"
											aria-label="{d.date}: {fmtTok(d.value)} {token?.symbol ?? ''}"
											style="flex: 1; height: {h}px; border-radius: 1.5px 1.5px 0 0; background: {mobileTooltip?.index === i || i === series.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'}; cursor: default; transition: background 80ms;"
											onmouseenter={(e) => {
												const rect = e.currentTarget.getBoundingClientRect();
												const parent = e.currentTarget.parentElement!.getBoundingClientRect();
												mobileTooltip = { index: i, x: rect.left - parent.left + rect.width / 2 };
											}}
											onmouseleave={() => (mobileTooltip = null)}
										></div>
									{/each}
								</div>
							</div>
							<div class="flex justify-between mt-1">
								<span class="text-[9px] text-[var(--text-tertiary)] font-mono">{series[0] ? shortDate(series[0].date) : ''}</span>
								<span class="text-[9px] text-[var(--text-tertiary)] font-mono">Today</span>
							</div>
						</div>
					</Card>

					<Card padding="p-0" class="overflow-hidden">
						<div class="px-3 py-2.5 border-b border-[var(--border-default)] flex items-center justify-between">
							<span class="text-[13px] font-semibold text-[var(--text-primary)]">Subscriptions</span>
							<a href="/mining/subscriptions" class="text-[11px] font-medium no-underline text-[var(--text-accent)]">View All ({subs.length})</a>
						</div>
						{#if subs.length === 0}
							<div class="text-center overflow-hidden">
								<div class="w-full h-[140px] overflow-hidden">
									<img src="/brand/hero-honeycomb.png" alt="" class="w-full h-full object-cover object-bottom opacity-60" loading="lazy" />
								</div>
								<div class="px-4 pt-4 pb-6">
									<p class="text-[13px] mb-3 text-[var(--text-secondary)]">You are not mining any projects yet.</p>
									<a href="/discover"><Button>Discover projects</Button></a>
								</div>
							</div>
						{:else}
							{#each subs as s, idx (s.subscription_id)}
								{@const st = subStatus(s.status)}
								<a
									href="/mining/{encodeURIComponent(s.subscription_id)}"
									class="flex items-center gap-2.5 px-3 py-2.5 no-underline transition-colors hover:bg-[var(--surface-2)]"
									style={idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}
								>
									<ProjectIcon project={iconProject(s.project_id, s.project_name)} size={28} rounded="5px" />
									<div class="min-w-0 flex-1">
										<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">{s.project_name ?? projectName(s.project_id)}</div>
										<div class="text-[11px] text-[var(--text-tertiary)]">
											{subEarned(s)} {s.token?.symbol ?? ''} &middot; {bpToPercent(s.uptime_bp)} uptime
										</div>
									</div>
									<span class="text-[11px] font-medium shrink-0" style="color: {st.color};">{st.label}</span>
								</a>
							{/each}
						{/if}
					</Card>
				</div>

				<!-- DESKTOP -->
				<div class="hidden md:flex flex-col gap-4">
					{#if tokens.length > 1}
						<div class="flex items-center gap-1.5">
							<span class="text-[11px] text-[var(--text-tertiary)] mr-1">Reward token</span>
							{#each tokens as t (t.address)}
								<button
									type="button"
									onclick={() => (tokenAddr = t.address.toLowerCase())}
									class="h-6 px-2 rounded-[4px] text-[11px] font-medium border cursor-pointer {token?.address === t.address
										? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] border-transparent'
										: 'bg-transparent text-[var(--text-secondary)] border-[var(--border-default)]'}">{t.symbol}</button
								>
							{/each}
						</div>
					{/if}

					<div class="grid gap-[1px] rounded-lg overflow-hidden border grid-cols-5 bg-[var(--border-default)] border-[var(--border-default)]">
						{#each [
							{ label: 'Today', value: fmtTok(earnedToday), unit: token?.symbol ?? '—', muted: false },
							{ label: 'Last 7d', value: fmtTok(earned7d), unit: token?.symbol ?? '—', muted: false },
							{ label: 'Last 30d', value: fmtTok(earned30d), unit: token?.symbol ?? '—', muted: false },
							{
								label: 'Claimable',
								value: token ? formatAmount(claimable.find((c) => c.token.address.toLowerCase() === token!.address.toLowerCase())?.amount ?? 0n, token.decimals) : '0',
								unit: token?.symbol ?? '—',
								muted: true
							},
							{ label: 'Bonded', value: formatAmount(bonded, 18, { maxFrac: 2 }), unit: 'NECTA collateral', muted: false }
						] as stat (stat.label)}
							<div class="p-4 flex flex-col gap-0.5 bg-[var(--surface-1)]">
								<span class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{stat.label}</span>
								<span class="text-[22px] font-semibold leading-7 -tracking-wide font-mono tabular-nums" style="color: {stat.muted ? 'var(--text-secondary)' : 'var(--text-primary)'};">{stat.value}</span>
								<span class="text-[11px] text-[var(--text-tertiary)]">{stat.unit}</span>
							</div>
						{/each}
					</div>

					<div class="grid gap-3 items-start [grid-template-columns:1fr_300px]">
						<Card padding="p-0" class="overflow-hidden">
							<div class="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
								<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">30-day earnings{token ? ` · ${token.symbol}` : ''}</span>
							</div>
							<div class="px-4 py-3">
								{#if earningsQ.error}
									<ErrorState error={earningsQ.error} retry={earningsQ.refresh} compact />
								{:else}
									<div class="relative" style="height: 340px;">
										{#if desktopTooltip !== null}
											{@const td = series[desktopTooltip.index]}
											<div
												class="absolute z-10 pointer-events-none bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] font-mono whitespace-nowrap mb-1"
												style="bottom: 100%; left: {desktopTooltip.x}px; transform: translateX(-50%);"
											>
												<span class="text-[var(--text-tertiary)]">{td.date}</span>: {fmtTok(td.value)} {token?.symbol ?? ''}
											</div>
										{/if}
										{#if chartMax === 0n && earningsQ.settled}
											<div class="absolute inset-0 flex items-center justify-center text-[12px] text-[var(--text-tertiary)] pointer-events-none">No earnings in the last 30 days yet.</div>
										{/if}
										<div class="flex items-end gap-[2px] h-full">
											{#each series as d, i (d.date)}
												{@const h = d.value > 0n ? Math.max(4, barRatio(d.value) * 330) : 2}
												<div
													role="img"
													aria-label="{d.date}: {fmtTok(d.value)} {token?.symbol ?? ''}"
													style="flex: 1; height: {h}px; border-radius: 2px 2px 0 0; background: {desktopTooltip?.index === i || i === series.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'}; transition: height 200ms ease-out, background 80ms; cursor: default;"
													onmouseenter={(e) => {
														const rect = e.currentTarget.getBoundingClientRect();
														const parent = e.currentTarget.parentElement!.getBoundingClientRect();
														desktopTooltip = { index: i, x: rect.left - parent.left + rect.width / 2 };
													}}
													onmouseleave={() => (desktopTooltip = null)}
												></div>
											{/each}
										</div>
									</div>
									<div class="flex justify-between mt-1.5">
										<span class="text-[10px] text-[var(--text-tertiary)] font-mono">{series[0] ? shortDate(series[0].date) : ''}</span>
										<span class="text-[10px] text-[var(--text-tertiary)] font-mono">Today</span>
									</div>
								{/if}
							</div>
						</Card>

						<div class="flex flex-col gap-2">
							<Card padding="p-0" class="overflow-hidden">
								<div class="px-3 py-2.5 border-b border-[var(--border-default)] flex items-center gap-1.5">
									<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Latest payouts</span>
								</div>
								<div class="py-1 max-h-44 overflow-y-auto">
									{#if (payoutsQ.data?.items ?? []).length === 0}
										<p class="text-xs px-3 py-2.5 text-[var(--text-tertiary)]">{payoutsQ.loading ? 'Loading…' : 'No payouts yet.'}</p>
									{:else}
										{#each payoutsQ.data?.items ?? [] as p (`${p.project_id}:${p.epoch}`)}
											<a href="/apps/{p.project_id}" class="flex items-center justify-between gap-2 h-8 px-3 no-underline transition-colors hover:bg-[var(--surface-2)]">
												<span class="text-[11px] shrink-0 text-[var(--text-tertiary)] font-mono">ep {p.epoch}</span>
												<span class="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0 text-[var(--text-secondary)]">{projectName(p.project_id)}</span>
												<span class="text-[11px] font-semibold shrink-0 font-mono text-[var(--success)] tabular-nums">+{formatAmount(p.amount, p.token.decimals)} {p.token.symbol}</span>
											</a>
										{/each}
									{/if}
								</div>
							</Card>

							<Card padding="p-0" class="overflow-hidden">
								<div class="px-3 py-2.5 border-b border-[var(--border-default)]">
									<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Top projects (30d)</span>
								</div>
								<div class="py-1">
									{#if topProjects.length === 0}
										<p class="text-xs px-3 py-2.5 text-[var(--text-tertiary)]">No earnings yet.</p>
									{:else}
										{#each topProjects as x (x.key)}
											<a href="/apps/{x.key}" class="flex items-center justify-between h-9 px-3 gap-2 no-underline transition-colors hover:bg-[var(--surface-2)]">
												<div class="min-w-0 flex-1">
													<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">{projectName(x.key)}</div>
													<div class="text-[11px] text-[var(--text-tertiary)]">{formatNumber(x.units)} units</div>
												</div>
												<span class="text-[12px] shrink-0 font-mono text-[var(--text-secondary)] tabular-nums text-right">
													{#each x.amounts ?? [] as a (a.token.address)}<span class="block">{formatAmount(a.amount, a.token.decimals)} {a.token.symbol}</span>{/each}
												</span>
											</a>
										{/each}
									{/if}
								</div>
							</Card>

							<Card padding="p-0" class="overflow-hidden">
								<div class="px-3 py-2.5 border-b border-[var(--border-default)] flex items-center justify-between">
									<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Devices</span>
									<a href="/mining/devices" class="text-[11px] font-medium no-underline text-[var(--text-accent)]">Manage</a>
								</div>
								<div class="py-1">
									{#if devices.length === 0}
										<p class="text-xs px-3 py-2.5 text-[var(--text-tertiary)]">No devices bound yet.</p>
									{:else}
										{#each devices.slice(0, 5) as d (d.node_id)}
											{@const ds = deviceStatus(d.status)}
											<a href="/mining/devices" class="flex items-center gap-2 h-8 px-3 no-underline hover:bg-[var(--surface-2)]">
												<Smartphone size={13} strokeWidth={1.5} class="text-[var(--text-tertiary)] shrink-0" />
												<span class="text-[12px] flex-1 min-w-0 truncate text-[var(--text-secondary)]">{d.label || d.node_id}</span>
												<span class="status-dot status-dot-{ds.dot}"></span>
												<span class="text-[11px] shrink-0" style="color: {ds.color};">{ds.label}</span>
											</a>
										{/each}
									{/if}
								</div>
							</Card>
						</div>
					</div>

					<!-- Subscriptions (desktop) -->
					<Card padding="p-0" class="overflow-hidden">
						<div class="px-4 pt-3.5 pb-3 border-b border-[var(--border-default)] flex items-center justify-between">
							<div>
								<h3 class="text-sm font-semibold m-0 -tracking-tight text-[var(--text-primary)]">Subscriptions</h3>
								<p class="text-[11px] mt-0.5 mb-0 text-[var(--text-tertiary)]">Click a row to open its detail page</p>
							</div>
							<a href="/mining/subscriptions" class="text-xs font-medium no-underline shrink-0 text-[var(--text-accent)]">View All ({subs.length})</a>
						</div>

						{#if subs.length === 0}
							<div class="text-center overflow-hidden">
								<div class="w-full h-[140px] overflow-hidden">
									<img src="/brand/hero-honeycomb.png" alt="" class="w-full h-full object-cover object-bottom opacity-60" loading="lazy" />
								</div>
								<div class="px-6 pt-5 pb-7">
									<p class="text-[13px] mb-4 text-[var(--text-secondary)]">Your devices are bound but not mining any project yet.</p>
									<a href="/discover"><Button>Discover projects</Button></a>
								</div>
							</div>
						{:else}
							<div class="grid h-8 px-3 items-center border-b border-[var(--border-default)] [grid-template-columns:1fr_130px_120px_80px_80px_40px]">
								{#each ['Project', 'Status', 'Earned', 'Leases', 'Uptime', ''] as col, i (i)}
									<span class="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]" style="text-align: {i > 0 ? 'right' : 'left'}; {i > 0 && i < 5 ? 'padding-right: 8px;' : ''}">{col}</span>
								{/each}
							</div>
							{#each subs as s, idx (s.subscription_id)}
								{@const st = subStatus(s.status)}
								<a
									href="/mining/{encodeURIComponent(s.subscription_id)}"
									class="grid h-11 px-3 items-center no-underline transition-colors hover:bg-[var(--surface-2)] [grid-template-columns:1fr_130px_120px_80px_80px_40px]"
									style={idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}
								>
									<div class="flex items-center gap-2.5 min-w-0">
										<ProjectIcon project={iconProject(s.project_id, s.project_name)} size={28} rounded="5px" />
										<div class="min-w-0">
											<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">{s.project_name ?? projectName(s.project_id)}</div>
											<div class="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-tertiary)] font-mono">{s.node_id}</div>
										</div>
									</div>
									<div class="flex items-center justify-end gap-[5px] pr-2">
										<span class="status-dot status-dot-{st.dot} {s.status === 'active' ? 'status-dot-pulse' : ''}"></span>
										<span class="text-[11px] font-medium" style="color: {st.color};">{st.label}</span>
									</div>
									<span class="text-[12px] text-right pr-2 font-mono text-[var(--text-primary)] tabular-nums">{subEarned(s)} <span class="text-[var(--text-tertiary)]">{s.token?.symbol ?? ''}</span></span>
									<span class="text-[12px] text-right pr-2 font-mono text-[var(--text-secondary)] tabular-nums">{formatNumber(s.leases_completed)}</span>
									<span class="text-[12px] text-right pr-2 font-mono text-[var(--text-secondary)] tabular-nums">{bpToPercent(s.uptime_bp)}</span>
									<div class="flex justify-end"><ArrowUpRight size={14} strokeWidth={1.5} class="text-[var(--text-tertiary)]" /></div>
								</a>
							{/each}
						{/if}
					</Card>

					<!-- Recent Activity -->
					{#if (eventsQ.data?.items ?? []).length > 0}
						<Card padding="p-0" class="overflow-hidden">
							<div class="px-4 py-2.5 border-b border-[var(--border-default)] flex items-center justify-between">
								<span class="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</span>
								<a href="/notifications" class="text-[12px] no-underline text-[var(--text-accent)]">All activity</a>
							</div>
							<div class="divide-y divide-[var(--border-default)]">
								{#each (eventsQ.data?.items ?? []).slice(0, 5) as evt (evt.id)}
									{@const m = eventMeta(evt.type)}
									{@const href = eventHref(evt)}
									<svelte:element this={href ? 'a' : 'div'} {href} class="flex items-center gap-3 px-4 py-2.5 no-underline {href ? 'hover:bg-[var(--surface-2)]' : ''}">
										<span class="inline-flex h-6 w-6 items-center justify-center rounded shrink-0 bg-[var(--surface-2)]">
											<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="3" fill={TONE_COLOR[m.tone]} /></svg>
										</span>
										<div class="min-w-0 flex-1">
											<span class="text-[12px] block overflow-hidden text-ellipsis whitespace-nowrap">
												<span class="font-medium text-[var(--text-primary)]">{m.label}</span>
												{#if evt.message}<span class="text-[var(--text-secondary)]"> &middot; {evt.message}</span>{/if}
											</span>
										</div>
										<span class="text-[11px] shrink-0 text-[var(--text-secondary)]">{timeAgo(evt.created_at)}</span>
									</svelte:element>
								{/each}
							</div>
						</Card>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</SignInGate>
