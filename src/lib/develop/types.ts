import type { hub } from '$lib/api/hub';
import type { Manifest } from '$lib/api/types';

/** Project as returned by `hub.project` (openapi-fetch drops `null`-only keys such as `modules.verifier`). */
export type HubProject = NonNullable<Awaited<ReturnType<typeof hub.project>>>;
export type HubSignedManifest = NonNullable<Awaited<ReturnType<typeof hub.manifest>>>;

/** A manifest from a Hub response, with the `null`-only keys the typings drop restored (§a.1: all keys present). */
export function toManifest(m: HubSignedManifest['manifest'] | Manifest): Manifest {
	const raw = m as unknown as Manifest;
	return {
		...raw,
		consensus: {
			...raw.consensus,
			modules: { worker: raw.consensus.modules.worker, verifier: null }
		},
		scheduling: {
			...raw.scheduling,
			requirements: { ...raw.scheduling.requirements, gpu: null }
		}
	};
}
