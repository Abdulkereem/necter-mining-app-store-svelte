<script lang="ts">
	import toast from 'svelte-french-toast';
	import { ArrowLeft, Plus } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Device, DeviceGroup } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { DEVICE_CLASS_LABEL, bpToPercent, formatNumber, timeAgo } from '$lib/format';
	import { deviceStatus } from '$lib/components/mining/labels';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	let group = $state<string>('');
	let selected = $state<Set<string>>(new Set());
	let newGroup = $state('');
	let busy = $state(false);

	const devicesQ = useQuery(() => hub.myDevices({ limit: 200, ...(group ? { group_id: group } : {}) }), { enabled: () => $signedIn });
	const groupsQ = useQuery(() => hub.deviceGroups(), { enabled: () => $signedIn });
	const devices = $derived((devicesQ.data?.items ?? []) as Device[]);
	const groups = $derived((groupsQ.data?.items ?? []) as DeviceGroup[]);

	function toggle(id: string) {
		const s = new Set(selected);
		if (s.has(id)) s.delete(id);
		else s.add(id);
		selected = s;
	}

	async function createGroup() {
		busy = true;
		try {
			await hub.createDeviceGroup(newGroup.trim(), [...selected]);
			toast.success('Group created');
			newGroup = '';
			selected = new Set();
			await Promise.all([groupsQ.refresh(), devicesQ.refresh()]);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			busy = false;
		}
	}

	async function moveTo(groupId: string | null) {
		busy = true;
		try {
			for (const id of selected) await hub.updateDevice(id, { group_id: groupId });
			toast.success('Devices updated');
			selected = new Set();
			await Promise.all([groupsQ.refresh(), devicesQ.refresh()]);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Fleet · Necter</title></svelte:head>

<SignInGate title="Your fleet" description="Sign in to see and group the devices bound to your wallet." illustration="compute">
	<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12">
		<a href="/operator" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4"><ArrowLeft class="h-3 w-3" /> Operator</a>
		<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
			<div>
				<h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">Fleet</h1>
				<p class="text-[13px] text-[var(--text-secondary)] mt-1">Group devices to filter and manage them together.</p>
			</div>
			<select bind:value={group} class="h-[32px] px-2 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[12px] text-[var(--text-primary)]">
				<option value="">All devices</option>
				{#each groups as g (g.group_id)}<option value={g.group_id}>{g.name} ({g.node_ids.length})</option>{/each}
			</select>
		</div>

		{#if selected.size > 0}
			<div class="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--border-accent)]">
				<span class="text-[12px] font-medium">{selected.size} selected</span>
				<input bind:value={newGroup} maxlength="64" placeholder="New group name" class="h-[30px] px-2 rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[12px]" />
				<button type="button" class="btn-subscribe inline-flex items-center gap-1" disabled={busy || !newGroup.trim()} onclick={createGroup}><Plus class="h-3.5 w-3.5" /> Create group</button>
				{#if groups.length}
					<select class="h-[30px] px-2 rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[12px]" onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value; if (v) void moveTo(v === '__none' ? null : v); }}>
						<option value="">Move to…</option>
						{#each groups as g (g.group_id)}<option value={g.group_id}>{g.name}</option>{/each}
						<option value="__none">No group</option>
					</select>
				{/if}
			</div>
		{/if}

		{#if devicesQ.loading && !devicesQ.data}
			<LoadingBlock rows={4} />
		{:else if devicesQ.error}
			<ErrorState error={devicesQ.error} retry={devicesQ.refresh} />
		{:else if devices.length === 0}
			<EmptyState illustration="compute" title="No devices here" description="Bind devices with `necter-miner bind --owner <your wallet>`; they appear automatically." />
		{:else}
			<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
				<div class="hidden md:grid px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style="grid-template-columns:24px 1fr 90px 90px 80px 80px 90px;gap:12px">
					<span></span><span>Device</span><span>Status</span><span>Class</span><span class="text-right">Uptime 7d</span><span class="text-right">Units 7d</span><span class="text-right">Last seen</span>
				</div>
				{#each devices as d (d.node_id)}
					{@const st = deviceStatus(d.status)}
					<div class="flex md:grid items-center px-4 py-3 border-b border-[var(--border-default)] gap-3" style="grid-template-columns:24px 1fr 90px 90px 80px 80px 90px">
						<input type="checkbox" checked={selected.has(d.node_id)} onchange={() => toggle(d.node_id)} class="accent-[var(--accent-base)]" aria-label="Select device" />
						<a href="/miners/{d.node_id}" class="min-w-0 no-underline flex-1">
							<p class="text-[13px] font-medium text-[var(--text-primary)] truncate">{d.label ?? d.node_id}</p>
							<p class="text-[10px] font-mono text-[var(--text-tertiary)] truncate">{d.node_id} · {groups.find((g) => g.group_id === d.group_id)?.name ?? 'no group'}</p>
						</a>
						<span class="text-[11px] font-medium" style="color:{st.color}">{st.label}</span>
						<span class="hidden md:block text-[12px] text-[var(--text-secondary)]">{d.class ? DEVICE_CLASS_LABEL[d.class] : '—'}</span>
						<span class="hidden md:block text-right text-[12px] font-mono">{bpToPercent(d.uptime_bp_7d)}</span>
						<span class="hidden md:block text-right text-[12px] font-mono">{formatNumber(d.units_7d)}</span>
						<span class="hidden md:block text-right text-[11px] text-[var(--text-tertiary)]">{timeAgo(d.last_seen_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</SignInGate>
