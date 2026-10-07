/**
 * Client for the local necter-miner HTTP API (spec/miner-core.md §7), used in local mode (the store served by
 * the miner at 127.0.0.1:7878 and inside the Tauri desktop window).
 *
 * Auth (§7.2): the Tauri backend injects a bearer itself; a browser on the same machine opens
 * `http://127.0.0.1:7878/#login=<token>` and the UI exchanges the token for a session cookie with
 * `POST /api/v1/session`. Remote dashboards log in with a password and must send `X-CSRF-Token`.
 */
import { writable, get, type Readable } from 'svelte/store';
import { MINER_API_URL } from '$lib/config';
import type { HardwareProfile, BenchmarkResult } from '$lib/api/types';

export class MinerApiError extends Error {
	readonly status: number;
	readonly code: string;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = 'MinerApiError';
		this.status = status;
		this.code = code;
	}
}

export interface MinerSessionInfo {
	authenticated: boolean;
	remote: boolean;
	csrf_token: string | null;
	expires_at: number | null;
	reauth_until: number | null;
}

export interface MinerStatus {
	state: 'running' | 'draining' | 'paused' | 'unbound' | 'stopped';
	reason?: string | null;
	node_id: string;
	owner: string | null;
	relay?: { connected: boolean; session_id?: string | null; since?: number | null; latency_ms?: number | null };
	slots?: number;
	active_leases?: number;
	device?: Record<string, unknown>;
	engine?: string;
	versions?: { miner?: string; ndsr?: string; latest?: string | null };
	subscriptions?: { subscription_id: string; project_id: string; status: string }[];
	today?: { leases: number; units: number };
	data_mb_today?: number;
}

export interface MinerWallet {
	mode: 'embedded' | 'external';
	address: string | null;
	locked: boolean;
}

export interface MinerHardware {
	class?: string;
	platform?: string;
	engine?: string;
	hardware: HardwareProfile;
	benchmark?: BenchmarkResult | null;
}

export interface MinerSignRequest {
	request_id: string;
	kind: 'binding' | 'bond' | 'unbond' | 'withdraw' | 'set_payout' | 'claim' | 'siwe';
	format: 'eip191' | 'eip712';
	payload: unknown;
	expires_at: number;
}

export interface MinerAsyncRequest {
	state: 'pending' | 'done' | 'failed';
	result?: unknown;
	error?: string | null;
}

export type MinerConnection =
	| { state: 'unknown' }
	| { state: 'absent' } // nothing answering on the local API
	| { state: 'locked' } // miner answers but this UI is not authenticated
	| { state: 'ready'; session: MinerSessionInfo };

const _conn = writable<MinerConnection>({ state: 'unknown' });
export const minerConnection: Readable<MinerConnection> = { subscribe: _conn.subscribe };

let csrfToken: string | null = null;

function url(path: string) {
	return `${MINER_API_URL}/api/v1${path}`;
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 8000): Promise<T> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	let res: Response;
	try {
		res = await fetch(url(path), {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: 'include',
			signal: ctrl.signal
		});
	} catch (e) {
		throw new MinerApiError(0, 'unavailable', e instanceof Error ? e.message : 'miner not reachable');
	} finally {
		clearTimeout(t);
	}
	if (res.status === 204) return undefined as T;
	let data: unknown = null;
	try {
		data = await res.json();
	} catch {
		data = null;
	}
	if (!res.ok) {
		const d = (data ?? {}) as { error?: string; message?: string };
		throw new MinerApiError(res.status, d.error ?? `http_${res.status}`, d.message ?? res.statusText);
	}
	return data as T;
}

/**
 * Establishes the local session: consumes `#login=<token>` from the URL fragment (removing it from history),
 * then reads `GET /session`. Safe to call repeatedly.
 */
