/**
 * Hub session (SIWE bearer token, PLATFORM.md D33) — persisted per browser, never sent anywhere but the Hub.
 *
 * The token is opaque (`nsess_…`), 12 h lifetime. It is dropped when expired, on 401 from the Hub, on logout,
 * and when the connected wallet changes to another address.
 */
import { writable, get, type Readable } from 'svelte/store';

export interface StoredSession {
	token: string;
	address: string; // lowercase
	expires_at: number; // unix seconds
	roles: string[];
}

export const SESSION_STORAGE_KEY = 'necter_session_v1';

/** Minimal storage interface (window.localStorage or a test double). */
export interface KeyValueStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

const TOKEN_RE = /^[A-Za-z0-9_\-.]{8,512}$/;
const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

export function nowSecs(): number {
	return Math.floor(Date.now() / 1000);
}

/** Validates a parsed value; returns null when malformed or expired (with a 30 s safety margin). */
export function validateSession(value: unknown, now = nowSecs()): StoredSession | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as Record<string, unknown>;
	if (typeof v.token !== 'string' || !TOKEN_RE.test(v.token)) return null;
	if (typeof v.address !== 'string') return null;
	const address = v.address.toLowerCase();
	if (!ADDRESS_RE.test(address)) return null;
	if (typeof v.expires_at !== 'number' || !Number.isInteger(v.expires_at)) return null;
	if (v.expires_at <= now + 30) return null;
	const roles = Array.isArray(v.roles) ? v.roles.filter((r): r is string => typeof r === 'string') : [];
	return { token: v.token, address, expires_at: v.expires_at, roles };
}

export function readSession(storage: KeyValueStorage | null, now = nowSecs()): StoredSession | null {
	if (!storage) return null;
	let raw: string | null = null;
	try {
		raw = storage.getItem(SESSION_STORAGE_KEY);
	} catch {
		return null;
	}
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		safeRemove(storage);
		return null;
	}
	const s = validateSession(parsed, now);
	if (!s) safeRemove(storage);
	return s;
}

export function writeSession(storage: KeyValueStorage | null, s: StoredSession | null) {
	if (!storage) return;
	try {
		if (s) storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
		else storage.removeItem(SESSION_STORAGE_KEY);
	} catch {
		/* storage unavailable (private mode) — session stays in memory only */
	}
}

function safeRemove(storage: KeyValueStorage) {
	try {
		storage.removeItem(SESSION_STORAGE_KEY);
	} catch {
		/* ignore */
	}
}

function browserStorage(): KeyValueStorage | null {
	try {
		return typeof window !== 'undefined' ? window.localStorage : null;
	} catch {
		return null;
	}
}

const _session = writable<StoredSession | null>(null);
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

/** Current Hub session (null = signed out). */
export const session: Readable<StoredSession | null> = { subscribe: _session.subscribe };

function scheduleExpiry(s: StoredSession | null) {
	if (expiryTimer) clearTimeout(expiryTimer);
	expiryTimer = null;
	if (!s) return;
	const ms = Math.max(0, (s.expires_at - nowSecs() - 30) * 1000);
	// setTimeout max is ~24.8 days; sessions are 12 h.
	expiryTimer = setTimeout(() => setSession(null), Math.min(ms, 2 ** 31 - 1));
}

export function setSession(s: StoredSession | null) {
	const valid = s ? validateSession(s) : null;
	_session.set(valid);
	writeSession(browserStorage(), valid);
	scheduleExpiry(valid);
}

export function hydrateSession() {
	const s = readSession(browserStorage());
	_session.set(s);
	scheduleExpiry(s);
}

export function currentToken(): string | null {
	const s = get(_session);
	if (!s) return null;
	if (s.expires_at <= nowSecs() + 30) {
		setSession(null);
		return null;
	}
	return s.token;
}

export function currentSession(): StoredSession | null {
	return get(_session);
}
