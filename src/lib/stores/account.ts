/**
 * Signed-in account state: `/v1/me` and `/v1/me/preferences` (watchlist, recent searches, saved addresses,
 * earnings goal, notification toggles). Reloaded whenever the session changes.
 */
import { get, writable, type Readable } from 'svelte/store';
import { api, unwrap } from '$lib/api/http';
import { session } from '$lib/api/session';
import type { Me, Preferences } from '$lib/api/types';

const _me = writable<Me | null>(null);
const _prefs = writable<Preferences | null>(null);
export const me: Readable<Me | null> = { subscribe: _me.subscribe };
export const preferences: Readable<Preferences | null> = { subscribe: _prefs.subscribe };

let started = false;
let loadedFor: string | null = null;

export async function refreshMe() {
	const s = get(session);
	if (!s) {
		_me.set(null);
		_prefs.set(null);
		loadedFor = null;
		return;
	}
	try {
		const [m, p] = await Promise.all([unwrap(api.GET('/v1/me')), unwrap(api.GET('/v1/me/preferences')).catch(() => null)]);
		if (get(session)?.address !== s.address) return;
		_me.set(m);
		_prefs.set(p ?? {});
		loadedFor = s.address;
	} catch {
		/* 401 clears the session via the client */
	}
}

/** Starts tracking the session (call once from the root layout). */
export function startAccountSync() {
	if (started) return;
	started = true;
	session.subscribe((s) => {
		if ((s?.address ?? null) !== loadedFor) void refreshMe();
	});
}

async function savePrefs(patch: Partial<Preferences>) {
	const cur = get(_prefs) ?? {};
	const next = { ...cur, ...patch };
	_prefs.set(next);
	try {
		_prefs.set(await unwrap(api.PUT('/v1/me/preferences', { body: next })));
	} catch (e) {
		_prefs.set(cur);
		throw e;
	}
}

export function isWatched(projectId: string): boolean {
	return (get(_prefs)?.watchlist ?? []).includes(projectId);
}

export async function toggleWatchlist(projectId: string) {
	const list = get(_prefs)?.watchlist ?? [];
	const next = list.includes(projectId) ? list.filter((x) => x !== projectId) : [projectId, ...list].slice(0, 200);
	await savePrefs({ watchlist: next });
}

export async function pushRecentSearch(q: string) {
	if (!get(session)) return;
	const t = q.trim().slice(0, 100);
	if (t.length < 2) return;
	const list = (get(_prefs)?.recent_searches ?? []).filter((x) => x !== t);
	await savePrefs({ recent_searches: [t, ...list].slice(0, 20) }).catch(() => undefined);
}

export async function clearRecentSearches() {
	await savePrefs({ recent_searches: [] });
}

export async function updatePreferences(patch: Partial<Preferences>) {
	await savePrefs(patch);
}
