/**
 * Device binding messages (PLATFORM.md §c.2). The store never builds bindings for the Hub — the miner does — but
 * it signs them with the browser wallet when the miner raises a `binding` sign request (external-wallet mode,
 * miner-core.md §6). Before the wallet signs, the message is re-parsed strictly and checked against the wallet,
 * the network and the clock, so a request can never bind a device to another owner or network.
 */
import { hexToString, isHex, keccak256, stringToBytes, type Hex } from 'viem';
import { isHash, isLowerAddress, nodeIdFromPublicKey } from './ids';

export class BindingError extends Error {
	readonly code: 'invalid_binding' | 'stale_binding';
	constructor(code: 'invalid_binding' | 'stale_binding', message: string) {
		super(message);
		this.name = 'BindingError';
		this.code = code;
	}
}

export interface BindingFields {
	unbind?: boolean;
	network: string;
	chainId: number;
	owner: string;
	nodeId: string;
	publicKey: string;
	issuedAt: number;
	nonce: string;
}

/** §c.2 rule: |now − issued_at| ≤ 600 at submission. */
export const BINDING_MAX_SKEW = 600;

const FIRST = { bind: 'Necter: bind mining device', unbind: 'Necter: unbind mining device' } as const;
const LABELS = ['Network', 'Chain ID', 'Owner', 'Node ID', 'Node key', 'Issued at', 'Nonce'] as const;

/** Builds the exact message bytes (lines joined by `\n`, no trailing newline, lowercase hex). */
export function bindingMessage(f: BindingFields): string {
	return [
		f.unbind ? FIRST.unbind : FIRST.bind,
		`Network: ${f.network}`,
		`Chain ID: ${f.chainId}`,
		`Owner: ${f.owner}`,
		`Node ID: ${f.nodeId}`,
		`Node key: ${f.publicKey}`,
		`Issued at: ${f.issuedAt}`,
		`Nonce: ${f.nonce}`
	].join('\n');
}

/** Strict parse: exact labels and order, lowercase hex, node id derived from the node key. */
export function parseBindingMessage(message: string): BindingFields {
	const bad = (why: string) => new BindingError('invalid_binding', why);
	const lines = message.split('\n');
	if (lines.length !== 8) throw bad('a binding message has exactly 8 lines');
	const unbind = lines[0] === FIRST.unbind;
	if (!unbind && lines[0] !== FIRST.bind) throw bad('unexpected first line');
	const v: string[] = [];
	LABELS.forEach((label, i) => {
		const line = lines[i + 1];
		if (!line.startsWith(`${label}: `)) throw bad(`line ${i + 2} must be "${label}: …"`);
		v.push(line.slice(label.length + 2));
	});
	const [network, chain, owner, nodeId, publicKey, issued, nonce] = v;
	if (!/^[a-z0-9-]{1,64}$/.test(network)) throw bad('invalid network');
	if (!/^[1-9][0-9]{0,15}$/.test(chain)) throw bad('invalid chain id');
	if (!isLowerAddress(owner)) throw bad('owner must be a lowercase address');
	if (!isHash(publicKey)) throw bad('node key must be lowercase 0x + 64 hex');
	if (!/^ndsr-[0-9a-f]{16}$/.test(nodeId) || nodeIdFromPublicKey(publicKey) !== nodeId) throw bad('node id is not derived from the node key');
	if (!/^(0|[1-9][0-9]{0,15})$/.test(issued)) throw bad('invalid issued at');
	if (!/^[0-9a-f]{32}$/.test(nonce)) throw bad('nonce must be 32 lowercase hex');
	const f: BindingFields = { unbind, network, chainId: Number(chain), owner, nodeId, publicKey, issuedAt: Number(issued), nonce };
	if (bindingMessage(f) !== message) throw bad('message is not canonical');
	return f;
}

/** binding_hash = keccak256(message bytes) */
export function bindingHash(message: string): Hex {
	return keccak256(stringToBytes(message));
}

export interface BindingExpectation {
	network: string;
	chainId: number;
	/** The wallet about to sign (owner of the binding). Omit to skip. */
	owner?: string;
	now?: number;
}

/** Parses and checks a message against the network, the wallet and the clock. Throws BindingError. */
export function checkBindingMessage(message: string, exp: BindingExpectation): BindingFields {
	const f = parseBindingMessage(message);
	if (f.network !== exp.network || f.chainId !== exp.chainId) throw new BindingError('invalid_binding', `binding is for ${f.network} / chain ${f.chainId}`);
	if (exp.owner && f.owner !== exp.owner.toLowerCase()) throw new BindingError('invalid_binding', 'binding names another wallet as owner');
	const now = exp.now ?? Math.floor(Date.now() / 1000);
	if (Math.abs(now - f.issuedAt) > BINDING_MAX_SKEW) throw new BindingError('stale_binding', 'binding message is too old or from the future');
	return f;
}

/** Record-level checks the store can do without the signatures: hash, fields, network, freshness. */
export function checkBindingRecord(
	r: { message: string; binding_hash: string; owner: string; node_id: string; public_key: string; issued_at: number; nonce: string },
	exp: BindingExpectation
): BindingFields {
	const f = checkBindingMessage(r.message, exp);
	if (bindingHash(r.message) !== r.binding_hash) throw new BindingError('invalid_binding', 'binding_hash mismatch');
	if (r.owner !== f.owner || r.node_id !== f.nodeId || r.public_key !== f.publicKey || r.issued_at !== f.issuedAt || r.nonce !== f.nonce)
		throw new BindingError('invalid_binding', 'record fields differ from the message');
	return f;
}

/** Sign-request payloads arrive as text or as 0x-hex of the UTF-8 bytes. */
export function messageText(payload: string): string {
	return isHex(payload) && payload.length % 2 === 0 && payload.length > 2 ? hexToString(payload) : payload;
}
