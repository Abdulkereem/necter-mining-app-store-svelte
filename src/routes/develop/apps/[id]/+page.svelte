<script lang="ts">
	import toast from 'svelte-french-toast';
	import { CheckCircle2, Circle, Clock, Play, Loader2 } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import { devProject } from '$lib/develop/context';
	import { pendingTxsFor } from '$lib/develop/pending-tx';
	import { bpToPercent, formatMs, formatNumber, formatToken, formatRating, formatDateTime, timeAgo } from '$lib/format';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import TxRequestCard from '$lib/components/develop/TxRequestCard.svelte';

	const ctx = devProject();
	const p = $derived(ctx.project);
	const pid = $derived(p.project_id);

	const healthQ = useQuery(() => hub.health(pid));
	const analyticsQ = useQuery(() => hub.analytics(pid, '7d'));
	const pendingQ = useQuery(() => pendingTxsFor(pid));
	const simsQ = useQuery(() => hub.simulations(pid));

	const s = $derived(p.stats);
	const series = $derived(analyticsQ.data?.series ?? []);
	const listed = $derived(p.listing_status === 'listed');

	const checklist = $derived([
		{ label: 'Signed manifest submitted', done: true },
		{ label: 'Registered on-chain (ProjectRegistry, relayed without gas)', done: !!p.registry_tx },
		{ label: 'Vault deployed and funded (creating the vault needs a little Sepolia ETH)', done: !!p.economics?.vault?.deployed && !!p.economics?.vault?.balance && p.economics.vault.balance !== '0' },
		{ label: 'Approved by the network operator', done: listed || p.listing_status === 'paused' }
	]);

	let fn = $state('');
	let input = $state('{}');
	let running = $state(false);
	$effect(() => {
		if (!fn) fn = p.consensus.work.functions[0] ?? '';
	});

	async function runSim() {
		running = true;
		try {
			let parsed: unknown = input;
			try {
				parsed = JSON.parse(input);
			} catch {
				/* send as a raw string */
			}
			const sim = await hub.runSimulation(pid, [{ function: fn, input: parsed }]);
			toast.success(sim.status === 'running' ? 'Simulation started' : `Simulation ${sim.status}`);
			await simsQ.refresh();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			running = false;
		}
	}

	async function forgetPending(draftId: string) {
		await hub.deleteDraft(draftId).catch(() => undefined);
		await Promise.all([pendingQ.refresh(), ctx.refresh()]);
	}
</script>

