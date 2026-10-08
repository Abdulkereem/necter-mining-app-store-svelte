/**
 * Small shared cache of project name / icon / category / token by project_id, for lists whose rows only carry
 * `project_id` (proofs, payouts, claims, slashes, events). Loads lazily through `hub.project` (public).
 */
import { SvelteMap } from 'svelte/reactivity';
import { hub } from '$lib/api/hub';
import type { Token } from '$lib/api/types';

export interface ProjectRef {
	project_id: string;
	name: string;
	category: string | null;
	icon: string | null;
	token: Token | null;
}

const cache = new SvelteMap<string, ProjectRef | null>();
const inflight = new Set<string>();

function load(id: string) {
	if (inflight.has(id)) return;
	inflight.add(id);
	hub
		.project(id)
		.then((p) => {
			cache.set(
				id,
				p ? { project_id: p.project_id, name: p.name, category: p.category ?? null, icon: p.icon ?? null, token: p.token ?? null } : null
			);
		})
		.catch(() => {
			/* leave it unresolved; callers fall back to the short id */
		})
		.finally(() => inflight.delete(id));
}

/** Returns the cached project (undefined while loading, null when it does not exist). Triggers a load. */
export function projectRef(id: string | null | undefined): ProjectRef | null | undefined {
	if (!id) return null;
	if (!cache.has(id)) {
		// Schedule outside the current reactive read.
		queueMicrotask(() => {
			if (!cache.has(id)) load(id);
		});
		return undefined;
	}
	return cache.get(id);
}

/** Pre-seeds the cache with a name already known (e.g. Subscription.project_name). */
export function seedProject(ref: ProjectRef) {
	if (!cache.get(ref.project_id)) cache.set(ref.project_id, ref);
}

/** Name for display, falling back to a shortened id. */
export function projectName(id: string | null | undefined, fallback?: string | null): string {
	const p = projectRef(id);
	if (p?.name) return p.name;
	if (fallback) return fallback;
	if (!id) return '—';
	return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Shape accepted by ProjectIcon. */
export function iconProject(id: string, fallbackName?: string | null) {
	const p = projectRef(id);
	return { project_id: id, name: p?.name ?? fallbackName ?? id.slice(2, 4), category: p?.category ?? null, icon: p?.icon ?? null };
}
