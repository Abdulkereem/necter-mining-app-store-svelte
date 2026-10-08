<script lang="ts">
	import { onMount } from 'svelte';
	import toast from 'svelte-french-toast';
	import { Play, Square, Wifi, WifiOff, Cpu, KeyRound, Link2, Loader2, ShieldAlert } from 'lucide-svelte';
	import { APP_MODE } from '$lib/config';
	import {
		minerApi,
		minerConnection,
		connectMiner,
		loginMinerPassword,
		waitMinerRequest,
		type MinerStatus,
		type MinerWallet,
		type MinerSignRequest
	} from '$lib/local/miner';
	import { wallet, personalSign, signTypedData, showConnectModal } from '$lib/stores/wallet';
	import { errorMessage } from '$lib/api/http';
	import { checkGaslessPayload } from '$lib/protocol/gasless';
	import { checkBindingMessage, messageText } from '$lib/protocol/binding';
	import { CHAIN_ID, NETWORK_ID } from '$lib/config';
	import { loadDescriptor } from '$lib/stores/network';
	import type { Eip712TypedData } from '$lib/api/types';
	import { shortAddress, timeAgo, formatDateTime } from '$lib/format';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import CopyText from '$lib/components/common/CopyText.svelte';

	let status = $state<MinerStatus | null>(null);
	let minerWallet = $state<MinerWallet | null>(null);
	let requests = $state<MinerSignRequest[]>([]);
	let error = $state<string | null>(null);
	let busy = $state<string | null>(null);
	let password = $state('');

	async function refresh() {
		if ($minerConnection.state !== 'ready') return;
		try {
			const [s, w, r] = await Promise.all([minerApi.status(), minerApi.wallet(), minerApi.signRequests()]);
			status = s;
			minerWallet = w;
			requests = Array.isArray(r) ? r : (r.items ?? []);
			error = null;
		} catch (e) {
			error = errorMessage(e);
		}
	}

	onMount(() => {
		if (APP_MODE !== 'local') return;
		void connectMiner().then(refresh);
		const t = setInterval(refresh, 5000);
		return () => clearInterval(t);
	});

	async function act(name: string, fn: () => Promise<unknown>, ok: string) {
		busy = name;
		try {
			await fn();
			toast.success(ok);
			await refresh();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			busy = null;
		}
	}

	async function login() {
		await act('login', () => loginMinerPassword(password), 'Unlocked');
		password = '';
	}

	async function bindToWallet() {
		if (!$wallet) return showConnectModal.set(true);
		await act(
			'bind',
			async () => {
				const { request_id } = await minerApi.bind($wallet!.address);
				const r = await waitMinerRequest(request_id, 300_000);
				if (r.state === 'failed') throw new Error(r.error ?? 'Binding failed');
			},
			'Device bound to your wallet'
		);
	}

	/** Signs a miner sign request with the connected browser wallet (external-wallet mode, miner-core §6). */
	async function approve(req: MinerSignRequest) {
		if (!$wallet || $wallet.connector.kind === 'miner') return showConnectModal.set(true);
		await act(
			req.request_id,
			async () => {
				let signature: string;
				if (req.format === 'eip191') {
					if (typeof req.payload !== 'string') throw new Error('Unexpected payload');
					if (req.kind === 'binding') {
						// Re-parse strictly (PLATFORM.md §c.2): this wallet as owner, this network, a fresh message.
						const d = await loadDescriptor();
						try {
							checkBindingMessage(messageText(req.payload), { network: d.network ?? NETWORK_ID, chainId: d.chain.id ?? CHAIN_ID, owner: $wallet!.address });
						} catch (e) {
							throw new Error(`Refusing to sign: ${e instanceof Error ? e.message : String(e)}`);
						}
					}
					signature = await personalSign(req.payload);
				} else {
					const td = req.payload as Eip712TypedData;
					const d = await loadDescriptor();
					const action =
						td.primaryType === 'Bond' ? 'bond' : td.primaryType === 'Unbond' ? 'unbond' : td.primaryType === 'Withdraw' ? 'withdraw' : td.primaryType === 'SetPayout' ? 'set_payout' : null;
					if (action) {
						const problem = checkGaslessPayload(
							{ action, typed_data: td, permit: null, expires_at: req.expires_at },
							{
								chainId: d.chain.id,
								owner: $wallet!.address,
								contracts: d.chain.contracts.staking ? [d.chain.contracts.staking] : [],
								// SetPayout: the address is the miner's request; the wallet shows it before signing.
								payout: action === 'set_payout' ? String((td.message as Record<string, unknown>).payout ?? '') : undefined
							}
						);
						if (problem) throw new Error(`Refusing to sign: ${problem}`);
					}
					signature = await signTypedData(td);
				}
				await minerApi.answerSignRequest(req.request_id, { signature: signature.toLowerCase() });
			},
			'Signed'
		);
	}

	const stateLabel: Record<string, { label: string; color: string }> = {
		running: { label: 'Mining', color: 'var(--success)' },
		draining: { label: 'Finishing leases', color: 'var(--warning)' },
		paused: { label: 'Paused by policy', color: 'var(--warning)' },
		unbound: { label: 'Not bound to a wallet', color: 'var(--warning)' },
		stopped: { label: 'Stopped', color: 'var(--text-tertiary)' }
	};