<div class="flex flex-col gap-4">
	{#each (pendingQ.data ?? []).filter((pt) => !(pt.kind === 'register' && p.registry_tx)) as pt (pt.draft_id)}
		<div class="bg-[var(--surface-1)] border border-[var(--border-accent)] rounded-[8px] p-5">
			<h3 class="text-[14px] font-semibold mb-1">{pt.kind === 'register' ? 'Finish registration' : `Publish version ${pt.version} on-chain`}</h3>
			<p class="text-[12px] text-[var(--text-secondary)] mb-3">
				{pt.kind === 'register'
					? 'The gasless registration did not complete. Send the registration from your wallet (needs a little Sepolia ETH); the project stays unregistered until it confirms.'
					: 'You skipped sending this transaction earlier. The version stays pending until it confirms.'}
			</p>
			<TxRequestCard tx={pt.tx} onsent={() => forgetPending(pt.draft_id)} />
		</div>
	{/each}

	{#if !listed}
		<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
			<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Launch checklist</h3>
			<div class="space-y-2">
				{#each checklist as c (c.label)}
					<div class="flex items-center gap-2 text-[13px]">
						{#if c.done}<CheckCircle2 class="h-4 w-4 text-[var(--success)]" />{:else}<Circle class="h-4 w-4 text-[var(--text-tertiary)]" />{/if}
						<span class={c.done ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{c.label}</span>
					</div>
				{/each}
			</div>
			{#if p.review?.reason}<p class="text-[12px] text-[var(--warning)] mt-3">Review note: {p.review.reason}</p>{/if}
		</div>
	{/if}

	{#if p.pending_version}
		<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 flex items-center gap-3">
			<Clock class="h-4 w-4 text-[var(--warning)]" />
			<p class="text-[13px]">Version {p.pending_version.version} ({p.pending_version.tiers_changed.join(', ')}) is {p.pending_version.status}{p.pending_version.effective_epoch != null ? `, effective from epoch ${p.pending_version.effective_epoch}` : ''}.</p>
		</div>
	{/if}

	<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
		{#each [
			{ label: 'Miners (active)', value: `${formatNumber(s?.miners_active)} / ${formatNumber(s?.miners_subscribed)}` },
			{ label: 'Rounds (7d)', value: formatNumber(s?.rounds) },
			{ label: 'Units (7d)', value: formatNumber(s?.units) },
			{ label: 'Paid to miners', value: s?.paid_to_miners ? formatToken(s.paid_to_miners, p.token, { maxFrac: 2, compact: true }) : '—' },
			{ label: 'Rating', value: p.average_rating_x100 != null ? `${formatRating(p.average_rating_x100)} (${p.review_count ?? 0})` : '—' }
		] as st (st.label)}
			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
				<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{st.label}</p>
				<p class="text-[17px] font-semibold font-mono mt-1">{st.value}</p>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
			<h3 class="text-[14px] font-semibold mb-3">Tasks per day (7d)</h3>
			{#if series.length > 1}
				{#key series}<AreaChart data={series.map((x) => x.tasks ?? 0)} labels={series.map((x) => new Date((x.t ?? 0) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))} height={160} />{/key}
			{:else}
				<p class="text-[13px] text-[var(--text-secondary)]">No task history yet.</p>
			{/if}
		</div>
		<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
			<h3 class="text-[14px] font-semibold mb-3">Health</h3>
			{#if healthQ.data}
				{@const h = healthQ.data}
				<p class="text-[13px] capitalize font-medium" style="color:{h.status === 'healthy' ? 'var(--success)' : 'var(--warning)'}">{h.status ?? '—'}</p>
				<div class="grid grid-cols-2 gap-2 mt-3 text-[12px]">
					<span class="text-[var(--text-tertiary)]">Eligible miners</span><span class="font-mono text-right">{formatNumber(h.eligible_miners)}</span>
					<span class="text-[var(--text-tertiary)]">Committee size</span><span class="font-mono text-right">{formatNumber(h.committee_size)}</span>
					<span class="text-[var(--text-tertiary)]">Median finality</span><span class="font-mono text-right">{formatMs(h.median_finality_ms)}</span>
					<span class="text-[var(--text-tertiary)]">Uptime (7d)</span><span class="font-mono text-right">{bpToPercent(s?.uptime_bp)}</span>
				</div>
				{#each h.issues ?? [] as issue}<p class="text-[12px] text-[var(--warning)] mt-2">• {issue}</p>{/each}
			{:else}
				<p class="text-[13px] text-[var(--text-secondary)]">—</p>
			{/if}
		</div>
	</div>

	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
		<h3 class="text-[14px] font-semibold mb-1">Run test tasks on validators</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mb-3">Runs sample tasks through validator rounds (works before listing). Inputs are JSON or a raw string.</p>
		<div class="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2">
			<select bind:value={fn} class="h-[34px] px-2 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px]">
				{#each p.consensus.work.functions as f (f)}<option value={f}>{f}</option>{/each}
			</select>
			<input bind:value={input} class="h-[34px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px] font-mono" />
			<button type="button" class="btn-subscribe inline-flex items-center gap-1.5" disabled={running || !fn} onclick={runSim}>
				{#if running}<Loader2 class="h-3.5 w-3.5 animate-spin" />{:else}<Play class="h-3.5 w-3.5" />{/if} Run
			</button>
		</div>
		{#if (simsQ.data?.items?.length ?? 0) > 0}
			<div class="mt-4 divide-y divide-[var(--border-default)]">
				{#each simsQ.data?.items ?? [] as sim (sim.simulation_id)}
					<details class="py-2">
						<summary class="flex items-center justify-between cursor-pointer text-[12px]">
							<span class="font-mono">{sim.simulation_id}</span>
							<span style="color:{sim.status === 'passed' ? 'var(--success)' : sim.status === 'failed' ? 'var(--error)' : 'var(--warning)'}">{sim.status} · {timeAgo(sim.started_at)}</span>
						</summary>
						{#each sim.results ?? [] as r (r.round_id)}
							<div class="mt-2 p-2 rounded-[5px] bg-[var(--surface-0)] text-[11px] font-mono break-all">
								<p>{r.success ? 'ok' : 'failed'} · gas {r.gas_used} · {r.consensus?.state} ({r.consensus?.votes}/{r.consensus?.quorum})</p>
								<p class="text-[var(--text-secondary)]">{r.output}</p>
								{#if r.error}<p class="text-[var(--error)]">{r.error}</p>{/if}
							</div>
						{/each}
						{#each sim.logs ?? [] as l}<p class="text-[11px] text-[var(--text-tertiary)] font-mono">{l}</p>{/each}
						{#if sim.completed_at}<p class="text-[10px] text-[var(--text-tertiary)] mt-1">Completed {formatDateTime(sim.completed_at)}</p>{/if}
					</details>
				{/each}
			</div>
		{/if}
	</div>
</div>
