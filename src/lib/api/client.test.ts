import { describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createApiClient, unwrap, unwrapOrNull, collectPages, ApiError, errorMessage } from './http';
import { createMockHub } from './mock/hub';
import { checkSiweMessage, buildSiweMessage } from '$lib/protocol/siwe';
import { checkGaslessPayload } from '$lib/protocol/gasless';
import { normalizeSignature, signManifest, digestManifest } from '$lib/protocol/manifest';
import { vaultAddress } from '$lib/protocol/ids';
import ref from '$lib/protocol/fixtures/reference-python.json';
import type { Manifest } from './types';

const OWNER_KEY = ('0x' + '00'.repeat(31) + '02') as `0x${string}`;
const owner = privateKeyToAccount(OWNER_KEY);
const ownerAddr = owner.address.toLowerCase();
const BASE = 'https://testnet-rpc.necter.network';

function setup(opts: { now?: () => number } = {}) {
	const hub = createMockHub({ now: opts.now });
	let token: string | null = null;
	const onUnauthorized = vi.fn(() => (token = null));
	const seen: Request[] = [];
	const client = createApiClient({
		baseUrl: BASE,
		fetch: (r) => {
			seen.push(r.clone());
			return hub.handle(r);
		},
		getToken: () => token,
		onUnauthorized
	});
	return { hub, client, seen, onUnauthorized, setToken: (t: string | null) => (token = t) };
}

async function siwe(client: ReturnType<typeof setup>['client'], domain = 'testnet.necter.network') {
	const n = await unwrap(client.POST('/v1/auth/nonce', { body: { address: ownerAddr, domain } }));
	const check = checkSiweMessage(n.message, {
		domain,
		address: ownerAddr,
		uri: domain.includes(':') ? `http://${domain}` : `https://${domain}`,
		chainId: 11155111,
		statement: 'Sign in to Necter testnet.',
		nonce: n.nonce
	});
	expect(check).toMatchObject({ ok: true });
	const signature = normalizeSignature(await owner.signMessage({ message: n.message })).toLowerCase();
	return { nonce: n, session: await unwrap(client.POST('/v1/auth/siwe', { body: { message: n.message, signature } })) };
}

describe('API client', () => {
	it('reads public endpoints and paginates', async () => {
		const { client } = setup();
		const d = await unwrap(client.GET('/'));
		expect(d.network).toBe('necter-testnet');
		const page = await unwrap(client.GET('/v1/projects', { params: { query: { limit: 2 } } }));
		expect(page.items).toHaveLength(2);
		expect(page.next_cursor).toBe('2');
		const all = await collectPages((cursor) => unwrap(client.GET('/v1/projects', { params: { query: { limit: 1, cursor } } })));
		expect(all.map((p) => p.slug)).toEqual(['sample-weather-oracle', 'sample-image-hash', 'sample-route-scorer']);
	});

	it('maps error bodies to ApiError and 404 to null', async () => {
		const { client } = setup();
		const id = '0x' + 'ff'.repeat(32);
		await expect(unwrap(client.GET('/v1/projects/{project_id}', { params: { path: { project_id: id } } }))).rejects.toMatchObject({
			name: 'ApiError',
			status: 404,
			code: 'not_found'
		});
		expect(await unwrapOrNull(client.GET('/v1/projects/{project_id}', { params: { path: { project_id: id } } }))).toBeNull();
	});

	it('reports network failures as network_error', async () => {
		const client = createApiClient({ baseUrl: BASE, fetch: async () => Promise.reject(new TypeError('Failed to fetch')), getToken: () => null });
		const e = await unwrap(client.GET('/v1/status')).catch((x) => x);
		expect(e).toBeInstanceOf(ApiError);
		expect(e.code).toBe('network_error');
		expect(errorMessage(e)).toMatch(/Cannot reach/);
	});

	it('parses Retry-After on 429', async () => {
		const client = createApiClient({
			baseUrl: BASE,
			fetch: async () => new Response(JSON.stringify({ error: 'rate_limited', message: 'slow down', request_id: 'r1' }), { status: 429, headers: { 'Retry-After': '12' } }),
			getToken: () => null
		});
		const e = (await unwrap(client.GET('/v1/status')).catch((x) => x)) as ApiError;
		expect(e.retryAfter).toBe(12);
		expect(e.requestId).toBe('r1');
		expect(errorMessage(e)).toBe('Too many requests. Try again in 12s.');
	});

	it('sends the bearer token and drops the session on 401', async () => {
		const { client, seen, setToken, onUnauthorized } = setup();
		setToken('nsess_not_a_real_token_000000000000000000');
		await expect(unwrap(client.GET('/v1/me'))).rejects.toMatchObject({ status: 401 });
		expect(seen.at(-1)!.headers.get('Authorization')).toBe('Bearer nsess_not_a_real_token_000000000000000000');
		expect(onUnauthorized).toHaveBeenCalledOnce();
	});
});

