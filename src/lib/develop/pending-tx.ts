/**
 * Chain transactions the developer chose to send later.
 *
 * `POST /v1/developers/projects` returns the `ProjectRegistry.register` transaction once, and
 * `POST /v1/developers/projects/{id}/versions` returns the `publishVersion` transaction once; the Hub has no
 * endpoint to fetch them again. When the developer skips sending, the portal keeps the tx request in a private
 * Hub draft (`/v1/developers/me/drafts`, linked through `project_id`) so it can be sent from the dashboard later.
 * A tx request is public calldata, not a secret.
 */
import { hub } from '$lib/api/hub';
import type { Draft, TxRequest } from '$lib/api/types';

export type PendingTxKind = 'register' | 'publish_version';

export interface PendingTx {
	draft_id: string;
	project_id: string;
	kind: PendingTxKind;
	version: number;
	tx: TxRequest;
	saved_at: number;
}

function isTx(v: unknown): v is TxRequest {
	const t = v as TxRequest | null;
	return !!t && typeof t === 'object' && typeof t.to === 'string' && typeof t.data === 'string' && typeof t.chain_id === 'number';
}

/** Reads a pending-tx record out of a draft (null when the draft is a wizard draft). */
export function pendingTxOf(d: Draft): PendingTx | null {
	const data = d.data as Record<string, unknown>;
	if (data?.kind !== 'pending_tx' || !d.project_id || !isTx(data.tx)) return null;
	return {
		draft_id: d.draft_id,
		project_id: d.project_id,
		kind: data.tx_kind === 'publish_version' ? 'publish_version' : 'register',
		version: typeof data.version === 'number' ? data.version : 1,
		tx: data.tx,
		saved_at: d.updated_at
	};
}

export function isWizardDraft(d: Draft): boolean {
	return (d.data as Record<string, unknown>)?.kind !== 'pending_tx';
}

export async function savePendingTx(projectId: string, kind: PendingTxKind, version: number, tx: TxRequest) {
	return hub.createDraft({ current_step: 0, project_id: projectId, data: { kind: 'pending_tx', tx_kind: kind, version, tx } });
}

export async function pendingTxsFor(projectId: string): Promise<PendingTx[]> {
	const { items = [] } = await hub.drafts();
	return items.map(pendingTxOf).filter((p): p is PendingTx => !!p && p.project_id === projectId);
}
