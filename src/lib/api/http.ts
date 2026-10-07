/**
 * Typed Hub API client: `openapi-fetch` over the types generated from spec/openapi.yaml, plus
 *   - bearer auth from the SIWE session (`./session`),
 *   - a stable `ApiError` for every non-2xx / network failure (openapi `Error` body),
 *   - session drop on 401.
 *
 * Usage:
 *   const project = await unwrap(api.GET('/v1/projects/{project_id}', { params: { path: { project_id } } }));
 */
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { RPC_URL, MOCK_API } from '$lib/config';
import { currentToken, setSession } from './session';

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly requestId: string | null;
	readonly details: Record<string, unknown> | null;
	readonly retryAfter: number | null;

	constructor(init: {
		status: number;
		code: string;
		message: string;
		requestId?: string | null;
		details?: Record<string, unknown> | null;
		retryAfter?: number | null;
	}) {
		super(init.message);
		this.name = 'ApiError';
		this.status = init.status;
		this.code = init.code;
		this.requestId = init.requestId ?? null;
		this.details = init.details ?? null;
		this.retryAfter = init.retryAfter ?? null;
	}

	get isNotFound() {
		return this.status === 404;
	}
	get isUnauthorized() {
		return this.status === 401;
	}
	get isNetwork() {
		return this.status === 0;
	}
}

/** Human message for an error code (falls back to the Hub's message). */
export function errorMessage(err: unknown): string {
	if (err instanceof ApiError) {
		switch (err.code) {
			case 'network_error':
				return 'Cannot reach the Necter network right now. Check your connection and try again.';
			case 'session_expired':
			case 'unauthorized':
				return 'Your session has ended. Sign in with your wallet again.';
			case 'rate_limited':
				return err.retryAfter ? `Too many requests. Try again in ${err.retryAfter}s.` : 'Too many requests. Try again shortly.';
			case 'not_enrolled':
				return 'Complete developer enrollment first.';
			case 'not_verified':
				return 'Your developer account is not verified yet.';
			default:
				return err.message || err.code;
		}
	}
	if (err instanceof Error) return err.message;
	return String(err);
}

/** Converts a non-OK Response to an ApiError (expects the openapi `Error` JSON body). */
export async function toApiError(response: Response, parsed?: unknown): Promise<ApiError> {
	let body: unknown = parsed;
	if (body === undefined) {
		try {
			body = await response.clone().json();
		} catch {
			body = null;
		}
	}
	const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
	const retry = response.headers.get('Retry-After');
	return new ApiError({
		status: response.status,
		code: typeof b.error === 'string' ? b.error : `http_${response.status}`,
		message: typeof b.message === 'string' ? b.message : response.statusText || `HTTP ${response.status}`,
		requestId: typeof b.request_id === 'string' ? b.request_id : null,
		details: b.details && typeof b.details === 'object' ? (b.details as Record<string, unknown>) : null,
		retryAfter: retry && /^\d+$/.test(retry) ? Number(retry) : null
	});
}

export interface ApiClientOptions {
	baseUrl?: string;
	fetch?: (input: Request) => Promise<Response>;
	getToken?: () => string | null;
	onUnauthorized?: () => void;
}

/** Creates a client. Exported for tests and for the local-mode `/rpc` proxy. */
export function createApiClient(opts: ApiClientOptions = {}) {
	const client = createClient<paths>({
		baseUrl: opts.baseUrl ?? RPC_URL,
		fetch: opts.fetch ?? ((req: Request) => globalThis.fetch(req))
	});
	const getToken = opts.getToken ?? currentToken;
	const auth: Middleware = {
		onRequest({ request }) {
			const token = getToken();
			if (token && !request.headers.has('Authorization')) request.headers.set('Authorization', `Bearer ${token}`);
			if (!request.headers.has('Accept')) request.headers.set('Accept', 'application/json');
			return request;
		},
		onResponse({ request, response }) {
			if (response.status === 401 && request.headers.has('Authorization')) opts.onUnauthorized?.();
			return response;
		}
	};
	client.use(auth);
	return client;
}

let mockFetch: ((req: Request) => Promise<Response>) | null = null;

async function devFetch(req: Request): Promise<Response> {
	// Dev-only mock Hub (PUBLIC_MOCK_API=1 with `vite dev`). `import.meta.env.DEV` is a compile-time constant,
	// so this branch and the mock module are removed from production builds.
	if (import.meta.env.DEV && MOCK_API) {
		if (!mockFetch) {
			const mod = await import('./mock/hub');
			const hub = mod.createMockHub({ persist: true, allowDomains: [location.host] });
			mockFetch = (r) => hub.handle(r);
		}
		return mockFetch(req);
	}
	return globalThis.fetch(req);
}

/** The app-wide Hub client. */
export const api = createApiClient({
	fetch: devFetch,
	onUnauthorized: () => setSession(null)
});

export type ApiClient = ReturnType<typeof createApiClient>;

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Awaits an openapi-fetch call and returns `data` or throws `ApiError`.
 * Network failures become `ApiError{status: 0, code: 'network_error'}`.
 */
export async function unwrap<T>(p: Promise<FetchResult<T>>): Promise<T> {
	let res: FetchResult<T>;
	try {
		res = await p;
	} catch (e) {
		throw new ApiError({ status: 0, code: 'network_error', message: e instanceof Error ? e.message : String(e) });
	}
	if (!res.response.ok) throw await toApiError(res.response, res.error);
	return res.data as T;
}

/** Like `unwrap` but resolves to `null` on 404. */
export async function unwrapOrNull<T>(p: Promise<FetchResult<T>>): Promise<T | null> {
	try {
		return await unwrap(p);
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) return null;
		throw e;
	}
}

/** Follows `next_cursor` up to `max` items. */
export async function collectPages<T>(
	fetchPage: (cursor: string | undefined) => Promise<{ items?: T[]; next_cursor?: string | null }>,
	max = 1000
): Promise<T[]> {
	const out: T[] = [];
	let cursor: string | undefined;
	for (let i = 0; i < 50 && out.length < max; i++) {
		const page = await fetchPage(cursor);
		out.push(...(page.items ?? []));
		if (!page.next_cursor) break;
		cursor = page.next_cursor;
	}
	return out.slice(0, max);
}
