/**
 * Derived identifiers (PLATFORM.md §a.2, §c.1, §d.1; contracts.md §4.2).
 */
import { concat, encodeAbiParameters, getAddress, getCreate2Address, hexToBytes, keccak256, stringToBytes, type Hex } from 'viem';

export class InvalidInputError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = 'InvalidInputError';
		this.code = code;
	}
}

/** Slug rule §a.3: 3–48 chars, lowercase ASCII letters/digits/hyphens, no leading/trailing hyphen. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const HASH_RE = /^0x[0-9a-f]{64}$/;

export function isLowerAddress(a: unknown): a is `0x${string}` {
	return typeof a === 'string' && ADDRESS_RE.test(a);
}

export function isHash(h: unknown): h is `0x${string}` {
	return typeof h === 'string' && HASH_RE.test(h);
}

export function normalizeAddress(a: string): `0x${string}` {
	const lower = a.toLowerCase();
	if (!ADDRESS_RE.test(lower)) throw new InvalidInputError('invalid_address', `not an EVM address: ${a}`);
	return lower as `0x${string}`;
}

/** project_id = keccak256("necter-project-v1:" ‖ bytes20(developer) ‖ utf8(slug)) */
export function projectId(developer: string, slug: string): Hex {
	if (!SLUG_RE.test(slug)) throw new InvalidInputError('invalid_slug', 'slug must be 3–48 chars of a-z, 0-9 and inner hyphens');
	const dev = normalizeAddress(developer);
	return keccak256(concat([stringToBytes('necter-project-v1:'), hexToBytes(dev), stringToBytes(slug)]));
}

/** subscription_id = keccak256(abi.encode(bytes32 project_id, address owner, bytes32 node_key)) */
export function subscriptionId(project: string, owner: string, nodeKey: string): Hex {
	if (!isHash(project)) throw new InvalidInputError('invalid_project_id', 'project_id must be 0x + 64 hex');
	if (!isHash(nodeKey)) throw new InvalidInputError('invalid_node_key', 'node key must be 0x + 64 hex');
	return keccak256(
		encodeAbiParameters([{ type: 'bytes32' }, { type: 'address' }, { type: 'bytes32' }], [project, normalizeAddress(owner), nodeKey])
	);
}

/** node_id = "ndsr-" + first 16 hex of keccak256(raw 32-byte ed25519 public key) (PROTOCOL.md § Node identity) */
export function nodeIdFromPublicKey(publicKey: string): string {
	if (!isHash(publicKey)) throw new InvalidInputError('invalid_public_key', 'public key must be 0x + 64 hex');
	return 'ndsr-' + keccak256(publicKey).slice(2, 18);
}

/**
 * Vault address: CREATE2 EIP-1167 clone of `implementation` by `factory` with salt = project_id
 * (OpenZeppelin `Clones.predictDeterministicAddress`). Returned lowercase.
 */
export function vaultAddress(factory: string, implementation: string, project: string): `0x${string}` {
	if (!isHash(project)) throw new InvalidInputError('invalid_project_id', 'project_id must be 0x + 64 hex');
	const impl = normalizeAddress(implementation);
	const initCode = concat([
		'0x3d602d80600a3d3981f3363d3d373d3d3d363d73',
		impl,
		'0x5af43d82803e903d91602b57fd5bf3'
	]);
	return getCreate2Address({
		from: getAddress(normalizeAddress(factory)),
		salt: project,
		bytecodeHash: keccak256(initCode)
	}).toLowerCase() as `0x${string}`;
}
