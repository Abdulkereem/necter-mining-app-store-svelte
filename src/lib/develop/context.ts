/** Developer project context shared by /develop/apps/[id]/* pages (set by the route layout). */
import { getContext, setContext } from 'svelte';
import type { Project } from '$lib/api/types';

export interface DevProjectCtx {
	readonly project: Project;
	refresh(): Promise<void>;
}

const KEY = Symbol('dev-project');

export function setDevProject(ctx: DevProjectCtx) {
	setContext(KEY, ctx);
}

export function devProject(): DevProjectCtx {
	return getContext<DevProjectCtx>(KEY);
}
