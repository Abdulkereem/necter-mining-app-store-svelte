/**
 * Tiny reactive loader for pages (Svelte 5 runes).
 *
 *   const project = useQuery(() => getProject(page.params.id));
 *   {#if project.loading} … {:else if project.error} … {:else} {project.data.name} {/if}
 *
 * Reactive values read synchronously inside `fn` (before its first `await`) are tracked: the query re-runs when
 * they change. Stale responses from an earlier run are dropped. `enabled` gates the run (e.g. signed-in only).
 */
import { ApiError } from './http';

export interface Query<T> {
	readonly data: T | undefined;
	readonly error: ApiError | Error | null;
	readonly loading: boolean;
	/** True after the first run settles (success or error). */
	readonly settled: boolean;
	refresh(): Promise<void>;
	/** Optimistically replace data (e.g. after a mutation). */
	set(value: T): void;
}

export function useQuery<T>(
	fn: () => Promise<T>,
	opts: { enabled?: () => boolean; pollMs?: number; keepPrevious?: boolean } = {}
): Query<T> {
	let data = $state<T | undefined>(undefined);
	let error = $state<ApiError | Error | null>(null);
	let loading = $state(true);
	let settled = $state(false);
	let runId = 0;
	let currentFn: (() => Promise<T>) | null = null;

	async function execute(promise: Promise<T>, id: number) {
		try {
			const value = await promise;
			if (id !== runId) return;
			data = value;
			error = null;
		} catch (e) {
			if (id !== runId) return;
			error = e instanceof Error ? e : new Error(String(e));
			if (!opts.keepPrevious) data = undefined;
		} finally {
			if (id === runId) {
				loading = false;
				settled = true;
			}
		}
	}

	$effect(() => {
		const enabled = opts.enabled ? opts.enabled() : true;
		if (!enabled) {
			runId++;
			data = undefined;
			error = null;
			loading = false;
			settled = false;
			return;
		}
		const id = ++runId;
		loading = true;
		currentFn = fn;
		// fn() runs synchronously here, so its reactive reads are tracked by this effect.
		let promise: Promise<T>;
		try {
			promise = fn();
		} catch (e) {
			promise = Promise.reject(e);
		}
		void execute(promise, id);
	});

	$effect(() => {
		if (!opts.pollMs) return;
		const t = setInterval(() => {
			if (currentFn && !loading && (!opts.enabled || opts.enabled())) void refresh(true);
		}, opts.pollMs);
		return () => clearInterval(t);
	});

	async function refresh(silent = false) {
		if (!currentFn) return;
		const id = ++runId;
		if (!silent) loading = true;
		let promise: Promise<T>;
		try {
			promise = currentFn();
		} catch (e) {
			promise = Promise.reject(e);
		}
		await execute(promise, id);
	}

	return {
		get data() {
			return data;
		},
		get error() {
			return error;
		},
		get loading() {
			return loading;
		},
		get settled() {
			return settled;
		},
		refresh: () => refresh(false),
		set(value: T) {
			data = value;
		}
	};
}
