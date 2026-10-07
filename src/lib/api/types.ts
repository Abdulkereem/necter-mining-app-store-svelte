/**
 * Friendly aliases over the generated OpenAPI types (`schema.d.ts`, generated from spec/openapi.yaml by
 * `npm run gen:api`). The store uses the API's snake_case shapes directly; formatting lives in `$lib/format`.
 */
import type { components, paths } from './schema';

type S = components['schemas'];

export type { paths, components };

export type Address = S['Address'];
export type Hash = S['Hash'];
export type Amount = S['Amount'];
export type NodeId = S['NodeId'];
export type Category = S['Category'];
export type DeviceClass = S['DeviceClass'];
export type Platform = S['Platform'];
export type Engine = S['Engine'];
export type DeviceStatus = S['DeviceStatus'];
export type ListingStatus = S['ListingStatus'];
export type SubscriptionStatus = S['SubscriptionStatus'];
export type ProofStatus = S['ProofStatus'];
export type SlashStatus = S['SlashStatus'];
export type ApiScope = S['ApiScope'];

export type ApiErrorBody = S['Error'];
export type NetworkDescriptor = S['NetworkDescriptor'];
export type NetworkStatus = S['Status'];
export type NetworkParams = S['NetworkParams'];
export type Validator = S['Validator'];
export type Token = S['Token'];
export type TokenBalance = S['TokenBalance'];
export type Collection = S['Collection'];
export type HubEvent = S['Event'];
export type Notification = S['Notification'];
export type RoundSummary = S['RoundSummary'];
export type Round = S['Round'];
export type EpochSummary = S['EpochSummary'];
export type EpochTotals = S['EpochTotals'];
export type RewardReceiptV2 = S['RewardReceiptV2'];
export type Settlement = S['Settlement'];
export type Module = S['Module'];
export type ExecuteResult = S['ExecuteResult'];
export type ProjectSummary = S['ProjectSummary'];
export type Project = S['Project'];
export type Manifest = S['Manifest'];
export type ManifestConsensus = S['ManifestConsensus'];
export type ManifestScheduling = S['ManifestScheduling'];
export type ManifestListing = S['ManifestListing'];
export type SignedManifest = S['SignedManifest'];
export type ProjectVersion = S['ProjectVersion'];
export type ProjectEconomics = S['ProjectEconomics'];
export type ProjectStats = S['ProjectStats'];
export type ProjectMiner = S['ProjectMiner'];
export type Compatibility = S['Compatibility'];
export type HardwareProfile = S['HardwareProfile'];
export type BenchmarkResult = S['BenchmarkResult'];
export type Review = S['Review'];
export type Announcement = S['Announcement'];
export type Task = S['Task'];
export type Session = S['Session'];
export type Me = S['Me'];
export type Preferences = S['Preferences'];
export type AccountProfile = S['AccountProfile'];
export type Device = S['Device'];
export type DeviceGroup = S['DeviceGroup'];
export type Eip712TypedData = S['Eip712TypedData'];
export type GaslessPayload = S['GaslessPayload'];
export type SignedGasless = S['SignedGasless'];
export type TxRequest = S['TxRequest'];
export type TxStatus = S['TxStatus'];
export type SubscriptionIntent = S['SubscriptionIntent'];
export type Subscription = S['Subscription'];
export type Lease = S['Lease'];
export type Proof = S['Proof'];
export type EpochPayout = S['EpochPayout'];
export type Claim = S['Claim'];
export type Withdrawal = S['Withdrawal'];
export type Evidence = S['Evidence'];
export type Slash = S['Slash'];
export type FaucetStatus = S['FaucetStatus'];
export type Developer = S['Developer'];
export type DeveloperProfileInput = S['DeveloperProfileInput'];
export type Draft = S['Draft'];
export type DraftInput = S['DraftInput'];
export type ProjectAnalytics = S['ProjectAnalytics'];
export type Simulation = S['Simulation'];
export type ApiKey = S['ApiKey'];
export type Binding = S['Binding'];

/** `{items, next_cursor}` page shape. */
export interface Page<T> {
	items: T[];
	next_cursor: string | null;
}

export type Period = '24h' | '7d' | '30d' | 'all';
