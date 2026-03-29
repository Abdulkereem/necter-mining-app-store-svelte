export type AppCategory =
  | "Blockchain"
  | "DePIN"
  | "AI/ML"
  | "Storage"
  | "Compute"
  | "Bandwidth"
  | "Data Sovereignty"
  | "IoT"
  | "Hardware Staking"
  | "Content Delivery"

export type AppStatus = "active" | "pending" | "paused" | "deprecated"

export type ResourceType = "compute" | "storage" | "data" | "bandwidth"

// Attestation requirements (prototype)
export type AttestationRequirement = "TPM" | "TEE" | "SGX"

// Reward pricing model (prototype)
export type RewardPricingModel = "fixed" | "variable" | "marketplace"

export interface App {
  id: string
  name: string
  description: string
  category: AppCategory
  developer: string
  developerAddress: string
  icon: string
  status: AppStatus
  reputationScore: number
  totalMiners: number
  totalEarnings: number
  avgEarningsPerDay: number
  requirements: {
    cpu?: string
    gpu?: string
    ram?: string
    storage?: string
    bandwidth?: string
  }
  resourceTypes: ResourceType[]
  rewardToken: string
  createdAt: string
  attestations: number
  tags: string[]
  // MSaaS-specific fields
  miningProfile?: MiningProfile
  consensusMechanism?: ConsensusMechanism
  verificationMethod?: VerificationMethod
  rewardModel?: RewardModel
  slaRequirements?: SLARequirements
  // Reward pricing configuration (prototype)
  rewardPricingModel?: RewardPricingModel
  baseRewardPerTask?: number // token units
  minRewardPerTask?: number // token units
  maxRewardPerTask?: number // token units
  marketplaceSurgeMultiplier?: number // 0..2 (prototype)
  // Fee split (percentages; must sum to 100 for custom)
  feeSplitMinerPct?: number
  feeSplitDeveloperPct?: number
  feeSplitTreasuryPct?: number
  // Optional per-app attestation requirements (prototype / UI + simulated enforcement)
  attestationRequirements?: AttestationRequirement[]
  screenshots?: string[]
  videoUrl?: string
  features?: string[]
  reviews?: Review[]
  averageRating?: number
  reviewCount?: number
  monthlyGrowth?: number // percentage
  trending?: boolean
  featured?: boolean

  // --- Prototype economics extensions (MSaaS / escrow runway) ---
  // These are optional and only populated for apps created via the developer wizard.
  escrowBalance?: number // in reward token units (prototype)
  dailyEmission?: number // tokens/day (prototype)
  disputeWindowSeconds?: number
}

export interface Miner {
  id: string
  address: string
  username: string
  reputationScore: number
  totalEarnings: number
  activeSubscriptions: number
  joinedAt: string
  hardware: {
    cpu: string
    gpu?: string
    ram: string
    storage: string
  }
  hardwareProfile?: HardwareProfile // Added for hardware compatibility
}

export interface Subscription {
  id: string
  minerId: string
  appId: string
  status: "active" | "paused" | "cancelled"
  startedAt: string
  totalEarned: number
  tasksCompleted: number
  uptime: number
  nodeId?: string
  nodeVersion?: string
  lastProofAt?: string
  slashingPenalty?: number
  stakeAmount?: number
  collateralLocked?: boolean
  collateralInfo?: CollateralInfo // Added for collateral management
}

export interface Task {
  id: string
  appId: string
  minerId: string
  type: string
  status: "pending" | "running" | "completed" | "failed"
  reward: number
  createdAt: string
  completedAt?: string
}

export interface Attestation {
  id: string
  appId: string
  attestorAddress: string
  score: number
  comment: string
  timestamp: string
}

export type ConsensusMechanism =
  | "PoW" // Proof of Work
  | "PoS" // Proof of Stake
  | "PoST" // Proof of Space-Time
  | "PoC" // Proof of Coverage
  | "PoR" // Proof of Replication
  | "PoA" // Proof of Authority
  | "DPoS" // Delegated Proof of Stake
  | "Custom"

export type VerificationMethod =
  | "zk-proof" // Zero-Knowledge Proofs
  | "tee-attestation" // Trusted Execution Environment
  | "on-chain" // On-chain verification
  | "oracle" // Oracle-based verification
  | "multi-sig" // Multi-signature verification
  | "merkle-proof" // Merkle proof verification
  | "custom"

export type RewardModel =
  | "per-task" // Fixed reward per completed task
  | "time-based" // Reward based on time contributed
  | "performance-based" // Reward based on performance metrics
  | "stake-weighted" // Reward weighted by stake
  | "storage-based" // Reward based on storage provided
  | "hybrid" // Combination of multiple models

export type TaskDomain =
  | "data-storage"
  | "data-retrieval"
  | "compute-inference"
  | "compute-training"
  | "network-relay"
  | "network-coverage"
  | "data-validation"
  | "content-delivery"
  | "custom"

