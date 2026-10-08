<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { ArrowLeft, HardDrive, Wallet, ShieldAlert, Activity, CheckCircle2 } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { signedIn, account } from '$lib/stores/wallet';
	import { loadParams } from '$lib/stores/network';
	import { formatNumber, formatMs, timeAgo, shortHex, formatDateTime } from '$lib/format';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import SubscriptionHeader from '$lib/components/mining/SubscriptionHeader.svelte';
	import NodeInfoTab from '$lib/components/mining/NodeInfoTab.svelte';
	import FinancialTab from '$lib/components/mining/FinancialTab.svelte';
	import SlashesTab from '$lib/components/mining/SlashesTab.svelte';
	import { LEASE_STATE, proofStatus } from '$lib/components/mining/labels';

	let subscriptionId = $derived($page.params.id ?? '');

	const subQ = useQuery(() => hub.subscription(subscriptionId), { enabled: () => $signedIn && !!subscriptionId, keepPrevious: true });
	let sub = $derived(subQ.data ?? null);

	const projectQ = useQuery(
		() => {
			const id = sub?.project_id;
			return id ? hub.project(id) : Promise.resolve(null);
		},
		{ enabled: () => !!sub }
	);
	const deviceQ = useQuery(
		() => {
			const id = sub?.node_id;
			return id ? hub.device(id) : Promise.resolve(null);
		},
		{ enabled: () => !!sub }
	);

	let project = $derived(
		sub
			? {
					project_id: sub.project_id,
					name: projectQ.data?.name ?? sub.project_name ?? shortHex(sub.project_id),
					category: projectQ.data?.category ?? null,
					icon: projectQ.data?.icon ?? null
				}
			: null
	);

	let wrongWallet = $derived(!!sub && !!$account && sub.owner.toLowerCase() !== $account.toLowerCase());

	// Ticking clock for countdowns (release_at, dispute windows).
	let now = $state(Math.floor(Date.now() / 1000));
	onMount(() => {
		const t = setInterval(() => (now = Math.floor(Date.now() / 1000)), 1000);
		return () => clearInterval(t);
	});

	let unbondingSecs = $state<number | null>(null);
	onMount(() => {
		loadParams()
			.then((p) => {
				const v = Number(p.params.unbonding_secs);
				unbondingSecs = Number.isFinite(v) && v > 0 ? v : null;
			})
			.catch(() => undefined);
	});

	type TabId = 'node' | 'leases' | 'proofs' | 'financial' | 'security';
	let activeTab = $state<TabId>('node');

	const leasesQ = useQuery(
		() => hub.leases({ node_id: sub?.node_id, project_id: sub?.project_id, limit: 100 }),
		{ enabled: () => !!sub && activeTab === 'leases' }
	);
	const proofsQ = useQuery(
		() => hub.proofs({ node_id: sub?.node_id, project_id: sub?.project_id, limit: 100 }),
		{ enabled: () => !!sub && activeTab === 'proofs' }
	);

	function changed() {
		void subQ.refresh();
	}

	const tabs = [
		{ id: 'node' as TabId, label: 'Overview', Icon: HardDrive },
		{ id: 'leases' as TabId, label: 'Leases', Icon: Activity },
		{ id: 'proofs' as TabId, label: 'Proofs', Icon: CheckCircle2 },
		{ id: 'financial' as TabId, label: 'Payouts', Icon: Wallet },
		{ id: 'security' as TabId, label: 'Slashes', Icon: ShieldAlert }
	];
</script>

<svelte:head>
	<title>{project ? `${project.name} subscription` : 'Subscription'} — Necter Mining App Store</title>
</svelte:head>

