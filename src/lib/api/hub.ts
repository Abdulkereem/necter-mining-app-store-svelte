/**
 * Thin typed wrappers over the Hub endpoints the store uses (one function per operation, PLATFORM.md §j.2).
 * Every function returns the response body or throws `ApiError`.
 */
import { api, unwrap, unwrapOrNull } from './http';
import type { paths } from './schema';
import type {
	Amount,
	Category,
	DeviceClass,
	DeveloperProfileInput,
	DraftInput,
	Manifest,
	Period,
	Preferences,
	ProofStatus,
	SignedGasless,
	SignedManifest,
	SlashStatus,
	SubscriptionStatus,
	ApiScope,
	HardwareProfile,
	Engine
} from './types';

type Q<P extends keyof paths, M extends 'get'> = paths[P][M] extends { parameters: { query?: infer T } } ? NonNullable<T> : never;

export type ProjectQuery = Q<'/v1/projects', 'get'>;
export type RoundQuery = Q<'/v1/explorer/rounds', 'get'>;
export type EpochQuery = Q<'/v1/explorer/epochs', 'get'>;

const path = <T extends Record<string, string | number>>(p: T) => ({ params: { path: p } });

export const hub = {
	// ── network ──
	descriptor: () => unwrap(api.GET('/')),
	status: () => unwrap(api.GET('/v1/status')),
	params: () => unwrap(api.GET('/v1/network/params')),
	treasury: () => unwrap(api.GET('/v1/network/treasury')),
	validators: () => unwrap(api.GET('/v1/validators')),
	categories: () => unwrap(api.GET('/v1/categories')),
	collections: () => unwrap(api.GET('/v1/collections')),
	collection: (id: string) => unwrapOrNull(api.GET('/v1/collections/{collection_id}', path({ collection_id: id }))),
	networkEvents: (query: Q<'/v1/events', 'get'> = {}) => unwrap(api.GET('/v1/events', { params: { query } })),

	// ── explorer ──
	explorerStats: () => unwrap(api.GET('/v1/explorer/stats')),
	rounds: (query: RoundQuery = {}) => unwrap(api.GET('/v1/explorer/rounds', { params: { query } })),
	round: (round_id: string) => unwrapOrNull(api.GET('/v1/explorer/rounds/{round_id}', path({ round_id }))),
	receipt: (receipt_hash: string) => unwrapOrNull(api.GET('/v1/explorer/receipts/{receipt_hash}', path({ receipt_hash }))),
	epochs: (query: EpochQuery = {}) => unwrap(api.GET('/v1/explorer/epochs', { params: { query } })),
	epoch: (project_id: string, epoch: number) => unwrapOrNull(api.GET('/v1/explorer/epochs/{project_id}/{epoch}', path({ project_id, epoch }))),
	explorerSlashes: (query: { project_id?: string; status?: SlashStatus; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/explorer/slashes', { params: { query } })),
	explorerSearch: (q: string) => unwrap(api.GET('/v1/explorer/search', { params: { query: { q } } })),
	modules: (query: { developer?: string; limit?: number; cursor?: string } = {}) => unwrap(api.GET('/v1/modules', { params: { query } })),
	module: (address: string) => unwrapOrNull(api.GET('/v1/modules/{address}', path({ address }))),

	// ── projects ──
	projects: (query: ProjectQuery = {}) => unwrap(api.GET('/v1/projects', { params: { query } })),
	project: (project_id: string) => unwrapOrNull(api.GET('/v1/projects/{project_id}', path({ project_id }))),
	manifest: (project_id: string) => unwrapOrNull(api.GET('/v1/projects/{project_id}/manifest', path({ project_id }))),
	versions: (project_id: string) => unwrap(api.GET('/v1/projects/{project_id}/versions', path({ project_id }))),
	economics: (project_id: string) => unwrapOrNull(api.GET('/v1/projects/{project_id}/economics', path({ project_id }))),
	stats: (project_id: string, period: Period = '7d') =>
		unwrap(api.GET('/v1/projects/{project_id}/stats', { params: { path: { project_id }, query: { period } } })),
	projectMiners: (project_id: string, query: { period?: Period; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/projects/{project_id}/miners', { params: { path: { project_id }, query } })),
	projectEpochs: (project_id: string, query: { limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/projects/{project_id}/epochs', { params: { path: { project_id }, query } })),
	projectRounds: (project_id: string, query: { limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/projects/{project_id}/rounds', { params: { path: { project_id }, query } })),
	compatibility: (
		project_id: string,
		body: { node_id?: string; class?: DeviceClass; engine?: Engine; hardware?: HardwareProfile; benchmark_score?: number }
	) => unwrap(api.POST('/v1/projects/{project_id}/compatibility', { params: { path: { project_id } }, body })),
	reviews: (project_id: string, query: { sort?: 'newest' | 'helpful' | 'rating_high' | 'rating_low'; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/projects/{project_id}/reviews', { params: { path: { project_id }, query } })),
	upsertReview: (project_id: string, rating: number, comment: string) =>
		unwrap(api.PUT('/v1/projects/{project_id}/reviews', { params: { path: { project_id } }, body: { rating, comment } })),
	deleteReview: (project_id: string) => unwrap(api.DELETE('/v1/projects/{project_id}/reviews', path({ project_id }))),
	markHelpful: (project_id: string, review_id: string) =>
		unwrap(api.POST('/v1/projects/{project_id}/reviews/{review_id}/helpful', path({ project_id, review_id }))),
	announcements: (project_id: string) => unwrap(api.GET('/v1/projects/{project_id}/announcements', path({ project_id }))),
	report: (
		project_id: string,
		body: { category: 'scam' | 'malware' | 'economics' | 'impersonation' | 'spam' | 'other'; severity: 'low' | 'medium' | 'high'; reason: string }
	) => unwrap(api.POST('/v1/projects/{project_id}/reports', { params: { path: { project_id } }, body })),

	// ── accounts ──
	me: () => unwrap(api.GET('/v1/me')),
	preferences: () => unwrap(api.GET('/v1/me/preferences')),
	putPreferences: (body: Preferences) => unwrap(api.PUT('/v1/me/preferences', { body })),
	myEvents: (query: { project_id?: string; after?: string; limit?: number } = {}) => unwrap(api.GET('/v1/me/events', { params: { query } })),
	notifications: (query: { unread?: boolean; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/me/notifications', { params: { query } })),
	markRead: (body: { ids?: string[]; all?: boolean }) => unwrap(api.POST('/v1/me/notifications/read', { body })),
	alerts: () => unwrap(api.GET('/v1/me/alerts')),
	account: (address: string) => unwrapOrNull(api.GET('/v1/accounts/{address}', path({ address }))),
	balances: (address: string) => unwrap(api.GET('/v1/accounts/{address}/balances', path({ address }))),
	leaderboard: (query: { metric: 'units' | 'earnings' | 'uptime' | 'reputation' | 'devices'; project_id?: string; period?: Period; limit?: number }) =>
		unwrap(api.GET('/v1/leaderboards', { params: { query } })),

	// ── devices ──
	myDevices: (query: { group_id?: string; status?: 'online' | 'idle' | 'offline' | 'faulty' | 'banned'; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/me/devices', { params: { query } })),
	device: (node_id: string) => unwrapOrNull(api.GET('/v1/devices/{node_id}', path({ node_id }))),
	updateDevice: (node_id: string, body: { label?: string; group_id?: string | null }) =>
		unwrap(api.PATCH('/v1/devices/{node_id}', { params: { path: { node_id } }, body })),
	deviceGroups: () => unwrap(api.GET('/v1/me/device-groups')),
	createDeviceGroup: (name: string, node_ids: string[]) => unwrap(api.POST('/v1/me/device-groups', { body: { name, node_ids } })),
	updateDeviceGroup: (group_id: string, name: string, node_ids: string[]) =>
		unwrap(api.PUT('/v1/me/device-groups/{group_id}', { params: { path: { group_id } }, body: { name, node_ids } })),
	deleteDeviceGroup: (group_id: string) => unwrap(api.DELETE('/v1/me/device-groups/{group_id}', path({ group_id }))),
	bindingMessage: (owner: string, public_key: string, unbind = false) =>
		unwrap(api.POST('/v1/devices/binding-message', { body: { owner, public_key, unbind } })),

	// ── subscriptions ──
	createSubscription: (project_id: string, node_id: string, collateral: Amount) =>
		unwrap(api.POST('/v1/subscriptions', { body: { project_id, node_id, collateral } })),
	createSubscriptionsBatch: (items: { project_id: string; node_id: string; collateral: Amount }[]) =>
		unwrap(api.POST('/v1/subscriptions/batch', { body: { items } })),
	mySubscriptions: (query: { project_id?: string; node_id?: string; status?: SubscriptionStatus; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/me/subscriptions', { params: { query } })),
	collateral: () => unwrap(api.GET('/v1/me/collateral')),
	subscription: (subscription_id: string) => unwrapOrNull(api.GET('/v1/subscriptions/{subscription_id}', path({ subscription_id }))),
	bond: (subscription_id: string, body: SignedGasless) =>
		unwrap(api.POST('/v1/subscriptions/{subscription_id}/bond', { params: { path: { subscription_id } }, body })),
	bondPayload: (subscription_id: string, amount: Amount) =>
		unwrap(api.POST('/v1/subscriptions/{subscription_id}/bond-payload', { params: { path: { subscription_id } }, body: { amount } })),
	pause: (subscription_id: string) => unwrap(api.POST('/v1/subscriptions/{subscription_id}/pause', path({ subscription_id }))),
	resume: (subscription_id: string) => unwrap(api.POST('/v1/subscriptions/{subscription_id}/resume', path({ subscription_id }))),
	/** Without body → payload to sign (200); with signed body → relayed (202). */
	unbond: (subscription_id: string, body?: SignedGasless) =>
		unwrap(api.POST('/v1/subscriptions/{subscription_id}/unbond', { params: { path: { subscription_id } }, ...(body ? { body } : {}) })),
	withdrawCollateral: (subscription_id: string, body?: SignedGasless) =>
		unwrap(api.POST('/v1/subscriptions/{subscription_id}/withdraw', { params: { path: { subscription_id } }, ...(body ? { body } : {}) })),

	// ── earnings / proofs ──
	leases: (query: { state?: 'offered' | 'leased' | 'voted' | 'finalized' | 'missed' | 'cancelled'; node_id?: string; project_id?: string; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/me/leases', { params: { query } })),
	proofs: (query: { status?: ProofStatus; project_id?: string; node_id?: string; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/me/proofs', { params: { query } })),
	proofStats: (query: { period?: Period; project_id?: string } = {}) => unwrap(api.GET('/v1/me/proofs/stats', { params: { query } })),
	proof: (proof_id: string) => unwrapOrNull(api.GET('/v1/proofs/{proof_id}', path({ proof_id }))),
	earnings: (query: { period?: Period; group_by?: 'project' | 'device' | 'day' } = {}) => unwrap(api.GET('/v1/me/earnings', { params: { query } })),
	epochPayouts: (query: { project_id?: string; claimed?: boolean; limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/me/earnings/epochs', { params: { query } })),
	claims: (query: { address?: string; project_id?: string } = {}) => unwrap(api.GET('/v1/me/claims', { params: { query } })),
	withdrawals: (query: { limit?: number; cursor?: string } = {}) => unwrap(api.GET('/v1/me/withdrawals', { params: { query } })),
	claimRewards: (project_ids?: string[]) => unwrap(api.POST('/v1/me/withdrawals/claims', { body: project_ids ? { project_ids } : {} })),
	mySlashes: (query: { status?: SlashStatus; limit?: number; cursor?: string } = {}) => unwrap(api.GET('/v1/me/slashes', { params: { query } })),
	slash: (evidence_hash: string) => unwrapOrNull(api.GET('/v1/slashes/{evidence_hash}', path({ evidence_hash }))),
	disputeSlash: (evidence_hash: string, reason: string, links: string[] = []) =>
		unwrap(api.POST('/v1/slashes/{evidence_hash}/disputes', { params: { path: { evidence_hash } }, body: { reason, links } })),

	// ── faucet ──
	faucet: () => unwrap(api.GET('/v1/faucet')),
	drip: () => unwrap(api.POST('/v1/faucet/drip')),

	// ── developers ──
	developer: (address: string) => unwrapOrNull(api.GET('/v1/developers/{address}', path({ address }))),
	myDeveloper: () => unwrapOrNull(api.GET('/v1/developers/me')),
	putMyDeveloper: (body: DeveloperProfileInput) => unwrap(api.PUT('/v1/developers/me', { body })),
	enroll: (body: {
		draft?: boolean;
		developer_type: 'individual' | 'organization';
		display_name: string;
		email?: string;
		website?: string;
		reason?: string;
		agreements_accepted: true;
	}) => unwrap(api.POST('/v1/developers/me/enrollment', { body })),
	requestVerification: (notes?: string) => unwrap(api.POST('/v1/developers/me/verification', { body: notes ? { notes } : {} })),
	drafts: () => unwrap(api.GET('/v1/developers/me/drafts')),
	draft: (draft_id: string) => unwrapOrNull(api.GET('/v1/developers/me/drafts/{draft_id}', path({ draft_id }))),
	createDraft: (body: DraftInput) => unwrap(api.POST('/v1/developers/me/drafts', { body })),
	saveDraft: (draft_id: string, body: DraftInput) => unwrap(api.PUT('/v1/developers/me/drafts/{draft_id}', { params: { path: { draft_id } }, body })),
	deleteDraft: (draft_id: string) => unwrap(api.DELETE('/v1/developers/me/drafts/{draft_id}', path({ draft_id }))),
	uploadAsset: (content_type: 'image/png' | 'image/jpeg' | 'image/webp', data_b64: string) =>
		unwrap(api.POST('/v1/developers/assets', { body: { content_type, data_b64 } })),
	myProjects: () => unwrap(api.GET('/v1/developers/me/projects')),
	prepareManifest: (manifest: Manifest) => unwrap(api.POST('/v1/developers/projects/prepare', { body: { manifest } as never })),
	publishProject: (env: SignedManifest) => unwrap(api.POST('/v1/developers/projects', { body: env as never })),
	publishVersion: (project_id: string, env: SignedManifest) =>
		unwrap(api.POST('/v1/developers/projects/{project_id}/versions', { params: { path: { project_id } }, body: env as never })),
	analytics: (project_id: string, period: Period = '7d') =>
		unwrap(api.GET('/v1/developers/projects/{project_id}/analytics', { params: { path: { project_id }, query: { period } } })),
	health: (project_id: string) => unwrap(api.GET('/v1/developers/projects/{project_id}/health', path({ project_id }))),
	revenue: (project_id: string, period: Period = '30d') =>
		unwrap(api.GET('/v1/developers/projects/{project_id}/revenue', { params: { path: { project_id }, query: { period } } })),
	proofMonitoring: (project_id: string, query: { limit?: number; cursor?: string } = {}) =>
		unwrap(api.GET('/v1/developers/projects/{project_id}/proofs', { params: { path: { project_id }, query } })),
	createAnnouncement: (project_id: string, body: { title: string; content: string; type: 'update' | 'maintenance' | 'feature' | 'alert' }) =>
		unwrap(api.POST('/v1/developers/projects/{project_id}/announcements', { params: { path: { project_id } }, body })),
	deleteAnnouncement: (project_id: string, announcement_id: string) =>
		unwrap(api.DELETE('/v1/developers/projects/{project_id}/announcements/{announcement_id}', path({ project_id, announcement_id }))),
	simulations: (project_id: string) => unwrap(api.GET('/v1/developers/projects/{project_id}/simulations', path({ project_id }))),
	runSimulation: (project_id: string, tasks: { function: string; input: unknown; gas_limit?: number }[]) =>
		unwrap(api.POST('/v1/developers/projects/{project_id}/simulations', { params: { path: { project_id } }, body: { tasks } })),
	simulation: (project_id: string, simulation_id: string) =>
		unwrapOrNull(api.GET('/v1/developers/projects/{project_id}/simulations/{simulation_id}', path({ project_id, simulation_id }))),
	apiKeys: () => unwrap(api.GET('/v1/developers/api-keys')),
	createApiKey: (body: { name: string; scopes: ApiScope[]; project_ids?: string[]; expires_at?: number | null }) =>
		unwrap(api.POST('/v1/developers/api-keys', { body })),
	revokeApiKey: (key_id: string) => unwrap(api.DELETE('/v1/developers/api-keys/{key_id}', path({ key_id })))
};

export type { Category };
