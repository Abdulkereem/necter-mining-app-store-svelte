/**
 * Network descriptor (`GET /`) and parameters (`GET /v1/network/params`), loaded once and cached.
 */
import { writable, type Readable } from 'svelte/store';
import { api, unwrap } from '$lib/api/http';
import type { NetworkDescriptor, NetworkParams } from '$lib/api/types';
import { CHAIN_EXPLORER } from '$lib/config';

const _descriptor = writable<NetworkDescriptor | null>(null);
export const descriptor: Readable<NetworkDescriptor | null> = { subscribe: _descriptor.subscribe };

let descriptorP: Promise<NetworkDescriptor> | null = null;
let paramsP: Promise<NetworkParams> | null = null;

export function loadDescriptor(): Promise<NetworkDescriptor> {
	if (!descriptorP) {
		descriptorP = unwrap(api.GET('/')).then((d) => {
			_descriptor.set(d);
			return d;
		});
		descriptorP.catch(() => (descriptorP = null));
	}
	return descriptorP;
}

export function loadParams(): Promise<NetworkParams> {
	if (!paramsP) {
		paramsP = unwrap(api.GET('/v1/network/params'));
		paramsP.catch(() => (paramsP = null));
	}
	return paramsP;
}

/** Chain explorer base URL (descriptor value when known). */
export function explorerBase(d: NetworkDescriptor | null): string {
	return d?.chain?.explorer ?? CHAIN_EXPLORER;
}