<SignInGate title="Connect your wallet" description="Sign in with the wallet that owns this subscription to see and manage it.">
	<div class="min-h-screen bg-[var(--surface-0)]">
		{#if subQ.loading && !subQ.data}
			<div class="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16"><LoadingBlock rows={4} height="80px" /></div>
		{:else if subQ.error}
			<div class="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16"><ErrorState error={subQ.error} retry={subQ.refresh} /></div>
		{:else if !sub || !project}
			<div class="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16 space-y-6">
				<a
					href="/mining"
					class="inline-flex items-center gap-2 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-[5px] text-[13px] px-3 py-1.5 no-underline"
				>
					<ArrowLeft class="h-4 w-4" />
					Back to My Mining
				</a>
				<EmptyState illustration="hourglass" title="Subscription not found" description="This subscription id does not exist, or it was created by another wallet.">
					<a href="/mining/subscriptions" class="btn-secondary no-underline">All subscriptions</a>
				</EmptyState>
			</div>
		{:else}
			<div class="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16 space-y-8">
				<SubscriptionHeader {sub} {project} {wrongWallet} {now} {unbondingSecs} onChanged={changed} />

				<div class="w-full">
					<div
						class="flex w-full mb-6 gap-0 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-[3px] overflow-x-auto"
						style="-webkit-overflow-scrolling: touch;"
					>
						{#each tabs as tabDef (tabDef.id)}
							<button
								type="button"
								class="flex-1 flex items-center justify-center gap-1.5 h-8 px-2 text-[12px] font-medium rounded-[5px] border-none cursor-pointer transition-colors whitespace-nowrap {activeTab === tabDef.id
									? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
									: 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}"
								onclick={() => (activeTab = tabDef.id)}
							>
								<tabDef.Icon class="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
								{tabDef.label}
							</button>
						{/each}
					</div>

					{#if activeTab === 'node'}
						<NodeInfoTab {sub} device={deviceQ.data} {now} canEdit={!wrongWallet && !!$account} onchanged={() => subQ.refresh()} />
					{:else if activeTab === 'leases'}
						<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Leases</h3>
							<p class="text-[13px] text-[var(--text-secondary)] mb-4">
								A lease is one task round assigned to this device by the committee draw. Primaries run it first; backups step in if a primary misses the deadline.
							</p>
							{#if leasesQ.loading && !leasesQ.data}
								<LoadingBlock rows={4} height="36px" />
							{:else if leasesQ.error}
								<ErrorState error={leasesQ.error} retry={leasesQ.refresh} compact />
							{:else if (leasesQ.data?.items ?? []).length === 0}
								<EmptyState compact illustration="network" title="No leases yet" description="Leases appear once the device is active and selected for a task committee." />
							{:else}
								<div class="rounded-[8px] border border-[var(--border)] overflow-x-auto">
									<table class="w-full text-[13px]">
										<thead>
											<tr class="border-b border-[var(--border)] bg-[var(--surface-2)]">
												{#each ['Round', 'Function', 'Role', 'State', 'Units', 'Deadline', 'Created'] as h (h)}
													<th class="text-left p-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">{h}</th>
												{/each}
											</tr>
										</thead>
										<tbody>
											{#each leasesQ.data?.items ?? [] as l (l.lease_id)}
												{@const st = LEASE_STATE[l.state]}
												<tr class="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
													<td class="p-3 font-mono text-[12px]">
														<a href="/explorer/rounds/{encodeURIComponent(l.round_id)}" class="text-[var(--text-accent)] no-underline">{shortHex(l.round_id.split(':')[1] ?? l.round_id)}</a>
													</td>
													<td class="p-3 font-mono text-[12px] text-[var(--text-secondary)]">{l.function ?? '—'}</td>
													<td class="p-3 text-[12px] text-[var(--text-secondary)] capitalize">{l.role}{l.role === 'backup' ? ` #${l.position}` : ''}</td>
													<td class="p-3"><span class="text-[11px] px-2 py-0.5 rounded bg-[var(--surface-2)]" style="color: {st?.color};">{st?.label ?? l.state}</span></td>
													<td class="p-3 font-mono text-[12px] text-[var(--text-secondary)]">{l.units ?? '—'}</td>
													<td class="p-3 text-[12px] text-[var(--text-tertiary)]">{l.deadline ? formatDateTime(l.deadline) : '—'}</td>
													<td class="p-3 text-[12px] text-[var(--text-tertiary)]">{timeAgo(l.created_at)}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					{:else if activeTab === 'proofs'}
						<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Proofs</h3>
							<p class="text-[13px] text-[var(--text-secondary)] mb-4">
								A proof is this device's signed vote on a round. It is verified when the validators finalize the same result.
							</p>
							{#if proofsQ.loading && !proofsQ.data}
								<LoadingBlock rows={4} height="36px" />
							{:else if proofsQ.error}
								<ErrorState error={proofsQ.error} retry={proofsQ.refresh} compact />
							{:else if (proofsQ.data?.items ?? []).length === 0}
								<EmptyState compact illustration="network" title="No proofs yet" description="Proofs appear when this device completes leased tasks." />
							{:else}
								{@const items = proofsQ.data?.items ?? []}
								<div class="flex flex-wrap gap-2 mb-3">
									{#each ['verified', 'pending', 'rejected', 'missed'] as s (s)}
										{@const n = items.filter((p) => p.status === s).length}
										{#if n > 0 || s === 'verified' || s === 'pending'}
											{@const ps = proofStatus(s)}
											<span class="inline-flex text-[11px] px-2 py-0.5 rounded bg-[var(--surface-2)]" style="color: {ps.color};">{ps.label}: {n}</span>
										{/if}
									{/each}
								</div>
								<div class="space-y-1.5 max-h-[480px] overflow-y-auto">
									{#each items as proof (proof.proof_id)}
										{@const ps = proofStatus(proof.status)}
										<a
											href="/mining/proofs/{proof.proof_id}"
											class="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0 text-[12px] no-underline hover:bg-[var(--surface-2)] -mx-1 px-1 rounded transition-colors"
										>
											<span class="font-mono truncate flex-1 text-[var(--text-primary)]">{shortHex(proof.proof_id, 14, 0)}</span>
											<span class="text-[11px] text-[var(--text-tertiary)] mx-2 shrink-0">{timeAgo(proof.submitted_at)}</span>
											<span class="text-[11px] text-[var(--text-tertiary)] mx-2 shrink-0 font-mono">{proof.units !== undefined ? `${formatNumber(proof.units)} u` : ''}</span>
											<span class="text-[11px] text-[var(--text-tertiary)] mx-2 shrink-0 font-mono hidden sm:inline">{proof.finality_ms ? formatMs(proof.finality_ms) : ''}</span>
											<span class="shrink-0 text-[10px] px-2 py-0.5 rounded bg-[var(--surface-2)]" style="color: {ps.color};">{ps.label}</span>
											{#if proof.slash_id}<span class="ml-1 text-[10px] text-[var(--error)]">Slashed</span>{/if}
										</a>
									{/each}
								</div>
							{/if}
						</div>
					{:else if activeTab === 'financial'}
						<FinancialTab projectId={sub.project_id} />
					{:else if activeTab === 'security'}
						<SlashesTab subscriptionId={sub.subscription_id} {now} canAct={!wrongWallet} onChanged={changed} />
					{/if}
				</div>


			</div>
		{/if}
	</div>
</SignInGate>