describe('SIWE flow', () => {
	it('nonce → check → personal_sign → session → /v1/me', async () => {
		const { client, setToken } = setup();
		const { session } = await siwe(client);
		expect(session.address).toBe(ownerAddr);
		expect(session.token).toMatch(/^nsess_/);
		setToken(session.token);
		const me = await unwrap(client.GET('/v1/me'));
		expect(me.address).toBe(ownerAddr);
		await unwrap(client.POST('/v1/auth/logout'));
		await expect(unwrap(client.GET('/v1/me'))).rejects.toMatchObject({ status: 401 });
	});

	it('works for the local-mode domain 127.0.0.1:7878', async () => {
		const { client } = setup();
		const { session } = await siwe(client, '127.0.0.1:7878');
		expect(session.address).toBe(ownerAddr);
	});

	it('rejects a reused nonce and a signature from another key', async () => {
		const { client } = setup();
		const n = await unwrap(client.POST('/v1/auth/nonce', { body: { address: ownerAddr, domain: 'testnet.necter.network' } }));
		const other = privateKeyToAccount(('0x' + '00'.repeat(31) + '03') as `0x${string}`);
		const bad = (await other.signMessage({ message: n.message })).toLowerCase();
		await expect(unwrap(client.POST('/v1/auth/siwe', { body: { message: n.message, signature: bad } }))).rejects.toMatchObject({ status: 401 });
		// nonce consumed by the failed attempt
		const good = (await owner.signMessage({ message: n.message })).toLowerCase();
		await expect(unwrap(client.POST('/v1/auth/siwe', { body: { message: n.message, signature: good } }))).rejects.toMatchObject({ status: 401 });
	});

	it('client refuses messages for another domain, chain, address or statement', () => {
		const now = 1_791_000_000;
		const base = { domain: 'testnet.necter.network', address: ownerAddr, statement: 'Sign in to Necter testnet.', uri: 'https://testnet.necter.network', chainId: 11155111, nonce: 'AbCdEfGhIjKlMnOpQ', issuedAt: now, expirationTime: now + 3600 };
		const exp = { domain: base.domain, address: ownerAddr, uri: base.uri, chainId: 11155111, statement: base.statement, now };
		expect(checkSiweMessage(buildSiweMessage(base), exp)).toMatchObject({ ok: true });
		expect(checkSiweMessage(buildSiweMessage({ ...base, domain: 'evil.example' }), exp)).toMatchObject({ ok: false });
		expect(checkSiweMessage(buildSiweMessage({ ...base, chainId: 1 }), exp)).toMatchObject({ ok: false });
		expect(checkSiweMessage(buildSiweMessage({ ...base, address: ref.keys.dev }), exp)).toMatchObject({ ok: false });
		expect(checkSiweMessage(buildSiweMessage({ ...base, statement: 'Approve all' }), exp)).toMatchObject({ ok: false });
		expect(checkSiweMessage(buildSiweMessage({ ...base, uri: 'https://evil.example' }), exp)).toMatchObject({ ok: false });
		expect(checkSiweMessage(buildSiweMessage({ ...base, issuedAt: now - 3600 }), exp)).toMatchObject({ ok: false });
		expect(checkSiweMessage(buildSiweMessage({ ...base, expirationTime: now + 3 * 86400 }), exp)).toMatchObject({ ok: false });
	});

	it('message format and signature match the Python reference', async () => {
		const msg = buildSiweMessage({
			domain: 'testnet.necter.network',
			address: ref.siwe.address,
			statement: 'Sign in to Necter testnet.',
			uri: 'https://testnet.necter.network',
			chainId: 11155111,
			nonce: 'AbCdEfGhIjKlMnOpQ',
			issuedAt: Date.parse('2026-10-07T12:00:00Z') / 1000,
			expirationTime: Date.parse('2026-10-08T00:00:00Z') / 1000
		});
		expect(msg).toBe(ref.siwe.message);
		expect(await owner.signMessage({ message: msg })).toBe(ref.siwe.signature);
	});
});

