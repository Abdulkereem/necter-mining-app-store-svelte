/**
 * Hub routes added by the PLATFORM.md errata that `spec/openapi.yaml` does not describe yet, typed by hand in the
 * openapi-typescript `paths` format so they go through the same client (auth, errors) as everything else.
 *
 *   E11  POST /v1/developers/projects/{project_id}/register — relays a signed EIP-712 `Register` (the
 *        `register_by_sig` payload of POST /v1/developers/projects) as ProjectRegistry.registerBySig, so the
 *        developer needs no ETH. Body `{typed_data, signature}` → 202 TxStatus. (Hub: hub_routes_dev.py.)
 *   E10  POST /v1/subscriptions/{subscription_id}/payout — two-step like unbond/withdraw: `{payout}` → 200 the
 *        EIP-712 `SetPayout` payload; `{typed_data, signature}` → 202 TxStatus (relayed Staking.setPayoutBySig).
 *
 * Drop this file once openapi.yaml carries both paths and `pnpm gen:api` has regenerated schema.d.ts.
 */
import type { components } from './schema';

type S = components['schemas'];

/** E10 payload: a GaslessPayload whose action is `set_payout` (primary type `SetPayout`, contracts.md §6). */
export type SetPayoutPayload = Omit<S['GaslessPayload'], 'action' | 'permit'> & { action: 'set_payout'; permit?: null };

type Json<T> = { content: { 'application/json': T } };
type Err = Json<S['Error']>;
type ErrorResponses = { 400: Err; 401: Err; 403: Err; 404: Err; 409: Err; 422: Err; 429: Err; 503: Err };

export interface ErrataPaths {
	'/v1/developers/projects/{project_id}/register': {
		parameters: { query?: never; header?: never; path: { project_id: S['Hash'] }; cookie?: never };
		get?: never;
		put?: never;
		post: {
			parameters: { query?: never; header?: never; path: { project_id: S['Hash'] }; cookie?: never };
			requestBody: Json<{ typed_data: S['Eip712TypedData']; signature: S['EvmSignature'] }>;
			responses: { 202: Json<S['TxStatus']> } & ErrorResponses;
		};
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	'/v1/subscriptions/{subscription_id}/payout': {
		parameters: { query?: never; header?: never; path: { subscription_id: S['Hash'] }; cookie?: never };
		get?: never;
		put?: never;
		post: {
			parameters: { query?: never; header?: never; path: { subscription_id: S['Hash'] }; cookie?: never };
			requestBody: Json<{ payout: S['Address'] } | { typed_data: S['Eip712TypedData']; signature: S['EvmSignature'] }>;
			responses: { 200: Json<SetPayoutPayload>; 202: Json<S['TxStatus']> } & ErrorResponses;
		};
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
}