export interface SLARequirements {
  minUptime: number // Percentage (0-100)
  maxLatency: number // Milliseconds
  minBandwidth: number // Mbps
  proofSubmissionInterval: number // Seconds
  slashingPenalty: number // Percentage of stake
}

export interface MiningProfile {
  id: string
  appId: string
  version: string
  taskDomain: TaskDomain
  consensusMechanism: ConsensusMechanism
  verificationMethod: VerificationMethod
  rewardModel: RewardModel
  slaRequirements: SLARequirements
  runtimeConfig: {
    containerType: "docker" | "wasm"
    entrypoint: string
    environment: Record<string, string>
  }
  networkConfig: {
    protocol: "grpc" | "websocket" | "http"
    port: number
    endpoints: string[]
  }
  createdAt: string
  updatedAt: string
  status: "active" | "deprecated" | "testing"
  trustScore?: MiningProfileTrustScore // Added for trust score
}

export interface DeveloperAnalytics {
  appId: string
  totalMiners: number
  activeMiners: number
  totalTasksSubmitted: number
  totalTasksCompleted: number
  totalTasksFailed: number
  avgProofSubmissionTime: number // Seconds
  avgTaskCompletionTime: number // Seconds
  totalRewardsDistributed: number
  slashingEvents: number
  uptimePercentage: number
  period: "24h" | "7d" | "30d" | "all"
}

export interface Review {
  id: string
  minerId: string
  minerUsername: string
  appId: string
  rating: number // 1-5
  comment: string
  timestamp: string
  helpful: number
}

export interface Developer {
  id: string
  address: string
  username: string
  email: string
  company?: string
  website?: string
  avatar?: string
  verified: boolean
  totalApps: number
  totalMiners: number
  reputationScore: number
  joinedAt: string
  bio?: string
  socialLinks?: {
    twitter?: string
    discord?: string
    github?: string
  }
}

export interface ProofSubmission {
  id: string
  subscriptionId: string
  minerId: string
  appId: string
  status: "pending" | "verified" | "rejected"
  submittedAt: string
  verifiedAt?: string
  reward: number
  hash: string
  metadata?: Record<string, any>
  proofDetail?: ProofDetail // Added for proof verification details
  disputeFiledAt?: string
  disputeResolvedAt?: string
  disputeOutcome?: "accepted" | "denied"
}

export interface Withdrawal {
  id: string
  minerId: string
  amount: number
  status: "pending" | "processing" | "completed" | "failed"
  requestedAt: string
  completedAt?: string
  txHash?: string
  walletAddress: string
  fee: number
}

export interface Referral {
  id: string
  referrer: string
  referred: string
  status: "pending" | "completed"
  reward: number
  createdAt: string
  completedAt?: string
}

export interface AttestationVote {
  id: string
  appId: string
  voterId: string
  vote: "approve" | "reject"
  reason?: string
  timestamp: string
}

// New interfaces added for updates
export interface HardwareProfile {
  id: string
  minerId: string
  gpuModel?: string
  gpuVram?: number
  cpuCores?: number
  cpuThreads?: number
  ramGb?: number
  storageGb?: number
  networkMbps?: number
  benchmarkScore?: number
}

export interface ProofDetail {
  id: string
  subscriptionId: string
  appId: string
  minerId: string
  proofData: string
  status: "pending" | "verifying" | "verified" | "rejected"
  submittedAt: string
  verifiedAt?: string
  verifierNode?: string
  expectedEarning: number
  actualEarning?: number
  rejectionReason?: string
  verificationTime?: number // milliseconds
  disputeReason?: string
  disputeFiledAt?: string
  disputeResolvedAt?: string
  disputeOutcome?: "accepted" | "denied"
}

export interface HardwareCompatibility {
  compatible: boolean
  tier: "compatible" | "marginal" | "incompatible"
  matchPercentage: number // 0-100
  missingRequirements: string[]
  estimatedEarningsPerMonth: number
  performanceRating: "excellent" | "good" | "fair" | "poor"
  warnings: string[]
}

export interface CollateralInfo {
  appId: string
  minerId: string
  amountRequired: number
  amountLocked: number
  unlockDate: string
  slashingHistory: SlashingEvent[]
  status: "healthy" | "warning" | "critical"
  marginCallRisk: number // percentage
}

export interface SlashingEvent {
  id: string
  timestamp: string
  amount: number
  reason: string
  recoveryPath?: string
}

export interface ProofStats {
  totalSubmitted: number
  totalVerified: number
  totalRejected: number
  successRate: number // percentage
  averageVerificationTime: number // milliseconds
  rejectionReasons: Record<string, number>
}

export interface MiningProfileTrustScore {
  appId: string
  overallScore: number // 0-100
  developerTrackRecord: number // 40% weight
  networkSecurity: number // 30% weight
  consensusHealth: number // 20% weight
  communityVotes: number // 10% weight
  trendingDirection: "improving" | "stable" | "declining"
  redFlags: string[]
  certificationLevel: "verified" | "gold" | "platinum" | "none"
}
