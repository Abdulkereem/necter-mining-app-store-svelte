import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { encodePacked, keccak256, recoverMessageAddress } from 'viem';
import ref from './fixtures/reference-python.json';
import { canonicalJson, compareCodePoints, parseStrictJson, CanonicalJsonError } from './canonical';
import { projectId, subscriptionId, vaultAddress, nodeIdFromPublicKey, SLUG_RE } from './ids';
import { digestManifest, signManifest, verifySignedManifest, validateManifest, normalizeSignature, tiersChanged, nextVersion } from './manifest';
import type { Manifest } from '$lib/api/types';

const DEV_KEY = ('0x' + '00'.repeat(31) + '01') as `0x${string}`;
const dev = privateKeyToAccount(DEV_KEY);

describe('canonical JSON (matches Python json.dumps sort_keys/ensure_ascii=False)', () => {
	for (const c of ref.canonical) {
		it(`canonicalizes ${Object.keys(c.input).join(',')}`, () => {
			expect(canonicalJson(c.input)).toBe(c.output);
		});
	}
	it('orders keys by code point, not UTF-16 unit', () => {
		expect(compareCodePoints('￿', '\u{1F41D}')).toBe(-1);
		expect(['\u{1F41D}', '￿'].sort()).toEqual(['\u{1F41D}', '￿']); // JS default is wrong here
	});
	it('rejects floats, unsafe integers, lone surrogates, undefined', () => {
		expect(() => canonicalJson({ a: 1.5 })).toThrow(CanonicalJsonError);
		expect(() => canonicalJson({ a: 2 ** 53 })).toThrow(/2\^53/);
		expect(() => canonicalJson({ a: '\ud800' })).toThrow(/surrogate/);
		expect(() => canonicalJson({ a: undefined })).toThrow(CanonicalJsonError);
		expect(() => canonicalJson(-0)).toThrow(CanonicalJsonError);
	});
	it('strict parser rejects duplicate keys and floats', () => {
		expect(() => parseStrictJson('{"a":1,"a":2}')).toThrow(/duplicate/);
		expect(() => parseStrictJson('{"a":1.0}')).toThrow(/float/);
		expect(() => parseStrictJson('{"a":1e3}')).toThrow(/float/);
		expect(parseStrictJson('{"b":[1,{"c":null}],"a":"x"}')).toEqual({ b: [1, { c: null }], a: 'x' });
		const proto = parseStrictJson('{"__proto__":{"x":1}}') as Record<string, unknown>;
		expect(Object.keys(proto)).toEqual(['__proto__']);
		expect(({} as Record<string, unknown>).x).toBeUndefined();
	});
});

describe('derived ids', () => {
	it('project_id matches the Python reference', () => {
		for (const c of ref.project_id) expect(projectId(c.developer, c.slug)).toBe(c.project_id);
	});
	it('project_id equals keccak256(abi.encodePacked(string,address,string)) (on-chain form)', () => {
		const viaPacked = keccak256(encodePacked(['string', 'address', 'string'], ['necter-project-v1:', dev.address, 'weather-oracle']));
		expect(projectId(dev.address, 'weather-oracle')).toBe(viaPacked);
	});
	it('rejects invalid slugs', () => {
		for (const s of ['ab', 'a'.repeat(49), 'Abc', '-abc', 'abc-', 'a_b', 'cafè']) {
			expect(SLUG_RE.test(s)).toBe(false);
			expect(() => projectId(dev.address, s)).toThrow(/slug/);
		}
		expect(SLUG_RE.test('a'.repeat(48))).toBe(true);
	});
	it('subscription_id matches the Python reference and differs per owner', () => {
		const ids = ref.subscription_id.map((c) => subscriptionId(c.project_id, c.owner, c.node_key));
		ref.subscription_id.forEach((c, i) => expect(ids[i]).toBe(c.subscription_id));
		expect(ids[0]).not.toBe(ids[1]);
	});
	it('vault address (CREATE2 EIP-1167 clone) matches the Python reference', () => {
		for (const c of ref.vault_address) expect(vaultAddress(c.factory, c.implementation, c.project_id)).toBe(c.vault);
	});
	it('node id from public key', () => {
		const pk = '0x' + '11'.repeat(32);
		expect(nodeIdFromPublicKey(pk)).toBe('ndsr-' + keccak256(pk as `0x${string}`).slice(2, 18));
	});
});