export async function connectMiner(): Promise<MinerConnection> {
	if (typeof window !== 'undefined') {
		const m = /(?:^#|&)login=([A-Za-z0-9_-]{16,128})/.exec(window.location.hash);
		if (m) {
			const token = m[1];
			history.replaceState(history.state, '', window.location.pathname + window.location.search);
			try {
				await request<void>('POST', '/session', { token });
			} catch {
				/* fall through to GET /session */
			}
		}
	}
	try {
		const s = await request<MinerSessionInfo>('GET', '/session');
		csrfToken = s.csrf_token ?? null;
		const conn: MinerConnection = s.authenticated ? { state: 'ready', session: s } : { state: 'locked' };
		_conn.set(conn);
		return conn;
	} catch (e) {
		const conn: MinerConnection =
			e instanceof MinerApiError && (e.status === 401 || e.status === 403) ? { state: 'locked' } : { state: 'absent' };
		_conn.set(conn);
		return conn;
	}
}

/** Password login for remote dashboards (§7.5). */
export async function loginMinerPassword(password: string): Promise<MinerConnection> {
	await request<void>('POST', '/session', { password });
	return connectMiner();
}

export async function logoutMiner() {
	try {
		await request<void>('DELETE', '/session');
	} finally {
		csrfToken = null;
		_conn.set({ state: 'locked' });
	}
}

export const minerApi = {
	status: () => request<MinerStatus>('GET', '/status'),
	identity: () => request<{ node_id: string; public_key: string; owner?: string | null; payout_address?: string | null }>('GET', '/identity'),
	hardware: () => request<MinerHardware>('GET', '/hardware'),
	runBenchmark: () => request<{ request_id: string }>('POST', '/benchmark'),
	wallet: () => request<MinerWallet>('GET', '/wallet'),
	start: () => request<void>('POST', '/start'),
	stop: (grace_ms?: number) => request<void>('POST', '/stop', grace_ms ? { grace_ms } : {}),
	bind: (owner: string) => request<{ request_id: string }>('POST', '/binding', { owner }),
	subscriptions: () => request<{ items?: unknown[] } | unknown[]>('GET', '/subscriptions'),
	subscribe: (project_id: string, collateral: string) =>
		request<{ request_id: string }>('POST', '/subscriptions', { project_id, collateral }),
	subscriptionAction: (id: string, action: 'pause' | 'resume' | 'unbond' | 'withdraw') =>
		request<{ request_id: string }>('POST', `/subscriptions/${encodeURIComponent(id)}/${action}`),
	claims: () => request<{ request_id: string }>('POST', '/claims'),
	signRequests: () => request<{ items?: MinerSignRequest[] } | MinerSignRequest[]>('GET', '/sign-requests'),
	answerSignRequest: (id: string, body: { signature: string } | { reject: true }) =>
		request<void>('POST', `/sign-requests/${encodeURIComponent(id)}`, body),
	request: (id: string) => request<MinerAsyncRequest>('GET', `/requests/${encodeURIComponent(id)}`)
};

/** Polls an async miner request until done/failed (or timeout). */
export async function waitMinerRequest(id: string, timeoutMs = 120_000, intervalMs = 1500): Promise<MinerAsyncRequest> {
	const until = Date.now() + timeoutMs;
	for (;;) {
		const r = await minerApi.request(id);
		if (r.state !== 'pending') return r;
		if (Date.now() > until) return { state: 'failed', error: 'timed out waiting for the miner' };
		await new Promise((res) => setTimeout(res, intervalMs));
	}
}

export function minerConnected(): boolean {
	return get(_conn).state === 'ready';
}

/** Probe used in web mode: is a miner running on this machine? (Hardware checker hint only.) */
export async function probeLocalMiner(): Promise<boolean> {
	try {
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), 1200);
		// Cross-origin from the hosted store: an opaque (no-cors) response proves something answers locally.
		await fetch(url('/session'), { mode: 'no-cors', signal: ctrl.signal });
		clearTimeout(t);
		return true;
	} catch {
		return false;
	}
}
