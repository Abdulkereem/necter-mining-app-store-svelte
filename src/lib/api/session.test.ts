import { describe, expect, it, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { readSession, writeSession, validateSession, SESSION_STORAGE_KEY, type KeyValueStorage } from './session';

class MemStorage implements KeyValueStorage {
	m = new Map<string, string>();
	getItem(k: string) {
		return this.m.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		this.m.set(k, v);
	}
	removeItem(k: string) {
		this.m.delete(k);
	}
}

const NOW = 1_791_000_000;
const good = { token: 'nsess_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG', address: '0x2B5AD5c4795c026514f8317c7a215e218DcCD6cF', expires_at: NOW + 3600, roles: ['miner', 7] };

describe('session key store', () => {
	it('validates, lowercases the address and filters roles', () => {
		expect(validateSession(good, NOW)).toEqual({ token: good.token, address: good.address.toLowerCase(), expires_at: NOW + 3600, roles: ['miner'] });
	});
	it('rejects expired (30 s margin), malformed tokens, addresses and timestamps', () => {
		expect(validateSession({ ...good, expires_at: NOW + 10 }, NOW)).toBeNull();
		expect(validateSession({ ...good, token: 'has spaces in it' }, NOW)).toBeNull();
		expect(validateSession({ ...good, address: '0x1234' }, NOW)).toBeNull();
		expect(validateSession({ ...good, expires_at: '123' }, NOW)).toBeNull();
		expect(validateSession(null, NOW)).toBeNull();
	});
	it('round-trips through storage and clears corrupt or expired entries', () => {
		const s = new MemStorage();
		const v = validateSession(good, NOW)!;
		writeSession(s, v);
		expect(readSession(s, NOW)).toEqual(v);
		expect(readSession(s, NOW + 7200)).toBeNull();
		expect(s.getItem(SESSION_STORAGE_KEY)).toBeNull();
		s.setItem(SESSION_STORAGE_KEY, '{not json');
		expect(readSession(s, NOW)).toBeNull();
		expect(s.getItem(SESSION_STORAGE_KEY)).toBeNull();
		writeSession(s, null);
		expect(s.getItem(SESSION_STORAGE_KEY)).toBeNull();
	});
	it('survives storage that throws (private mode)', () => {
		const throwing: KeyValueStorage = {
			getItem() {
				throw new Error('denied');
			},
			setItem() {
				throw new Error('denied');
			},
			removeItem() {
				throw new Error('denied');
			}
		};
		expect(readSession(throwing, NOW)).toBeNull();
		expect(() => writeSession(throwing, validateSession(good, NOW))).not.toThrow();
	});
});

describe('session store (svelte)', () => {
	beforeEach(() => {
		vi.resetModules();
		const mem = new MemStorage();
		vi.stubGlobal('window', { localStorage: mem });
	});
	it('setSession persists, currentToken returns it, expiry clears it', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW * 1000);
		const mod = await import('./session');
		mod.setSession({ ...validateSession(good, NOW)!, expires_at: NOW + 120 });
		expect(mod.currentToken()).toBe(good.token);
		expect((window as unknown as { localStorage: MemStorage }).localStorage.getItem(SESSION_STORAGE_KEY)).toContain(good.token);
		vi.advanceTimersByTime(91_000);
		expect(get(mod.session)).toBeNull();
		expect(mod.currentToken()).toBeNull();
		vi.useRealTimers();
	});
	it('hydrateSession restores a stored session', async () => {
		const mod = await import('./session');
		const v = validateSession({ ...good, expires_at: Math.floor(Date.now() / 1000) + 3600 })!;
		writeSession((window as unknown as { localStorage: MemStorage }).localStorage, v);
		mod.hydrateSession();
		expect(get(mod.session)).toEqual(v);
	});
});
