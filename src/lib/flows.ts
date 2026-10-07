/**
 * Multi-step user flows that combine Hub calls with wallet signatures:
 *   - subscribe (intent → check EIP-712 Bond + NECTA permit → sign → relay → wait for `active`)
 *   - top up, unbond, withdraw collateral (gasless, relayed by the Hub — PLATFORM.md D19)
 *   - claim rewards (gasless Merkle claims)
 *   - publish a project / a new version (prepare → compare canonical bytes → personal_sign → submit → register tx)
 *
 * In local mode with the miner's own wallet, the subscription actions go through the miner API instead
 * (miner-core.md §6–§7), which signs with the embedded wallet or raises a sign request.
 */
import { get } from 'svelte/store';
import { hub } from '$lib/api/hub';
import type { Amount, GaslessPayload, Manifest, SignedGasless, Subscription, TxStatus } from '$lib/api/types';
import { checkGaslessPayload } from '$lib/protocol/gasless';
import { digestManifest, signManifest, validateManifest, type ManifestProblem } from '$lib/protocol/manifest';
import { CHAIN_ID } from '$lib/config';
import { loadDescriptor } from '$lib/stores/network';
import { wallet, signTypedData, personalSign, sendTransaction } from '$lib/stores/wallet';
import { minerApi, waitMinerRequest } from '$lib/local/miner';

export type Step = (label: string) => void;

function usingMinerWallet() {
	return get(wallet)?.connector.kind === 'miner';
}

function owner(): string {
	const w = get(wallet);
	if (!w) throw new Error('Connect a wallet first');
	return w.address;
}

async function expectation(extra: { amount?: string; projectId?: string; subscriptionId?: string }) {
	const d = await loadDescriptor();
	const c = d.chain.contracts;
	return {
		chainId: d.chain.id ?? CHAIN_ID,
		owner: owner(),
		// Bond / Unbond / Withdraw are Staking payloads (contracts.md §6).
		contracts: [c.staking].filter((x): x is string => !!x),
		necta: c.necta ?? d.chain.token ?? null,
		...extra
	};
}

/** Checks, signs and returns a SignedGasless for a payload (+ permit). */
async function signGasless(p: GaslessPayload, exp: Awaited<ReturnType<typeof expectation>>, step?: Step): Promise<SignedGasless> {
	const problem = checkGaslessPayload(p, exp);
	if (problem) throw new Error(`Refusing to sign: ${problem}`);
	step?.('Sign the request in your wallet');
	const signature = (await signTypedData(p.typed_data)).toLowerCase();
	let permit_signature: string | null = null;
	if (p.permit) {
		step?.('Approve the NECTA permit in your wallet');
		permit_signature = (await signTypedData(p.permit)).toLowerCase();
	}
	return { typed_data: p.typed_data, signature, permit: p.permit ?? null, permit_signature };
}

async function waitForStatus(subscriptionId: string, done: (s: Subscription) => boolean, timeoutMs = 90_000): Promise<Subscription | null> {
	const until = Date.now() + timeoutMs;
	let last: Subscription | null = null;
	while (Date.now() < until) {
		last = await hub.subscription(subscriptionId);
		if (last && done(last)) return last;
		await new Promise((r) => setTimeout(r, 2500));
	}
	return last;
}

function assertTx(tx: TxStatus) {
	if (tx.status === 'failed' || tx.status === 'reverted') throw new Error(tx.error ?? `Transaction ${tx.status}`);
}

/** Subscribe a device to a project with `collateral` NECTA wei. Returns the subscription (active or pending). */
export async function subscribe(projectId: string, nodeId: string, collateral: Amount, step?: Step): Promise<Subscription | null> {
	if (usingMinerWallet()) {
		step?.('Asking the miner to subscribe');
		const { request_id } = await minerApi.subscribe(projectId, collateral);
		const r = await waitMinerRequest(request_id, 180_000);
		if (r.state === 'failed') throw new Error(r.error ?? 'The miner could not subscribe');
		return (r.result as Subscription) ?? null;
	}
	step?.('Creating the subscription');
	const intent = await hub.createSubscription(projectId, nodeId, collateral);
	const exp = await expectation({ amount: collateral, projectId });
	const signed = await signGasless(intent.bond, exp, step);
	step?.('Bonding collateral (gasless)');
	assertTx(await hub.bond(intent.subscription.subscription_id, signed));
	step?.('Waiting for the bond to confirm');
	return waitForStatus(intent.subscription.subscription_id, (s) => s.status !== 'pending_collateral');
}

/** Adds collateral to an existing subscription. */
export async function topUp(sub: Subscription, amount: Amount, step?: Step) {
	step?.('Preparing the top-up');
	const payload = await hub.bondPayload(sub.subscription_id, amount);
	const exp = await expectation({ amount, projectId: sub.project_id });
	const signed = await signGasless(payload, exp, step);
	step?.('Bonding collateral (gasless)');
	assertTx(await hub.bond(sub.subscription_id, signed));
}

