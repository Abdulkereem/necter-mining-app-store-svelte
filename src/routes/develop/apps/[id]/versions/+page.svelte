<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Check, Package, Loader2 } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { ManifestConsensus, ManifestScheduling, TxRequest, DeviceClass, Engine } from '$lib/api/types';
	import { devProject } from '$lib/develop/context';
	import { toManifest } from '$lib/develop/types';
	import { savePendingTx } from '$lib/develop/pending-tx';
	import { nextVersion, sortedUnique, DEVICE_CLASSES, ENGINES } from '$lib/protocol/manifest';
	import { canonicalJson, parseStrictJson } from '$lib/protocol/canonical';
	import { publishVersion, ManifestRejected } from '$lib/flows';
	import { formatDateTime, shortHex } from '$lib/format';
	import TxRequestCard from '$lib/components/develop/TxRequestCard.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	const ctx = devProject();
	const pid = $derived(ctx.project.project_id);
	const versionsQ = useQuery(() => hub.versions(pid));
	const manifestQ = useQuery(() => hub.manifest(pid));

	let mode = $state<'scheduling' | 'consensus'>('scheduling');
	let sched = $state<ManifestScheduling | null>(null);
	let consensusText = $state('');
	let busy = $state(false);
	let step = $state('');
	let problems = $state<string[]>([]);
	let publishTx = $state<TxRequest | null>(null);

	$effect(() => {
		const m = manifestQ.data ? toManifest(manifestQ.data.manifest) : null;
		if (m && !sched) {
			sched = structuredClone(m.scheduling);
			consensusText = JSON.stringify(m.consensus, null, 2);
		}
	});

	function toggle<T extends string>(list: T[], v: T): T[] {
		return sortedUnique(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
	}

	async function submit() {
		if (!manifestQ.data || !sched) return;
		problems = [];
		const current = toManifest(manifestQ.data.manifest);
		let changes: { scheduling?: ManifestScheduling; consensus?: ManifestConsensus };
		if (mode === 'scheduling') changes = { scheduling: $state.snapshot(sched) as ManifestScheduling };
		else {
			try {
				changes = { consensus: parseStrictJson(consensusText) as ManifestConsensus };
			} catch (e) {
				problems = [errorMessage(e)];
				return;
			}
		}
		const next = nextVersion(current, changes);
		if (canonicalJson(next.scheduling) === canonicalJson(current.scheduling) && canonicalJson(next.consensus) === canonicalJson(current.consensus)) {
			problems = ['Nothing changed.'];
			return;
		}
		busy = true;
		try {
			const r = await publishVersion(pid, next, (s) => (step = s), { sendPublishTx: false });
			toast.success(`Version ${r.version.version} submitted`);
			if (r.publishTx) {
				publishTx = r.publishTx;
				await savePendingTx(pid, 'publish_version', r.version.version, r.publishTx);
			}
			sched = null;
			await Promise.all([versionsQ.refresh(), manifestQ.refresh(), ctx.refresh()]);
		} catch (e) {
			if (e instanceof ManifestRejected) problems = e.problems.map((p) => `${p.path}: ${p.message}`);
			else toast.error(errorMessage(e));
		} finally {
			busy = false;
			step = '';
		}
	}
	const inputCls = 'w-full h-[32px] px-2 rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px] font-mono';
</script>

<div class="space-y-5">
	{#if publishTx}
		<TxRequestCard tx={publishTx} title="Send ProjectRegistry.publishVersion" onsent={() => { publishTx = null; void ctx.refresh(); }} />
	{/if}

	<div>
		<h2 class="text-[15px] font-semibold mb-3">Version history</h2>
		{#if versionsQ.loading && !versionsQ.data}
			<LoadingBlock rows={3} />
		{:else if versionsQ.error}
			<ErrorState error={versionsQ.error} retry={versionsQ.refresh} />
		{:else}
			<div class="space-y-3">
				{#each versionsQ.data?.items ?? [] as v (v.version)}
					{@const live = v.status === 'active'}
					<div class="rounded-[8px] p-4 flex items-start gap-4" style="border:1px solid var(--border-default);background:var(--surface-1)">
						<div class="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:{live ? 'var(--accent-subtle)' : 'var(--surface-3)'}">
							{#if live}<Check class="h-4 w-4 text-[var(--text-accent)]" strokeWidth={2} />{:else}<Package class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />{/if}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1 flex-wrap">
								<span class="text-[13px] font-semibold font-mono">v{v.version}</span>
								<span class="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] capitalize" style="background:{live ? 'var(--accent-subtle)' : 'var(--surface-3)'};color:{live ? 'var(--text-accent)' : 'var(--text-secondary)'}">{v.status}</span>
								{#each v.tiers_changed as t}<span class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-tertiary)]">{t}</span>{/each}
							</div>
							<p class="text-[11px] text-[var(--text-tertiary)] font-mono">manifest {shortHex(v.manifest_hash, 10, 6)} · consensus {shortHex(v.consensus_hash, 10, 6)}</p>
							<p class="text-[11px] text-[var(--text-tertiary)] mt-1">Submitted {formatDateTime(v.submitted_at)}{v.effective_epoch != null ? ` · effective epoch ${v.effective_epoch}` : ''}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
		<h2 class="text-[15px] font-semibold mb-1">Publish a new version</h2>
		<p class="text-[12px] text-[var(--text-secondary)] mb-4">
			Scheduling changes apply at once with no transaction. Consensus changes (modules, work, economics) need a
			<span class="font-mono">publishVersion</span> transaction and take effect after the activation delay. Listing edits live under
			<a href="/develop/apps/{pid}/settings" class="text-[var(--text-accent)]">Listing</a>.
		</p>
		<div class="flex gap-1 p-1 rounded-[6px] bg-[var(--surface-0)] mb-4 w-fit">
			<button type="button" class="h-[28px] px-3 rounded-[4px] text-[12px] border-none cursor-pointer {mode === 'scheduling' ? 'bg-[var(--surface-3)] text-[var(--text-primary)]' : 'bg-transparent text-[var(--text-secondary)]'}" onclick={() => (mode = 'scheduling')}>Requirements & SLA</button>
			<button type="button" class="h-[28px] px-3 rounded-[4px] text-[12px] border-none cursor-pointer {mode === 'consensus' ? 'bg-[var(--surface-3)] text-[var(--text-primary)]' : 'bg-transparent text-[var(--text-secondary)]'}" onclick={() => (mode = 'consensus')}>Consensus (advanced)</button>
		</div>
		{#if !sched}
			<LoadingBlock rows={2} />
		{:else if mode === 'scheduling'}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
				<label class="text-[12px] text-[var(--text-secondary)]">CPU cores<input type="number" min="0" bind:value={sched.requirements.cpu_cores} class={inputCls} /></label>
				<label class="text-[12px] text-[var(--text-secondary)]">RAM (MB)<input type="number" min="0" bind:value={sched.requirements.ram_mb} class={inputCls} /></label>
				<label class="text-[12px] text-[var(--text-secondary)]">Storage (MB)<input type="number" min="0" bind:value={sched.requirements.storage_mb} class={inputCls} /></label>
				<label class="text-[12px] text-[var(--text-secondary)]">Min benchmark<input type="number" min="0" bind:value={sched.requirements.min_benchmark} class={inputCls} /></label>
				<label class="text-[12px] text-[var(--text-secondary)]">Max latency (ms)<input type="number" min="100" bind:value={sched.sla.max_latency_ms} class={inputCls} /></label>
				<label class="text-[12px] text-[var(--text-secondary)]">Min uptime (bp)<input type="number" min="0" max="10000" bind:value={sched.sla.min_uptime_bp} class={inputCls} /></label>
			</div>
			<p class="text-[12px] text-[var(--text-secondary)] mt-4 mb-2">Device classes</p>
			<div class="flex flex-wrap gap-2">
				{#each DEVICE_CLASSES as c (c)}
					<label class="text-[12px] flex items-center gap-1.5 capitalize"><input type="checkbox" checked={sched.requirements.device_classes.includes(c)} onchange={() => (sched!.requirements.device_classes = toggle(sched!.requirements.device_classes, c as DeviceClass))} class="accent-[var(--accent-base)]" />{c}</label>
				{/each}
			</div>
			<p class="text-[12px] text-[var(--text-secondary)] mt-4 mb-2">Engines</p>
			<div class="flex flex-wrap gap-2">
				{#each ENGINES as e (e)}
					<label class="text-[12px] flex items-center gap-1.5"><input type="checkbox" checked={sched.requirements.engines.includes(e)} onchange={() => (sched!.requirements.engines = toggle(sched!.requirements.engines, e as Engine))} class="accent-[var(--accent-base)]" />{e}</label>
				{/each}
			</div>
			<label class="text-[12px] flex items-center gap-1.5 mt-4"><input type="checkbox" bind:checked={sched.public_tasks} class="accent-[var(--accent-base)]" /> Anyone may submit tasks (rate-limited)</label>
		{:else}
			<textarea bind:value={consensusText} rows="16" spellcheck="false" class="w-full p-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[12px] font-mono"></textarea>
			<p class="text-[11px] text-[var(--text-tertiary)] mt-1">Integers only; amounts are wei strings. Validated against the manifest rules before signing.</p>
		{/if}
		{#each problems as pr}<p class="text-[12px] text-[var(--error)] mt-2">{pr}</p>{/each}
		<button type="button" class="btn-subscribe mt-4 inline-flex items-center gap-1.5" disabled={busy || !sched} onclick={submit}>
			{#if busy}<Loader2 class="h-3.5 w-3.5 animate-spin" />{step || 'Working…'}{:else}Sign & publish version{/if}
		</button>
	</div>
</div>