describe('manifest signing', () => {
	for (const c of ref.manifest) {
		it(`${c.name}: canonical bytes and hashes match Python`, () => {
			const d = digestManifest(c.manifest as unknown as Manifest);
			expect(d.canonical).toBe(c.canonical);
			expect(d.manifest_hash).toBe(c.manifest_hash);
			expect(d.consensus_hash).toBe(c.consensus_hash);
			expect(d.project_id).toBe(c.project_id);
		});
		it(`${c.name}: wallet signature equals eth_account's (RFC 6979) and verifies`, async () => {
			const env = await signManifest(c.manifest as unknown as Manifest, (hex) => dev.signMessage({ message: { raw: hex } }));
			expect(env.signature).toBe(c.signature);
			const v = await verifySignedManifest(env);
			expect(v).toEqual({ ok: true, signer: c.signer });
		});
		it(`${c.name}: is valid per §a.3`, () => {
			expect(validateManifest(c.manifest)).toEqual([]);
		});
	}

	it('v2 listing-only change keeps consensus_hash', () => {
		const [a, b] = ref.manifest;
		expect(a.consensus_hash).toBe(b.consensus_hash);
		expect(tiersChanged(a.manifest as unknown as Manifest, b.manifest as unknown as Manifest)).toEqual(['listing']);
		const n = nextVersion(a.manifest as unknown as Manifest, { listing: (b.manifest as unknown as Manifest).listing });
		expect(n.version).toBe(2);
		expect(n.previous).toBe(a.manifest_hash);
	});

	it('rejects tampered envelopes and wrong signers', async () => {
		const c = ref.manifest[0];
		const m = c.manifest as unknown as Manifest;
		const env = await signManifest(m, (hex) => dev.signMessage({ message: { raw: hex } }));
		const tampered = { ...env, manifest: { ...m, listing: { ...m.listing, name: 'Other' } } };
		expect((await verifySignedManifest(tampered)).ok).toBe(false);
		const other = privateKeyToAccount(('0x' + '00'.repeat(31) + '02') as `0x${string}`);
		const wrong = await signManifest(m, (hex) => other.signMessage({ message: { raw: hex } }));
		expect(await verifySignedManifest(wrong)).toMatchObject({ ok: false, reason: 'signer is not the developer' });
	});

	it('normalizes v ∈ {0,1} and rejects high-s', async () => {
		const sig = ref.manifest[0].signature;
		const v = parseInt(sig.slice(130), 16);
		const raw01 = sig.slice(0, 130) + (v - 27).toString(16).padStart(2, '0');
		expect(normalizeSignature(raw01)).toBe(sig);
		const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
		const s = BigInt('0x' + sig.slice(66, 130));
		const highS = sig.slice(0, 66) + (N - s).toString(16).padStart(64, '0') + (v === 27 ? '1c' : '1b');
		expect(() => normalizeSignature(highS)).toThrow(/high-s/);
		// recovered signer is still the developer for the original
		const signer = await recoverMessageAddress({ message: { raw: ref.manifest[0].canonical_hex as `0x${string}` }, signature: sig as `0x${string}` });
		expect(signer.toLowerCase()).toBe(ref.keys.dev);
	});

	it('reports §a.3 problems', () => {
		const m = structuredClone(ref.manifest[0].manifest) as unknown as Manifest & Record<string, unknown>;
		m.consensus.economics.fee_split_bp = { miner: 8000, developer: 1000, treasury: 500 };
		m.scheduling.requirements.device_classes = ['phone', 'laptop'];
		(m as Record<string, unknown>).extra = 1;
		m.listing.accent_color = '#ffc933';
		(m.consensus.work as Record<string, unknown>).round_secs = 1.5;
		const codes = validateManifest(m).map((p) => `${p.path}:${p.code}`);
		expect(codes).toContain('consensus.economics.fee_split_bp:invalid_fee_split');
		expect(codes).toContain('scheduling.requirements.device_classes:invalid_value');
		expect(codes).toContain('extra:unknown_key');
		expect(codes).toContain('listing.accent_color:invalid_value');
		expect(codes.some((c) => c.endsWith(':invalid_manifest'))).toBe(true);
	});
});