</script>

<svelte:head>
	<title>This device · Necter</title>
</svelte:head>

<div class="px-4 md:px-8 py-6 md:py-8 max-w-[1100px] mx-auto">
	<h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">This device</h1>
	<p class="text-[13px] text-[var(--text-secondary)] mt-1 mb-6">Status and controls of the necter-miner running on this machine.</p>

	{#if APP_MODE !== 'local'}
		<EmptyState
			illustration="compute"
			title="Device controls live in the miner app"
			description="Open the Necter desktop app, or run `necter-miner ui` on the machine, to manage the miner on that device. In the web store you can see all your devices under My Mining."
		>
			<a href="/mining/devices" class="btn-subscribe">My devices</a>
			<a href="/mining/hardware-checker" class="btn-secondary">Install the miner</a>
		</EmptyState>
	{:else if $minerConnection.state === 'unknown'}
		<LoadingBlock rows={3} height="96px" />
	{:else if $minerConnection.state === 'absent'}
		<EmptyState illustration="compute" title="The miner is not running" description="Start necter-miner (or the desktop app) on this machine, then reload this page.">
			<button type="button" class="btn-secondary" onclick={() => connectMiner().then(refresh)}>Retry</button>
		</EmptyState>
	{:else if $minerConnection.state === 'locked'}
		<div class="max-w-[420px] mx-auto rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] p-6">
			<div class="flex items-center gap-2 mb-2"><KeyRound class="h-4 w-4 text-[var(--text-accent)]" /><h2 class="text-[15px] font-semibold">Unlock the dashboard</h2></div>
			<p class="text-[12px] text-[var(--text-secondary)] mb-4">
				On this machine run <span class="font-mono">necter-miner ui</span> to open a signed-in window. Remote dashboards use the password set with
				<span class="font-mono">necter-miner ui enable-remote</span>.
			</p>
			<form onsubmit={(e) => { e.preventDefault(); void login(); }} class="flex gap-2">
				<input type="password" autocomplete="current-password" bind:value={password} placeholder="Dashboard password" class="flex-1 h-[34px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--border-accent)]" />
				<button type="submit" class="btn-subscribe" disabled={!password || busy === 'login'}>Unlock</button>
			</form>
		</div>
	{:else if !status}
		{#if error}<p class="text-[13px] text-[var(--error)]">{error}</p>{/if}
		<LoadingBlock rows={3} height="96px" />
	{:else}
		{@const st = stateLabel[status.state] ?? { label: status.state, color: 'var(--text-secondary)' }}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<section class="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
				<div class="flex items-start justify-between gap-4 flex-wrap">
					<div class="flex items-center gap-3">
						<div class="h-11 w-11 rounded-[10px] bg-[var(--accent-subtle)] flex items-center justify-center"><Cpu class="h-5 w-5 text-[var(--text-accent)]" strokeWidth={1.6} /></div>
						<div>
							<p class="text-[15px] font-semibold flex items-center gap-2"><span class="h-2 w-2 rounded-full" style="background:{st.color}"></span>{st.label}</p>
							<p class="text-[12px] text-[var(--text-tertiary)]">{status.reason ?? ''}</p>
						</div>
					</div>
					<div class="flex gap-2">
						{#if status.state === 'stopped' || status.state === 'paused'}
							<button type="button" class="btn-subscribe inline-flex items-center gap-1.5" disabled={busy === 'start'} onclick={() => act('start', minerApi.start, 'Mining started')}><Play class="h-3.5 w-3.5" /> Start</button>
						{:else if status.state !== 'unbound'}
							<button type="button" class="btn-secondary inline-flex items-center gap-1.5" disabled={busy === 'stop'} onclick={() => act('stop', () => minerApi.stop(30000), 'Stopping after current leases')}><Square class="h-3.5 w-3.5" /> Stop</button>
						{/if}
					</div>
				</div>
				<dl class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Node id</dt><dd class="mt-0.5"><CopyText value={status.node_id} /></dd></div>
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Owner</dt><dd class="mt-0.5 text-[12px] font-mono">{status.owner ? shortAddress(status.owner) : '—'}</dd></div>
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Engine</dt><dd class="mt-0.5 text-[12px]">{status.engine ?? '—'}</dd></div>
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Version</dt><dd class="mt-0.5 text-[12px]">{status.versions?.miner ?? '—'}{#if status.versions?.latest && status.versions.latest !== status.versions.miner}<span class="ml-1 text-[var(--text-accent)]">→ {status.versions.latest}</span>{/if}</dd></div>
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Relay</dt><dd class="mt-0.5 text-[12px] flex items-center gap-1">{#if status.relay?.connected}<Wifi class="h-3.5 w-3.5 text-[var(--success)]" /> {status.relay.latency_ms ?? '—'} ms{:else}<WifiOff class="h-3.5 w-3.5 text-[var(--error)]" /> offline{/if}</dd></div>
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Active leases</dt><dd class="mt-0.5 text-[12px] font-mono">{status.active_leases ?? 0} / {status.slots ?? '—'}</dd></div>
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Today</dt><dd class="mt-0.5 text-[12px] font-mono">{status.today?.leases ?? 0} leases · {status.today?.units ?? 0} units</dd></div>
					<div><dt class="text-[11px] text-[var(--text-tertiary)]">Connected since</dt><dd class="mt-0.5 text-[12px]">{timeAgo(status.relay?.since ?? null)}</dd></div>
				</dl>
				{#if status.subscriptions && status.subscriptions.length}
					<div class="mt-5 border-t border-[var(--border-default)] pt-4">
						<p class="text-[12px] font-medium text-[var(--text-secondary)] mb-2">Subscriptions on this device</p>
						<div class="flex flex-wrap gap-2">
							{#each status.subscriptions as s (s.subscription_id)}
								<a href="/mining/{s.subscription_id}" class="text-[12px] px-2 h-[26px] inline-flex items-center gap-1.5 rounded-[5px] bg-[var(--surface-2)] border border-[var(--border-default)] no-underline text-[var(--text-primary)]">
									<span class="font-mono">{s.project_id.slice(0, 10)}…</span><span class="text-[var(--text-tertiary)]">{s.status}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</section>

			<section class="rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
				<h2 class="text-[14px] font-semibold mb-3">Wallet</h2>
				{#if minerWallet}
					<p class="text-[12px] text-[var(--text-tertiary)]">{minerWallet.mode === 'embedded' ? 'Embedded wallet (signs automatically)' : 'External wallet (you approve each signature)'}</p>
					<p class="text-[13px] font-mono mt-1">{minerWallet.address ? shortAddress(minerWallet.address) : 'No wallet yet'}</p>
					{#if minerWallet.locked}<p class="text-[12px] text-[var(--warning)] mt-1">Locked — unlock it in the desktop app.</p>{/if}
				{/if}
				{#if status.state === 'unbound'}
					<div class="mt-4 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--border-accent)] p-3">
						<p class="text-[12px] text-[var(--text-primary)]">Bind this device to {$wallet ? shortAddress($wallet.address) : 'your wallet'} to start receiving work.</p>
						<button type="button" class="btn-subscribe mt-3 inline-flex items-center gap-1.5" style="width:100%" disabled={busy === 'bind'} onclick={bindToWallet}>
							{#if busy === 'bind'}<Loader2 class="h-3.5 w-3.5 animate-spin" />Waiting for signatures…{:else}<Link2 class="h-3.5 w-3.5" />Bind device{/if}
						</button>
					</div>
				{/if}
			</section>
		</div>

		<section class="mt-4 rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
			<h2 class="text-[14px] font-semibold mb-1">Signature requests</h2>
			<p class="text-[12px] text-[var(--text-tertiary)] mb-4">With an external wallet the miner asks you to approve binding, collateral and claim signatures here. Requests expire after 15 minutes.</p>
			{#if requests.length === 0}
				<p class="text-[13px] text-[var(--text-secondary)]">Nothing to sign.</p>
			{:else}
				<div class="space-y-2">
					{#each requests as req (req.request_id)}
						<div class="flex items-center gap-3 p-3 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border-default)]">
							<ShieldAlert class="h-4 w-4 text-[var(--text-accent)] flex-shrink-0" />
							<div class="flex-1 min-w-0">
								<p class="text-[13px] font-medium capitalize">{req.kind.replace('_', ' ')} <span class="text-[11px] text-[var(--text-tertiary)] uppercase">{req.format}</span></p>
								<p class="text-[11px] text-[var(--text-tertiary)]">Expires {formatDateTime(req.expires_at)}</p>
							</div>
							<button type="button" class="btn-secondary" disabled={busy === req.request_id} onclick={() => act(req.request_id, () => minerApi.answerSignRequest(req.request_id, { reject: true }), 'Rejected')}>Reject</button>
							<button type="button" class="btn-subscribe" disabled={busy === req.request_id} onclick={() => approve(req)}>Review & sign</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>
