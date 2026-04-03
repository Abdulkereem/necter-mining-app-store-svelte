import type { App, HardwareProfile, MinerDevice, MiningProfile, ProofDetail, ProofSubmission, Subscription, Withdrawal } from "$lib/types"

// Listing visibility for the miner-facing marketplace.
// `beta` means approved but still under post-approval conditions (time-boxed).
export type AppListingStatus = "draft" | "pending_governance" | "listed" | "beta" | "delisted"

export type JobStatus = "queued" | "running" | "completed" | "failed"

export interface Miner {
  id: string
  walletAddress: string
  label?: string
  createdAt: string
  updatedAt: string
}

export type EventType =
  | "wallet_connected"
  | "wallet_disconnected"
  | "subscription_created"
  | "subscription_blocked"
  | "subscription_paused"
  | "subscription_resumed"
  | "job_queued"
  | "job_started"
  | "job_failed"
  | "job_completed"
  | "proof_submitted"
  | "proof_verified"
  | "proof_disputed"
  | "proof_dispute_resolved"
  | "slash_applied"
  | "payout_distributed"
  | "badge_awarded"
  | "app_reported"
  | "moderation_case_resolved"
  | "developer_enrollment_requested"
  | "developer_enrollment_approved"
  | "developer_enrollment_rejected"
  | "developer_verification_requested"
  | "developer_verification_approved"
  | "developer_verification_rejected"
  | "withdrawal_requested"
  | "withdrawal_completed"
  | "deploy_started"
  | "deploy_progress"
  | "deploy_completed"
  | "mining_package_uploaded"
  | "mining_package_activated"
  | "attestation_oracle_submitted"
  | "attestation_oracle_verified"
  | "app_submitted_for_governance"
  | "governance_attested"
  | "listing_approved"
  | "listing_rejected"
  | "app_governance_approved"

export interface TimelineEvent {
  id: string
  type: EventType
  createdAt: string
  minerId?: string
  walletAddress?: string
  appId?: string
  subscriptionId?: string
  jobId?: string
  proofId?: string
  payoutId?: string
  withdrawalId?: string
  message: string
  metadata?: Record<string, unknown>
}

export interface MiningJob {
  id: string
  appId: string
  subscriptionId: string
  minerId: string
  status: JobStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  reward: number
  proofId?: string
  failureReason?: string
}

export interface GovernanceDecision {
  appId: string
  status: "review" | "voting" | "executing" | "approved" | "rejected"
  createdAt: string
  decidedAt?: string
  yesVotes: number
  noVotes: number
  requiredAttestations: number
  yesAttestors: string[]
  noAttestors: string[]
  requiredReviews?: number
  voteEndsAt?: string
  reason?: string
  // Optional post-approval conditions (e.g. escrow top-up, CPU mode, docs).
  conditions?: string[]
  conditionsDeadlineAt?: string
  conditionsMetAt?: string
}

export type MiningPackageKind = "docker" | "vm" | "ndsr"

export interface MiningPackageRelease {
  id: string
  appId: string
  kind: MiningPackageKind
  version: string // developer-defined semver-ish (prototype)
  createdAt: string
  uploadedByWalletAddress?: string
  // Optional artifact pointers (prototype; would be OCI digest / IPFS CID / etc.)
  image?: string // Docker image ref
  digest?: string // pinned digest or content hash
  vmImageUrl?: string
  entrypoint?: string
  env?: Record<string, string>
  notes?: string
}

export interface CreateNetworkDraft {
  id: string
  developerId: string
  createdAt: string
  updatedAt: string
  currentStep: number
  data: Record<string, unknown>
}

export interface ProductPageData {
  appId: string
  updatedAt: string
  appName: string
  subtitle: string
  description: string
  keywords: string[]
  screenshots: Array<{ id: string; url: string; order: number }>
  previewVideos: string[]
}

export interface TestnetStatus {
  appId: string
  status: "idle" | "running" | "passed" | "failed"
  lastRunAt?: string
  logs: string[]
}

export interface GovernanceReview {
  id: string
  appId: string
  reviewerId: string
  status: "in_progress" | "submitted"
  createdAt: string
  updatedAt: string
  submittedAt?: string

