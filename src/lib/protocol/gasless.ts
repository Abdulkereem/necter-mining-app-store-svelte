/**
 * Checks Hub-built EIP-712 payloads (openapi `GaslessPayload`, contracts.md §6) before the wallet signs them.
 * The wallet shows the typed data too, but users skim; these checks make sure the store never forwards a
 * request whose contract, chain, owner, amount or type layout differs from what the user asked for.
 */
import type { Eip712TypedData, GaslessPayload } from '$lib/api/types';

type Field = { name: string; type: string };

/** contracts.md §6 — exact type strings. */
export const EIP712_TYPES: Record<string, { domainName: string; fields: Field[] }> = {
	Register: {
		domainName: 'Necter ProjectRegistry',
		fields: [
			{ name: 'developer', type: 'address' },
			{ name: 'slug', type: 'string' },
			{ name: 'worker', type: 'bytes32' },
			{ name: 'consensusHash', type: 'bytes32' },
			{ name: 'manifestHash', type: 'bytes32' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	},
	PublishVersion: {
		domainName: 'Necter ProjectRegistry',
		fields: [
			{ name: 'developer', type: 'address' },
			{ name: 'projectId', type: 'bytes32' },
			{ name: 'version', type: 'uint32' },
			{ name: 'consensusHash', type: 'bytes32' },
			{ name: 'manifestHash', type: 'bytes32' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	},
	Bond: {
		domainName: 'Necter Staking',
		fields: [
			{ name: 'owner', type: 'address' },
			{ name: 'projectId', type: 'bytes32' },
			{ name: 'nodeKey', type: 'bytes32' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	},
	SetPayout: {
		domainName: 'Necter Staking',
		fields: [
			{ name: 'owner', type: 'address' },
			{ name: 'subscriptionId', type: 'bytes32' },
			{ name: 'payout', type: 'address' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	},
	Unbond: {
		domainName: 'Necter Staking',
		fields: [
			{ name: 'owner', type: 'address' },
			{ name: 'subscriptionId', type: 'bytes32' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	},
	Withdraw: {
		domainName: 'Necter Staking',
		fields: [
			{ name: 'owner', type: 'address' },
			{ name: 'subscriptionId', type: 'bytes32' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	},
	Permit: {
		domainName: 'NECTA (testnet)',
		fields: [
			{ name: 'owner', type: 'address' },
			{ name: 'spender', type: 'address' },
			{ name: 'value', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	}
};

const ACTION_PRIMARY: Record<GaslessPayload['action'], string> = {
	bond: 'Bond',
	unbond: 'Unbond',
	withdraw: 'Withdraw',
	register_project: 'Register'
};

export interface GaslessExpectation {
	chainId: number;
	owner: string;
	/** Allowed verifying contracts for the main payload (e.g. Staking from the network descriptor). Empty = skip. */
	contracts?: string[];
	/** NECTA token address for the permit. Empty = skip. */
	necta?: string | null;
	/** Exact amount (wei string) for bond / permit value lower bound. */
	amount?: string;
	projectId?: string;
	subscriptionId?: string;
	now?: number;
}

const lc = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : v);

function checkTypes(td: Eip712TypedData, primary: string): string | null {
	const spec = EIP712_TYPES[primary];
	if (!spec) return `unknown primary type ${primary}`;
	if (td.primaryType !== primary) return `expected ${primary}, got ${td.primaryType}`;
	const types = td.types as Record<string, Field[]>;
	const got = types?.[primary];
	if (!Array.isArray(got) || got.length !== spec.fields.length) return `${primary} type layout differs from the contract`;
	for (let i = 0; i < got.length; i++)
		if (got[i].name !== spec.fields[i].name || got[i].type !== spec.fields[i].type) return `${primary} type layout differs from the contract`;
	const extra = Object.keys(types).filter((k) => k !== primary && k !== 'EIP712Domain');
	if (extra.length) return `unexpected nested types: ${extra.join(', ')}`;
	const dom = td.domain as Record<string, unknown>;
	if (dom.name !== spec.domainName) return `unexpected domain name "${String(dom.name)}"`;
	if (dom.version !== '1') return 'unexpected domain version';
	return null;
}

function checkCommon(td: Eip712TypedData, exp: GaslessExpectation, contracts: string[] | undefined): string | null {
	const dom = td.domain as Record<string, unknown>;
	if (Number(dom.chainId) !== exp.chainId) return `wrong chain (${String(dom.chainId)})`;
	if (contracts && contracts.length && !contracts.map((c) => c.toLowerCase()).includes(String(lc(dom.verifyingContract))))
		return 'unexpected contract';
	const msg = td.message as Record<string, unknown>;
	const now = exp.now ?? Math.floor(Date.now() / 1000);
	const deadline = Number(msg.deadline);
	if (!Number.isFinite(deadline) || deadline <= now) return 'signature request already expired';
	if (deadline > now + 7 * 86400) return 'deadline too far in the future';
	return null;
}

/** Returns null when the payload is acceptable, else a human-readable reason. */
export function checkGaslessPayload(p: GaslessPayload, exp: GaslessExpectation): string | null {
	const primary = ACTION_PRIMARY[p.action];
	if (!primary) return `unknown action ${p.action}`;
	const td = p.typed_data;
	const typeErr = checkTypes(td, primary);
	if (typeErr) return typeErr;
	const commonErr = checkCommon(td, exp, exp.contracts);
	if (commonErr) return commonErr;
	const msg = td.message as Record<string, unknown>;
	const ownerField = primary === 'Register' ? 'developer' : 'owner';
	if (lc(msg[ownerField]) !== exp.owner.toLowerCase()) return 'payload is for another wallet';
	if (exp.amount !== undefined && primary === 'Bond' && String(msg.amount) !== exp.amount) return 'amount differs from your request';
	if (exp.projectId && primary === 'Bond' && lc(msg.projectId) !== exp.projectId.toLowerCase()) return 'project differs from your request';
	if (exp.subscriptionId && (primary === 'Unbond' || primary === 'Withdraw') && lc(msg.subscriptionId) !== exp.subscriptionId.toLowerCase())
		return 'subscription differs from your request';
	if (p.permit) {
		const permErr = checkTypes(p.permit, 'Permit') ?? checkCommon(p.permit, exp, exp.necta ? [exp.necta] : undefined);
		if (permErr) return `permit: ${permErr}`;
		const pm = p.permit.message as Record<string, unknown>;
		if (lc(pm.owner) !== exp.owner.toLowerCase()) return 'permit is for another wallet';
		if (exp.contracts && exp.contracts.length && !exp.contracts.map((c) => c.toLowerCase()).includes(String(lc(pm.spender))))
			return 'permit spender is not the staking contract';
		if (exp.amount !== undefined) {
			try {
				if (BigInt(String(pm.value)) < BigInt(exp.amount)) return 'permit value is below the bond amount';
				if (BigInt(String(pm.value)) > BigInt(exp.amount)) return 'permit value exceeds the bond amount';
			} catch {
				return 'permit value is not an integer';
			}
		}
	}
	return null;
}

/** JSON for `eth_signTypedData_v4` (adds the EIP712Domain type when missing). */
export function typedDataJson(td: Eip712TypedData): string {
	const types = { ...(td.types as Record<string, Field[]>) };
	if (!types.EIP712Domain) {
		const dom = td.domain as Record<string, unknown>;
		const d: Field[] = [];
		if ('name' in dom) d.push({ name: 'name', type: 'string' });
		if ('version' in dom) d.push({ name: 'version', type: 'string' });
		if ('chainId' in dom) d.push({ name: 'chainId', type: 'uint256' });
		if ('verifyingContract' in dom) d.push({ name: 'verifyingContract', type: 'address' });
		if ('salt' in dom) d.push({ name: 'salt', type: 'bytes32' });
		types.EIP712Domain = d;
	}
	return JSON.stringify({ domain: td.domain, types, primaryType: td.primaryType, message: td.message });
}