/** Starts unbonding (collateral withdrawable after the unbonding period). */
export async function unbond(sub: Subscription, step?: Step) {
	if (usingMinerWallet()) {
		const { request_id } = await minerApi.subscriptionAction(sub.subscription_id, 'unbond');
		const r = await waitMinerRequest(request_id);
		if (r.state === 'failed') throw new Error(r.error ?? 'The miner could not unbond');
		return;
	}
	step?.('Preparing the unbond request');
	const payload = (await hub.unbond(sub.subscription_id)) as GaslessPayload;
	const signed = await signGasless(payload, await expectation({ subscriptionId: sub.subscription_id }), step);
	step?.('Submitting (gasless)');
	assertTx((await hub.unbond(sub.subscription_id, signed)) as TxStatus);
}

/** Withdraws collateral after `release_at`. */
export async function withdrawCollateral(sub: Subscription, step?: Step) {
	if (usingMinerWallet()) {
		const { request_id } = await minerApi.subscriptionAction(sub.subscription_id, 'withdraw');
		const r = await waitMinerRequest(request_id);
		if (r.state === 'failed') throw new Error(r.error ?? 'The miner could not withdraw');
		return;
	}
	step?.('Preparing the withdrawal');
	const payload = (await hub.withdrawCollateral(sub.subscription_id)) as GaslessPayload;
	const signed = await signGasless(payload, await expectation({ subscriptionId: sub.subscription_id }), step);
	step?.('Submitting (gasless)');
	assertTx((await hub.withdrawCollateral(sub.subscription_id, signed)) as TxStatus);
}

export async function pause(sub: Subscription) {
	if (usingMinerWallet()) {
		const { request_id } = await minerApi.subscriptionAction(sub.subscription_id, 'pause');
		await waitMinerRequest(request_id);
		return;
	}
	return hub.pause(sub.subscription_id);
}

export async function resume(sub: Subscription) {
	if (usingMinerWallet()) {
		const { request_id } = await minerApi.subscriptionAction(sub.subscription_id, 'resume');
		await waitMinerRequest(request_id);
		return;
	}
	return hub.resume(sub.subscription_id);
}

/** Claims every released payout (gasless; funds always go to the miner). */
export async function claimAll(projectIds?: string[]) {
	if (usingMinerWallet()) {
		const { request_id } = await minerApi.claims();
		const r = await waitMinerRequest(request_id);
		if (r.state === 'failed') throw new Error(r.error ?? 'Claim failed');
		return [];
	}
	return (await hub.claimRewards(projectIds)).items ?? [];
}

export class ManifestRejected extends Error {
	readonly problems: ManifestProblem[];
	constructor(problems: ManifestProblem[]) {
		super(problems.map((p) => `${p.path || 'manifest'}: ${p.message}`).join('; '));
		this.name = 'ManifestRejected';
		this.problems = problems;
	}
}

/**
 * Validates locally, asks the Hub to prepare, checks the Hub's canonical bytes/ids equal ours, then signs.
 */
async function prepareAndSign(m: Manifest, step?: Step) {
	const local = validateManifest(m);
	if (local.length) throw new ManifestRejected(local);
	step?.('Validating with the network');
	const prep = await hub.prepareManifest(m);
	if (!prep.valid) throw new ManifestRejected(prep.problems);
	const d = digestManifest(m);
	if (prep.canonical !== undefined && prep.canonical !== d.canonical) throw new Error('The network returned different manifest bytes; not signing.');
	if (prep.manifest_hash && prep.manifest_hash !== d.manifest_hash) throw new Error('manifest_hash mismatch; not signing.');
	if (prep.project_id && prep.project_id !== d.project_id) throw new Error('project_id mismatch; not signing.');
	step?.('Sign the manifest in your wallet');
	const env = await signManifest(m, (hex) => personalSign(hex));
	return { env, prep };
}

/** Publishes version 1. Returns the project and, when sent, the register transaction hash. */
export async function publishProject(m: Manifest, step?: Step, opts: { sendRegisterTx?: boolean } = {}) {
	const { env } = await prepareAndSign(m, step);
	step?.('Submitting the signed manifest');
	const res = await hub.publishProject(env);
	let txHash: string | null = null;
	if (opts.sendRegisterTx !== false && res.register_tx) {
		step?.('Confirm the registry transaction in your wallet');
		txHash = await sendTransaction(res.register_tx);
	}
	return { project: res.project, registerTx: res.register_tx, txHash };
}

/** Publishes version n > 1. Listing/scheduling-only versions apply at once; consensus changes need a tx. */
export async function publishVersion(projectId: string, m: Manifest, step?: Step, opts: { sendPublishTx?: boolean } = {}) {
	const { env } = await prepareAndSign(m, step);
	step?.('Submitting the new version');
	const res = await hub.publishVersion(projectId, env);
	let txHash: string | null = null;
	if (opts.sendPublishTx !== false && res.publish_tx) {
		step?.('Confirm the publishVersion transaction in your wallet');
		txHash = await sendTransaction(res.publish_tx);
	}
	return { version: res.version, publishTx: res.publish_tx ?? null, txHash };
}