describe('subscribe + gasless bond (EIP-712 intent and permit)', () => {
	it('creates an intent, checks and signs the payloads, relays the bond', async () => {
		const { client, setToken, hub } = setup();
		const { session } = await siwe(client);
		setToken(session.token);
		await unwrap(client.POST('/v1/faucet/drip'));
		const devices = await unwrap(client.GET('/v1/me/devices'));
		const project = (await unwrap(client.GET('/v1/projects'))).items[0];
		const amount = '10000000000000000000';
		const intent = await unwrap(client.POST('/v1/subscriptions', { body: { project_id: project.project_id, node_id: devices.items[0].node_id, collateral: amount } }));
		const d = await unwrap(client.GET('/'));
		const exp = { chainId: 11155111, owner: ownerAddr, contracts: [d.chain.contracts.staking!], necta: d.chain.contracts.necta, amount, projectId: project.project_id };
		expect(checkGaslessPayload(intent.bond, exp)).toBeNull();
		// a payload asking for more than requested is refused
		expect(checkGaslessPayload(intent.bond, { ...exp, amount: '1' })).toMatch(/amount/);
		expect(checkGaslessPayload(intent.bond, { ...exp, owner: ref.keys.dev })).toMatch(/another wallet/);
		expect(checkGaslessPayload(intent.bond, { ...exp, contracts: ['0x' + '99'.repeat(20)] })).toMatch(/contract/);

		const td = intent.bond.typed_data;
		const signature = (await owner.signTypedData(td as never)).toLowerCase();
		const permit = intent.bond.permit!;
		const permit_signature = (await owner.signTypedData(permit as never)).toLowerCase();
		const tx = await unwrap(
			client.POST('/v1/subscriptions/{subscription_id}/bond', {
				params: { path: { subscription_id: intent.subscription.subscription_id } },
				body: { typed_data: td, signature, permit, permit_signature }
			})
		);
		expect(tx.status).toBe('confirmed');
		const sub = await unwrap(client.GET('/v1/subscriptions/{subscription_id}', { params: { path: { subscription_id: intent.subscription.subscription_id } } }));
		expect(sub.status).toBe('active');
		expect(sub.collateral).toBe(amount);
		expect(hub.state().accounts[ownerAddr].necta).toBe(990n * 10n ** 18n);
	});
});

describe('developer publish flow', () => {
	it('enroll → prepare → sign manifest → publish → version 2 listing-only', async () => {
		const { client, setToken } = setup();
		const { session } = await siwe(client);
		setToken(session.token);
		await unwrap(client.POST('/v1/developers/me/enrollment', { body: { developer_type: 'individual', display_name: 'Owner', agreements_accepted: true } }));
		const m = structuredClone(ref.manifest[0].manifest) as unknown as Manifest;
		m.developer = ownerAddr;
		m.slug = 'owner-oracle';
		const pid = digestManifest(m).project_id;
		m.consensus.economics.vault = vaultAddress('0x000000000000000000000000000000000000fac7', '0x0000000000000000000000000000000000001111', pid);
		const prep = await unwrap(client.POST('/v1/developers/projects/prepare', { body: { manifest: m } as never }));
		expect(prep.problems).toEqual([]);
		expect(prep.canonical).toBe(digestManifest(m).canonical);
		const env = await signManifest(m, (hex) => owner.signMessage({ message: { raw: hex } }));
		const pub = await unwrap(client.POST('/v1/developers/projects', { body: env as never }));
		expect(pub.project.listing_status).toBe('pending_review');
		expect(pub.register_tx.to).toMatch(/^0x[0-9a-f]{40}$/);
		const v2 = { ...m, version: 2, previous: env.manifest_hash!, listing: { ...m.listing, tagline: 'Updated' } };
		const env2 = await signManifest(v2, (hex) => owner.signMessage({ message: { raw: hex } }));
		const res = await unwrap(client.POST('/v1/developers/projects/{project_id}/versions', { params: { path: { project_id: pid } }, body: env2 as never }));
		expect(res.version.tiers_changed).toEqual(['listing']);
		expect(res.publish_tx).toBeNull();
	});

	it('Hub rejects a manifest signed by someone else', async () => {
		const { client, setToken } = setup();
		const { session } = await siwe(client);
		setToken(session.token);
		await unwrap(client.POST('/v1/developers/me/enrollment', { body: { developer_type: 'individual', display_name: 'Owner', agreements_accepted: true } }));
		const m = structuredClone(ref.manifest[0].manifest) as unknown as Manifest;
		m.developer = ownerAddr;
		m.consensus.economics.vault = vaultAddress('0x000000000000000000000000000000000000fac7', '0x0000000000000000000000000000000000001111', digestManifest(m).project_id);
		const dev = privateKeyToAccount(('0x' + '00'.repeat(31) + '01') as `0x${string}`);
		const env = await signManifest(m, (hex) => dev.signMessage({ message: { raw: hex } }));
		await expect(unwrap(client.POST('/v1/developers/projects', { body: env as never }))).rejects.toMatchObject({ status: 422, code: 'bad_signature' });
	});
});