  overallScore: number // 1-10
  securityRating: "safe" | "concerns" | "unsafe"
  economicFairness: "fair" | "questionable" | "unfair"
  technicalQuality: "high" | "medium" | "low"
  compliance: "pass" | "conditional" | "fail"
  recommendation: "approve" | "conditional" | "reject"

  comments: string
  conditions?: string
}

export interface GovernanceProposal {
  id: string
  title: string
  description: string
  type: "parameter-update" | "reward-change" | "treasury" | "other"
  status: "active" | "passed" | "rejected" | "executed" | "cancelled"
  createdAt: string
  endsAt?: string
  quorumPercent: number // 0-100 (display-only in prototype)
  votesFor: number // prototype VP units
  votesAgainst: number // prototype VP units
  votersFor: string[] // voterIds (wallet addresses)
  votersAgainst: string[] // voterIds (wallet addresses)
  createdBy: string // voterId (wallet address)
}

// Governance stake history
export interface GovernanceStakeEvent {
  id: string
  address: string
  type: "deposit" | "withdraw" | "lock" | "unlock" | "reward"
  amount: number
  reason: string
  proposalId?: string
  appId?: string
  createdAt: string
  unlocksAt?: string
}

// Delegation
export interface GovernanceDelegation {
  id: string
  fromAddress: string
  toAddress: string
  amount: number
  createdAt: string
  revokedAt?: string
}

// Proposal discussion
export interface ProposalComment {
  id: string
  proposalId: string
  authorAddress: string
  content: string
  createdAt: string
  parentCommentId?: string
  upvotes: number
  upvoters: string[]
}

// Treasury
export interface TreasuryTransaction {
  id: string
  type: "inflow" | "outflow"
  amount: number
  source?: string
  recipient?: string
  purpose?: string
  createdAt: string
  status: "completed" | "pending"
}

export interface TreasuryAllocation {
  label: string
  percent: number
  amount: number
}

// Developer Portal: Webhook logs
export interface WebhookLogEntry {
  id: string
  appId: string
  event: string
  url: string
  payload: string
  status: "delivered" | "failed" | "retrying"
  statusCode?: number
  createdAt: string
  retriedAt?: string
  attempts: number
}

// Developer Portal: Deployment logs
export interface DeploymentLog {
  id: string
  appId: string
  version: string
  status: "building" | "deploying" | "live" | "failed" | "rolled_back"
  startedAt: string
  completedAt?: string
  steps: DeploymentStep[]
  triggeredBy: string
}

export interface DeploymentStep {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  startedAt?: string
  completedAt?: string
  logs: string[]
}

// Developer Portal: Announcements
export interface Announcement {
  id: string
  appId: string
  title: string
  content: string
  type: "update" | "maintenance" | "feature" | "alert"
  createdAt: string
  authorAddress: string
}

// Developer Portal: Miner tiers
export interface MinerTierConfig {
  enabled: boolean
  tiers: Array<{
    name: string
    minUptime: number
    minProofRate: number
    rewardMultiplier: number
    color: string
  }>
  blocklist: string[]
  allowlist: string[]
}

// Developer Portal: Support tickets
export interface SupportTicket {
  id: string
  appId: string
  minerId: string
  subject: string
  description: string
  status: "open" | "in_progress" | "resolved" | "closed"
  priority: "low" | "medium" | "high"
  createdAt: string
  updatedAt: string
  replies: Array<{ authorId: string; content: string; createdAt: string }>
}

// Developer Portal: Testnet sessions
export interface TestnetSession {
  id: string
  appId: string
  status: "running" | "completed" | "failed"
  startedAt: string
  completedAt?: string
  simulatedMiners: number
  proofsGenerated: number
  proofsPassed: number
  proofsFailed: number
  logs: string[]
}

export type AppReportCategory = "scam" | "malware" | "economics" | "impersonation" | "spam" | "other"
export type AppReportSeverity = "low" | "medium" | "high"

export interface AppReport {
  id: string
  appId: string
  reporterMinerId: string
  reporterWalletAddress: string
  category: AppReportCategory
  severity: AppReportSeverity
  reason: string
  createdAt: string
}

