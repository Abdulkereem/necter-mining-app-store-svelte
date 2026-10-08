<script lang="ts">
	import { Server, Wifi, Layers, Coins, ChevronRight, LayoutGrid, LineChart, Zap } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Device, Subscription } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { bpToPercent, formatToken } from '$lib/format';
	import { sumByToken } from '$lib/components/mining/labels';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	const devicesQ = useQuery(() => hub.myDevices({ limit: 200 }), { enabled: () => $signedIn });
	const subsQ = useQuery(() => hub.mySubscriptions({ limit: 200 }), { enabled: () => $signedIn });
	const earningsQ = useQuery(() => hub.earnings({ period: '30d', group_by: 'device' }), { enabled: () => $signedIn });
	const groupsQ = useQuery(() => hub.deviceGroups(), { enabled: () => $signedIn });

	const devices = $derived((devicesQ.data?.items ?? []) as Device[]);
	const subs = $derived((subsQ.data?.items ?? []) as Subscription[]);
	const online = $derived(devices.filter((d) => d.status === 'online').length);
	const avgUptime = $derived(devices.length ? Math.round(devices.reduce((a, d) => a + (d.uptime_bp_7d ?? 0), 0) / devices.length) : null);
	const reps = $derived(subs.filter((s) => typeof s.reputation === 'number'));
	const avgRep = $derived(reps.length ? Math.round(reps.reduce((a, s) => a + (s.reputation ?? 0), 0) / reps.length) : null);
	const totals = $derived(sumByToken(earningsQ.data?.totals ?? []));
	const byClass = $derived.by(() => {
		const m = new Map<string, number>();
		for (const d of devices) m.set(d.class ?? 'unknown', (m.get(d.class ?? 'unknown') ?? 0) + 1);
		return [...m.entries()];
	});

	const quickLinks = [
		{ href: '/operator/fleet', label: 'Fleet', desc: 'Devices, groups and status', icon: LayoutGrid },
		{ href: '/operator/earnings', label: 'Earnings', desc: 'Per device, project and day', icon: LineChart },
		{ href: '/mining/collateral', label: 'Collateral', desc: 'Bond, unbond and withdraw', icon: Coins },
		{ href: '/operator/automation', label: 'Automation', desc: 'Coming soon', icon: Zap }
	];
</script>

<svelte:head><title>Operator · Necter</title></svelte:head>

<SignInGate title="Operator dashboard" description="Run many devices from one wallet. Sign in to see your fleet." illustration="compute">
	<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12">
		<div style="margin-bottom:24px">
			<h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">Operator</h1>
			<p class="text-[13px] text-[var(--text-secondary)] mt-1">Every device bound to your wallet, in one place.</p>
		</div>

		{#if devicesQ.loading && !devicesQ.data}
			<LoadingBlock rows={2} height="96px" />
		{:else if devicesQ.error}
			<ErrorState error={devicesQ.error} retry={devicesQ.refresh} />
		{:else if devices.length === 0}
			<EmptyState illustration="compute" title="No devices yet" description="Install necter-miner on your servers (Docker or systemd) or desktops and bind each one to this wallet; they appear here automatically.">
				<a href="/mining/hardware-checker" class="btn-subscribe">Install the miner</a>
			</EmptyState>
		{:else}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
				{#each [
					{ label: 'Devices', value: String(devices.length), icon: Server },
					{ label: 'Online', value: String(online), icon: Wifi },
					{ label: 'Subscriptions', value: String(subs.length), icon: Layers },
					{ label: 'Groups', value: String(groupsQ.data?.items?.length ?? 0), icon: LayoutGrid }
				] as stat (stat.label)}
					{@const Icon = stat.icon}
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px">
						<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
							<Icon size={14} strokeWidth={1.5} style="color:var(--text-tertiary)" />
							<span style="font-size:11px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.02em">{stat.label}</span>
						</div>
						<p style="font-size:24px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono)">{stat.value}</p>
					</div>
				{/each}
			</div>

			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px]" style="padding:16px;margin-top:16px">
				<h2 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Fleet health</h2>
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Avg uptime (7d)</p><p class="text-[20px] font-semibold font-mono text-[var(--success)]">{bpToPercent(avgUptime)}</p></div>
					<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Avg reputation</p><p class="text-[20px] font-semibold font-mono text-[var(--text-accent)]">{bpToPercent(avgRep)}</p></div>
					<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Earned (30d)</p>{#if totals.length}{#each totals as t (t.token.address)}<p class="text-[16px] font-semibold font-mono">{formatToken(t.amount.toString(), t.token, { maxFrac: 2 })}</p>{/each}{:else}<p class="text-[20px] font-mono">—</p>{/if}</div>
					<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">By class</p><div class="flex gap-2 flex-wrap mt-1">{#each byClass as [c, n] (c)}<span class="text-[11px] font-medium px-1.5 h-[20px] inline-flex items-center rounded-[3px] bg-[var(--surface-3)] text-[var(--text-secondary)] capitalize">{c} {n}</span>{/each}</div></div>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
			{#each quickLinks as link (link.href)}
				{@const Icon = link.icon}
				<a href={link.href} class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] hover:border-[var(--border-hover)]" style="padding:16px;display:flex;align-items:center;gap:12px;text-decoration:none">
					<div style="width:36px;height:36px;border-radius:8px;background:var(--accent-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0"><Icon size={16} strokeWidth={1.5} style="color:var(--text-accent)" /></div>
					<div style="flex:1;min-width:0"><p style="font-size:13px;font-weight:600;color:var(--text-primary)">{link.label}</p><p style="font-size:12px;color:var(--text-tertiary);margin-top:2px">{link.desc}</p></div>
					<ChevronRight size={14} strokeWidth={1.5} style="color:var(--text-tertiary)" />
				</a>
			{/each}
		</div>
	</div>
</SignInGate>