export interface ModerationCase {
  id: string
  appId: string
  status: "open" | "resolved_keep" | "resolved_delist"
  createdAt: string
  updatedAt: string
  decidedAt?: string

  reportIds: string[]
  reportCount: number
  lastReportedAt?: string

  // DAO vote to keep/delist (prototype)
  keepVotes: number
  delistVotes: number
  requiredVotes: number
  keepVoters: string[]
  delistVoters: string[]
}

export type AttestationOracleStatus = "none" | "pending" | "verified" | "rejected"

export interface AttestationOracleSubmission {
  appId: string
  status: AttestationOracleStatus
  submittedAt?: string
  verifiedAt?: string
  codeHash?: string // “code hash” / measurement to attest
  runtimeDigest?: string // e.g. pinned OCI digest
  notes?: string
}

export interface OperatorFleetMiner {
  id: string
  label: string
  walletAddress: string
  location?: string
  tier: "cpu" | "gpu" | "storage" | "bandwidth"
  reputationScore: number
  uptime: number
  createdAt: string
  updatedAt: string
}

export interface OperatorMinerGroup {
  id: string
  name: string
  minerIds: string[]
  createdAt: string
  updatedAt: string
}

export interface OperatorDeployment {
  id: string
  status: "running" | "complete" | "failed"
  progress: number // 0-100
  createdAt: string
  updatedAt: string
  targetGroupId?: string
  minerIds: string[]
  appIds: string[]
  logs: string[]
}

export interface OperatorAutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger: "low_reputation" | "downtime" | "low_roi"
  action: "pause" | "resume" | "switch_app"
  createdAt: string
  updatedAt: string
}

export type CollectionKind = "editors_picks" | "dao_curated"

export interface CuratedCollection {
  id: string
  kind: CollectionKind
  title: string
  description?: string
  appIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Payout {
  id: string
  createdAt: string
  appId: string
  minerId: string
  walletAddress?: string
  subscriptionId?: string
  jobId?: string
  proofId?: string
  // gross reward (before splits)
  gross: number
  minerAmount: number
  developerAmount: number
  treasuryAmount: number
  developerWalletAddress?: string
}

export interface SlashingEvent {
  id: string
  createdAt: string
  appId: string
  minerId: string
  subscriptionId?: string
  amount: number
  reason: string
}

export type BadgeKind = "milestone" | "performance" | "governance" | "community"

export interface MinerBadge {
  id: string
  kind: BadgeKind
  name: string
  description: string
  mintedAt: string
  appId?: string
}

export type DeveloperVerificationStatus = "unverified" | "pending" | "verified" | "rejected"

export interface DeveloperVerificationRecord {
  walletAddress: string
  status: DeveloperVerificationStatus
  requestedAt?: string
  reviewedAt?: string
  notes?: string
}

export type DeveloperEnrollmentStatus = "none" | "pending" | "active" | "rejected"

export interface DeveloperEnrollmentRecord {
  walletAddress: string
  status: DeveloperEnrollmentStatus
  submittedAt?: string
  reviewedAt?: string
  developerType?: "individual" | "organization"
  agreementsAccepted?: boolean
  agreementsAcceptedAt?: string
  taxStatus?: "not_started" | "submitted" | "verified"
  bankingStatus?: "not_started" | "submitted" | "verified"
  displayName?: string
  email?: string
  website?: string
  reason?: string
  notes?: string
  // Extended profile fields
  bio?: string
  location?: string
  founded?: string
  category?: string
  tags?: string[]
  logo?: string
  socialLinks?: {
    twitter?: string
    discord?: string
    github?: string
    telegram?: string
  }
}

export interface MockBackendState {
  version: 1
  createdAt: string
  updatedAt: string

  // Current session (prototype auth context)
  session: {
    walletAddress: string | null
    minerId: string | null
  }

  // Prototype roles (authorization)
  rolesByWalletAddress: Record<string, Array<"miner" | "developer" | "governance" | "operator">>

  // Primary entities (source of truth for UI)
  apps: App[]
  listingStatusByAppId: Record<string, AppListingStatus>
  miningProfiles: MiningProfile[]

  miners: Miner[]
  subscriptions: Subscription[]
  jobs: MiningJob[]
  proofs: ProofSubmission[]
  proofDetails: ProofDetail[]
  withdrawals: Withdrawal[]

  governance: GovernanceDecision[]
  events: TimelineEvent[]

  // Deploy pipeline (simulated MSaaS compile/deploy)
  deployPipelinesByAppId: Record<
    string,
    {
      status: "idle" | "compiling" | "deploying" | "submitted" | "complete" | "failed"
      progress: number // 0-100
      updatedAt: string
      logs: string[]
      pinnedDigest?: string
    }
  >

  // Convenience totals (simulated)
  walletBalancesByAddress: Record<string, number>

  // Miner UX convenience state (persisted)
  watchlistByMinerId: Record<string, string[]>
  recentSearchesByMinerId: Record<string, string[]>
  savedWithdrawalAddressesByMinerId: Record<string, string[]>

  // Discover curation (persisted)
  curatedCollections: CuratedCollection[]

  // Developer drafts (persisted)
  createNetworkDraftByDeveloperId: Record<string, CreateNetworkDraft>

  // Developer product pages (persisted)
  productPageByAppId: Record<string, ProductPageData>

  // Developer testnet (persisted)
  testnetByAppId: Record<string, TestnetStatus>

  // Governance reviews (persisted)
  governanceReviews: GovernanceReview[]
  governanceProposals: GovernanceProposal[]

  // Moderation (persisted)
  appReports: AppReport[]
  moderationCases: ModerationCase[]

  // Attestation Oracle (persisted) — developer submits a code hash for attestation.
  attestationOracleByAppId: Record<string, AttestationOracleSubmission>

  // Mining Package releases (persisted) — versioned runtime artifacts attached to an app.
  miningPackageReleasesByAppId: Record<string, MiningPackageRelease[]>
  activeMiningPackageReleaseIdByAppId: Record<string, string>

  // Miner-owned hardware profile (persisted)
  hardwareProfileByMinerId: Record<string, HardwareProfile>

  // Miner devices (persisted)
  devicesByMinerId: Record<string, MinerDevice[]>

  // Miner attestation capabilities (persisted)
  attestationCapabilitiesByMinerId: Record<
    string,
    { tpm: boolean; tee: boolean; sgx: boolean }
  >

  // Miner reputation (persisted)
  minerReputationByMinerId: Record<string, number>

  // Developer verification (persisted)
  developerVerificationByAddress: Record<string, DeveloperVerificationRecord>

  // Developer enrollment (persisted) - required before accessing Developer Portal.
  developerEnrollmentByAddress: Record<string, DeveloperEnrollmentRecord>

  // Economics logs (persisted)
  payouts: Payout[]
  treasuryBalance: number
  slashingEvents: SlashingEvent[]

  // Gamification (persisted)
  badgesByMinerId: Record<string, MinerBadge[]>

  // Governance staking (persisted)
  governanceStakesByAddress: Record<string, { total: number; locked: number; available: number }>
  governanceVoteStakes: Record<string, Record<string, number>> // proposalId -> voterId -> stakeAmount
  governanceReviewerStakes: Record<string, Record<string, number>> // appId -> reviewerId -> stakeAmount
  governanceRewards: Record<string, number> // walletAddress -> accumulated rewards
  governanceStakeHistory: GovernanceStakeEvent[]
  governanceDelegations: GovernanceDelegation[]
  proposalComments: ProposalComment[]
  treasuryTransactions: TreasuryTransaction[]

  // Developer portal (persisted)
  webhookLogsByAppId: Record<string, WebhookLogEntry[]>
  deploymentLogsByAppId: Record<string, DeploymentLog[]>
  announcementsByAppId: Record<string, Announcement[]>
  minerTiersByAppId: Record<string, MinerTierConfig>
  supportTicketsByAppId: Record<string, SupportTicket[]>
  testnetSessionsByAppId: Record<string, TestnetSession[]>

  // Operator portal (persisted)
  operatorMiners: OperatorFleetMiner[]
  operatorGroups: OperatorMinerGroup[]
  operatorDeployments: OperatorDeployment[]
  operatorAutomationRules: OperatorAutomationRule[]
}

