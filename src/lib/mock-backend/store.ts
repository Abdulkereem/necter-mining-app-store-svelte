

import { mockApps, mockSubscriptions } from "$lib/mock-data"
import type {
  MockBackendState,
  AppListingStatus,
  AppReport,
  AppReportCategory,
  AppReportSeverity,
  AttestationOracleSubmission,
  MiningPackageRelease,
  MiningPackageKind,
  MiningJob,
  GovernanceDecision,
  GovernanceProposal,
  Miner,
  TimelineEvent,
  EventType,
  ProductPageData,
  TestnetStatus,
  GovernanceReview,
  ModerationCase,
  OperatorFleetMiner,
  OperatorMinerGroup,
  OperatorDeployment,
  OperatorAutomationRule,
  CuratedCollection,
  DeveloperVerificationRecord,
  DeveloperEnrollmentRecord,
  Payout,
  SlashingEvent,
  MinerBadge,
  GovernanceStakeEvent,
  GovernanceDelegation,
  ProposalComment,
  TreasuryTransaction,
  WebhookLogEntry,
  DeploymentLog,
  DeploymentStep,
  Announcement,
  SupportTicket,
  TestnetSession,
} from "$lib/mock-backend/types"
import type { App, HardwareProfile, MinerDevice, MiningProfile, ProofDetail, ProofSubmission, Subscription, Withdrawal } from "$lib/types"

const STORAGE_KEY = "necter_mock_backend_v1"

type Listener = () => void

function nowIso() {
  return new Date().toISOString()
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stableSeedFromString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function fakeCodeHash(parts: string[]) {
  // Deterministic “hash-like” string for the prototype.
  const seed = stableSeedFromString(parts.join("|"))
  const hex = (n: number) => n.toString(16).padStart(8, "0")
  const chunks = Array.from({ length: 8 }, (_, i) => hex((seed + i * 0x9e3779b9) >>> 0)).join("")
  return `0x${chunks}`
}

function randId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function initialListingStatus(apps: App[]): Record<string, AppListingStatus> {
  const out: Record<string, AppListingStatus> = {}
  for (const a of apps) out[String((a as any).id)] = "listed"
  return out
}

function seedGovernanceListingQueue(input: {
  apps: App[]
  listingStatusByAppId: Record<string, AppListingStatus>
  createdAt: string
}): { governance: GovernanceDecision[]; listingStatusByAppId: Record<string, AppListingStatus> } {
  const { apps, listingStatusByAppId, createdAt } = input

  const alreadyPending = Object.values(listingStatusByAppId).some((s) => s === "pending_governance")
  if (alreadyPending) return { governance: [], listingStatusByAppId }

  const pickIds = apps
    .filter((a) => (listingStatusByAppId[a.id] ?? "listed") === "listed")
    .slice(0, 3)
    .map((a) => a.id)

  if (pickIds.length === 0) return { governance: [], listingStatusByAppId }

  const nextListing = { ...listingStatusByAppId }
  for (const id of pickIds) nextListing[id] = "pending_governance"

  const governance: GovernanceDecision[] = pickIds.map((appId, idx) => ({
    appId,
    status: "voting",
    createdAt: new Date(new Date(createdAt).getTime() + (idx + 1) * 60 * 60 * 1000).toISOString(),
    yesVotes: 0,
    noVotes: 0,
    requiredAttestations: 3,
    yesAttestors: [],
    noAttestors: [],
    requiredReviews: 3,
    voteEndsAt: new Date(Date.now() + 18_000).toISOString(),
  }))

  return { governance, listingStatusByAppId: nextListing }
}

function legacyRemapAppId(app: App): string {
  // Older mock datasets accidentally reused numeric IDs. Remap by name to preserve both apps.
  const id = String((app as any).id)
  const name = String((app as any).name ?? "").trim().toLowerCase()
  if (id === "15" && name === "polkadot") return "22"
  if (id === "16" && name === "starknet") return "23"
  if (id === "17" && name === "bandwidth protocol") return "24"
  if (id === "18" && name === "nymph protocol") return "25"
  if (id === "19" && name === "flux network") return "26"
  if (id === "20" && name === "sentinel network") return "27"
  return id
}

const LEGACY_MISSING_ICON_PATHS = new Set<string>([
  "/bittensor-logo.jpg",
  "/grass-logo.jpg",
  "/ionet-logo.jpg",
  "/nosana-logo.jpg",
  "/fluence-logo.jpg",
  "/dimo-logo.jpg",
  "/hivemapper-logo.jpg",
])

function normalizeAppMedia(app: App): App {
  const icon = app.icon && LEGACY_MISSING_ICON_PATHS.has(app.icon) ? "/placeholder-logo.png" : app.icon
  const screenshots = Array.isArray((app as any).screenshots)
    ? ((app as any).screenshots as string[]).map((s) => (LEGACY_MISSING_ICON_PATHS.has(s) ? "/placeholder-logo.png" : s))
    : (app as any).screenshots
  return { ...app, icon, screenshots: screenshots as any }
}

function defaultAttestationRequirementsForApp(_app: App): Array<"TPM" | "TEE" | "SGX"> {
  // Mock store: skip attestation requirements so subscribe always works in demo mode.
  return []
}

function ensureAppAttestationDefaults(app: App): App {
  const existing = Array.isArray((app as any).attestationRequirements) ? ((app as any).attestationRequirements as any[]) : []
  if (existing.length > 0) return app
  const defaults = defaultAttestationRequirementsForApp(app)
  if (defaults.length === 0) return app
  return { ...(app as any), attestationRequirements: defaults } as App
}

function dedupeAppsById(apps: App[]) {
  const seen = new Set<string>()
  const out: App[] = []
  for (const a of apps) {
    const id = String((a as any).id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ ...(a as any), id } as App)
  }
  return out
}

function ensureDefaultMiner(createdAt = nowIso()): Miner {
  return {
    id: "miner-1",
    walletAddress: "0xDEMO_MINER_000000000000000000000000000000000000",
    label: "Demo Miner",
    createdAt,
    updatedAt: createdAt,
  }
}

function bootstrapOperatorMiners(now = nowIso()): OperatorFleetMiner[] {
  const tiers: OperatorFleetMiner["tier"][] = ["gpu", "cpu", "storage", "bandwidth"]
  const out: OperatorFleetMiner[] = []
  for (let i = 1; i <= 24; i++) {
    const tier = tiers[i % tiers.length]!
    out.push({
      id: `op-miner-${i}`,
      label: `Node ${String(i).padStart(3, "0")}`,
      walletAddress: `0xOP${String(i).padStart(2, "0")}_MINER_${"0".repeat(28)}`,
      location: i % 3 === 0 ? "us-east" : i % 3 === 1 ? "eu-west" : "ap-sg",
      tier,
      reputationScore: Number((4 + (i % 10) * 0.1).toFixed(1)),
      uptime: Number((92 + (i % 8) * 0.9).toFixed(1)),
      createdAt: now,
      updatedAt: now,
    })
  }
  return out
}

function toMinerIdentity(m: OperatorFleetMiner, now = nowIso()): Miner {
  return {
    id: m.id,
    walletAddress: m.walletAddress,
    label: m.label,
    createdAt: now,
    updatedAt: now,
  }
}

function bootstrapCuratedCollections(now = nowIso()): CuratedCollection[] {
  const editors = mockApps.filter((a) => (a as any).featured).slice(0, 8).map((a) => a.id)
  const dao = mockApps.filter((a) => (a as any).trending).slice(0, 8).map((a) => a.id)
  const fallback = mockApps.slice(0, 8).map((a) => a.id)

  const byCategory = (cat: string) => mockApps.filter((a) => a.category === cat).slice(0, 6).map((a) => a.id)
  const highEarning = [...mockApps].sort((a, b) => b.avgEarningsPerDay - a.avgEarningsPerDay).slice(0, 6).map((a) => a.id)
  const beginner = [...mockApps].filter((a) => !a.requirements?.gpu).sort((a, b) => b.reputationScore - a.reputationScore).slice(0, 6).map((a) => a.id)

  return [
    {
      id: "col_editors_picks",
      kind: "editors_picks",
      title: "Editor’s Picks",
      description: "Hand-picked projects by the Necter team.",
      appIds: editors.length > 0 ? editors : fallback,
      createdAt: now, updatedAt: now,
    },
    {
      id: "col_gpu_compute",
      kind: "dao_curated",
      title: "GPU Compute & AI",
      description: "Projects that need GPU power. AI inference, rendering, training.",
      appIds: byCategory("AI/ML"),
      createdAt: now, updatedAt: now,
    },
    {
      id: "col_storage",
      kind: "dao_curated",
      title: "Storage Projects",
      description: "Earn by providing disk space and bandwidth for decentralized storage.",
      appIds: byCategory("Storage"),
      createdAt: now, updatedAt: now,
    },
    {
      id: "col_depin_iot",
      kind: "dao_curated",
      title: "DePIN & IoT",
      description: "Physical infrastructure projects. Wireless coverage, sensors, mapping.",
      appIds: [...byCategory("DePIN"), ...byCategory("IoT")].slice(0, 6),
      createdAt: now, updatedAt: now,
    },
    {
      id: "col_high_earning",
      kind: "editors_picks",
      title: "Highest Earning Projects",
      description: "Projects with the best daily earnings potential for miners.",
      appIds: highEarning,
      createdAt: now, updatedAt: now,
    },
    {
      id: "col_beginner",
      kind: "editors_picks",
      title: "Great for Beginners",
      description: "No GPU required. Start mining with just a CPU and internet connection.",
      appIds: beginner,
      createdAt: now, updatedAt: now,
    },
    {
      id: "col_dao_curated",
      kind: "dao_curated",
      title: "Community Favorites",
      description: "Top-rated by the Necter mining community.",
      appIds: dao.length > 0 ? dao : fallback,
      createdAt: now, updatedAt: now,
    },
  ]
}

function bootstrapGovernanceProposals(now = nowIso()): GovernanceProposal[] {
  // Deterministic demo proposals (first-class, clickable, and creatable).
  return [
    {
      id: "GP-14",
      title: "Update slashing parameters for AI nodes",
      description:
        "Increase the slashing penalty for incorrect inference results from 10% to 25% to deter malicious actors. Also clarifies the dispute window for contested proofs.",
      type: "parameter-update",
      status: "active",
      createdAt: now,
      endsAt: "2026-02-10T00:00:00.000Z",
      quorumPercent: 85,
      votesFor: 1_250_000,
      votesAgainst: 45_000,
      votersFor: [],
      votersAgainst: [],
      createdBy: "gov-demo",
    },
    {
      id: "GP-13",
      title: "Approve 'Render Network' marketplace listing",
      description: "Whitelist Render Network as a verified DePIN compute provider on the marketplace.",
      type: "other",
      status: "passed",
      createdAt: "2026-01-20T00:00:00.000Z",
      endsAt: "2026-01-28T00:00:00.000Z",
      quorumPercent: 92,
      votesFor: 3_200_000,
      votesAgainst: 12_000,
      votersFor: [],
      votersAgainst: [],
      createdBy: "gov-demo",
    },
    {
      id: "GP-12",
      title: "Treasury buyback program (Q1)",
      description: "Allocate 500k USDC from treasury to buy back and burn NCT tokens.",
      type: "treasury",
      status: "executed",
      createdAt: "2026-01-05T00:00:00.000Z",
      endsAt: "2026-01-12T00:00:00.000Z",
      quorumPercent: 78,
      votesFor: 2_800_000,
      votesAgainst: 800_000,
      votersFor: [],
      votersAgainst: [],
      createdBy: "gov-demo",
    },
  ]
}

/** Seed a few verified proofs and payouts so Latest payouts and dashboard have data; also seed proof activity events. */
function seedInitialProofsAndPayouts(opts: {
  subscriptions: Subscription[]
  minerId: string
  walletAddress: string
  createdAt: string
}): { proofs: ProofSubmission[]; payouts: Payout[]; events: TimelineEvent[] } {
  const { subscriptions, minerId, walletAddress, createdAt } = opts
  const proofs: ProofSubmission[] = []
  const payouts: Payout[] = []
  const events: TimelineEvent[] = []
  const baseTime = new Date(createdAt).getTime()
  let proofIdx = 0
  let payoutIdx = 0
  const rewards = [0.12, 0.25, 0.18, 0.31, 0.22, 0.19, 0.28, 0.15, 0.24, 0.2]
  subscriptions
    .filter((s) => s.minerId === minerId)
    .forEach((sub, subIdx) => {
      const n = 2 + (subIdx % 2)
      for (let i = 0; i < n; i++) {
        const hoursAgo = (subIdx * 24 + (i + 1) * 8) % 168
        const ts = new Date(baseTime - hoursAgo * 60 * 60 * 1000).toISOString()
        const submittedTs = new Date(baseTime - hoursAgo * 60 * 60 * 1000 - 2 * 60 * 1000).toISOString()
        const reward = rewards[(proofIdx + payoutIdx) % rewards.length]!
        const proofId = `proof_seed_${proofIdx}`
        const payoutId = `payout_seed_${payoutIdx}`
        proofs.push({
          id: proofId,
          subscriptionId: sub.id,
          minerId,
          appId: sub.appId,
          status: "verified",
          submittedAt: submittedTs,
          verifiedAt: ts,
          reward,
          hash: `0x${proofId.padEnd(62, "0").slice(0, 62)}`,
        })
        const gross = reward / 0.8
        const developerAmount = Number((gross * 0.15).toFixed(4))
        const treasuryAmount = Number((gross * 0.05).toFixed(4))
        payouts.push({
          id: payoutId,
          createdAt: ts,
          appId: sub.appId,
          minerId,
          walletAddress,
          subscriptionId: sub.id,
          proofId,
          gross,
          minerAmount: reward,
          developerAmount,
          treasuryAmount,
        })
        events.push(
          {
            id: `evt_seed_submit_${proofIdx}`,
            type: "proof_submitted",
            createdAt: submittedTs,
            minerId,
            appId: sub.appId,
            subscriptionId: sub.id,
            proofId,
            message: `Proof submitted for job (verified).`,
            metadata: { reward },
          },
          {
            id: `evt_seed_verified_${proofIdx}`,
            type: "proof_verified",
            createdAt: ts,
            minerId,
            appId: sub.appId,
            subscriptionId: sub.id,
            proofId,
            message: "Proof verified; rewards credited.",
            metadata: { reward, minerAmount: reward },
          },
          {
            id: `evt_seed_payout_${payoutIdx}`,
            type: "payout_distributed",
            createdAt: ts,
            minerId,
            walletAddress,
            appId: sub.appId,
            subscriptionId: sub.id,
            proofId,
            payoutId,
            message: "Payout distributed (prototype split).",
            metadata: { gross, minerAmount: reward, developerAmount, treasuryAmount },
          },
        )
        proofIdx++
        payoutIdx++
      }
    })
  return { proofs, payouts, events }
}

function bootstrapState(): MockBackendState {
  // Deterministic timestamps so SSR + initial hydration match.
  const createdAt = "2026-01-01T00:00:00.000Z"
  const demoMiner = ensureDefaultMiner(createdAt)
  const operatorMiners = bootstrapOperatorMiners(createdAt)
  const seededProofsAndPayouts = seedInitialProofsAndPayouts({
    subscriptions: [...mockSubscriptions],
    minerId: demoMiner.id,
    walletAddress: demoMiner.walletAddress,
    createdAt,
  })
  const operatorGroups: OperatorMinerGroup[] = [
    {
      id: "grp-gpu",
      name: "High-Performance GPU Nodes",
      minerIds: operatorMiners.filter((m) => m.tier === "gpu").map((m) => m.id),
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "grp-storage",
      name: "Storage Specialists",
      minerIds: operatorMiners.filter((m) => m.tier === "storage").map((m) => m.id),
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const listingStatusByAppId = initialListingStatus(mockApps)
  const seededQueue = seedGovernanceListingQueue({ apps: mockApps, listingStatusByAppId, createdAt })

  return {
    version: 1,
    createdAt,
    updatedAt: createdAt,
    session: {
      walletAddress: demoMiner.walletAddress,
      minerId: demoMiner.id,
    },
    rolesByWalletAddress: {
      [demoMiner.walletAddress]: ["miner", "developer", "governance", "operator"], // demo: allow everything
    },
    apps: mockApps.map((a) => ensureAppAttestationDefaults(a)),
    listingStatusByAppId: seededQueue.listingStatusByAppId,
    miningProfiles: [],
    miners: [demoMiner, ...operatorMiners.map((m) => toMinerIdentity(m, createdAt))],
    subscriptions: [...mockSubscriptions],
    jobs: [],
    proofs: seededProofsAndPayouts.proofs,
    proofDetails: [],
    withdrawals: [],
    payouts: seededProofsAndPayouts.payouts,
    governance: seededQueue.governance,
    events: [
      {
        id: "evt_bootstrap",
        type: "wallet_connected",
        createdAt,
        minerId: demoMiner.id,
        walletAddress: demoMiner.walletAddress,
        message: "Demo miner initialized.",
      },
      ...seededProofsAndPayouts.events,
    ],
    deployPipelinesByAppId: {},
    walletBalancesByAddress: {
      [demoMiner.walletAddress]: 500, // a little starting balance for demo UX
    },
    watchlistByMinerId: {
      [demoMiner.id]: ["2", "12", "6"].filter(Boolean),
    },
    recentSearchesByMinerId: {
      [demoMiner.id]: ["gpu", "storage", "low stake"],
    },
    savedWithdrawalAddressesByMinerId: {
      [demoMiner.id]: [demoMiner.walletAddress],
    },
    curatedCollections: bootstrapCuratedCollections(createdAt),
    createNetworkDraftByDeveloperId: {},
    productPageByAppId: {},
    testnetByAppId: {},
    governanceReviews: [],
    governanceProposals: bootstrapGovernanceProposals(createdAt),
    appReports: [] as AppReport[],
    moderationCases: [] as ModerationCase[],
    attestationOracleByAppId: {} as Record<string, AttestationOracleSubmission>,
    miningPackageReleasesByAppId: {} as Record<string, MiningPackageRelease[]>,
    activeMiningPackageReleaseIdByAppId: {} as Record<string, string>,

    hardwareProfileByMinerId: {
      [demoMiner.id]: {
        id: `hw_${demoMiner.id}`,
        minerId: demoMiner.id,
        cpuCores: 8,
        cpuThreads: 16,
        ramGb: 32,
        storageGb: 500,
        networkMbps: 100,
        gpuModel: "RTX 3080",
        gpuVram: 10,
      },
    },
    devicesByMinerId: {
      [demoMiner.id]: [
        {
          id: "device-1",
          minerId: demoMiner.id,
          name: "Home Desktop",
          type: "desktop",
          status: "online",
          lastSeenAt: createdAt,
          createdAt,
          hardware: {
            gpu: "NVIDIA RTX 4090",
            gpuVram: 24,
            cpu: "AMD Ryzen 9 7950X",
            cpuCores: 16,
            ram: "64GB DDR5",
            storage: "2TB NVMe",
            bandwidth: "500 Mbps",
          },
          subscribedAppIds: ["1", "2", "3"],
          totalEarned: 1240.50,
          uptime: 99.2,
          location: "Home Office",
        },
        {
          id: "device-2",
          minerId: demoMiner.id,
          name: "Cloud Server",
          type: "server",
          status: "online",
          lastSeenAt: createdAt,
          createdAt,
          hardware: {
            cpu: "Intel Xeon E-2388G",
            cpuCores: 8,
            ram: "128GB ECC",
            storage: "4TB SSD",
            bandwidth: "1000 Mbps",
          },
          subscribedAppIds: ["1", "2", "3", "4", "5"],
          totalEarned: 2890.75,
          uptime: 99.8,
          location: "US-East Datacenter",
        },
        {
          id: "device-3",
          minerId: demoMiner.id,
          name: "MacBook Pro",
          type: "laptop" as const,
          status: "idle" as const,
          lastSeenAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          createdAt,
          hardware: {
            gpu: "Apple M3 Max",
            gpuVram: 36,
            cpu: "Apple M3 Max",
            cpuCores: 14,
            ram: "36GB Unified",
            storage: "1TB SSD",
            bandwidth: "200 Mbps",
          },
          subscribedAppIds: ["1"],
          totalEarned: 320.15,
          uptime: 78.4,
          location: "Mobile",
        },
      ],
    },
    attestationCapabilitiesByMinerId: {
      [demoMiner.id]: { tpm: true, tee: true, sgx: false },
    },
    minerReputationByMinerId: {
      [demoMiner.id]: 4.6,
    },
    developerVerificationByAddress: {
      [demoMiner.walletAddress]: {
        walletAddress: demoMiner.walletAddress,
        status: "verified",
        requestedAt: createdAt,
        reviewedAt: createdAt,
      } satisfies DeveloperVerificationRecord,
      "0xBTC...core": { walletAddress: "0xBTC...core", status: "verified", requestedAt: "2009-01-03", reviewedAt: "2009-01-03" } satisfies DeveloperVerificationRecord,
      "0xETH...found": { walletAddress: "0xETH...found", status: "verified", requestedAt: "2015-07-30", reviewedAt: "2015-07-30" } satisfies DeveloperVerificationRecord,
      "0xXMR...proj": { walletAddress: "0xXMR...proj", status: "verified", requestedAt: "2014-04-18", reviewedAt: "2014-04-18" } satisfies DeveloperVerificationRecord,
    },
    developerEnrollmentByAddress: {
      [demoMiner.walletAddress]: {
        walletAddress: demoMiner.walletAddress,
        status: "active",
        submittedAt: createdAt,
        reviewedAt: createdAt,
        displayName: "Demo Developer",
      } satisfies DeveloperEnrollmentRecord,
      "0xBTC...core": {
        walletAddress: "0xBTC...core", status: "active", submittedAt: "2009-01-03", reviewedAt: "2009-01-03",
        displayName: "Bitcoin Core", logo: "/logos/bitcoin.svg",
        bio: "Open-source software that serves as a Bitcoin node and provides a Bitcoin wallet. Maintained by hundreds of contributors worldwide since 2009.",
        website: "https://bitcoin.org", location: "Decentralized", founded: "2009", category: "Blockchain",
        tags: ["Bitcoin", "PoW", "SHA-256", "Layer 1"],
        socialLinks: { twitter: "bitcoin", github: "bitcoin", discord: "", telegram: "" },
      } satisfies DeveloperEnrollmentRecord,
      "0xETH...found": {
        walletAddress: "0xETH...found", status: "active", submittedAt: "2015-07-30", reviewedAt: "2015-07-30",
        displayName: "Ethereum Foundation", logo: "/logos/ethereum.svg",
        bio: "A non-profit organization dedicated to supporting Ethereum and related technologies. Funds research, development, and education for the Ethereum ecosystem.",
        website: "https://ethereum.org", location: "Zug, Switzerland", founded: "2014", category: "Blockchain",
        tags: ["Ethereum", "PoS", "Smart Contracts", "EVM"],
        socialLinks: { twitter: "ethereum", github: "ethereum", discord: "", telegram: "" },
      } satisfies DeveloperEnrollmentRecord,
      "0xXMR...proj": {
        walletAddress: "0xXMR...proj", status: "active", submittedAt: "2014-04-18", reviewedAt: "2014-04-18",
        displayName: "Monero Project", logo: "/logos/monero.svg",
        bio: "A community-driven open-source project building private, censorship-resistant digital cash. Monero is maintained by a decentralized team of researchers and developers.",
        website: "https://getmonero.org", location: "Decentralized", founded: "2014", category: "Blockchain",
        tags: ["Monero", "Privacy", "RandomX", "CPU Mining"],
        socialLinks: { twitter: "monero", github: "monero-project", discord: "", telegram: "" },
      } satisfies DeveloperEnrollmentRecord,
    },
    governanceStakesByAddress: {
      [demoMiner.walletAddress]: { total: 25_000, locked: 0, available: 25_000 },
    },
    governanceVoteStakes: {},
    governanceReviewerStakes: {},
    governanceRewards: {},
    governanceStakeHistory: [] as GovernanceStakeEvent[],
    governanceDelegations: [] as GovernanceDelegation[],
    proposalComments: [] as ProposalComment[],
    treasuryTransactions: [] as TreasuryTransaction[],
    webhookLogsByAppId: {} as Record<string, WebhookLogEntry[]>,
    deploymentLogsByAppId: {} as Record<string, DeploymentLog[]>,
    announcementsByAppId: {} as Record<string, Announcement[]>,
    minerTiersByAppId: {} as Record<string, any>,
    supportTicketsByAppId: {} as Record<string, SupportTicket[]>,
    testnetSessionsByAppId: {} as Record<string, TestnetSession[]>,
    treasuryBalance: 0,
    slashingEvents: [] as SlashingEvent[],
    badgesByMinerId: {
      [demoMiner.id]: [] as MinerBadge[],
    },
    operatorMiners,
    operatorGroups,
    operatorDeployments: [],
    operatorAutomationRules: [
      {
        id: "rule-uptime",
        name: "Auto-pause miners with downtime",
        enabled: true,
        trigger: "downtime",
        action: "pause",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "rule-reputation",
        name: "Auto-suspend low reputation",
        enabled: true,
        trigger: "low_reputation",
        action: "pause",
        createdAt,
        updatedAt: createdAt,
      },
    ],
  }
}

export class MockBackendStore {
  private state: MockBackendState
  private listeners = new Set<Listener>()
  private hydratedFromStorage = false

  constructor() {
    // IMPORTANT: keep SSR + initial client render deterministic.
    // We hydrate from localStorage after mount to avoid hydration mismatches.
    this.state = bootstrapState()
  }

  hydrateFromStorageOnce() {
    if (this.hydratedFromStorage) return
    this.hydratedFromStorage = true
    if (typeof window === "undefined") return

    const existing = safeParse<MockBackendState>(window.localStorage.getItem(STORAGE_KEY))
    if (existing?.version === 1) {
      this.setState(() => this.normalize(existing))
      return
    }

    // First visit: persist the bootstrap state so future loads have a snapshot.
    this.persist()
  }

  private normalize(input: MockBackendState): MockBackendState {
    // Lightweight migrations for older saved demo states.
    const demoMiner = ensureDefaultMiner()

    // Ensure apps and listing-status are consistent + IDs are unique.
    const listingStatusByAppId = {
      ...(input.listingStatusByAppId ?? {}),
    } as Record<string, AppListingStatus>

    // Merge: start with saved apps, then add any new mockApps not already present.
    // Always prefer mock data icons/screenshots over stale localStorage versions.
    const savedApps: App[] =
      Array.isArray((input as any).apps) && (input as any).apps.length > 0 ? ((input as any).apps as App[]) : []
    const mockById = new Map(mockApps.map((a) => [String(a.id), a]))
    const mergedSaved = savedApps.map((a) => {
      const fresh = mockById.get(String(a.id))
      if (fresh) return { ...a, icon: fresh.icon, screenshots: (fresh as any).screenshots }
      return a
    })
    const savedIds = new Set(mergedSaved.map((a) => String(a.id)))
    const newApps = mockApps.filter((a) => !savedIds.has(String(a.id)))
    const rawApps: App[] = [...mergedSaved, ...newApps]

    const migratedApps = rawApps.map((a) => {
      const nextId = legacyRemapAppId(a)
      const next = nextId !== a.id ? { ...a, id: nextId } : a
      if (nextId !== a.id) {
        const prevStatus = listingStatusByAppId[a.id]
        if (prevStatus && !listingStatusByAppId[nextId]) listingStatusByAppId[nextId] = prevStatus
      }
      return ensureAppAttestationDefaults(normalizeAppMedia(next))
    })

    const apps = dedupeAppsById(migratedApps)
    for (const a of apps) {
      if (!listingStatusByAppId[a.id]) listingStatusByAppId[a.id] = "listed"
    }

    const miners: Miner[] =
      Array.isArray((input as any).miners) && (input as any).miners.length > 0
        ? ((input as any).miners as Miner[]).map((m) => ({
            id: m.id,
            walletAddress: m.walletAddress,
            label: m.label,
            createdAt: m.createdAt ?? input.createdAt,
            updatedAt: m.updatedAt ?? input.updatedAt,
          }))
        : [demoMiner]

    const walletBalancesByAddress = {
      ...(input.walletBalancesByAddress ?? {}),
    } as Record<string, number>

    // Ensure every miner has a balance entry (so wallet UIs are consistent).
    for (const m of miners) {
      if (typeof walletBalancesByAddress[m.walletAddress] !== "number") walletBalancesByAddress[m.walletAddress] = 0
    }

    const events: TimelineEvent[] =
      Array.isArray((input as any).events) ? (((input as any).events as TimelineEvent[]) ?? []) : []

    const governance: GovernanceDecision[] = Array.isArray((input as any).governance)
      ? ((input as any).governance as GovernanceDecision[]).map((g) => ({
          ...g,
          status: (g as any).status === "pending" ? ("review" as const) : g.status,
          requiredReviews: (g as any).requiredReviews ?? 3,
        }))
      : []

    const appReports: AppReport[] = Array.isArray((input as any).appReports) ? (((input as any).appReports as AppReport[]) ?? []) : []
    const moderationCases: ModerationCase[] = Array.isArray((input as any).moderationCases)
      ? (((input as any).moderationCases as ModerationCase[]) ?? [])
      : []
    const attestationOracleByAppId: Record<string, AttestationOracleSubmission> = {
      ...(((input as any).attestationOracleByAppId ?? {}) as Record<string, any>),
    }
    const miningPackageReleasesByAppId: Record<string, MiningPackageRelease[]> = {
      ...(((input as any).miningPackageReleasesByAppId ?? {}) as Record<string, any>),
    }
    const activeMiningPackageReleaseIdByAppId: Record<string, string> = {
      ...(((input as any).activeMiningPackageReleaseIdByAppId ?? {}) as Record<string, any>),
    }

    // Demo UX: ensure Governance listing queue is never empty.
    let nextGovernance = governance
    let nextListingStatusByAppId = listingStatusByAppId
    if (nextGovernance.length === 0) {
      const seeded = seedGovernanceListingQueue({ apps, listingStatusByAppId, createdAt: input.createdAt ?? nowIso() })
      if (seeded.governance.length > 0) {
        nextGovernance = seeded.governance
        nextListingStatusByAppId = seeded.listingStatusByAppId
      }
    }

    // Enrollment migration: if a wallet already has developer role but no enrollment record, treat as enrolled.
    const developerEnrollmentByAddress = { ...(((input as any).developerEnrollmentByAddress ?? {}) as Record<string, any>) }
    for (const [addr, roles] of Object.entries((input as any).rolesByWalletAddress ?? {})) {
      if (Array.isArray(roles) && roles.includes("developer") && !developerEnrollmentByAddress[addr]) {
        developerEnrollmentByAddress[addr] = {
          walletAddress: addr,
          status: "active",
          submittedAt: input.createdAt ?? nowIso(),
          reviewedAt: input.createdAt ?? nowIso(),
        } satisfies DeveloperEnrollmentRecord
      }
    }

    // If enrollment is active but developer role is missing, grant it for compatibility.
    const rolesByWalletAddress = { ...(((input as any).rolesByWalletAddress ?? {}) as Record<string, any>) }
    for (const [addr, rec] of Object.entries(developerEnrollmentByAddress)) {
      if ((rec as any)?.status !== "active") continue
      const roles = Array.isArray(rolesByWalletAddress[addr]) ? rolesByWalletAddress[addr] : []
      if (!roles.includes("developer")) rolesByWalletAddress[addr] = [...roles, "developer"]
    }

    return {
      ...input,
      session: (input as any).session ?? { walletAddress: null, minerId: null },
      rolesByWalletAddress,
      apps,
      listingStatusByAppId: nextListingStatusByAppId,
      miners,
      walletBalancesByAddress,
      events,
      governance: nextGovernance,
      // Migrations: older saved states may not have this map.
      deployPipelinesByAppId: (input as any).deployPipelinesByAppId ?? {},
      watchlistByMinerId: (input as any).watchlistByMinerId ?? {},
      recentSearchesByMinerId: (input as any).recentSearchesByMinerId ?? {},
      savedWithdrawalAddressesByMinerId: (input as any).savedWithdrawalAddressesByMinerId ?? {},
      curatedCollections: (input as any).curatedCollections ?? bootstrapCuratedCollections(input.createdAt ?? nowIso()),
      createNetworkDraftByDeveloperId: (input as any).createNetworkDraftByDeveloperId ?? {},
      productPageByAppId: (input as any).productPageByAppId ?? {},
      testnetByAppId: (input as any).testnetByAppId ?? {},
      governanceReviews: (input as any).governanceReviews ?? [],
      governanceProposals: (input as any).governanceProposals ?? bootstrapGovernanceProposals(input.createdAt ?? nowIso()),
      appReports,
      moderationCases,
      attestationOracleByAppId,
      miningPackageReleasesByAppId,
      activeMiningPackageReleaseIdByAppId,
      hardwareProfileByMinerId: (input as any).hardwareProfileByMinerId ?? {},
      devicesByMinerId: (() => {
        const saved = (input as any).devicesByMinerId ?? {}
        const bootstrap = bootstrapState().devicesByMinerId ?? {}
        const merged = { ...saved }
        // Copy bootstrap devices to every known miner that has no devices
        const bootstrapDevices = Object.values(bootstrap).flat() as any[]
        if (bootstrapDevices.length > 0) {
          // Find the current miner from the session or miners list
          const currentMinerId = (input as any).session?.minerId ?? miners[0]?.id ?? demoMiner.id
          if (!merged[currentMinerId] || (merged[currentMinerId] as any[]).length === 0) {
            // Give current miner the bootstrap devices (with updated minerId)
            merged[currentMinerId] = bootstrapDevices.map((d: any) => ({ ...d, minerId: currentMinerId }))
          }
        }
        return merged
      })(),
      attestationCapabilitiesByMinerId: (input as any).attestationCapabilitiesByMinerId ?? {},
      minerReputationByMinerId: (input as any).minerReputationByMinerId ?? {},
      developerVerificationByAddress: (input as any).developerVerificationByAddress ?? {},
      developerEnrollmentByAddress,
      payouts: (input as any).payouts ?? [],
      treasuryBalance: (input as any).treasuryBalance ?? 0,
      slashingEvents: (input as any).slashingEvents ?? [],
      badgesByMinerId: (input as any).badgesByMinerId ?? {},
      governanceStakesByAddress: (input as any).governanceStakesByAddress ?? {},
      governanceVoteStakes: (input as any).governanceVoteStakes ?? {},
      governanceReviewerStakes: (input as any).governanceReviewerStakes ?? {},
      governanceRewards: (input as any).governanceRewards ?? {},
      governanceStakeHistory: (input as any).governanceStakeHistory ?? [],
      governanceDelegations: (input as any).governanceDelegations ?? [],
      proposalComments: (input as any).proposalComments ?? [],
      treasuryTransactions: (input as any).treasuryTransactions ?? [],
      webhookLogsByAppId: (input as any).webhookLogsByAppId ?? {},
      deploymentLogsByAppId: (input as any).deploymentLogsByAppId ?? {},
      announcementsByAppId: (input as any).announcementsByAppId ?? {},
      minerTiersByAppId: (input as any).minerTiersByAppId ?? {},
      supportTicketsByAppId: (input as any).supportTicketsByAppId ?? {},
      testnetSessionsByAppId: (input as any).testnetSessionsByAppId ?? {},
      operatorMiners: (input as any).operatorMiners ?? [],
      operatorGroups: (input as any).operatorGroups ?? [],
      operatorDeployments: (input as any).operatorDeployments ?? [],
      operatorAutomationRules: (input as any).operatorAutomationRules ?? [],
      updatedAt: input.updatedAt ?? nowIso(),
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState() {
    return this.state
  }

  // ---------- Moderation / reporting ----------
  listAppReports(input?: { appId?: string; limit?: number }) {
    const appId = input?.appId ? String(input.appId) : null
    const limit = Math.max(1, Math.min(200, input?.limit ?? 50))
    const all = this.state.appReports ?? []
    const filtered = appId ? all.filter((r) => r.appId === appId) : all
    return filtered.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit)
  }

  listModerationCases(input?: { status?: ModerationCase["status"]; limit?: number }) {
    const limit = Math.max(1, Math.min(200, input?.limit ?? 50))
    const all = this.state.moderationCases ?? []
    const filtered = input?.status ? all.filter((c) => c.status === input.status) : all
    return filtered.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit)
  }

  submitAppReport(input: {
    appId: string
    category: AppReportCategory
    severity: AppReportSeverity
    reason: string
  }) {
    const session = this.requireSession()
    const appId = String(input.appId)
    const category = input.category
    const severity = input.severity
    const reason = (input.reason ?? "").trim()
    if (!appId) return null
    if (!reason) throw new Error("Please include a short reason for the report.")

    const now = nowIso()
    const report: AppReport = {
      id: randId("report"),
      appId,
      reporterMinerId: session.minerId!,
      reporterWalletAddress: session.walletAddress!,
      category,
      severity,
      reason: reason.slice(0, 1200),
      createdAt: now,
    }

    this.setState((prev) => {
      const appReports = [report, ...(prev.appReports ?? [])]
      const existing = (prev.moderationCases ?? []).find((c) => c.appId === appId && c.status === "open") ?? null
      const requiredVotes = 3
      const caseId = existing?.id ?? `case_${appId}`
      const next: ModerationCase = existing
        ? {
            ...existing,
            updatedAt: now,
            reportIds: Array.from(new Set([report.id, ...existing.reportIds])),
            reportCount: (existing.reportCount ?? existing.reportIds.length) + 1,
            lastReportedAt: now,
          }
        : {
            id: caseId,
            appId,
            status: "open",
            createdAt: now,
            updatedAt: now,
            reportIds: [report.id],
            reportCount: 1,
            lastReportedAt: now,
            keepVotes: 0,
            delistVotes: 0,
            requiredVotes,
            keepVoters: [],
            delistVoters: [],
          }

      const without = (prev.moderationCases ?? []).filter((c) => c.id !== next.id)
      return { ...prev, appReports, moderationCases: [next, ...without], updatedAt: now }
    })

    this.emit({
      type: "app_reported",
      appId,
      minerId: session.minerId!,
      walletAddress: session.walletAddress!,
      message: `App reported (${category}, ${severity}).`,
      metadata: { category, severity },
    })

    return report
  }

  castModerationVote(input: { appId: string; voterId: string; direction: "keep" | "delist" }) {
    const { walletAddress } = this.requireRole("governance")
    const voterId = input.voterId.trim()
    if (!voterId) return
    if (voterId !== walletAddress) throw new Error("Forbidden (voter mismatch).")
    const appId = String(input.appId)
    if (!appId) return

    const now = nowIso()
    this.setState((prev) => {
      const existing = (prev.moderationCases ?? []).find((c) => c.appId === appId && c.status === "open") ?? null
      if (!existing) return prev

      const inKeep = existing.keepVoters.includes(voterId)
      const inDelist = existing.delistVoters.includes(voterId)

      let keepVotes = existing.keepVotes
      let delistVotes = existing.delistVotes
      let keepVoters = existing.keepVoters
      let delistVoters = existing.delistVoters

      if (input.direction === "keep") {
        if (inKeep) {
          keepVotes = Math.max(0, keepVotes - 1)
          keepVoters = keepVoters.filter((x) => x !== voterId)
        } else {
          if (inDelist) {
            delistVotes = Math.max(0, delistVotes - 1)
            delistVoters = delistVoters.filter((x) => x !== voterId)
          }
          keepVotes = keepVotes + 1
          keepVoters = [...keepVoters, voterId]
        }
      } else {
        if (inDelist) {
          delistVotes = Math.max(0, delistVotes - 1)
          delistVoters = delistVoters.filter((x) => x !== voterId)
        } else {
          if (inKeep) {
            keepVotes = Math.max(0, keepVotes - 1)
            keepVoters = keepVoters.filter((x) => x !== voterId)
          }
          delistVotes = delistVotes + 1
          delistVoters = [...delistVoters, voterId]
        }
      }

      let status: ModerationCase["status"] = existing.status
      let decidedAt: string | undefined = existing.decidedAt
      let listingStatusByAppId = prev.listingStatusByAppId

      if (keepVotes >= existing.requiredVotes) {
        status = "resolved_keep"
        decidedAt = now
      }
      if (delistVotes >= existing.requiredVotes) {
        status = "resolved_delist"
        decidedAt = now
        listingStatusByAppId = { ...prev.listingStatusByAppId, [appId]: "delisted" as const }
      }

      const updated: ModerationCase = { ...existing, keepVotes, delistVotes, keepVoters, delistVoters, status, decidedAt, updatedAt: now }
      const moderationCases = (prev.moderationCases ?? []).map((c) => (c.id === existing.id ? updated : c))
      return { ...prev, moderationCases, listingStatusByAppId, updatedAt: now }
    })

    const next = (this.state.moderationCases ?? []).find((c) => c.appId === appId) ?? null
    if (next && (next.status === "resolved_keep" || next.status === "resolved_delist")) {
      this.emit({
        type: "moderation_case_resolved",
        appId,
        walletAddress: voterId,
        message: next.status === "resolved_delist" ? "Moderation: delisted by DAO vote." : "Moderation: kept by DAO vote.",
        metadata: { status: next.status },
      })
    }
  }

  private setState(updater: (prev: MockBackendState) => MockBackendState) {
    this.state = updater(this.state)
    this.persist()
    for (const l of this.listeners) l()
  }

  private persist() {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      // ignore storage quota errors in demo environments
    }
  }

  // ---------- Attestation Oracle ----------
  getAttestationOracle(appId: string) {
    return this.state.attestationOracleByAppId?.[String(appId)] ?? null
  }

  submitAttestationOracle(input: { appId: string; codeHash?: string; runtimeDigest?: string }) {
    const { walletAddress } = this.requireRole("developer")
    const appId = String(input.appId)
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    if (!app) throw new Error("App not found.")
    if ((app.developerAddress ?? "") !== walletAddress) throw new Error("Forbidden (not the app owner).")

    const now = nowIso()
    const pipeline = this.state.deployPipelinesByAppId?.[appId] ?? null
    const runtimeDigest = (input.runtimeDigest ?? pipeline?.pinnedDigest ?? "").trim() || undefined
    const codeHash =
      (input.codeHash ?? "").trim() ||
      fakeCodeHash([appId, app.name, runtimeDigest ?? "no-digest", app.verificationMethod ?? "unknown"])

    this.setState((prev) => ({
      ...prev,
      attestationOracleByAppId: {
        ...(prev.attestationOracleByAppId ?? {}),
        [appId]: {
          appId,
          status: "pending",
          submittedAt: now,
          verifiedAt: prev.attestationOracleByAppId?.[appId]?.verifiedAt,
          codeHash,
          runtimeDigest,
        },
      },
      updatedAt: now,
    }))

    this.emit({
      type: "attestation_oracle_submitted",
      appId,
      walletAddress,
      message: `AttestationOracle submission created for ${app.name}.`,
      metadata: { codeHash, runtimeDigest },
    })

    // Demo: auto-verify after a short delay.
    setTimeout(() => {
      try {
        const cur = this.state.attestationOracleByAppId?.[appId] ?? null
        if (!cur || cur.status !== "pending") return
        const verifiedAt = nowIso()
        this.setState((prev) => ({
          ...prev,
          attestationOracleByAppId: {
            ...(prev.attestationOracleByAppId ?? {}),
            [appId]: { ...cur, status: "verified", verifiedAt, notes: "Verified (demo auto-approval)." },
          },
          updatedAt: verifiedAt,
        }))
        this.emit({
          type: "attestation_oracle_verified",
          appId,
          walletAddress,
          message: `AttestationOracle verified ${app.name} (demo).`,
          metadata: { codeHash: cur.codeHash, runtimeDigest: cur.runtimeDigest },
        })
      } catch {
        // ignore demo timer errors
      }
    }, 5000)

    return { appId, codeHash, runtimeDigest }
  }

  // ---------- Mining Package ----------
  listMiningPackageReleases(appId: string): MiningPackageRelease[] {
    return Array.isArray(this.state.miningPackageReleasesByAppId?.[String(appId)])
      ? (this.state.miningPackageReleasesByAppId[String(appId)] ?? [])
      : []
  }

  getActiveMiningPackageRelease(appId: string): MiningPackageRelease | null {
    const id = this.state.activeMiningPackageReleaseIdByAppId?.[String(appId)] ?? ""
    if (!id) return null
    return this.listMiningPackageReleases(appId).find((r) => r.id === id) ?? null
  }

  uploadMiningPackageRelease(input: {
    appId: string
    kind: MiningPackageKind
    version: string
    image?: string
    digest?: string
    vmImageUrl?: string
    entrypoint?: string
    env?: Record<string, string>
    notes?: string
    setActive?: boolean
  }) {
    const { walletAddress } = this.requireRole("developer")
    const appId = String(input.appId)
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    if (!app) throw new Error("App not found.")
    if ((app.developerAddress ?? "") !== walletAddress) throw new Error("Forbidden (not the app owner).")
    const version = String(input.version ?? "").trim()
    if (!version) throw new Error("Version is required.")
    const kind = input.kind
    const now = nowIso()
    const release: MiningPackageRelease = {
      id: randId("pkg"),
      appId,
      kind,
      version,
      createdAt: now,
      uploadedByWalletAddress: walletAddress,
      image: (input.image ?? "").trim() || undefined,
      digest: (input.digest ?? "").trim() || undefined,
      vmImageUrl: (input.vmImageUrl ?? "").trim() || undefined,
      entrypoint: (input.entrypoint ?? "").trim() || undefined,
      env: input.env ?? undefined,
      notes: (input.notes ?? "").trim() || undefined,
    }

    this.setState((prev) => {
      const cur = Array.isArray(prev.miningPackageReleasesByAppId?.[appId]) ? (prev.miningPackageReleasesByAppId[appId] ?? []) : []
      const next = [release, ...cur].slice(0, 25)
      return {
        ...prev,
        miningPackageReleasesByAppId: { ...(prev.miningPackageReleasesByAppId ?? {}), [appId]: next },
        activeMiningPackageReleaseIdByAppId: input.setActive
          ? { ...(prev.activeMiningPackageReleaseIdByAppId ?? {}), [appId]: release.id }
          : (prev.activeMiningPackageReleaseIdByAppId ?? {}),
        updatedAt: now,
      }
    })

    this.emit({
      type: "mining_package_uploaded",
      appId,
      walletAddress,
      message: `Mining package ${version} uploaded (${kind}).`,
      metadata: { kind, version, digest: release.digest },
    })

    if (input.setActive) {
      this.emit({
        type: "mining_package_activated",
        appId,
        walletAddress,
        message: `Mining package ${version} set active.`,
        metadata: { kind, version, releaseId: release.id },
      })
    }

    return release
  }

  setActiveMiningPackageRelease(input: { appId: string; releaseId: string }) {
    const { walletAddress } = this.requireRole("developer")
    const appId = String(input.appId)
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    if (!app) throw new Error("App not found.")
    if ((app.developerAddress ?? "") !== walletAddress) throw new Error("Forbidden (not the app owner).")

    const release = this.listMiningPackageReleases(appId).find((r) => r.id === input.releaseId) ?? null
    if (!release) throw new Error("Release not found.")

    const now = nowIso()
    this.setState((prev) => ({
      ...prev,
      activeMiningPackageReleaseIdByAppId: { ...(prev.activeMiningPackageReleaseIdByAppId ?? {}), [appId]: release.id },
      updatedAt: now,
    }))
    this.emit({
      type: "mining_package_activated",
      appId,
      walletAddress,
      message: `Mining package ${release.version} set active.`,
      metadata: { kind: release.kind, version: release.version, releaseId: release.id },
    })
    return release
  }

  // ---------- AuthZ helpers (prototype) ----------
  private requireSession() {
    const walletAddress = this.state.session?.walletAddress ?? null
    const minerId = this.state.session?.minerId ?? null
    if (!walletAddress || !minerId) throw new Error("Authentication required (connect wallet).")
    return { walletAddress, minerId }
  }

  private hasRole(walletAddress: string, role: "miner" | "developer" | "governance" | "operator") {
    const roles = this.state.rolesByWalletAddress?.[walletAddress] ?? []
    return roles.includes(role)
  }

  private requireRole(role: "miner" | "developer" | "governance" | "operator") {
    const { walletAddress } = this.requireSession()
    if (!this.hasRole(walletAddress, role)) throw new Error(`Forbidden (requires ${role} role).`)
    return { walletAddress }
  }

  grantRole(walletAddress: string, role: "miner" | "developer" | "governance" | "operator") {
    this.setState((prev) => {
      const rolesByWalletAddress = { ...prev.rolesByWalletAddress }
      const existing = rolesByWalletAddress[walletAddress] ?? []
      if (!existing.includes(role)) {
        rolesByWalletAddress[walletAddress] = [...existing, role]
      }
      return { ...prev, rolesByWalletAddress, updatedAt: nowIso() }
    })
  }

  setSession(input: { walletAddress: string; minerId: string }) {
    this.setState((prev) => ({
      ...prev,
      session: { walletAddress: input.walletAddress, minerId: input.minerId },
      updatedAt: nowIso(),
    }))
  }

  clearSession() {
    this.setState((prev) => ({
      ...prev,
      session: { walletAddress: null, minerId: null },
      updatedAt: nowIso(),
    }))
  }

  listRoles(walletAddress: string) {
    return [...(this.state.rolesByWalletAddress?.[walletAddress] ?? [])]
  }

  setRoleEnabled(input: { walletAddress: string; role: "miner" | "developer" | "governance" | "operator"; enabled: boolean }) {
    const nextWallet = input.walletAddress.trim()
    if (!nextWallet) return
    this.setState((prev) => {
      const existing = prev.rolesByWalletAddress?.[nextWallet] ?? []
      const without = existing.filter((r) => r !== input.role)
      const next = input.enabled ? [...without, input.role] : without
      return { ...prev, rolesByWalletAddress: { ...(prev.rolesByWalletAddress ?? {}), [nextWallet]: next }, updatedAt: nowIso() }
    })
  }

  private emit(event: Omit<TimelineEvent, "id" | "createdAt"> & { type: EventType; createdAt?: string }) {
    const e: TimelineEvent = {
      id: randId("evt"),
      createdAt: event.createdAt ?? nowIso(),
      ...event,
    }
    this.setState((prev) => ({ ...prev, events: [e, ...prev.events].slice(0, 500), updatedAt: nowIso() }))
  }

  private collectConditions(appId: string) {
    const raw = this.state.governanceReviews
      .filter((r) => r.appId === appId && r.status === "submitted")
      .map((r) => (r.conditions ?? "").trim())
      .filter(Boolean)

    const lines = raw
      .flatMap((c) => c.split(/\r?\n/).map((x) => x.replace(/^\s*[-•]\s*/, "").trim()))
      .map((x) => x.trim())
      .filter(Boolean)

    // de-dupe case-insensitively, preserve order
    const out: string[] = []
    for (const l of lines) {
      if (out.some((x) => x.toLowerCase() === l.toLowerCase())) continue
      out.push(l)
    }
    return out.slice(0, 12)
  }

  private systemSuggestedConditions(appId: string) {
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    const out: string[] = []
    if (!app) return out

    // “App Review” style checks (prototype)
    const dev = (app.developerAddress ?? "").trim()
    const devStatus = dev ? this.state.developerVerificationByAddress?.[dev]?.status ?? "unverified" : "unverified"
    if (devStatus !== "verified") out.push("Developer verification required")

    // Ensure escrow runway looks sane (at least 7 days if configured).
    const escrow = typeof (app as any).escrowBalance === "number" ? Number((app as any).escrowBalance) : 0
    const daily = typeof (app as any).dailyEmission === "number" ? Number((app as any).dailyEmission) : 0
    const runwayDays = daily > 0 ? escrow / daily : null
    if (runwayDays != null && runwayDays < 7) out.push("Top up escrow to at least 7 days of runway")

    // Require non-placeholder icon for store listing.
    const icon = (app.icon ?? "").trim()
    if (!icon || icon.includes("placeholder")) out.push("Upload a production app icon (1024×1024)")

    return out
  }

  private openVoteIfReady(appId: string) {
    const decision = this.state.governance.find((g) => g.appId === appId) ?? null
    if (!decision || decision.status !== "review") return
    const requiredReviews = decision.requiredReviews ?? 3
    const submitted = this.state.governanceReviews.filter((r) => r.appId === appId && r.status === "submitted").length
    if (submitted < requiredReviews) return

    // App Store Connect-style: keep “review” short in demo.
    const voteEndsAt = new Date(Date.now() + 15_000).toISOString()
    this.setState((prev) => ({
      ...prev,
      governance: prev.governance.map((g) => (g.appId === appId ? { ...g, status: "voting" as const, voteEndsAt } : g)),
      updatedAt: nowIso(),
    }))

    setTimeout(() => this.finalizeVote(appId), 16_000)
  }

  private finalizeVote(appId: string) {
    const current = this.state.governance.find((g) => g.appId === appId) ?? null
    if (!current || current.status !== "voting") return

    const required = current.requiredAttestations ?? 3
    const yes = current.yesVotes
    const no = current.noVotes

    const conditions = this.collectConditions(appId)

    const outcome = yes >= required ? "approved" : no >= required ? "rejected" : yes > no ? "approved" : "rejected"

    // Brief execution phase to reflect “review → vote → execution”.
    this.setState((prev) => ({
      ...prev,
      governance: prev.governance.map((g) => (g.appId === appId ? { ...g, status: "executing" as const } : g)),
      updatedAt: nowIso(),
    }))

    setTimeout(() => {
      const deadline = conditions.length > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined

      this.setState((prev) => {
        const listingStatusByAppId =
          outcome === "approved"
            ? {
                ...prev.listingStatusByAppId,
                [appId]: conditions.length > 0 ? ("beta" as const) : ("listed" as const),
              }
            : { ...prev.listingStatusByAppId, [appId]: "delisted" as const }

        const governance = prev.governance.map((g) =>
          g.appId === appId
            ? {
                ...g,
                status: outcome as any,
                decidedAt: nowIso(),
                conditions: conditions.length > 0 ? conditions : [],
                conditionsDeadlineAt: outcome === "approved" && conditions.length > 0 ? deadline : undefined,
                reason:
                  outcome === "rejected"
                    ? g.reason ?? "Rejected by vote"
                    : conditions.length > 0
                      ? `Approved (beta) with conditions`
                      : g.reason,
              }
            : g,
        )
        return { ...prev, listingStatusByAppId, governance, updatedAt: nowIso() }
      })
    }, 1200)
  }

  reset() {
    this.setState(() => bootstrapState())
  }

  // ---------- Queries ----------
  listApps() {
    const s = this.state
    return dedupeAppsById(s.apps.filter((a) => s.listingStatusByAppId[a.id] === "listed" || s.listingStatusByAppId[a.id] === "beta"))
  }

  getAppById(id: string) {
    return this.state.apps.find((a) => a.id === id) || null
  }

  getListingStatus(appId: string) {
    return this.state.listingStatusByAppId[appId] ?? "draft"
  }

  listSubscriptions() {
    return [...this.state.subscriptions]
  }

  listSubscriptionsForApp(appId: string) {
    return this.state.subscriptions.filter((s) => s.appId === appId)
  }

  getMinerById(minerId: string) {
    return this.state.miners.find((m) => m.id === minerId) ?? null
  }

  getWalletBalance(walletAddress: string) {
    return this.state.walletBalancesByAddress[walletAddress] ?? 0
  }

  listEvents(opts?: { minerId?: string; appId?: string; limit?: number }) {
    const limit = Math.max(1, Math.min(500, opts?.limit ?? 100))
    return this.state.events
      .filter((e) => (opts?.minerId ? e.minerId === opts.minerId : true))
      .filter((e) => (opts?.appId ? e.appId === opts.appId : true))
      .slice(0, limit)
  }

  listCuratedCollections() {
    return [...(this.state.curatedCollections ?? [])]
  }

  getCuratedCollection(id: string) {
    return (this.state.curatedCollections ?? []).find((c) => c.id === id) ?? null
  }

  listPayouts(opts?: { minerId?: string; appId?: string; limit?: number }) {
    const limit = Math.max(1, Math.min(500, opts?.limit ?? 100))
    return (this.state.payouts ?? [])
      .filter((p) => (opts?.minerId ? p.minerId === opts.minerId : true))
      .filter((p) => (opts?.appId ? p.appId === opts.appId : true))
      .slice(0, limit)
  }

  listSlashingEvents(opts?: { minerId?: string; appId?: string; limit?: number }) {
    const limit = Math.max(1, Math.min(500, opts?.limit ?? 100))
    return (this.state.slashingEvents ?? [])
      .filter((s) => (opts?.minerId ? s.minerId === opts.minerId : true))
      .filter((s) => (opts?.appId ? s.appId === opts.appId : true))
      .slice(0, limit)
  }

  listBadges(minerId: string) {
    return this.state.badgesByMinerId?.[minerId] ?? []
  }

  submitReview(input: { appId: string; rating: number; comment: string }) {
    const { minerId } = this.requireAuth()
    const app = this.state.apps.find((a) => a.id === input.appId)
    if (!app) throw new Error("App not found.")
    if (input.rating < 1 || input.rating > 5) throw new Error("Rating must be 1-5.")
    if (!input.comment.trim()) throw new Error("Comment is required.")

    const existing = (app.reviews ?? []).find((r) => r.minerId === minerId)
    if (existing) throw new Error("You have already reviewed this project.")

    const review = {
      id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      minerId,
      minerUsername: minerId.replace("miner_", "Miner "),
      appId: input.appId,
      rating: input.rating,
      comment: input.comment.trim(),
      timestamp: nowIso(),
      helpful: 0,
    }

    this.setState((prev) => ({
      ...prev,
      apps: prev.apps.map((a) => {
        if (a.id !== input.appId) return a
        const reviews = [...(a.reviews ?? []), review]
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        return { ...a, reviews, averageRating: avg, reviewCount: reviews.length }
      }),
      updatedAt: nowIso(),
    }))

    return review
  }

  getDeveloperVerification(walletAddress: string) {
    return this.state.developerVerificationByAddress?.[walletAddress] ?? null
  }

  getDeveloperEnrollment(walletAddress: string) {
    return this.state.developerEnrollmentByAddress?.[walletAddress] ?? null
  }

  // ---------- Actions ----------
  listOperatorMiners() {
    return [...this.state.operatorMiners]
  }

  listOperatorGroups() {
    return [...this.state.operatorGroups]
  }

  listOperatorDeployments(limit = 50) {
    return this.state.operatorDeployments.slice(0, limit)
  }

  toggleAutomationRule(ruleId: string) {
    this.setState((prev) => ({
      ...prev,
      operatorAutomationRules: prev.operatorAutomationRules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled, updatedAt: nowIso() } : r)),
      updatedAt: nowIso(),
    }))
  }

  upsertCuratedCollection(input: { id?: string; kind: CuratedCollection["kind"]; title: string; description?: string; appIds: string[] }) {
    this.requireRole("governance")
    const now = nowIso()
    const id = input.id ?? randId("col")
    const next: CuratedCollection = {
      id,
      kind: input.kind,
      title: input.title.trim() || "Untitled collection",
      description: (input.description ?? "").trim() || undefined,
      appIds: Array.from(new Set(input.appIds.map((x) => String(x)).filter(Boolean))).slice(0, 25),
      createdAt: now,
      updatedAt: now,
    }
    this.setState((prev) => {
      const existing = (prev.curatedCollections ?? []).find((c) => c.id === id) ?? null
      const createdAt = existing?.createdAt ?? now
      const merged: CuratedCollection = { ...next, createdAt }
      const without = (prev.curatedCollections ?? []).filter((c) => c.id !== id)
      return { ...prev, curatedCollections: [merged, ...without], updatedAt: now }
    })
    return id
  }

  setCuratedCollectionApps(input: { collectionId: string; appIds: string[] }) {
    this.requireRole("governance")
    const now = nowIso()
    const appIds = Array.from(new Set(input.appIds.map((x) => String(x)).filter(Boolean))).slice(0, 25)
    this.setState((prev) => ({
      ...prev,
      curatedCollections: (prev.curatedCollections ?? []).map((c) =>
        c.id === input.collectionId ? { ...c, appIds, updatedAt: now } : c,
      ),
      updatedAt: now,
    }))
  }

  toggleCuratedCollectionApp(input: { collectionId: string; appId: string }) {
    this.requireRole("governance")
    const now = nowIso()
    this.setState((prev) => {
      const curatedCollections = (prev.curatedCollections ?? []).map((c) => {
        if (c.id !== input.collectionId) return c
        const exists = c.appIds.includes(input.appId)
        const appIds = exists ? c.appIds.filter((x) => x !== input.appId) : [input.appId, ...c.appIds]
        return { ...c, appIds: Array.from(new Set(appIds)).slice(0, 25), updatedAt: now }
      })
      return { ...prev, curatedCollections, updatedAt: now }
    })
  }

  requestDeveloperVerification(input: { walletAddress: string; notes?: string }) {
    const session = this.requireSession()
    const addr = input.walletAddress.trim()
    if (!addr) return
    if (addr !== session.walletAddress) throw new Error("Forbidden (wallet mismatch).")
    const now = nowIso()
    this.setState((prev) => {
      const existing = prev.developerVerificationByAddress?.[addr] ?? null
      const status =
        existing?.status === "verified" ? "verified" : "pending"
      const record: DeveloperVerificationRecord = {
        walletAddress: addr,
        status: status as any,
        requestedAt: existing?.requestedAt ?? now,
        reviewedAt: existing?.reviewedAt,
        notes: (input.notes ?? existing?.notes ?? "").trim() || undefined,
      }
      return {
        ...prev,
        developerVerificationByAddress: { ...(prev.developerVerificationByAddress ?? {}), [addr]: record },
        updatedAt: now,
      }
    })
    this.emit({
      type: "developer_verification_requested",
      walletAddress: addr,
      message: "Developer verification requested.",
      metadata: { notes: input.notes ?? "" },
    })

    // Demo: auto-verify after a short delay (so users can see the “approved” state).
    setTimeout(() => {
      try {
        const cur = this.state.developerVerificationByAddress?.[addr] ?? null
        if (!cur || cur.status !== "pending") return
        const reviewedAt = nowIso()
        this.setState((prev) => ({
          ...prev,
          developerVerificationByAddress: {
            ...(prev.developerVerificationByAddress ?? {}),
            [addr]: { ...cur, status: "verified", reviewedAt },
          },
          updatedAt: reviewedAt,
        }))
        this.emit({
          type: "developer_verification_approved",
          walletAddress: addr,
          message: "Developer verified (demo auto-approval).",
          metadata: { notes: "Auto-approved for prototype demo." },
        })
      } catch {
        // ignore demo timer errors
      }
    }, 5000)
  }

  reviewDeveloperVerification(input: { walletAddress: string; status: "verified" | "rejected"; notes?: string }) {
    this.requireRole("governance")
    const addr = input.walletAddress.trim()
    if (!addr) return
    const now = nowIso()
    this.setState((prev) => {
      const existing = prev.developerVerificationByAddress?.[addr] ?? null
      const record: DeveloperVerificationRecord = {
        walletAddress: addr,
        status: input.status,
        requestedAt: existing?.requestedAt ?? now,
        reviewedAt: now,
        notes: (input.notes ?? "").trim() || undefined,
      }
      return {
        ...prev,
        developerVerificationByAddress: { ...(prev.developerVerificationByAddress ?? {}), [addr]: record },
        updatedAt: now,
      }
    })
    this.emit({
      type: input.status === "verified" ? "developer_verification_approved" : "developer_verification_rejected",
      walletAddress: addr,
      message: input.status === "verified" ? "Developer verified." : "Developer verification rejected.",
      metadata: { notes: input.notes ?? "" },
    })
  }

  requestDeveloperEnrollment(input: { walletAddress: string; displayName?: string; email?: string; website?: string; reason?: string }) {
    const session = this.requireSession()
    const addr = input.walletAddress.trim()
    if (!addr) return
    if (addr !== session.walletAddress) throw new Error("Forbidden (wallet mismatch).")

    const now = nowIso()
    this.setState((prev) => {
      const existing = prev.developerEnrollmentByAddress?.[addr] ?? null
      const next: DeveloperEnrollmentRecord = {
        walletAddress: addr,
        status: "pending",
        submittedAt: existing?.submittedAt ?? now,
        reviewedAt: existing?.reviewedAt,
        displayName: (input.displayName ?? existing?.displayName ?? "").trim() || undefined,
        email: (input.email ?? existing?.email ?? "").trim() || undefined,
        website: (input.website ?? existing?.website ?? "").trim() || undefined,
        reason: (input.reason ?? existing?.reason ?? "").trim() || undefined,
      }
      return {
        ...prev,
        developerEnrollmentByAddress: { ...(prev.developerEnrollmentByAddress ?? {}), [addr]: next },
        updatedAt: now,
      }
    })

    this.emit({
      type: "developer_enrollment_requested",
      walletAddress: addr,
      message: "Developer enrollment requested.",
      metadata: { displayName: input.displayName ?? "", website: input.website ?? "" },
    })
  }

  saveDeveloperEnrollmentDraft(input: {
    walletAddress: string
    developerType?: DeveloperEnrollmentRecord["developerType"]
    agreementsAccepted?: boolean
    taxStatus?: DeveloperEnrollmentRecord["taxStatus"]
    bankingStatus?: DeveloperEnrollmentRecord["bankingStatus"]
    displayName?: string
    email?: string
    website?: string
    reason?: string
  }) {
    const session = this.requireSession()
    const addr = input.walletAddress.trim()
    if (!addr) return
    if (addr !== session.walletAddress) throw new Error("Forbidden (wallet mismatch).")

    const now = nowIso()
    this.setState((prev) => {
      const existing = prev.developerEnrollmentByAddress?.[addr] ?? null
      // Do not allow editing once approved.
      if (existing?.status === "active") return prev

      const next: DeveloperEnrollmentRecord = {
        walletAddress: addr,
        status: existing?.status ?? "none",
        submittedAt: existing?.submittedAt,
        reviewedAt: existing?.reviewedAt,
        developerType: input.developerType ?? existing?.developerType,
        agreementsAccepted: typeof input.agreementsAccepted === "boolean" ? input.agreementsAccepted : existing?.agreementsAccepted,
        agreementsAcceptedAt:
          typeof input.agreementsAccepted === "boolean" && input.agreementsAccepted
            ? existing?.agreementsAcceptedAt ?? now
            : existing?.agreementsAcceptedAt,
        taxStatus: input.taxStatus ?? existing?.taxStatus ?? "not_started",
        bankingStatus: input.bankingStatus ?? existing?.bankingStatus ?? "not_started",
        displayName: (input.displayName ?? existing?.displayName ?? "").trim() || undefined,
        email: (input.email ?? existing?.email ?? "").trim() || undefined,
        website: (input.website ?? existing?.website ?? "").trim() || undefined,
        reason: (input.reason ?? existing?.reason ?? "").trim() || undefined,
        notes: existing?.notes,
      }
      return {
        ...prev,
        developerEnrollmentByAddress: { ...(prev.developerEnrollmentByAddress ?? {}), [addr]: next },
        updatedAt: now,
      }
    })
  }

  /** Update developer profile fields (works even after enrollment is active) */
  saveDeveloperProfile(input: {
    walletAddress: string
    displayName?: string
    bio?: string
    website?: string
    location?: string
    founded?: string
    category?: string
    tags?: string[]
    socialLinks?: { twitter?: string; discord?: string; github?: string; telegram?: string }
  }) {
    const session = this.requireSession()
    const addr = input.walletAddress.trim()
    if (!addr) return
    if (addr !== session.walletAddress) throw new Error("Forbidden (wallet mismatch).")

    const now = nowIso()
    this.setState((prev) => {
      const existing = prev.developerEnrollmentByAddress?.[addr] ?? {
        walletAddress: addr,
        status: "active" as const,
      }

      const next: DeveloperEnrollmentRecord = {
        ...existing,
        displayName: input.displayName !== undefined ? (input.displayName.trim() || undefined) : existing.displayName,
        bio: input.bio !== undefined ? (input.bio.trim() || undefined) : existing.bio,
        website: input.website !== undefined ? (input.website.trim() || undefined) : existing.website,
        location: input.location !== undefined ? (input.location.trim() || undefined) : existing.location,
        founded: input.founded !== undefined ? (input.founded.trim() || undefined) : existing.founded,
        category: input.category !== undefined ? (input.category.trim() || undefined) : existing.category,
        tags: input.tags !== undefined ? input.tags.filter(Boolean) : existing.tags,
        socialLinks: input.socialLinks !== undefined ? {
          twitter: input.socialLinks.twitter?.trim() || undefined,
          discord: input.socialLinks.discord?.trim() || undefined,
          github: input.socialLinks.github?.trim() || undefined,
          telegram: input.socialLinks.telegram?.trim() || undefined,
        } : existing.socialLinks,
      }

      return {
        ...prev,
        developerEnrollmentByAddress: { ...(prev.developerEnrollmentByAddress ?? {}), [addr]: next },
        updatedAt: now,
      }
    })
  }

  submitDeveloperEnrollment(walletAddress: string) {
    const session = this.requireSession()
    const addr = walletAddress.trim()
    if (!addr) return
    if (addr !== session.walletAddress) throw new Error("Forbidden (wallet mismatch).")
    const now = nowIso()

    const cur = this.state.developerEnrollmentByAddress?.[addr] ?? null
    if (!cur) throw new Error("Please fill out your Developer Account first.")
    if (cur.status === "active") return

    const missing: string[] = []
    if (!cur.displayName) missing.push("Display name")
    if (!cur.email) missing.push("Email")
    if (!cur.agreementsAccepted) missing.push("Agreements")
    if (missing.length > 0) throw new Error(`Missing required items: ${missing.join(", ")}`)

    this.setState((prev) => {
      const existing = prev.developerEnrollmentByAddress?.[addr] ?? null
      if (!existing) return prev
      const next: DeveloperEnrollmentRecord = { ...existing, status: "pending", submittedAt: existing.submittedAt ?? now }
      return {
        ...prev,
        developerEnrollmentByAddress: { ...(prev.developerEnrollmentByAddress ?? {}), [addr]: next },
        updatedAt: now,
      }
    })

    this.emit({
      type: "developer_enrollment_requested",
      walletAddress: addr,
      message: "Developer enrollment submitted.",
      metadata: { displayName: cur.displayName ?? "", website: cur.website ?? "" },
    })

    // Demo: auto-approve after a short delay (so the portal becomes accessible quickly).
    setTimeout(() => {
      try {
        const current = this.state.developerEnrollmentByAddress?.[addr] ?? null
        if (!current || current.status !== "pending") return
        const now2 = nowIso()
        this.setState((prev) => {
          const existing = prev.developerEnrollmentByAddress?.[addr] ?? null
          if (!existing || existing.status !== "pending") return prev
          const next: DeveloperEnrollmentRecord = { ...existing, status: "active", reviewedAt: now2 }
          const roles = prev.rolesByWalletAddress?.[addr] ?? []
          return {
            ...prev,
            developerEnrollmentByAddress: { ...(prev.developerEnrollmentByAddress ?? {}), [addr]: next },
            rolesByWalletAddress: { ...(prev.rolesByWalletAddress ?? {}), [addr]: Array.from(new Set([...roles, "developer"])) as any },
            updatedAt: now2,
          }
        })
        this.emit({
          type: "developer_enrollment_approved",
          walletAddress: addr,
          message: "Developer enrollment approved (demo auto-approval).",
          metadata: { notes: "Auto-approved for prototype demo." },
        })
      } catch {
        // ignore demo timer errors
      }
    }, 5000)
  }

  reviewDeveloperEnrollment(input: { walletAddress: string; status: "active" | "rejected"; notes?: string }) {
    this.requireRole("governance")
    const addr = input.walletAddress.trim()
    if (!addr) return
    const now = nowIso()

    this.setState((prev) => {
      const existing = prev.developerEnrollmentByAddress?.[addr] ?? null
      const record: DeveloperEnrollmentRecord = {
        walletAddress: addr,
        status: input.status,
        submittedAt: existing?.submittedAt ?? now,
        reviewedAt: now,
        displayName: existing?.displayName,
        email: existing?.email,
        website: existing?.website,
        reason: existing?.reason,
        notes: (input.notes ?? "").trim() || undefined,
      }

      const developerEnrollmentByAddress = { ...(prev.developerEnrollmentByAddress ?? {}), [addr]: record }

      // If approved, also grant the developer role (so existing dev-only actions still work).
      const roles = prev.rolesByWalletAddress?.[addr] ?? []
      const rolesByWalletAddress =
        input.status === "active"
          ? { ...(prev.rolesByWalletAddress ?? {}), [addr]: Array.from(new Set([...roles, "developer"])) as any }
          : prev.rolesByWalletAddress

      return { ...prev, developerEnrollmentByAddress, rolesByWalletAddress, updatedAt: now }
    })

    this.emit({
      type: input.status === "active" ? "developer_enrollment_approved" : "developer_enrollment_rejected",
      walletAddress: addr,
      message: input.status === "active" ? "Developer enrollment approved." : "Developer enrollment rejected.",
      metadata: { notes: input.notes ?? "" },
    })
  }

  startOperatorDeployment(input: { groupId: string; appIds: string[] }) {
    this.requireRole("operator")
    const group = this.state.operatorGroups.find((g) => g.id === input.groupId)
    if (!group) return null

    const minerIds = group.minerIds.slice(0, 25) // keep demo bounded
    const id = randId("deploy")
    const createdAt = nowIso()

    const deployment: OperatorDeployment = {
      id,
      status: "running",
      progress: 5,
      createdAt,
      updatedAt: createdAt,
      targetGroupId: input.groupId,
      minerIds,
      appIds: input.appIds,
      logs: [
        `> Starting deployment to group "${group.name}" (${minerIds.length} miners)`,
        `> Apps: ${input.appIds.join(", ")}`,
      ],
    }

    this.setState((prev) => ({ ...prev, operatorDeployments: [deployment, ...prev.operatorDeployments], updatedAt: nowIso() }))

    const tick = () => {
      this.setState((prev) => {
        const d = prev.operatorDeployments.find((x) => x.id === id)
        if (!d || d.status !== "running") return prev
        const next = Math.min(100, d.progress + Math.floor(Math.random() * 18 + 8))
        const logs = [...d.logs]
        if (d.progress < 35 && next >= 35) logs.push("> Staggering rollouts across miners…")
        if (d.progress < 70 && next >= 70) logs.push("> Verifying health checks & attestation…")
        if (d.progress < 95 && next >= 95) logs.push("> Finalizing subscriptions…")
        const status = next >= 100 ? "complete" : "running"
        return {
          ...prev,
          operatorDeployments: prev.operatorDeployments.map((x) =>
            x.id === id ? { ...x, progress: next, status: status as any, updatedAt: nowIso(), logs: logs.slice(-24) } : x,
          ),
          updatedAt: nowIso(),
        }
      })

      const cur = this.state.operatorDeployments.find((x) => x.id === id)
      if (cur && cur.progress < 100) setTimeout(tick, 450 + Math.floor(Math.random() * 350))
      if (cur && cur.progress >= 100) {
        // On completion, create subscriptions (bounded).
        const appsToDeploy = input.appIds.slice(0, 3)
        for (const minerId of minerIds.slice(0, 15)) {
          const miner = this.state.miners.find((m) => m.id === minerId)
          for (const appId of appsToDeploy) {
            const exists = this.state.subscriptions.some((s) => s.minerId === minerId && s.appId === appId)
            if (!exists) this.subscribeToApp({ appId, minerId, walletAddress: miner?.walletAddress })
          }
        }
      }
    }
    setTimeout(tick, 500)

    return deployment
  }

  listGovernanceReviews(appId: string) {
    return this.state.governanceReviews.filter((r) => r.appId === appId)
  }

  getGovernanceReview(appId: string, reviewerId: string) {
    return this.state.governanceReviews.find((r) => r.appId === appId && r.reviewerId === reviewerId) ?? null
  }

  listGovernanceProposals() {
    return [...(this.state.governanceProposals ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  getGovernanceProposalById(id: string) {
    return (this.state.governanceProposals ?? []).find((p) => p.id === id) ?? null
  }

  createGovernanceProposal(input: { title: string; description: string; type: GovernanceProposal["type"]; createdBy: string; durationDays?: number; stakeAmount?: number }) {
    const { walletAddress } = this.requireRole("governance")
    if (input.createdBy !== walletAddress) throw new Error("Forbidden (createdBy mismatch).")

    // Determine required stake by proposal type
    const defaultStakes: Record<string, number> = {
      "parameter-update": 10,
      "reward-change": 25,
      treasury: 50,
    }
    const requiredStake = input.stakeAmount ?? defaultStakes[input.type] ?? 10
    const currentStake = this.state.governanceStakesByAddress[walletAddress] ?? { total: 0, locked: 0, available: 0 }
    // Auto-deposit from wallet if governance stake is insufficient
    if (currentStake.available < requiredStake) {
      const walletBal = this.state.walletBalancesByAddress[walletAddress] ?? 0
      const needed = requiredStake - currentStake.available
      if (walletBal >= needed) {
        this.depositGovernanceStake(walletAddress, needed)
      } else {
        throw new Error(`Insufficient balance. Need ${requiredStake} NECTA to stake. You have ${currentStake.available} staked + ${walletBal.toFixed(0)} in wallet.`)
      }
    }

    const now = nowIso()
    const durationDays = Math.max(1, Math.min(30, input.durationDays ?? 7))
    const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    const existing = this.state.governanceProposals ?? []
    const maxN = existing
      .map((p) => {
        const m = p.id.match(/^GP-(\d+)$/)
        return m ? Number(m[1]) : 0
      })
      .reduce((a, b) => Math.max(a, b), 0)

    const id = `GP-${maxN + 1}`

    const proposal: GovernanceProposal = {
      id,
      title: input.title.trim().slice(0, 140),
      description: input.description.trim().slice(0, 2000),
      type: input.type,
      status: "active",
      createdAt: now,
      endsAt,
      quorumPercent: 20,
      votesFor: 0,
      votesAgainst: 0,
      votersFor: [],
      votersAgainst: [],
      createdBy: input.createdBy,
    }

    this.setState((prev) => {
      const stake = prev.governanceStakesByAddress[walletAddress] ?? { total: 0, locked: 0, available: 0 }
      return {
        ...prev,
        governanceProposals: [proposal, ...(prev.governanceProposals ?? [])],
        governanceStakesByAddress: {
          ...prev.governanceStakesByAddress,
          [walletAddress]: {
            total: stake.total,
            locked: stake.locked + requiredStake,
            available: stake.available - requiredStake,
          },
        },
        updatedAt: nowIso(),
      }
    })

    return proposal
  }

  castGovernanceProposalVote(input: { proposalId: string; voterId: string; direction: "for" | "against"; vp?: number; stakeAmount?: number }) {
    const { walletAddress } = this.requireRole("governance")
    const voterId = input.voterId.trim()
    if (!voterId) return
    if (voterId !== walletAddress) throw new Error("Forbidden (voter mismatch).")

    // Vote power = stake amount (minimum 100 NECTA)
    const stakeAmount = Math.max(5, input.stakeAmount ?? input.vp ?? 5)
    const currentStake = this.state.governanceStakesByAddress[walletAddress] ?? { total: 0, locked: 0, available: 0 }

    // Check if this is a new vote (not toggling off an existing one)
    const proposal = (this.state.governanceProposals ?? []).find((x) => x.id === input.proposalId)
    const isAlreadyVoted = proposal?.votersFor.includes(voterId) || proposal?.votersAgainst.includes(voterId)
    if (!isAlreadyVoted && currentStake.available < stakeAmount) {
      // Auto-deposit from wallet
      const walletBal = this.state.walletBalancesByAddress[walletAddress] ?? 0
      const needed = stakeAmount - currentStake.available
      if (walletBal >= needed) {
        this.depositGovernanceStake(walletAddress, needed)
      } else {
        throw new Error(`Insufficient balance. Need ${stakeAmount} NECTA. You have ${currentStake.available} staked + ${walletBal.toFixed(0)} in wallet.`)
      }
    }

    const vp = stakeAmount

    this.setState((prev) => {
      const p = (prev.governanceProposals ?? []).find((x) => x.id === input.proposalId) ?? null
      if (!p || p.status !== "active") return prev

      const inFor = p.votersFor.includes(voterId)
      const inAgainst = p.votersAgainst.includes(voterId)

      let nextVotesFor = p.votesFor
      let nextVotesAgainst = p.votesAgainst
      let votersFor = p.votersFor
      let votersAgainst = p.votersAgainst

      // Track stake changes for this vote
      const prevVoteStakes = prev.governanceVoteStakes[input.proposalId] ?? {}
      const prevVoterStake = prevVoteStakes[voterId] ?? 0
      let nextVoteStakes = { ...prevVoteStakes }
      let stakeDelta = 0 // positive = lock more, negative = unlock

      // Toggle behavior:
      // - vote same direction again -> remove vote (unlock stake)
      // - vote opposite direction -> switch sides (keep stake locked)
      if (input.direction === "for") {
        if (inFor) {
          // Removing vote — use the previously recorded vp for this voter
          nextVotesFor = Math.max(0, nextVotesFor - prevVoterStake)
          votersFor = votersFor.filter((x) => x !== voterId)
          stakeDelta = -prevVoterStake
          delete nextVoteStakes[voterId]
        } else {
          if (inAgainst) {
            nextVotesAgainst = Math.max(0, nextVotesAgainst - prevVoterStake)
            votersAgainst = votersAgainst.filter((x) => x !== voterId)
            // Switching sides: no net stake change, just update the amount
            stakeDelta = vp - prevVoterStake
          } else {
            // New vote
            stakeDelta = vp
          }
          nextVotesFor = nextVotesFor + vp
          votersFor = [...votersFor, voterId]
          nextVoteStakes[voterId] = vp
        }
      } else {
        if (inAgainst) {
          nextVotesAgainst = Math.max(0, nextVotesAgainst - prevVoterStake)
          votersAgainst = votersAgainst.filter((x) => x !== voterId)
          stakeDelta = -prevVoterStake
          delete nextVoteStakes[voterId]
        } else {
          if (inFor) {
            nextVotesFor = Math.max(0, nextVotesFor - prevVoterStake)
            votersFor = votersFor.filter((x) => x !== voterId)
            stakeDelta = vp - prevVoterStake
          } else {
            stakeDelta = vp
          }
          nextVotesAgainst = nextVotesAgainst + vp
          votersAgainst = [...votersAgainst, voterId]
          nextVoteStakes[voterId] = vp
        }
      }

      // Auto-close when time passes (lightweight simulation).
      const ended = p.endsAt ? Date.now() >= new Date(p.endsAt).getTime() : false
      let status = p.status
      if (ended) {
        status = nextVotesFor >= nextVotesAgainst ? ("passed" as const) : ("rejected" as const)
      }

      const updated: GovernanceProposal = {
        ...p,
        votesFor: nextVotesFor,
        votesAgainst: nextVotesAgainst,
        votersFor,
        votersAgainst,
        status,
      }

      // Update governance stake balance
      const stake = prev.governanceStakesByAddress[walletAddress] ?? { total: 0, locked: 0, available: 0 }
      const updatedStake = stakeDelta !== 0
        ? {
            total: stake.total,
            locked: Math.max(0, stake.locked + stakeDelta),
            available: Math.max(0, stake.available - stakeDelta),
          }
        : stake

      // Record stake history event
      const stakeHistoryEvent: GovernanceStakeEvent | null = stakeDelta !== 0 ? {
        id: `gse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        address: walletAddress,
        type: stakeDelta > 0 ? "lock" : "unlock",
        amount: Math.abs(stakeDelta),
        reason: `${stakeDelta > 0 ? "Voted" : "Removed vote"} on proposal "${p.title}"`,
        proposalId: input.proposalId,
        createdAt: nowIso(),
        unlocksAt: p.endsAt,
      } : null

      return {
        ...prev,
        governanceProposals: (prev.governanceProposals ?? []).map((x) => (x.id === p.id ? updated : x)),
        governanceVoteStakes: { ...prev.governanceVoteStakes, [input.proposalId]: nextVoteStakes },
        governanceStakesByAddress: {
          ...prev.governanceStakesByAddress,
          [walletAddress]: updatedStake,
        },
        governanceStakeHistory: stakeHistoryEvent
          ? [...(prev.governanceStakeHistory ?? []), stakeHistoryEvent]
          : (prev.governanceStakeHistory ?? []),
        updatedAt: nowIso(),
      }
    })
  }

  getHardwareProfile(minerId: string): HardwareProfile | null {
    return this.state.hardwareProfileByMinerId?.[minerId] ?? null
  }

  upsertHardwareProfile(input: { minerId: string; profile: Partial<HardwareProfile> }) {
    const session = this.requireSession()
    if (input.minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    this.setState((prev) => {
      const existing = prev.hardwareProfileByMinerId?.[input.minerId] ?? null
      const next: HardwareProfile = {
        id: existing?.id ?? `hw_${input.minerId}`,
        minerId: input.minerId,
        ...existing,
        ...input.profile,
      }
      return {
        ...prev,
        hardwareProfileByMinerId: { ...(prev.hardwareProfileByMinerId ?? {}), [input.minerId]: next },
        updatedAt: nowIso(),
      }
    })
  }

  // ---------- Device management ----------
  listDevices(minerId: string): MinerDevice[] {
    const saved = this.state.devicesByMinerId?.[minerId]
    if (saved && saved.length > 0) return saved
    // Fallback: return demo devices for any miner that has none
    return [
      {
        id: "device-1",
        minerId,
        name: "Home Desktop",
        type: "desktop" as const,
        status: "online" as const,
        lastSeenAt: new Date().toISOString(),
        createdAt: "2025-11-15T00:00:00Z",
        hardware: { gpu: "NVIDIA RTX 4090", gpuVram: 24, cpu: "AMD Ryzen 9 7950X", cpuCores: 16, ram: "64GB DDR5", storage: "2TB NVMe", bandwidth: "500 Mbps" },
        subscribedAppIds: ["1", "2", "3"],
        totalEarned: 1240.50,
        uptime: 99.2,
        location: "Home Office",
      },
      {
        id: "device-2",
        minerId,
        name: "MacBook Pro",
        type: "laptop" as const,
        status: "idle" as const,
        lastSeenAt: new Date(Date.now() - 7200000).toISOString(),
        createdAt: "2026-01-08T00:00:00Z",
        hardware: { gpu: "Apple M3 Max", gpuVram: 36, cpu: "Apple M3 Max", cpuCores: 14, ram: "36GB Unified", storage: "1TB SSD", bandwidth: "200 Mbps" },
        subscribedAppIds: ["1"],
        totalEarned: 320.15,
        uptime: 78.4,
        location: "Mobile",
      },
    ]
  }

  getDevice(deviceId: string): MinerDevice | null {
    for (const devices of Object.values(this.state.devicesByMinerId ?? {})) {
      const found = devices.find((d) => d.id === deviceId)
      if (found) return found
    }
    return null
  }

  addDevice(input: {
    minerId: string
    name: string
    type: MinerDevice["type"]
    hardware: MinerDevice["hardware"]
    location?: string
  }): MinerDevice {
    const session = this.requireSession()
    if (input.minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    const now = nowIso()
    const device: MinerDevice = {
      id: randId("device"),
      minerId: input.minerId,
      name: input.name,
      type: input.type,
      status: "online",
      lastSeenAt: now,
      createdAt: now,
      hardware: input.hardware,
      subscribedAppIds: [],
      totalEarned: 0,
      uptime: 100,
      location: input.location,
    }
    this.setState((prev) => {
      const existing = prev.devicesByMinerId?.[input.minerId] ?? []
      return {
        ...prev,
        devicesByMinerId: { ...prev.devicesByMinerId, [input.minerId]: [...existing, device] },
        updatedAt: nowIso(),
      }
    })
    return device
  }

  updateDevice(
    deviceId: string,
    updates: Partial<Pick<MinerDevice, "name" | "type" | "hardware" | "status" | "location">>,
  ): void {
    const session = this.requireSession()
    this.setState((prev) => {
      const nextMap = { ...prev.devicesByMinerId }
      for (const [minerId, devices] of Object.entries(nextMap)) {
        const idx = devices.findIndex((d) => d.id === deviceId)
        if (idx !== -1) {
          if (minerId !== session.minerId) throw new Error("Forbidden (not your device).")
          const updated = { ...devices[idx], ...updates, lastSeenAt: nowIso() }
          const nextDevices = [...devices]
          nextDevices[idx] = updated
          nextMap[minerId] = nextDevices
          break
        }
      }
      return { ...prev, devicesByMinerId: nextMap, updatedAt: nowIso() }
    })
  }

  removeDevice(deviceId: string): void {
    const session = this.requireSession()
    this.setState((prev) => {
      const nextMap = { ...prev.devicesByMinerId }
      for (const [minerId, devices] of Object.entries(nextMap)) {
        const idx = devices.findIndex((d) => d.id === deviceId)
        if (idx !== -1) {
          if (minerId !== session.minerId) throw new Error("Forbidden (not your device).")
          nextMap[minerId] = devices.filter((d) => d.id !== deviceId)
          break
        }
      }
      return { ...prev, devicesByMinerId: nextMap, updatedAt: nowIso() }
    })
  }

  upsertGovernanceReview(input: Omit<GovernanceReview, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const { walletAddress } = this.requireRole("governance")
    if (input.reviewerId !== walletAddress) throw new Error("Forbidden (reviewer mismatch).")

    // Require 200 NECTA stake when submitting a review (not when saving drafts)
    const REVIEW_STAKE = 200
    if (input.status === "submitted") {
      const existingReview = this.state.governanceReviews.find((r) => r.appId === input.appId && r.reviewerId === input.reviewerId)
      const alreadyStaked = (this.state.governanceReviewerStakes[input.appId] ?? {})[input.reviewerId]
      if (!alreadyStaked && (!existingReview || existingReview.status !== "submitted")) {
        const currentStake = this.state.governanceStakesByAddress[walletAddress] ?? { total: 0, locked: 0, available: 0 }
        if (currentStake.available < REVIEW_STAKE) throw new Error(`Insufficient governance stake. Need ${REVIEW_STAKE} NECTA to submit a review, have ${currentStake.available} available.`)
      }
    }

    const now = nowIso()
    this.setState((prev) => {
      const existing = prev.governanceReviews.find((r) => r.appId === input.appId && r.reviewerId === input.reviewerId) ?? null
      const next: GovernanceReview = {
        id: existing?.id ?? input.id ?? randId("review"),
        appId: input.appId,
        reviewerId: input.reviewerId,
        status: input.status,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        submittedAt: input.submittedAt ?? existing?.submittedAt,
        overallScore: input.overallScore,
        securityRating: input.securityRating,
        economicFairness: input.economicFairness,
        technicalQuality: input.technicalQuality,
        compliance: input.compliance,
        recommendation: input.recommendation,
        comments: input.comments,
        conditions: input.conditions,
      }
      const without = prev.governanceReviews.filter((r) => !(r.appId === input.appId && r.reviewerId === input.reviewerId))

      // Lock stake on submission (only if not already staked for this review)
      let governanceStakesByAddress = prev.governanceStakesByAddress
      let governanceReviewerStakes = prev.governanceReviewerStakes
      const alreadyStaked = (prev.governanceReviewerStakes[input.appId] ?? {})[input.reviewerId]
      if (input.status === "submitted" && !alreadyStaked && (!existing || existing.status !== "submitted")) {
        const stake = prev.governanceStakesByAddress[walletAddress] ?? { total: 0, locked: 0, available: 0 }
        governanceStakesByAddress = {
          ...prev.governanceStakesByAddress,
          [walletAddress]: {
            total: stake.total,
            locked: stake.locked + REVIEW_STAKE,
            available: stake.available - REVIEW_STAKE,
          },
        }
        governanceReviewerStakes = {
          ...prev.governanceReviewerStakes,
          [input.appId]: {
            ...(prev.governanceReviewerStakes[input.appId] ?? {}),
            [input.reviewerId]: REVIEW_STAKE,
          },
        }
      }

      return {
        ...prev,
        governanceReviews: [next, ...without],
        governanceStakesByAddress,
        governanceReviewerStakes,
        updatedAt: now,
      }
    })
    if (input.status === "submitted") this.openVoteIfReady(input.appId)
  }

  getTestnetStatus(appId: string): TestnetStatus | null {
    return this.state.testnetByAppId[appId] ?? null
  }

  runTestnet(appId: string) {
    const { walletAddress } = this.requireRole("developer")
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    if (app?.developerAddress && app.developerAddress !== walletAddress) throw new Error("Forbidden (not the app owner).")
    const start = nowIso()
    this.setState((prev) => ({
      ...prev,
      testnetByAppId: {
        ...prev.testnetByAppId,
        [appId]: {
          appId,
          status: "running",
          lastRunAt: start,
          logs: [
            "> Starting test job…",
            "> Pulling runtime artifact…",
            "> Running deterministic sample workload…",
            "> Submitting proof…",
          ],
        },
      },
      updatedAt: nowIso(),
    }))

    setTimeout(() => {
      const ok = Math.random() > 0.12
      this.setState((prev) => {
        const current = prev.testnetByAppId[appId]
        if (!current) return prev
        const logs = [...current.logs]
        logs.push(ok ? "> Test passed: proof verified." : "> Test failed: verifier rejected proof.")
        logs.push("> Test session complete.")
        return {
          ...prev,
          testnetByAppId: {
            ...prev.testnetByAppId,
            [appId]: { ...current, status: ok ? "passed" : "failed", logs: logs.slice(-24), lastRunAt: nowIso() },
          },
          updatedAt: nowIso(),
        }
      })
    }, 1400 + Math.floor(Math.random() * 1200))
  }

  getProductPage(appId: string) {
    const { walletAddress } = this.requireRole("developer")
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    if (app?.developerAddress && app.developerAddress !== walletAddress) throw new Error("Forbidden (not the app owner).")
    return this.state.productPageByAppId[appId] ?? null
  }

  saveProductPage(appId: string, data: Omit<ProductPageData, "appId" | "updatedAt">) {
    const { walletAddress } = this.requireRole("developer")
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    if (app?.developerAddress && app.developerAddress !== walletAddress) throw new Error("Forbidden (not the app owner).")
    this.setState((prev) => ({
      ...prev,
      productPageByAppId: {
        ...prev.productPageByAppId,
        [appId]: { appId, updatedAt: nowIso(), ...data },
      },
      updatedAt: nowIso(),
    }))
  }

  getCreateNetworkDraft(developerId: string) {
    return this.state.createNetworkDraftByDeveloperId[developerId] ?? null
  }

  saveCreateNetworkDraft(input: { developerId: string; currentStep: number; data: Record<string, unknown> }) {
    const now = nowIso()
    this.setState((prev) => {
      const existing = prev.createNetworkDraftByDeveloperId[input.developerId]
      const draft = {
        id: existing?.id ?? randId("draft"),
        developerId: input.developerId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        currentStep: input.currentStep,
        data: input.data,
      }
      return {
        ...prev,
        createNetworkDraftByDeveloperId: { ...prev.createNetworkDraftByDeveloperId, [input.developerId]: draft },
        updatedAt: now,
      }
    })
  }

  clearCreateNetworkDraft(developerId: string) {
    this.setState((prev) => {
      const next = { ...prev.createNetworkDraftByDeveloperId }
      delete next[developerId]
      return { ...prev, createNetworkDraftByDeveloperId: next, updatedAt: nowIso() }
    })
  }

  listWithdrawalAddresses(minerId: string) {
    const session = this.requireSession()
    if (minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    return this.state.savedWithdrawalAddressesByMinerId[minerId] ?? []
  }

  addWithdrawalAddress(input: { minerId: string; walletAddress: string }) {
    const session = this.requireSession()
    if (input.minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    const addr = input.walletAddress.trim()
    if (!addr) return
    this.setState((prev) => {
      const existing = prev.savedWithdrawalAddressesByMinerId[input.minerId] ?? []
      const without = existing.filter((x) => x.toLowerCase() !== addr.toLowerCase())
      const next = [addr, ...without].slice(0, 25)
      return {
        ...prev,
        savedWithdrawalAddressesByMinerId: { ...prev.savedWithdrawalAddressesByMinerId, [input.minerId]: next },
        updatedAt: nowIso(),
      }
    })
  }

  removeWithdrawalAddress(input: { minerId: string; walletAddress: string }) {
    const session = this.requireSession()
    if (input.minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    const addr = input.walletAddress.trim()
    this.setState((prev) => {
      const existing = prev.savedWithdrawalAddressesByMinerId[input.minerId] ?? []
      const next = existing.filter((x) => x.toLowerCase() !== addr.toLowerCase())
      return {
        ...prev,
        savedWithdrawalAddressesByMinerId: { ...prev.savedWithdrawalAddressesByMinerId, [input.minerId]: next },
        updatedAt: nowIso(),
      }
    })
  }

  listWatchlist(minerId: string) {
    const ids = this.state.watchlistByMinerId[minerId] ?? []
    return ids
  }

  isWishlisted(minerId: string, appId: string) {
    return (this.state.watchlistByMinerId[minerId] ?? []).includes(appId)
  }

  toggleWatchlist(input: { minerId: string; appId: string }) {
    const session = this.requireSession()
    if (input.minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    this.setState((prev) => {
      const existing = prev.watchlistByMinerId[input.minerId] ?? []
      const next = existing.includes(input.appId) ? existing.filter((id) => id !== input.appId) : [input.appId, ...existing]
      return {
        ...prev,
        watchlistByMinerId: { ...prev.watchlistByMinerId, [input.minerId]: next.slice(0, 200) },
        updatedAt: nowIso(),
      }
    })
  }

  listRecentSearches(minerId: string) {
    return this.state.recentSearchesByMinerId[minerId] ?? []
  }

  pushRecentSearch(input: { minerId: string; query: string }) {
    const session = this.requireSession()
    if (input.minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    const q = input.query.trim()
    if (!q) return
    this.setState((prev) => {
      const existing = prev.recentSearchesByMinerId[input.minerId] ?? []
      const without = existing.filter((x) => x.toLowerCase() !== q.toLowerCase())
      const next = [q, ...without].slice(0, 12)
      return { ...prev, recentSearchesByMinerId: { ...prev.recentSearchesByMinerId, [input.minerId]: next }, updatedAt: nowIso() }
    })
  }

  clearRecentSearches(minerId: string) {
    const session = this.requireSession()
    if (minerId !== session.minerId) throw new Error("Forbidden (not your miner).")
    this.setState((prev) => ({ ...prev, recentSearchesByMinerId: { ...prev.recentSearchesByMinerId, [minerId]: [] }, updatedAt: nowIso() }))
  }

  ensureMiner(input: { minerId: string; walletAddress: string; label?: string }) {
    const existing = this.state.miners.find((m) => m.id === input.minerId) ?? null
    const labelNext = input.label ?? existing?.label ?? "Miner"
    const needsMinerUpdate =
      !existing || existing.walletAddress !== input.walletAddress || (existing.label ?? "") !== (labelNext ?? "")
    const needsBalance = typeof this.state.walletBalancesByAddress[input.walletAddress] !== "number"
    if (!needsMinerUpdate && !needsBalance) return

    this.setState((prev) => {
      const now = nowIso()
      const existing = prev.miners.find((m) => m.id === input.minerId)
      const miners = existing
        ? prev.miners.map((m) =>
            m.id === input.minerId
              ? { ...m, walletAddress: input.walletAddress, label: labelNext, updatedAt: now }
              : m,
          )
        : [
            {
              id: input.minerId,
              walletAddress: input.walletAddress,
              label: labelNext,
              createdAt: now,
              updatedAt: now,
            },
            ...prev.miners,
          ]

      const walletBalancesByAddress =
        typeof prev.walletBalancesByAddress[input.walletAddress] === "number"
          ? prev.walletBalancesByAddress
          : { ...prev.walletBalancesByAddress, [input.walletAddress]: 0 }

      // So "Subscribe to Network" works: give every miner default attestation capabilities in the demo.
      const existingCaps = prev.attestationCapabilitiesByMinerId?.[input.minerId]
      const attestationCapabilitiesByMinerId = {
        ...(prev.attestationCapabilitiesByMinerId ?? {}),
        [input.minerId]: existingCaps ?? { tpm: true, tee: true, sgx: false },
      }

      return { ...prev, miners, walletBalancesByAddress, attestationCapabilitiesByMinerId, updatedAt: now }
    })

    this.emit({
      type: "wallet_connected",
      minerId: input.minerId,
      walletAddress: input.walletAddress,
      message: `Wallet connected for ${labelNext}.`,
      metadata: { label: labelNext },
    })

    // Keep session in sync for prototype-level authorization.
    this.setSession({ minerId: input.minerId, walletAddress: input.walletAddress })

    // Ensure every connected wallet has at least miner role.
    this.setState((prev) => {
      const existing = prev.rolesByWalletAddress?.[input.walletAddress] ?? []
      if (existing.includes("miner")) return prev
      return {
        ...prev,
        rolesByWalletAddress: {
          ...(prev.rolesByWalletAddress ?? {}),
          [input.walletAddress]: ["miner", ...existing],
        },
        updatedAt: nowIso(),
      }
    })
  }

  publishAppDraft(input: {
    app: App
    miningProfile?: MiningProfile
    listingStatus?: AppListingStatus
  }) {
    const { walletAddress } = this.requireRole("developer")
    const status = input.listingStatus ?? "pending_governance"
    // PRD: Only verified developer keys can publish apps publicly (submit for listing).
    // For demo: auto-verify the developer if not yet verified
    if (status === "pending_governance") {
      const ver = this.state.developerVerificationByAddress?.[walletAddress]?.status ?? "unverified"
      if (ver !== "verified") {
        this.setState((prev) => ({
          ...prev,
          developerVerificationByAddress: {
            ...(prev.developerVerificationByAddress ?? {}),
            [walletAddress]: { walletAddress, status: "verified" as const, requestedAt: nowIso(), reviewedAt: nowIso() },
          },
        }))
      }
    }
    this.setState((prev) => {
      const exists = prev.apps.some((a) => a.id === input.app.id)

      // Enforce ownership: the connected developer becomes the owner.
      // If app already exists and is owned by someone else, block.
      const existingApp = prev.apps.find((a) => a.id === input.app.id) ?? null
      if (existingApp?.developerAddress && existingApp.developerAddress !== walletAddress) {
        throw new Error("Forbidden (not the app owner).")
      }

      const app = { ...input.app, developerAddress: walletAddress, developer: input.app.developer || `Dev ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` }
      const apps = exists ? prev.apps.map((a) => (a.id === app.id ? app : a)) : [app, ...prev.apps]
      const listingStatusByAppId = { ...prev.listingStatusByAppId, [input.app.id]: status }
      const miningProfiles = input.miningProfile ? [input.miningProfile, ...prev.miningProfiles] : prev.miningProfiles

      const deployPipelinesByAppId = {
        ...prev.deployPipelinesByAppId,
        [input.app.id]: {
          status: "submitted" as const,
          progress: 100,
          updatedAt: nowIso(),
          logs: [
            "> Published to governance queue (demo)",
          ],
        },
      }

      const governance: GovernanceDecision[] =
        status === "pending_governance"
          ? [
              {
                appId: input.app.id,
                status: "review",
                createdAt: nowIso(),
                yesVotes: 0,
                noVotes: 0,
                requiredAttestations: 3,
                requiredReviews: 3,
                yesAttestors: [],
                noAttestors: [],
              },
              ...prev.governance.filter((g) => g.appId !== input.app.id),
            ]
          : prev.governance

      return { ...prev, apps, listingStatusByAppId, miningProfiles, governance, deployPipelinesByAppId, updatedAt: nowIso() }
    })

    this.emit({
      type: "app_submitted_for_governance",
      appId: input.app.id,
      message: `App submitted: ${input.app.name}`,
      metadata: { listingStatus: input.listingStatus ?? "pending_governance" },
    })

    // Demo auto-approval: simulate governance review → approval after 8 seconds
    if (status === "pending_governance") {
      const appId = input.app.id
      setTimeout(() => {
        try {
          this.setState((prev) => {
            const listingStatusByAppId = { ...prev.listingStatusByAppId, [appId]: "listed" as const }
            const governance = prev.governance.map((g) =>
              g.appId === appId
                ? { ...g, status: "approved" as const, decidedAt: nowIso(), yesVotes: 3, yesAttestors: ["gov-auto-1", "gov-auto-2", "gov-auto-3"] }
                : g,
            )
            return { ...prev, listingStatusByAppId, governance, updatedAt: nowIso() }
          })
          this.emit({ type: "app_governance_approved", appId, message: `${input.app.name} approved by governance` })

          // Generate mock miners for the newly listed app
          const mockMinerNames = ["miner-alpha", "miner-beta", "miner-gamma", "miner-delta", "miner-epsilon", "miner-zeta", "miner-eta", "miner-theta", "miner-iota", "miner-kappa"]
          const now2 = nowIso()
          this.setState((prev2) => {
            const newSubs = mockMinerNames.map((minerId, i) => ({
              id: `sub_mock_${appId}_${i}`,
              appId,
              minerId,
              status: i < 8 ? "active" as const : "paused" as const,
              subscribedAt: new Date(Date.now() - (i * 86400000)).toISOString(),
              totalEarned: Number((Math.random() * 50 + 5).toFixed(2)),
              tasksCompleted: Math.floor(Math.random() * 100 + 10),
              uptime: Number((95 + Math.random() * 4.5).toFixed(1)),
            }))
            const newProofs = mockMinerNames.slice(0, 6).flatMap((minerId, i) =>
              Array.from({ length: 3 }, (_, j) => ({
                id: `proof_mock_${appId}_${i}_${j}`,
                appId,
                minerId,
                subscriptionId: `sub_mock_${appId}_${i}`,
                status: j < 2 ? "verified" as const : "pending" as const,
                submittedAt: new Date(Date.now() - ((i * 3 + j) * 3600000)).toISOString(),
                verifiedAt: j < 2 ? new Date(Date.now() - ((i * 3 + j) * 3600000) + 300000).toISOString() : undefined,
                reward: Number((Math.random() * 5 + 1).toFixed(2)),
                hash: `0x${Math.random().toString(16).slice(2, 34)}`,
              }))
            )
            // Update app totalMiners
            const apps = prev2.apps.map((a) => a.id === appId ? { ...a, totalMiners: 10, totalEarnings: Number(newSubs.reduce((s, sub) => s + sub.totalEarned, 0).toFixed(0)) } : a)
            return {
              ...prev2,
              apps,
              subscriptions: [...prev2.subscriptions, ...newSubs],
              proofs: [...prev2.proofs, ...newProofs],
              updatedAt: now2,
            }
          })
        } catch {}
      }, 8000)
    }
  }

  simulateAppStoreReview(appId: string) {
    // Governance-triggered simulation: create 3 reviews + votes and finalize quickly.
    // PRD: DAO-based governance approval for app listing/delisting.
    const { walletAddress } = this.requireRole("governance")
    const app = this.state.apps.find((a) => a.id === appId) ?? null
    if (!app) return

    // Ensure it’s in the governance queue.
    const status = this.state.listingStatusByAppId[appId] ?? "draft"
    if (status !== "pending_governance") {
      this.publishAppDraft({ app, listingStatus: "pending_governance" })
    }

    const now = nowIso()
    const reviewers = ["gov-demo-1", "gov-demo-2", "gov-demo-3"]
    const conditions = this.systemSuggestedConditions(appId).join("\n")

    // Write “system” reviews without requiring real governance wallets.
    this.setState((prev) => {
      const existing = prev.governanceReviews ?? []
      const without = existing.filter((r) => !(r.appId === appId && reviewers.includes(r.reviewerId)))
      const nextReviews: GovernanceReview[] = reviewers.map((reviewerId, i) => ({
        id: `sys_review_${appId}_${i + 1}`,
        appId,
        reviewerId,
        status: "submitted",
        createdAt: now,
        updatedAt: now,
        submittedAt: now,
        overallScore: 8,
        securityRating: "safe",
        economicFairness: "fair",
        technicalQuality: "high",
        compliance: "pass",
        recommendation: conditions ? "conditional" : "approve",
        comments: "Automated review (prototype).",
        conditions: conditions || undefined,
      }))
      return { ...prev, governanceReviews: [...nextReviews, ...without], updatedAt: now }
    })

    // Open vote (same trigger as normal review submission).
    this.openVoteIfReady(appId)

    // Auto-cast enough YES votes after vote opens, then finalize.
    setTimeout(() => {
      const cur = this.state.governance.find((g) => g.appId === appId) ?? null
      if (!cur || cur.status !== "voting") return
      const required = cur.requiredAttestations ?? 3
      const yesAttestors = Array.from({ length: required }, (_, i) => `gov-attestor-${i + 1}`)
      this.setState((prev) => ({
        ...prev,
        governance: prev.governance.map((g) =>
          g.appId === appId ? { ...g, yesVotes: required, yesAttestors } : g,
        ),
        updatedAt: nowIso(),
      }))
      this.finalizeVote(appId)
    }, 1200)
  }

  updateApp(appId: string, patch: Partial<App>) {
    const { walletAddress } = this.requireRole("developer")
    this.setState((prev) => {
      const existing = prev.apps.find((a) => a.id === appId) ?? null
      if (existing?.developerAddress && existing.developerAddress !== walletAddress) {
        throw new Error("Forbidden (not the app owner).")
      }
      const apps = prev.apps.map((a) => (a.id === appId ? { ...a, ...patch } : a))
      return { ...prev, apps, updatedAt: nowIso() }
    })
  }

  startDeployPipeline(appId: string, opts?: { pinnedDigest?: string }) {
    this.setState((prev) => {
      const existing = prev.deployPipelinesByAppId[appId]
      const pinnedDigest = opts?.pinnedDigest ?? existing?.pinnedDigest ?? `sha256:${Math.random().toString(16).slice(2, 10)}...demo`
      return {
        ...prev,
        deployPipelinesByAppId: {
          ...prev.deployPipelinesByAppId,
          [appId]: {
            status: "compiling",
            progress: 5,
            updatedAt: nowIso(),
            pinnedDigest,
            logs: [
              "> MSaaS: compiling runtime...",
              "> Resolving dependencies...",
              "> Building OCI artifact...",
            ],
          },
        },
        updatedAt: nowIso(),
      }
    })

    this.emit({
      type: "deploy_started",
      appId,
      message: "Deploy pipeline started.",
      metadata: { pinnedDigest: opts?.pinnedDigest },
    })

    // progress ticks
    const tick = () => {
      this.setState((prev) => {
        const p = prev.deployPipelinesByAppId[appId]
        if (!p) return prev
        if (p.status === "complete" || p.status === "failed") return prev
        const next = Math.min(100, p.progress + Math.floor(Math.random() * 18 + 8))
        const status =
          next < 55 ? "compiling" : next < 85 ? "deploying" : next < 100 ? "submitted" : "complete"

        const logs = [...p.logs]
        if (p.progress < 55 && next >= 55) logs.push("> Compilation complete. Preparing deployment…")
        if (p.progress < 85 && next >= 85) logs.push("> Pushing to registry & pinning digest…")
        if (p.progress < 100 && next >= 100) logs.push("> Deploy pipeline complete.")

        return {
          ...prev,
          deployPipelinesByAppId: {
            ...prev.deployPipelinesByAppId,
            [appId]: {
              ...p,
              status: status as any,
              progress: next,
              updatedAt: nowIso(),
              logs: logs.slice(-24),
            },
          },
          updatedAt: nowIso(),
        }
      })
      const current = this.state.deployPipelinesByAppId[appId]
      if (current) {
        this.emit({
          type: current.progress >= 100 ? "deploy_completed" : "deploy_progress",
          appId,
          message: current.progress >= 100 ? "Deploy pipeline completed." : `Deploy progress: ${current.progress}%`,
          metadata: { progress: current.progress, status: current.status, pinnedDigest: current.pinnedDigest },
        })
      }
      if (current && current.progress < 100) setTimeout(tick, 450 + Math.floor(Math.random() * 350))
    }
    setTimeout(tick, 500)
  }

  castGovernanceAttestation(input: { appId: string; attestor: string; direction: "yes" | "no" }) {
    const { walletAddress } = this.requireRole("governance")
    if (input.attestor !== walletAddress) throw new Error("Forbidden (attestor mismatch).")
    this.setState((prev) => {
      const existing = prev.governance.find((g) => g.appId === input.appId)
      if (!existing || (existing.status !== "voting" && existing.status !== "review")) return prev

      // prevent double-voting
      if (existing.yesAttestors.includes(input.attestor) || existing.noAttestors.includes(input.attestor)) return prev

      const updated: GovernanceDecision = {
        ...existing,
        yesVotes: input.direction === "yes" ? existing.yesVotes + 1 : existing.yesVotes,
        noVotes: input.direction === "no" ? existing.noVotes + 1 : existing.noVotes,
        yesAttestors: input.direction === "yes" ? [...existing.yesAttestors, input.attestor] : existing.yesAttestors,
        noAttestors: input.direction === "no" ? [...existing.noAttestors, input.attestor] : existing.noAttestors,
      }

      const governance = prev.governance.map((g) => (g.appId === input.appId ? updated : g))

      // Auto-finalize when threshold met
      let listingStatusByAppId = prev.listingStatusByAppId
      if (updated.yesVotes >= updated.requiredAttestations) {
        const conditions = this.collectConditions(input.appId)
        listingStatusByAppId = {
          ...prev.listingStatusByAppId,
          [input.appId]: conditions.length > 0 ? ("beta" as const) : ("listed" as const),
        }
        const finalized = {
          ...updated,
          status: "approved" as const,
          decidedAt: nowIso(),
          conditions: conditions.length > 0 ? conditions : [],
          conditionsDeadlineAt: conditions.length > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
          reason: conditions.length > 0 ? "Approved (beta) with conditions" : updated.reason,
        }
        return {
          ...prev,
          listingStatusByAppId,
          governance: prev.governance.map((g) => (g.appId === input.appId ? finalized : g)),
          updatedAt: nowIso(),
        }
      }

      if (updated.noVotes >= updated.requiredAttestations) {
        listingStatusByAppId = { ...prev.listingStatusByAppId, [input.appId]: "delisted" as const }
        const finalized = { ...updated, status: "rejected" as const, decidedAt: nowIso(), reason: "Rejected by attestors" }
        return {
          ...prev,
          listingStatusByAppId,
          governance: prev.governance.map((g) => (g.appId === input.appId ? finalized : g)),
          updatedAt: nowIso(),
        }
      }

      return { ...prev, governance, updatedAt: nowIso() }
    })

    this.emit({
      type: "governance_attested",
      appId: input.appId,
      message: `Governance attestation: ${input.direction.toUpperCase()} by ${input.attestor}`,
      metadata: { attestor: input.attestor, direction: input.direction },
    })
  }

  // ---------- Governance staking ----------

  getGovernanceStake(address: string): { total: number; locked: number; available: number } {
    return this.state.governanceStakesByAddress[address] ?? { total: 0, locked: 0, available: 0 }
  }

  returnProposalStake(proposalId: string) {
    const proposal = (this.state.governanceProposals ?? []).find((p) => p.id === proposalId)
    if (!proposal || (proposal.status !== "passed" && proposal.status !== "rejected")) return

    const defaultStakes: Record<string, number> = {
      "parameter-update": 500,
      "reward-change": 1000,
      treasury: 2000,
    }
    const proposalStake = defaultStakes[proposal.type] ?? 500

    this.setState((prev) => {
      const creatorAddr = proposal.createdBy
      const stake = prev.governanceStakesByAddress[creatorAddr] ?? { total: 0, locked: 0, available: 0 }

      // Creator gets 2x back if proposal passed, 1x (original) back if rejected
      const isPassed = proposal.status === "passed"
      const creatorReturn = isPassed ? proposalStake * 2 : proposalStake
      const updatedCreatorStake = {
        total: isPassed ? stake.total + proposalStake : stake.total, // 2x means they gain 1x net
        locked: Math.max(0, stake.locked - proposalStake),
        available: stake.available + creatorReturn,
      }

      // Return vote stakes + voter rewards (0.5% of their stake)
      const voteStakes = prev.governanceVoteStakes[proposalId] ?? {}
      let nextStakesByAddress = { ...prev.governanceStakesByAddress, [creatorAddr]: updatedCreatorStake }
      let nextRewards = { ...prev.governanceRewards }

      for (const [voterId, voterStakeRaw] of Object.entries(voteStakes)) {
        const voterStake = Number(voterStakeRaw)
        const voterBalance = nextStakesByAddress[voterId] ?? { total: 0, locked: 0, available: 0 }
        const reward = Math.round(voterStake * 0.005 * 100) / 100 // 0.5% reward
        nextStakesByAddress = {
          ...nextStakesByAddress,
          [voterId]: {
            total: voterBalance.total + reward,
            locked: Math.max(0, voterBalance.locked - voterStake),
            available: voterBalance.available + voterStake + reward,
          },
        }
        nextRewards = { ...nextRewards, [voterId]: (nextRewards[voterId] ?? 0) + reward }
      }

      // Clear vote stakes for this proposal
      const nextVoteStakes = { ...prev.governanceVoteStakes }
      delete nextVoteStakes[proposalId]

      return {
        ...prev,
        governanceStakesByAddress: nextStakesByAddress,
        governanceVoteStakes: nextVoteStakes,
        governanceRewards: nextRewards,
        updatedAt: nowIso(),
      }
    })
  }

  /** Settle reviewer stakes: unlock stakes and grant 50 NECTA reward per submitted review for a given app. */
  settleReviewerStakes(appId: string) {
    const REVIEWER_REWARD = 50

    this.setState((prev) => {
      const reviewerStakes = prev.governanceReviewerStakes[appId] ?? {}
      if (Object.keys(reviewerStakes).length === 0) return prev

      let nextStakesByAddress = { ...prev.governanceStakesByAddress }
      let nextRewards = { ...prev.governanceRewards }

      for (const [reviewerId, stakedAmountRaw] of Object.entries(reviewerStakes)) {
        const stakedAmount = Number(stakedAmountRaw)
        const balance = nextStakesByAddress[reviewerId] ?? { total: 0, locked: 0, available: 0 }
        nextStakesByAddress = {
          ...nextStakesByAddress,
          [reviewerId]: {
            total: balance.total + REVIEWER_REWARD,
            locked: Math.max(0, balance.locked - stakedAmount),
            available: balance.available + stakedAmount + REVIEWER_REWARD,
          },
        }
        nextRewards = { ...nextRewards, [reviewerId]: (nextRewards[reviewerId] ?? 0) + REVIEWER_REWARD }
      }

      // Clear reviewer stakes for this app
      const nextReviewerStakes = { ...prev.governanceReviewerStakes }
      delete nextReviewerStakes[appId]

      return {
        ...prev,
        governanceStakesByAddress: nextStakesByAddress,
        governanceReviewerStakes: nextReviewerStakes,
        governanceRewards: nextRewards,
        updatedAt: nowIso(),
      }
    })
  }

  /** Get accumulated governance participation rewards for an address. */
  getGovernanceRewards(address: string): number {
    return this.state.governanceRewards[address] ?? 0
  }

  // ═══════════════════════════════════════════════════
  //  GOVERNANCE: Stake Management
  // ═══════════════════════════════════════════════════

  depositGovernanceStake(address: string, amount: number) {
    this.requireAuth()
    if (amount <= 0) throw new Error("Amount must be positive.")
    const balance = this.state.walletBalancesByAddress[address] ?? 0
    if (balance < amount) throw new Error(`Insufficient wallet balance. Have ${balance.toFixed(2)}, need ${amount}.`)

    const evt: GovernanceStakeEvent = {
      id: `gse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      address, type: "deposit", amount, reason: "Deposited NECTA into governance stake",
      createdAt: nowIso(),
    }

    this.setState((prev) => {
      const stake = prev.governanceStakesByAddress[address] ?? { total: 0, locked: 0, available: 0 }
      return {
        ...prev,
        walletBalancesByAddress: { ...prev.walletBalancesByAddress, [address]: (prev.walletBalancesByAddress[address] ?? 0) - amount },
        governanceStakesByAddress: { ...prev.governanceStakesByAddress, [address]: { total: stake.total + amount, locked: stake.locked, available: stake.available + amount } },
        governanceStakeHistory: [...(prev.governanceStakeHistory ?? []), evt],
        updatedAt: nowIso(),
      }
    })
  }

  withdrawGovernanceStake(address: string, amount: number) {
    this.requireAuth()
    if (amount <= 0) throw new Error("Amount must be positive.")
    const stake = this.state.governanceStakesByAddress[address] ?? { total: 0, locked: 0, available: 0 }
    if (stake.available < amount) throw new Error(`Insufficient available stake. Have ${stake.available.toFixed(2)} available, ${stake.locked.toFixed(2)} locked.`)

    const evt: GovernanceStakeEvent = {
      id: `gse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      address, type: "withdraw", amount, reason: "Withdrew NECTA from governance stake",
      createdAt: nowIso(),
    }

    this.setState((prev) => {
      const s = prev.governanceStakesByAddress[address] ?? { total: 0, locked: 0, available: 0 }
      return {
        ...prev,
        walletBalancesByAddress: { ...prev.walletBalancesByAddress, [address]: (prev.walletBalancesByAddress[address] ?? 0) + amount },
        governanceStakesByAddress: { ...prev.governanceStakesByAddress, [address]: { total: s.total - amount, locked: s.locked, available: s.available - amount } },
        governanceStakeHistory: [...(prev.governanceStakeHistory ?? []), evt],
        updatedAt: nowIso(),
      }
    })
  }

  claimGovernanceRewards(address: string) {
    this.requireAuth()
    const rewards = this.state.governanceRewards[address] ?? 0
    if (rewards <= 0) throw new Error("No rewards to claim.")

    const evt: GovernanceStakeEvent = {
      id: `gse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      address, type: "reward", amount: rewards, reason: `Claimed ${rewards.toFixed(2)} NECTA governance rewards`,
      createdAt: nowIso(),
    }

    this.setState((prev) => ({
      ...prev,
      walletBalancesByAddress: { ...prev.walletBalancesByAddress, [address]: (prev.walletBalancesByAddress[address] ?? 0) + rewards },
      governanceRewards: { ...prev.governanceRewards, [address]: 0 },
      governanceStakeHistory: [...(prev.governanceStakeHistory ?? []), evt],
      updatedAt: nowIso(),
    }))
    return rewards
  }

  getStakeHistory(address: string): GovernanceStakeEvent[] {
    return (this.state.governanceStakeHistory ?? []).filter((e) => e.address === address).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  getLockedStakeDetails(address: string): Array<{ proposalId: string; title: string; amount: number; unlocksAt?: string }> {
    const result: Array<{ proposalId: string; title: string; amount: number; unlocksAt?: string }> = []
    const voteStakes = this.state.governanceVoteStakes ?? {}
    for (const [proposalId, voters] of Object.entries(voteStakes)) {
      const amount = voters[address]
      if (!amount) continue
      const proposal = (this.state.governanceProposals ?? []).find((p) => p.id === proposalId)
      if (!proposal || proposal.status !== "active") continue
      result.push({ proposalId, title: proposal.title, amount, unlocksAt: proposal.endsAt })
    }
    return result
  }

  // ═══════════════════════════════════════════════════
  //  GOVERNANCE: Delegation
  // ═══════════════════════════════════════════════════

  delegateVotingPower(input: { from: string; to: string; amount: number }) {
    this.requireAuth()
    if (input.from === input.to) throw new Error("Cannot delegate to yourself.")
    if (input.amount <= 0) throw new Error("Amount must be positive.")
    const stake = this.state.governanceStakesByAddress[input.from] ?? { total: 0, locked: 0, available: 0 }
    if (stake.available < input.amount) throw new Error(`Insufficient available stake. Have ${stake.available.toFixed(2)}.`)

    const delegation: GovernanceDelegation = {
      id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromAddress: input.from, toAddress: input.to, amount: input.amount,
      createdAt: nowIso(),
    }

    this.setState((prev) => {
      const fromStake = prev.governanceStakesByAddress[input.from] ?? { total: 0, locked: 0, available: 0 }
      return {
        ...prev,
        governanceDelegations: [...(prev.governanceDelegations ?? []), delegation],
        governanceStakesByAddress: {
          ...prev.governanceStakesByAddress,
          [input.from]: { ...fromStake, locked: fromStake.locked + input.amount, available: fromStake.available - input.amount },
        },
        updatedAt: nowIso(),
      }
    })
    return delegation
  }

  revokeDelegation(delegationId: string) {
    this.requireAuth()
    const del = (this.state.governanceDelegations ?? []).find((d) => d.id === delegationId && !d.revokedAt)
    if (!del) throw new Error("Delegation not found or already revoked.")

    this.setState((prev) => {
      const fromStake = prev.governanceStakesByAddress[del.fromAddress] ?? { total: 0, locked: 0, available: 0 }
      return {
        ...prev,
        governanceDelegations: (prev.governanceDelegations ?? []).map((d) =>
          d.id === delegationId ? { ...d, revokedAt: nowIso() } : d
        ),
        governanceStakesByAddress: {
          ...prev.governanceStakesByAddress,
          [del.fromAddress]: { ...fromStake, locked: Math.max(0, fromStake.locked - del.amount), available: fromStake.available + del.amount },
        },
        updatedAt: nowIso(),
      }
    })
  }

  getDelegationsFrom(address: string): GovernanceDelegation[] {
    return (this.state.governanceDelegations ?? []).filter((d) => d.fromAddress === address && !d.revokedAt)
  }

  getDelegationsTo(address: string): GovernanceDelegation[] {
    return (this.state.governanceDelegations ?? []).filter((d) => d.toAddress === address && !d.revokedAt)
  }

  getEffectiveVotingPower(address: string): number {
    const stake = this.state.governanceStakesByAddress[address] ?? { total: 0, locked: 0, available: 0 }
    const delegatedToMe = this.getDelegationsTo(address).reduce((s, d) => s + d.amount, 0)
    const delegatedAway = this.getDelegationsFrom(address).reduce((s, d) => s + d.amount, 0)
    return stake.available + delegatedToMe
  }

  getVotingPowerBreakdown(address: string) {
    const stake = this.state.governanceStakesByAddress[address] ?? { total: 0, locked: 0, available: 0 }
    const delegatedToYou = this.getDelegationsTo(address).reduce((s, d) => s + d.amount, 0)
    const delegatedAway = this.getDelegationsFrom(address).reduce((s, d) => s + d.amount, 0)
    const effectiveVP = stake.available + delegatedToYou
    const totalNetworkVP = Object.values(this.state.governanceStakesByAddress).reduce((s, v) => s + v.total, 0) || 1
    return {
      ownStake: stake.total,
      locked: stake.locked,
      available: stake.available,
      delegatedToYou,
      delegatedAway,
      effectiveVP,
      totalNetworkVP,
      percentOfTotal: (effectiveVP / totalNetworkVP) * 100,
    }
  }

  // ═══════════════════════════════════════════════════
  //  GOVERNANCE: Proposal Discussion / Comments
  // ═══════════════════════════════════════════════════

  listProposalComments(proposalId: string): ProposalComment[] {
    return (this.state.proposalComments ?? [])
      .filter((c) => c.proposalId === proposalId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  addProposalComment(input: { proposalId: string; authorAddress: string; content: string; parentCommentId?: string }): ProposalComment {
    this.requireAuth()
    if (!input.content.trim()) throw new Error("Comment cannot be empty.")
    const comment: ProposalComment = {
      id: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      proposalId: input.proposalId,
      authorAddress: input.authorAddress,
      content: input.content.trim(),
      createdAt: nowIso(),
      parentCommentId: input.parentCommentId,
      upvotes: 0,
      upvoters: [],
    }
    this.setState((prev) => ({
      ...prev,
      proposalComments: [...(prev.proposalComments ?? []), comment],
      updatedAt: nowIso(),
    }))
    return comment
  }

  upvoteProposalComment(commentId: string, voterAddress: string) {
    this.requireAuth()
    this.setState((prev) => ({
      ...prev,
      proposalComments: (prev.proposalComments ?? []).map((c) => {
        if (c.id !== commentId) return c
        if (c.upvoters.includes(voterAddress)) {
          return { ...c, upvotes: Math.max(0, c.upvotes - 1), upvoters: c.upvoters.filter((v) => v !== voterAddress) }
        }
        return { ...c, upvotes: c.upvotes + 1, upvoters: [...c.upvoters, voterAddress] }
      }),
      updatedAt: nowIso(),
    }))
  }

  // ═══════════════════════════════════════════════════
  //  GOVERNANCE: Treasury
  // ═══════════════════════════════════════════════════

  listTreasuryTransactions(opts?: { type?: "inflow" | "outflow"; limit?: number }): TreasuryTransaction[] {
    let txns = [...(this.state.treasuryTransactions ?? [])]
    if (opts?.type) txns = txns.filter((t) => t.type === opts.type)
    txns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (opts?.limit) txns = txns.slice(0, opts.limit)
    return txns
  }

  getTreasurySummary() {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 86400000
    const txns = this.state.treasuryTransactions ?? []
    const recent = txns.filter((t) => new Date(t.createdAt).getTime() >= thirtyDaysAgo)
    const inflows30d = recent.filter((t) => t.type === "inflow").reduce((s, t) => s + t.amount, 0)
    const outflows30d = recent.filter((t) => t.type === "outflow").reduce((s, t) => s + t.amount, 0)

    const balance = this.state.treasuryBalance ?? 0
    const allocations = [
      { label: "Development Fund", percent: 40, amount: balance * 0.4 },
      { label: "Miner Rewards Pool", percent: 25, amount: balance * 0.25 },
      { label: "Security & Audits", percent: 15, amount: balance * 0.15 },
      { label: "Community Grants", percent: 10, amount: balance * 0.1 },
      { label: "Operations", percent: 10, amount: balance * 0.1 },
    ]

    return { balance, inflows30d, outflows30d, allocations, totalTransactions: txns.length }
  }

  recordTreasuryInflow(amount: number, source: string) {
    if (amount <= 0) return
    const txn: TreasuryTransaction = {
      id: `ttx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "inflow", amount, source, createdAt: nowIso(), status: "completed",
    }
    this.setState((prev) => ({
      ...prev,
      treasuryTransactions: [...(prev.treasuryTransactions ?? []), txn],
      treasuryBalance: (prev.treasuryBalance ?? 0) + amount,
      updatedAt: nowIso(),
    }))
  }

  // ═══════════════════════════════════════════════════
  //  GOVERNANCE: Activity Feed (derived, no new state)
  // ═══════════════════════════════════════════════════

  getMyGovernanceActivity(address: string): Array<{
    id: string; type: string; title: string; description: string;
    timestamp: string; direction?: string; stakeAmount?: number;
    proposalId?: string; appId?: string; status?: string;
  }> {
    const items: Array<{
      id: string; type: string; title: string; description: string;
      timestamp: string; direction?: string; stakeAmount?: number;
      proposalId?: string; appId?: string; status?: string;
    }> = []

    // Proposals I created
    for (const p of (this.state.governanceProposals ?? [])) {
      if (p.createdBy === address) {
        items.push({
          id: `act_prop_${p.id}`, type: "proposal_created", title: "Created proposal",
          description: p.title, timestamp: p.createdAt, proposalId: p.id, status: p.status,
        })
      }
    }

    // Proposals I voted on
    for (const p of (this.state.governanceProposals ?? [])) {
      const inFor = p.votersFor.includes(address)
      const inAgainst = p.votersAgainst.includes(address)
      if (!inFor && !inAgainst) continue
      const voteStakes = this.state.governanceVoteStakes?.[p.id] ?? {}
      items.push({
        id: `act_vote_${p.id}`, type: "vote_cast", title: "Voted on proposal",
        description: p.title, timestamp: p.createdAt, proposalId: p.id,
        direction: inFor ? "for" : "against", stakeAmount: voteStakes[address] ?? 0,
        status: p.status,
      })
    }

    // Governance reviews I submitted
    for (const r of (this.state.governanceReviews ?? [])) {
      if (r.reviewerId === address) {
        const app = this.state.apps.find((a) => a.id === r.appId)
        items.push({
          id: `act_rev_${r.id}`, type: "review_submitted", title: "Reviewed listing",
          description: app?.name ?? r.appId, timestamp: r.createdAt, appId: r.appId,
          status: r.status,
        })
      }
    }

    // Moderation votes
    for (const c of (this.state.moderationCases ?? [])) {
      const voted = c.keepVoters?.includes(address) || c.delistVoters?.includes(address)
      if (!voted) continue
      const app = this.state.apps.find((a) => a.id === c.appId)
      const dir = c.keepVoters?.includes(address) ? "keep" : "delist"
      items.push({
        id: `act_mod_${c.id}`, type: "moderation_vote", title: "Moderation vote",
        description: app?.name ?? c.appId, timestamp: c.createdAt, appId: c.appId,
        direction: dir, status: c.status,
      })
    }

    // Stake history events (deposits, withdrawals, rewards)
    for (const e of (this.state.governanceStakeHistory ?? [])) {
      if (e.address !== address) continue
      if (e.type === "deposit" || e.type === "withdraw" || e.type === "reward") {
        items.push({
          id: e.id, type: `stake_${e.type}`, title: e.type === "deposit" ? "Staked NECTA" : e.type === "withdraw" ? "Withdrew stake" : "Claimed rewards",
          description: e.reason, timestamp: e.createdAt, stakeAmount: e.amount,
          proposalId: e.proposalId, appId: e.appId,
        })
      }
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return items
  }

  // ═══════════════════════════════════════════════════
  //  GOVERNANCE: Total Network VP
  // ═══════════════════════════════════════════════════

  getTotalVotingPower(): number {
    return Object.values(this.state.governanceStakesByAddress).reduce((s, v) => s + v.total, 0) || 25000
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Webhook Logs
  // ═══════════════════════════════════════════════════

  listWebhookLogs(appId: string): WebhookLogEntry[] {
    return (this.state.webhookLogsByAppId[appId] ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  simulateWebhook(appId: string, event: string) {
    const app = this.state.apps.find((a) => a.id === appId)
    if (!app) throw new Error("App not found.")
    const url = (app as any).webhookUrl || "https://api.example.com/webhooks"
    const payloads: Record<string, object> = {
      new_subscription: { event: "new_subscription", minerId: "miner_demo", appId, timestamp: nowIso() },
      proof_verified: { event: "proof_verified", proofId: `proof_${Date.now()}`, appId, minerId: "miner_demo", status: "verified", timestamp: nowIso() },
      payout_sent: { event: "payout_sent", appId, amount: 12.5, currency: "NECTA", recipients: 3, timestamp: nowIso() },
      miner_offline: { event: "miner_offline", minerId: "miner_demo", appId, lastSeen: nowIso(), timestamp: nowIso() },
    }
    const payload = payloads[event] || { event, appId, timestamp: nowIso() }
    const delivered = Math.random() > 0.2
    const entry: WebhookLogEntry = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      appId, event, url, payload: JSON.stringify(payload, null, 2),
      status: delivered ? "delivered" : "failed",
      statusCode: delivered ? 200 : 500,
      createdAt: nowIso(), attempts: 1,
    }
    this.setState((prev) => ({
      ...prev,
      webhookLogsByAppId: { ...prev.webhookLogsByAppId, [appId]: [...(prev.webhookLogsByAppId[appId] ?? []), entry] },
      updatedAt: nowIso(),
    }))
    return entry
  }

  retryWebhook(appId: string, logId: string) {
    this.setState((prev) => ({
      ...prev,
      webhookLogsByAppId: {
        ...prev.webhookLogsByAppId,
        [appId]: (prev.webhookLogsByAppId[appId] ?? []).map((e) =>
          e.id === logId ? { ...e, status: "delivered" as const, statusCode: 200, retriedAt: nowIso(), attempts: e.attempts + 1 } : e
        ),
      },
      updatedAt: nowIso(),
    }))
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Deployment Pipeline
  // ═══════════════════════════════════════════════════

  listDeploymentLogs(appId: string): DeploymentLog[] {
    return (this.state.deploymentLogsByAppId[appId] ?? []).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }

  triggerDeployment(appId: string, version: string) {
    const { walletAddress } = this.requireAuth()
    const steps: DeploymentStep[] = [
      { name: "Pull source", status: "completed", startedAt: nowIso(), completedAt: nowIso(), logs: ["Cloning repository...", "Checkout complete."] },
      { name: "Build container", status: "completed", startedAt: nowIso(), completedAt: nowIso(), logs: ["Building Docker image...", "Layer 1/8: FROM ubuntu:22.04", "Layer 8/8: ENTRYPOINT", "Build complete. Image size: 342MB"] },
      { name: "Run tests", status: "completed", startedAt: nowIso(), completedAt: nowIso(), logs: ["Running proof validation tests...", "12/12 tests passed.", "Coverage: 94.2%"] },
      { name: "Push to registry", status: "completed", startedAt: nowIso(), completedAt: nowIso(), logs: [`Pushing necter/${appId}:${version}...`, "Push complete. Digest: sha256:a1b2c3d4..."] },
      { name: "Deploy to network", status: "live", startedAt: nowIso(), completedAt: nowIso(), logs: ["Rolling out to 3 regions...", "us-east-1: healthy", "eu-west-1: healthy", "ap-southeast-1: healthy", "Deployment complete."] },
    ]
    const log: DeploymentLog = {
      id: `deploy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      appId, version, status: "live", startedAt: nowIso(), completedAt: nowIso(),
      steps, triggeredBy: walletAddress,
    }
    this.setState((prev) => ({
      ...prev,
      deploymentLogsByAppId: { ...prev.deploymentLogsByAppId, [appId]: [...(prev.deploymentLogsByAppId[appId] ?? []), log] },
      updatedAt: nowIso(),
    }))
    return log
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Announcements
  // ═══════════════════════════════════════════════════

  listAnnouncements(appId: string): Announcement[] {
    return (this.state.announcementsByAppId[appId] ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  createAnnouncement(input: { appId: string; title: string; content: string; type: Announcement["type"] }): Announcement {
    const { walletAddress } = this.requireAuth()
    const ann: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      appId: input.appId, title: input.title, content: input.content, type: input.type,
      createdAt: nowIso(), authorAddress: walletAddress,
    }
    this.setState((prev) => ({
      ...prev,
      announcementsByAppId: { ...prev.announcementsByAppId, [input.appId]: [...(prev.announcementsByAppId[input.appId] ?? []), ann] },
      updatedAt: nowIso(),
    }))
    return ann
  }

  deleteAnnouncement(appId: string, announcementId: string) {
    this.setState((prev) => ({
      ...prev,
      announcementsByAppId: {
        ...prev.announcementsByAppId,
        [appId]: (prev.announcementsByAppId[appId] ?? []).filter((a) => a.id !== announcementId),
      },
      updatedAt: nowIso(),
    }))
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Miner Tier Management
  // ═══════════════════════════════════════════════════

  getMinerTierConfig(appId: string): { enabled: boolean; tiers: Array<{ name: string; minUptime: number; minProofRate: number; rewardMultiplier: number; color: string }>; blocklist: string[]; allowlist: string[] } {
    return this.state.minerTiersByAppId[appId] ?? {
      enabled: false,
      tiers: [
        { name: "Bronze", minUptime: 0, minProofRate: 0, rewardMultiplier: 1, color: "#CD7F32" },
        { name: "Silver", minUptime: 90, minProofRate: 85, rewardMultiplier: 1.25, color: "#C0C0C0" },
        { name: "Gold", minUptime: 98, minProofRate: 95, rewardMultiplier: 1.5, color: "#FFD700" },
      ],
      blocklist: [],
      allowlist: [],
    }
  }

  updateMinerTierConfig(appId: string, config: any) {
    this.requireAuth()
    this.setState((prev) => ({
      ...prev,
      minerTiersByAppId: { ...prev.minerTiersByAppId, [appId]: config },
      updatedAt: nowIso(),
    }))
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Support Tickets
  // ═══════════════════════════════════════════════════

  listSupportTickets(appId: string): SupportTicket[] {
    return (this.state.supportTicketsByAppId[appId] ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  createSupportTicket(input: { appId: string; minerId: string; subject: string; description: string; priority: SupportTicket["priority"] }): SupportTicket {
    const ticket: SupportTicket = {
      id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      appId: input.appId, minerId: input.minerId, subject: input.subject, description: input.description,
      status: "open", priority: input.priority,
      createdAt: nowIso(), updatedAt: nowIso(), replies: [],
    }
    this.setState((prev) => ({
      ...prev,
      supportTicketsByAppId: { ...prev.supportTicketsByAppId, [input.appId]: [...(prev.supportTicketsByAppId[input.appId] ?? []), ticket] },
      updatedAt: nowIso(),
    }))
    return ticket
  }

  replySupportTicket(appId: string, ticketId: string, reply: { authorId: string; content: string }) {
    this.requireAuth()
    this.setState((prev) => ({
      ...prev,
      supportTicketsByAppId: {
        ...prev.supportTicketsByAppId,
        [appId]: (prev.supportTicketsByAppId[appId] ?? []).map((t) =>
          t.id === ticketId
            ? { ...t, replies: [...t.replies, { ...reply, createdAt: nowIso() }], updatedAt: nowIso(), status: "in_progress" as const }
            : t
        ),
      },
      updatedAt: nowIso(),
    }))
  }

  updateTicketStatus(appId: string, ticketId: string, status: SupportTicket["status"]) {
    this.requireAuth()
    this.setState((prev) => ({
      ...prev,
      supportTicketsByAppId: {
        ...prev.supportTicketsByAppId,
        [appId]: (prev.supportTicketsByAppId[appId] ?? []).map((t) =>
          t.id === ticketId ? { ...t, status, updatedAt: nowIso() } : t
        ),
      },
      updatedAt: nowIso(),
    }))
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Testnet Sessions
  // ═══════════════════════════════════════════════════

  listTestnetSessions(appId: string): TestnetSession[] {
    return (this.state.testnetSessionsByAppId[appId] ?? []).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }

  runTestnetSession(appId: string): TestnetSession {
    this.requireAuth()
    const miners = 3 + Math.floor(Math.random() * 8)
    const total = 20 + Math.floor(Math.random() * 80)
    const failed = Math.floor(Math.random() * Math.ceil(total * 0.1))
    const session: TestnetSession = {
      id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      appId, status: "completed", startedAt: nowIso(), completedAt: nowIso(),
      simulatedMiners: miners, proofsGenerated: total, proofsPassed: total - failed, proofsFailed: failed,
      logs: [
        `Spawning ${miners} simulated miners...`,
        "All miners connected to testnet.",
        `Generating ${total} proof tasks...`,
        `Proof validation: ${total - failed}/${total} passed (${((total - failed) / total * 100).toFixed(1)}%)`,
        failed > 0 ? `${failed} proofs failed validation — check proof logic.` : "All proofs passed. Ready for mainnet.",
        "Testnet session completed.",
      ],
    }
    this.setState((prev) => ({
      ...prev,
      testnetSessionsByAppId: { ...prev.testnetSessionsByAppId, [appId]: [...(prev.testnetSessionsByAppId[appId] ?? []), session] },
      updatedAt: nowIso(),
    }))
    return session
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Project Health Score
  // ═══════════════════════════════════════════════════

  getProjectHealthScore(appId: string): {
    overall: number; uptime: number; proofRate: number; minerSatisfaction: number;
    rewardHealth: number; status: "healthy" | "warning" | "critical";
    issues: string[];
  } {
    const subs = this.state.subscriptions.filter((s) => s.appId === appId)
    const proofs = this.state.proofs.filter((p) => p.appId === appId)
    const verified = proofs.filter((p) => p.status === "verified").length
    const total = proofs.length || 1

    const avgUptime = subs.length > 0 ? subs.reduce((s, sub) => s + sub.uptime, 0) / subs.length : 100
    const proofRate = (verified / total) * 100
    const app = this.state.apps.find((a) => a.id === appId)
    const avgRating = app?.averageRating ?? 4.0
    const minerSatisfaction = (avgRating / 5) * 100
    const activeSubs = subs.filter((s) => s.status === "active").length
    const rewardHealth = activeSubs > 0 ? Math.min(100, 60 + activeSubs * 5) : 50

    const overall = Math.round((avgUptime * 0.3 + proofRate * 0.3 + minerSatisfaction * 0.2 + rewardHealth * 0.2))
    const issues: string[] = []
    if (avgUptime < 95) issues.push("Average miner uptime below 95%")
    if (proofRate < 90) issues.push("Proof success rate below 90%")
    if (avgRating < 3.5) issues.push("Miner satisfaction rating below 3.5/5")
    if (activeSubs === 0) issues.push("No active miners subscribed")

    return {
      overall, uptime: Math.round(avgUptime), proofRate: Math.round(proofRate),
      minerSatisfaction: Math.round(minerSatisfaction), rewardHealth: Math.round(rewardHealth),
      status: overall >= 80 ? "healthy" : overall >= 60 ? "warning" : "critical",
      issues,
    }
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Economics Simulator
  // ═══════════════════════════════════════════════════

  simulateEconomics(input: { dailyEmission: number; rewardPerTask: number; expectedMiners: number; avgTasksPerDay: number; feePercent: number }): {
    dailyCost: number; monthlyCost: number; revenuePerMiner: number; platformFee: number;
    burnRate: number; monthsOfRunway: number; breakeven: number;
  } {
    const dailyCost = input.rewardPerTask * input.avgTasksPerDay * input.expectedMiners
    const platformFee = dailyCost * (input.feePercent / 100)
    const netDailyCost = dailyCost + platformFee
    const revenuePerMiner = input.avgTasksPerDay * input.rewardPerTask
    const escrow = 10000 // assume 10K NECTA escrow
    const monthsOfRunway = netDailyCost > 0 ? escrow / (netDailyCost * 30) : Infinity
    const breakeven = revenuePerMiner > 0 ? Math.ceil(netDailyCost / revenuePerMiner) : 0

    return {
      dailyCost: netDailyCost, monthlyCost: netDailyCost * 30,
      revenuePerMiner, platformFee,
      burnRate: netDailyCost, monthsOfRunway, breakeven,
    }
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Revenue Analytics
  // ═══════════════════════════════════════════════════

  getRevenueAnalytics(appId: string): {
    totalRevenue: number; totalPayouts: number; platformFees: number;
    payoutsByMiner: Array<{ minerId: string; amount: number; proofs: number }>;
    recentPayouts: Array<{ id: string; minerId: string; amount: number; date: string }>;
    dailyRevenue: Array<{ date: string; amount: number }>;
  } {
    const subs = this.state.subscriptions.filter((s) => s.appId === appId)
    const totalFromSubs = subs.reduce((s, sub) => s + (sub.totalEarned ?? 0), 0)
    const platformFees = totalFromSubs * 0.1
    const proofs = this.state.proofs.filter((p) => p.appId === appId)

    const minerMap = new Map<string, { amount: number; proofs: number }>()
    for (const sub of subs) {
      const existing = minerMap.get(sub.minerId) ?? { amount: 0, proofs: 0 }
      existing.amount += sub.totalEarned ?? 0
      minerMap.set(sub.minerId, existing)
    }
    for (const p of proofs) {
      if (p.status === "verified" && p.minerId) {
        const existing = minerMap.get(p.minerId) ?? { amount: 0, proofs: 0 }
        existing.proofs += 1
        minerMap.set(p.minerId, existing)
      }
    }

    const payoutsByMiner = [...minerMap.entries()].map(([minerId, data]) => ({ minerId, ...data })).sort((a, b) => b.amount - a.amount)

    // Generate mock daily revenue for last 30 days
    const dailyRevenue: Array<{ date: string; amount: number }> = []
    const now = Date.now()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      dailyRevenue.push({
        date: d.toISOString().slice(0, 10),
        amount: Math.max(0, (totalFromSubs / 30) * (0.5 + Math.random())),
      })
    }

    // Recent payouts from events
    const recentPayouts = (this.state.payouts ?? [])
      .filter((p: any) => p.appId === appId)
      .slice(0, 20)
      .map((p: any) => ({ id: p.id, minerId: p.minerId ?? "unknown", amount: p.minerAmount ?? p.gross ?? 0, date: p.createdAt }))

    return { totalRevenue: totalFromSubs, totalPayouts: totalFromSubs - platformFees, platformFees, payoutsByMiner, recentPayouts, dailyRevenue }
  }

  // ═══════════════════════════════════════════════════
  //  DEVELOPER PORTAL: Proof Monitoring
  // ═══════════════════════════════════════════════════

  getProofMonitoring(appId: string): {
    total: number; verified: number; failed: number; pending: number; disputed: number;
    successRate: number; avgVerificationTime: number;
    recentProofs: Array<{ id: string; minerId: string; status: string; createdAt: string }>;
    failureReasons: Array<{ reason: string; count: number }>;
    hourlyRate: Array<{ hour: string; count: number; verified: number }>;
  } {
    const proofs = this.state.proofs.filter((p) => p.appId === appId)
    const verified = proofs.filter((p) => p.status === "verified").length
    const failed = proofs.filter((p) => p.status === "rejected").length
    const pending = proofs.filter((p) => p.status === "pending").length
    const disputed = proofs.filter((p) => p.status === "disputed").length
    const total = proofs.length || 1

    const recentProofs = proofs.slice(-20).reverse().map((p) => ({
      id: p.id, minerId: p.minerId, status: p.status, createdAt: p.submittedAt ?? p.createdAt ?? nowIso(),
    }))

    const failureReasons = [
      { reason: "Invalid computation hash", count: Math.floor(failed * 0.4) },
      { reason: "Timeout exceeded", count: Math.floor(failed * 0.25) },
      { reason: "Resource mismatch", count: Math.floor(failed * 0.2) },
      { reason: "Duplicate submission", count: Math.ceil(failed * 0.15) },
    ].filter((r) => r.count > 0)

    // Mock hourly data
    const hourlyRate: Array<{ hour: string; count: number; verified: number }> = []
    for (let i = 23; i >= 0; i--) {
      const h = new Date(Date.now() - i * 3600000)
      const count = Math.floor(Math.random() * 20) + 2
      hourlyRate.push({ hour: `${h.getHours().toString().padStart(2, "0")}:00`, count, verified: Math.floor(count * (0.85 + Math.random() * 0.15)) })
    }

    return {
      total: proofs.length, verified, failed, pending, disputed,
      successRate: (verified / total) * 100,
      avgVerificationTime: 2.3 + Math.random() * 3,
      recentProofs, failureReasons, hourlyRate,
    }
  }

  // ═══════════════════════════════════════════════════
  //  MINING: Earnings Breakdown
  // ═══════════════════════════════════════════════════

  getEarningsBreakdown(minerId: string): {
    totalEarned: number; thisWeek: number; lastWeek: number; weeklyChange: number;
    projected30d: number; byProject: Array<{ appId: string; appName: string; earned: number; proofs: number; uptime: number }>;
    dailyEarnings: Array<{ date: string; amount: number }>;
  } {
    const subs = this.state.subscriptions.filter((s) => s.minerId === minerId)
    const totalEarned = subs.reduce((s, sub) => s + (sub.totalEarned ?? 0), 0)
    const now = Date.now()
    const weekMs = 7 * 86400000

    // Simulate weekly earnings from total
    const thisWeek = totalEarned * 0.18
    const lastWeek = totalEarned * 0.15
    const weeklyChange = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0
    const projected30d = (thisWeek / 7) * 30

    const byProject = subs.map((sub) => {
      const app = this.state.apps.find((a) => a.id === sub.appId)
      const proofs = this.state.proofs.filter((p) => p.appId === sub.appId && p.minerId === minerId && p.status === "verified").length
      return { appId: sub.appId, appName: app?.name ?? sub.appId, earned: sub.totalEarned ?? 0, proofs, uptime: sub.uptime }
    }).sort((a, b) => b.earned - a.earned)

    const dailyEarnings: Array<{ date: string; amount: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      dailyEarnings.push({ date: d.toISOString().slice(0, 10), amount: Math.max(0, (totalEarned / 30) * (0.6 + Math.random() * 0.8)) })
    }

    return { totalEarned, thisWeek, lastWeek, weeklyChange, projected30d, byProject, dailyEarnings }
  }

  // ═══════════════════════════════════════════════════
  //  MINING: Proof Stats
  // ═══════════════════════════════════════════════════

  getProofStats(minerId: string): {
    total: number; verified: number; failed: number; pending: number; successRate: number;
    avgVerificationTime: number;
    byProject: Array<{ appId: string; appName: string; total: number; verified: number; failed: number; rate: number }>;
    dailyRate: Array<{ date: string; submitted: number; verified: number }>;
  } {
    const proofs = this.state.proofs.filter((p) => p.minerId === minerId)
    const verified = proofs.filter((p) => p.status === "verified").length
    const failed = proofs.filter((p) => p.status === "rejected").length
    const pending = proofs.filter((p) => p.status === "pending").length
    const total = proofs.length || 1

    const appMap = new Map<string, { total: number; verified: number; failed: number }>()
    for (const p of proofs) {
      const e = appMap.get(p.appId) ?? { total: 0, verified: 0, failed: 0 }
      e.total++
      if (p.status === "verified") e.verified++
      if (p.status === "rejected") e.failed++
      appMap.set(p.appId, e)
    }

    const byProject = [...appMap.entries()].map(([appId, data]) => {
      const app = this.state.apps.find((a) => a.id === appId)
      return { appId, appName: app?.name ?? appId, ...data, rate: data.total > 0 ? (data.verified / data.total) * 100 : 0 }
    }).sort((a, b) => a.rate - b.rate)

    const dailyRate: Array<{ date: string; submitted: number; verified: number }> = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const sub = Math.floor(Math.random() * 15) + 3
      dailyRate.push({ date: d.toISOString().slice(0, 10), submitted: sub, verified: Math.floor(sub * (0.8 + Math.random() * 0.2)) })
    }

    return { total: proofs.length, verified, failed, pending, successRate: (verified / total) * 100, avgVerificationTime: 1.8 + Math.random() * 3, byProject, dailyRate }
  }

  // ═══════════════════════════════════════════════════
  //  MINING: Active Jobs Across Projects
  // ═══════════════════════════════════════════════════

  getActiveJobs(minerId: string): Array<{ id: string; appId: string; appName: string; status: string; type: string; startedAt: string; reward: number }> {
    const subs = this.state.subscriptions.filter((s) => s.minerId === minerId && s.status === "active")
    const jobs: Array<{ id: string; appId: string; appName: string; status: string; type: string; startedAt: string; reward: number }> = []
    for (const sub of subs) {
      const app = this.state.apps.find((a) => a.id === sub.appId)
      const appJobs = this.state.jobs.filter((j) => j.appId === sub.appId && j.minerId === minerId && (j.status === "queued" || j.status === "running"))
      for (const j of appJobs) {
        jobs.push({ id: j.id, appId: sub.appId, appName: app?.name ?? sub.appId, status: j.status, type: j.type ?? "compute", startedAt: j.startedAt ?? j.createdAt, reward: j.reward ?? 0 })
      }
    }
    // If no real jobs, generate a few mock active ones
    if (jobs.length === 0 && subs.length > 0) {
      for (const sub of subs.slice(0, 3)) {
        const app = this.state.apps.find((a) => a.id === sub.appId)
        jobs.push({ id: `job_${sub.appId}_live`, appId: sub.appId, appName: app?.name ?? sub.appId, status: "running", type: "proof_generation", startedAt: nowIso(), reward: 0.25 + Math.random() * 0.5 })
      }
    }
    return jobs.sort((a, b) => (a.status === "running" ? 0 : 1) - (b.status === "running" ? 0 : 1))
  }

  // ═══════════════════════════════════════════════════
  //  MINING: Alerts
  // ═══════════════════════════════════════════════════

  getMiningAlerts(minerId: string): Array<{ id: string; type: "uptime" | "proof_failure" | "slashing" | "low_collateral"; severity: "warning" | "critical"; message: string; appId?: string; timestamp: string }> {
    const alerts: Array<{ id: string; type: "uptime" | "proof_failure" | "slashing" | "low_collateral"; severity: "warning" | "critical"; message: string; appId?: string; timestamp: string }> = []
    const subs = this.state.subscriptions.filter((s) => s.minerId === minerId)

    for (const sub of subs) {
      const app = this.state.apps.find((a) => a.id === sub.appId)
      const name = app?.name ?? sub.appId
      if (sub.uptime < 95) {
        alerts.push({ id: `alert_uptime_${sub.appId}`, type: "uptime", severity: sub.uptime < 80 ? "critical" : "warning", message: `${name}: uptime dropped to ${sub.uptime.toFixed(1)}%`, appId: sub.appId, timestamp: nowIso() })
      }
      const proofs = this.state.proofs.filter((p) => p.appId === sub.appId && p.minerId === minerId)
      const failed = proofs.filter((p) => p.status === "rejected").length
      if (failed > 3) {
        alerts.push({ id: `alert_proof_${sub.appId}`, type: "proof_failure", severity: failed > 10 ? "critical" : "warning", message: `${name}: ${failed} proofs failed verification`, appId: sub.appId, timestamp: nowIso() })
      }
    }

    const slashEvents = this.state.slashingEvents.filter((s) => s.minerId === minerId)
    for (const s of slashEvents.slice(-3)) {
      alerts.push({ id: `alert_slash_${s.id}`, type: "slashing", severity: "critical", message: `Slashed ${s.amount.toFixed(2)} NECTA: ${s.reason}`, appId: s.appId, timestamp: s.createdAt })
    }

    return alerts.sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1))
  }

  // ═══════════════════════════════════════════════════
  //  MINING: Earnings Goal
  // ═══════════════════════════════════════════════════

  getEarningsGoal(minerId: string): { target: number; current: number; period: string } | null {
    const key = `earningsGoal_${minerId}`
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null
      if (!raw) return null
      return JSON.parse(raw)
    } catch { return null }
  }

  setEarningsGoal(minerId: string, target: number) {
    const subs = this.state.subscriptions.filter((s) => s.minerId === minerId)
    const totalEarned = subs.reduce((s, sub) => s + (sub.totalEarned ?? 0), 0)
    const goal = { target, current: totalEarned, period: new Date().toISOString().slice(0, 7) }
    const key = `earningsGoal_${minerId}`
    try { if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(goal)) } catch {}
    return goal
  }

  // ═══════════════════════════════════════════════════
  //  MINING: Collateral Actions
  // ═══════════════════════════════════════════════════

  topUpCollateral(input: { minerId: string; appId: string; amount: number }) {
    this.requireAuth()
    const walletAddress = this.state.session.walletAddress!
    const balance = this.state.walletBalancesByAddress[walletAddress] ?? 0
    if (balance < input.amount) throw new Error(`Insufficient balance. Have ${balance.toFixed(2)}, need ${input.amount}.`)

    this.setState((prev) => {
      const sub = prev.subscriptions.find((s) => s.appId === input.appId && s.minerId === input.minerId)
      return {
        ...prev,
        walletBalancesByAddress: { ...prev.walletBalancesByAddress, [walletAddress]: balance - input.amount },
        subscriptions: prev.subscriptions.map((s) =>
          s.appId === input.appId && s.minerId === input.minerId
            ? { ...s, collateral: (s.collateral ?? 0) + input.amount }
            : s
        ),
        updatedAt: nowIso(),
      }
    })
  }

  approveListing(appId: string) {
    this.requireRole("governance")
    this.setState((prev) => {
      const listingStatusByAppId = { ...prev.listingStatusByAppId, [appId]: "listed" as const }
      const governance = prev.governance.map((g) =>
        g.appId === appId
          ? { ...g, status: "approved" as const, decidedAt: nowIso(), yesVotes: g.yesVotes + 25 }
          : g,
      )
      return { ...prev, listingStatusByAppId, governance, updatedAt: nowIso() }
    })

    this.emit({
      type: "listing_approved",
      appId,
      message: "Listing approved.",
    })
  }

  rejectListing(appId: string, reason = "Rejected by governance") {
    this.requireRole("governance")
    this.setState((prev) => {
      const listingStatusByAppId = { ...prev.listingStatusByAppId, [appId]: "delisted" as const }
      const governance = prev.governance.map((g) =>
        g.appId === appId
          ? { ...g, status: "rejected" as const, decidedAt: nowIso(), noVotes: g.noVotes + 25, reason }
          : g,
      )
      return { ...prev, listingStatusByAppId, governance, updatedAt: nowIso() }
    })

    this.emit({
      type: "listing_rejected",
      appId,
      message: "Listing rejected.",
      metadata: { reason },
    })
  }

  markConditionsMet(appId: string) {
    this.requireRole("governance")
    this.setState((prev) => {
      const listingStatusByAppId = { ...prev.listingStatusByAppId, [appId]: "listed" as const }
      const governance = prev.governance.map((g) =>
        g.appId === appId ? { ...g, conditionsMetAt: nowIso() } : g,
      )
      return { ...prev, listingStatusByAppId, governance, updatedAt: nowIso() }
    })

    this.emit({
      type: "listing_approved",
      appId,
      message: "Conditions marked complete; listing moved to full status.",
    })
  }

  subscribeToApp(input: { appId: string; minerId: string; walletAddress?: string; stakeAmount?: number }) {
    const app = this.state.apps.find((a) => a.id === input.appId) ?? null
    // Ensure miner (and default attestation caps) exist before checking requirements,
    // so "Subscribe to Network" works for newly connected wallets.
    if (input.walletAddress) {
      this.ensureMiner({ minerId: input.minerId, walletAddress: input.walletAddress })
    }
    const reqs =
      (Array.isArray((app as any)?.attestationRequirements) ? ((app as any).attestationRequirements as any[]) : []) ??
      []
    const effectiveReqs = reqs.length > 0 ? reqs : app ? defaultAttestationRequirementsForApp(app) : []
    if (effectiveReqs.length > 0) {
      const caps = this.state.attestationCapabilitiesByMinerId?.[input.minerId] ?? { tpm: false, tee: false, sgx: false }
      const missing: string[] = []
      for (const r of effectiveReqs as string[]) {
        if (r === "TPM" && !caps.tpm) missing.push("TPM")
        if (r === "TEE" && !caps.tee) missing.push("TEE")
        if (r === "SGX" && !caps.sgx) missing.push("SGX")
      }
      if (missing.length > 0) {
        this.emit({
          type: "subscription_blocked",
          minerId: input.minerId,
          walletAddress: input.walletAddress,
          appId: input.appId,
          message: `Subscription blocked: missing attestations (${missing.join(", ")}).`,
          metadata: { missing },
        })
        return null
      }
    }
    const id = randId("sub")
    const startedAt = nowIso()
    const subscription: Subscription = {
      id,
      minerId: input.minerId,
      appId: input.appId,
      status: "active",
      startedAt,
      totalEarned: 0,
      tasksCompleted: 0,
      uptime: 100,
      stakeAmount: input.stakeAmount ?? 0,
      collateralLocked: (input.stakeAmount ?? 0) > 0,
    }

    this.setState((prev) => ({ ...prev, subscriptions: [subscription, ...prev.subscriptions], updatedAt: nowIso() }))

    this.emit({
      type: "subscription_created",
      minerId: subscription.minerId,
      walletAddress: input.walletAddress,
      appId: subscription.appId,
      subscriptionId: subscription.id,
      message: "Subscription created and mining started.",
      metadata: { stakeAmount: subscription.stakeAmount },
    })
    // Create first job immediately for “it feels real”
    this.enqueueJob({ subscriptionId: subscription.id })
    return subscription
  }

  pauseSubscription(subscriptionId: string) {
    const session = this.requireSession()
    const owned = this.state.subscriptions.find((s) => s.id === subscriptionId) ?? null
    if (owned && owned.minerId !== session.minerId) throw new Error("Forbidden (not your subscription).")
    this.setState((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) => (s.id === subscriptionId ? { ...s, status: "paused" } : s)),
      updatedAt: nowIso(),
    }))

    const sub = this.state.subscriptions.find((s) => s.id === subscriptionId)
    this.emit({
      type: "subscription_paused",
      minerId: sub?.minerId,
      appId: sub?.appId,
      subscriptionId,
      message: "Subscription paused.",
    })
  }

  resumeSubscription(subscriptionId: string) {
    const session = this.requireSession()
    const owned = this.state.subscriptions.find((s) => s.id === subscriptionId) ?? null
    if (owned && owned.minerId !== session.minerId) throw new Error("Forbidden (not your subscription).")
    this.setState((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) => (s.id === subscriptionId ? { ...s, status: "active" } : s)),
      updatedAt: nowIso(),
    }))

    const sub = this.state.subscriptions.find((s) => s.id === subscriptionId)
    this.emit({
      type: "subscription_resumed",
      minerId: sub?.minerId,
      appId: sub?.appId,
      subscriptionId,
      message: "Subscription resumed.",
    })
    this.enqueueJob({ subscriptionId })
  }

  enqueueJob(input: { subscriptionId: string }) {
    const sub = this.state.subscriptions.find((s) => s.id === input.subscriptionId)
    if (!sub || sub.status !== "active") return null

    const jobId = randId("job")
    const rng = mulberry32(stableSeedFromString(`${jobId}:${sub.appId}:${sub.minerId}`))
    const app = this.state.apps.find((a) => a.id === sub.appId) ?? null
    const pricing = (app as any)?.rewardPricingModel as any
    const base = typeof (app as any)?.baseRewardPerTask === "number" ? Number((app as any).baseRewardPerTask) : rng() * 2 + 0.25
    const minR =
      typeof (app as any)?.minRewardPerTask === "number"
        ? Number((app as any).minRewardPerTask)
        : 0.01
    const maxR =
      typeof (app as any)?.maxRewardPerTask === "number"
        ? Number((app as any).maxRewardPerTask)
        : 25

    let reward = base
    if (pricing === "fixed") {
      reward = base
    } else if (pricing === "variable") {
      // Variable within [min,max] (e.g., based on SLA/perf).
      reward = base * (0.7 + rng() * 0.9)
    } else if (pricing === "marketplace") {
      // Marketplace-like: demand pressure increases reward slightly with active miner count.
      const activeMiners = this.state.subscriptions.filter((s) => s.appId === sub.appId && s.status === "active").length
      const demand = 1 + Math.min(0.5, activeMiners / 100)
      const surge = typeof (app as any)?.marketplaceSurgeMultiplier === "number" ? Number((app as any).marketplaceSurgeMultiplier) : 0.5
      reward = base * demand * (1 + rng() * clamp(surge, 0, 2))
    } else {
      // Default (legacy): small random reward
      reward = rng() * 2 + 0.25
    }
    reward = clamp(reward, minR, maxR)
    reward = Math.max(0.01, Number(reward.toFixed(4)))

    const job: MiningJob = {
      id: jobId,
      appId: sub.appId,
      subscriptionId: sub.id,
      minerId: sub.minerId,
      status: "queued",
      createdAt: nowIso(),
      reward,
    }

    this.setState((prev) => ({ ...prev, jobs: [job, ...prev.jobs], updatedAt: nowIso() }))
    this.emit({
      type: "job_queued",
      minerId: job.minerId,
      appId: job.appId,
      subscriptionId: job.subscriptionId,
      jobId: job.id,
      message: "Job queued.",
      metadata: { reward: job.reward },
    })
    // Auto-run it quickly to simulate a live system
    setTimeout(() => this.runJob(jobId), 700 + Math.floor(Math.random() * 900))
    return job
  }

  runJob(jobId: string) {
    const job = this.state.jobs.find((j) => j.id === jobId)
    if (!job) return

    this.setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => (j.id === jobId ? { ...j, status: "running" as const, startedAt: nowIso() } : j)),
      updatedAt: nowIso(),
    }))

    const j = this.state.jobs.find((x) => x.id === jobId)
    this.emit({
      type: "job_started",
      minerId: j?.minerId,
      appId: j?.appId,
      subscriptionId: j?.subscriptionId,
      jobId,
      message: "Job started.",
    })

    setTimeout(() => this.completeJob(jobId), 1200 + Math.floor(Math.random() * 1400))
  }

  completeJob(jobId: string) {
    const job = this.state.jobs.find((j) => j.id === jobId)
    if (!job) return

    const rng = mulberry32(stableSeedFromString(`complete:${jobId}`))
    const ok = rng() > 0.05

    if (!ok) {
      const proofId = randId("proof")
      const submittedAt = nowIso()
      const rejectionReason = "Verifier rejected proof"

      const proof: ProofSubmission = {
        id: proofId,
        subscriptionId: job.subscriptionId,
        minerId: job.minerId,
        appId: job.appId,
        status: "rejected",
        submittedAt,
        verifiedAt: submittedAt,
        reward: job.reward,
        hash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64)}`,
        metadata: { jobId, rejectionReason },
      }

      const proofDetail: ProofDetail = {
        id: `detail_${proofId}`,
        subscriptionId: job.subscriptionId,
        appId: job.appId,
        minerId: job.minerId,
        proofData: proof.hash,
        status: "rejected",
        submittedAt,
        verifiedAt: submittedAt,
        verifierNode: "necter-verifier-01",
        expectedEarning: job.reward,
        rejectionReason,
        verificationTime: 250 + Math.floor(Math.random() * 350),
      }

      this.setState((prev) => {
        const now = nowIso()
        const jobs = prev.jobs.map((j) =>
          j.id === jobId ? { ...j, status: "failed" as const, completedAt: now, failureReason: rejectionReason, proofId } : j,
        )
        const proofs = [proof, ...prev.proofs]
        const proofDetails = [proofDetail, ...prev.proofDetails]

        const sub = prev.subscriptions.find((s) => s.id === job.subscriptionId) ?? null
        const stake = sub?.stakeAmount ?? 0
        const slashAmount = stake > 0 ? Number((stake * 0.05).toFixed(4)) : 0

        const slashingEvents = [...(prev.slashingEvents ?? [])]
        const subscriptions =
          sub && slashAmount > 0
            ? prev.subscriptions.map((s) =>
                s.id === sub.id
                  ? {
                      ...s,
                      stakeAmount: Math.max(0, Number(((s.stakeAmount ?? 0) - slashAmount).toFixed(4))),
                      collateralLocked: Math.max(0, (s.stakeAmount ?? 0) - slashAmount) > 0,
                    }
                  : s,
              )
            : prev.subscriptions

        if (sub && slashAmount > 0) {
          slashingEvents.unshift({
            id: randId("slash"),
            createdAt: now,
            appId: sub.appId,
            minerId: sub.minerId,
            subscriptionId: sub.id,
            amount: slashAmount,
            reason: "Rejected proof (prototype slashing).",
          })
        }

        const minerReputationByMinerId = { ...(prev.minerReputationByMinerId ?? {}) }
        if (sub) {
          const cur = typeof minerReputationByMinerId[sub.minerId] === "number" ? minerReputationByMinerId[sub.minerId] : 4.0
          minerReputationByMinerId[sub.minerId] = Math.max(0, Number((cur - (slashAmount > 0 ? 0.1 : 0.02)).toFixed(2)))
        }

        const slashEvent: TimelineEvent | null =
          sub && slashAmount > 0
            ? {
                id: randId("evt"),
                type: "slash_applied",
                createdAt: now,
                minerId: sub.minerId,
                appId: sub.appId,
                subscriptionId: sub.id,
                jobId,
                proofId,
                message: `Slashing applied: -${slashAmount} stake (prototype).`,
                metadata: { amount: slashAmount, reason: "rejected_proof" },
              }
            : null

        const events = slashEvent ? [slashEvent, ...prev.events].slice(0, 500) : prev.events

        return {
          ...prev,
          jobs,
          proofs,
          proofDetails,
          subscriptions,
          slashingEvents: slashingEvents.slice(0, 500),
          minerReputationByMinerId,
          events,
          updatedAt: now,
        }
      })
      this.emit({
        type: "job_failed",
        minerId: job.minerId,
        appId: job.appId,
        subscriptionId: job.subscriptionId,
        jobId,
        proofId,
        message: "Job failed: verifier rejected proof.",
      })
      this.emit({
        type: "proof_submitted",
        minerId: job.minerId,
        appId: job.appId,
        subscriptionId: job.subscriptionId,
        jobId,
        proofId,
        message: "Proof submitted (rejected).",
        metadata: { status: "rejected" },
      })
      return
    }

    const proofId = randId("proof")
    const proof: ProofSubmission = {
      id: proofId,
      subscriptionId: job.subscriptionId,
      minerId: job.minerId,
      appId: job.appId,
      status: "pending",
      submittedAt: nowIso(),
      reward: job.reward,
      hash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64)}`,
      metadata: { jobId },
    }

    const proofDetail: ProofDetail = {
      id: `detail_${proofId}`,
      subscriptionId: job.subscriptionId,
      appId: job.appId,
      minerId: job.minerId,
      proofData: proof.hash,
      status: "verifying",
      submittedAt: proof.submittedAt,
      verifierNode: "necter-verifier-01",
      expectedEarning: job.reward,
      verificationTime: 250 + Math.floor(Math.random() * 350),
    }

    this.setState((prev) => {
      const jobs = prev.jobs.map((j) =>
        j.id === jobId
          ? { ...j, status: "completed" as const, completedAt: nowIso(), proofId: proofId }
          : j,
      )
      const proofs = [proof, ...prev.proofs]
      const proofDetails = [proofDetail, ...prev.proofDetails]
      return { ...prev, jobs, proofs, proofDetails, updatedAt: nowIso() }
    })

    this.emit({
      type: "job_completed",
      minerId: job.minerId,
      appId: job.appId,
      subscriptionId: job.subscriptionId,
      jobId,
      proofId,
      message: "Job completed; proof submitted.",
      metadata: { reward: job.reward },
    })

    // Verify asynchronously (so Proof Queue is meaningful)
    setTimeout(() => {
      this.setState((prev) => {
        const proofs = prev.proofs.map((p) =>
          p.id === proofId ? { ...p, status: "verified" as const, verifiedAt: nowIso() } : p,
        )
        const proofDetails = prev.proofDetails.map((d) =>
          d.id === `detail_${proofId}`
            ? { ...d, status: "verified" as const, verifiedAt: nowIso(), actualEarning: job.reward }
            : d,
        )
        const subscriptions = prev.subscriptions.map((s) =>
          s.id === job.subscriptionId
            ? {
                ...s,
                tasksCompleted: s.tasksCompleted + 1,
                totalEarned: Number((s.totalEarned + job.reward).toFixed(4)),
                uptime: Math.max(80, Number((s.uptime - Math.random() * 0.03).toFixed(2))),
              }
            : s,
        )

        const app = prev.apps.find((a) => a.id === job.appId) ?? null
        const miner = prev.miners.find((m) => m.id === job.minerId) ?? null
        const minerWallet = miner?.walletAddress
        const developerWallet = app?.developerAddress

        // --- Reward split (prototype economics) ---
        // Base split: 80% miner, 15% developer, 5% treasury.
        let minerPct = 0.8
        let devPct = 0.15
        let treasuryPct = 0.05

        // Optional per-app custom split (percentages that sum to 100).
        if (app) {
          const m = (app as any).feeSplitMinerPct
          const d = (app as any).feeSplitDeveloperPct
          const t = (app as any).feeSplitTreasuryPct
          if (typeof m === "number" && typeof d === "number" && typeof t === "number") {
            const sum = m + d + t
            if (sum > 0 && Math.abs(sum - 100) < 0.0001 && m >= 0 && d >= 0 && t >= 0) {
              minerPct = m / 100
              devPct = d / 100
              treasuryPct = t / 100
            }
          }
        }

        // Progressive pool (very small prototype): top miner for this app gets +5% from treasury.
        if (app) {
          const byMiner = new Map<string, number>()
          for (const s of subscriptions) {
            if (s.appId !== app.id) continue
            byMiner.set(s.minerId, (byMiner.get(s.minerId) ?? 0) + (s.tasksCompleted ?? 0))
          }
          const sorted = [...byMiner.entries()].sort((a, b) => b[1] - a[1])
          const topMinerId = sorted[0]?.[0]
          if (topMinerId && topMinerId === job.minerId) {
            const bonus = Math.min(0.05, treasuryPct)
            minerPct += bonus
            treasuryPct -= bonus
          }
        }

        const gross = Number(job.reward.toFixed(4))
        const minerAmount = Number((gross * minerPct).toFixed(4))
        const developerAmount = Number((gross * devPct).toFixed(4))
        const treasuryAmount = Number((gross * treasuryPct).toFixed(4))

        const payoutId = randId("payout")
        const payout: Payout = {
          id: payoutId,
          createdAt: nowIso(),
          appId: job.appId,
          minerId: job.minerId,
          walletAddress: minerWallet,
          subscriptionId: job.subscriptionId,
          jobId,
          proofId,
          gross,
          minerAmount,
          developerAmount,
          treasuryAmount,
          developerWalletAddress: developerWallet,
        }

        const walletBalancesByAddress = { ...(prev.walletBalancesByAddress ?? {}) }
        if (minerWallet) walletBalancesByAddress[minerWallet] = Number(((walletBalancesByAddress[minerWallet] ?? 0) + minerAmount).toFixed(4))
        if (developerWallet) walletBalancesByAddress[developerWallet] = Number(((walletBalancesByAddress[developerWallet] ?? 0) + developerAmount).toFixed(4))

        const treasuryBalance = Number(((prev.treasuryBalance ?? 0) + treasuryAmount).toFixed(4))
        const payouts = [payout, ...(prev.payouts ?? [])].slice(0, 2000)

        // --- Badges (prototype) ---
        const minerBadges = prev.badgesByMinerId?.[job.minerId] ?? []
        const hasBadge = (name: string) => minerBadges.some((b) => b.name === name)
        const nextBadges = [...minerBadges]
        const totalTasksAll = subscriptions.filter((s) => s.minerId === job.minerId).reduce((sum, s) => sum + (s.tasksCompleted ?? 0), 0)

        if (!hasBadge("First Proof Verified")) {
          nextBadges.push({
            id: randId("badge"),
            kind: "milestone",
            name: "First Proof Verified",
            description: "Submit and verify your very first proof on Necter",
            mintedAt: nowIso(),
            appId: job.appId,
          })
        }
        if (totalTasksAll >= 10 && !hasBadge("10 Proofs Verified")) {
          nextBadges.push({
            id: randId("badge"),
            kind: "milestone",
            name: "10 Proofs Verified",
            description: "Verify 10 proofs across any combination of projects",
            mintedAt: nowIso(),
          })
        }
        if (totalTasksAll >= 100 && !hasBadge("Centurion")) {
          nextBadges.push({
            id: randId("badge"),
            kind: "milestone",
            name: "Centurion",
            description: "Complete 100 verified proofs. You're no longer a beginner",
            mintedAt: nowIso(),
          })
        }
        // First Payout badge
        if (minerAmount > 0 && !hasBadge("First Payout")) {
          nextBadges.push({
            id: randId("badge"),
            kind: "milestone",
            name: "First Payout",
            description: "Receive your first NECTA reward payout from a mining project",
            mintedAt: nowIso(),
            appId: job.appId,
          })
        }
        // Multi-network miner
        const minerNetworkCount = new Set(subscriptions.filter((s) => s.minerId === job.minerId && s.status === "active").map((s) => s.appId)).size
        if (minerNetworkCount >= 3 && !hasBadge("Network Hopper")) {
          nextBadges.push({
            id: randId("badge"),
            kind: "community",
            name: "Network Hopper",
            description: "Mine on 3 or more different projects simultaneously",
            mintedAt: nowIso(),
          })
        }
        // Category explorer
        const minerCategories = new Set(
          subscriptions
            .filter((s) => s.minerId === job.minerId && s.status === "active")
            .map((s) => prev.apps.find((a) => a.id === s.appId)?.category)
            .filter(Boolean)
        )
        if (minerCategories.size >= 4 && !hasBadge("Category Explorer")) {
          nextBadges.push({
            id: randId("badge"),
            kind: "community",
            name: "Category Explorer",
            description: "Mine at least one project from 4 different categories",
            mintedAt: nowIso(),
          })
        }
        // Earnings milestones
        const lifetimeEarned = prev.proofs.filter((p) => p.minerId === job.minerId && p.status === "verified").reduce((s, p) => s + p.reward, 0) + minerAmount
        if (lifetimeEarned >= 1000 && !hasBadge("Diamond Hands")) {
          nextBadges.push({
            id: randId("badge"),
            kind: "milestone",
            name: "Diamond Hands",
            description: "Accumulate 1,000 NECTA in total lifetime earnings",
            mintedAt: nowIso(),
          })
        }

        const badgesByMinerId = { ...(prev.badgesByMinerId ?? {}) }
        badgesByMinerId[job.minerId] = nextBadges.slice(0, 50)

        // Also write an event for the payout (explorer visibility).
        const payoutEvent: TimelineEvent = {
          id: randId("evt"),
          type: "payout_distributed",
          createdAt: nowIso(),
          minerId: job.minerId,
          walletAddress: minerWallet,
          appId: job.appId,
          subscriptionId: job.subscriptionId,
          jobId,
          proofId,
          payoutId,
          message: "Payout distributed (prototype split).",
          metadata: { gross, minerAmount, developerAmount, treasuryAmount },
        }

        return {
          ...prev,
          proofs,
          proofDetails,
          subscriptions,
          walletBalancesByAddress,
          treasuryBalance,
          payouts,
          badgesByMinerId,
          events: [payoutEvent, ...prev.events].slice(0, 500),
          updatedAt: nowIso(),
        }
      })

      this.emit({
        type: "proof_verified",
        minerId: job.minerId,
        appId: job.appId,
        subscriptionId: job.subscriptionId,
        jobId,
        proofId,
        message: "Proof verified; rewards credited.",
        metadata: { reward: job.reward },
      })
    }, 900 + Math.floor(Math.random() * 900))

    // enqueue another job to keep things “alive”
    setTimeout(() => this.enqueueJob({ subscriptionId: job.subscriptionId }), 2500 + Math.floor(Math.random() * 3500))
  }

  requestWithdrawal(input: { minerId: string; walletAddress: string; amount: number }) {
    const session = this.requireSession()
    if (input.minerId !== session.minerId || input.walletAddress !== session.walletAddress) {
      throw new Error("Forbidden (withdrawal must be from your connected wallet).")
    }
    const id = randId("wd")
    const w: Withdrawal = {
      id,
      minerId: input.minerId,
      amount: input.amount,
      status: "processing",
      requestedAt: nowIso(),
      walletAddress: input.walletAddress,
      fee: Number((Math.max(0.01, input.amount * 0.005)).toFixed(4)),
    }

    this.setState((prev) => {
      const current = prev.walletBalancesByAddress[input.walletAddress] ?? 0
      if (input.amount <= 0) return prev
      if (current < input.amount + w.fee) return prev
      const next = Math.max(0, Number((current - input.amount - w.fee).toFixed(4)))
      return {
        ...prev,
        withdrawals: [w, ...prev.withdrawals],
        walletBalancesByAddress: { ...prev.walletBalancesByAddress, [input.walletAddress]: next },
        updatedAt: nowIso(),
      }
    })

    this.emit({
      type: "withdrawal_requested",
      minerId: input.minerId,
      walletAddress: input.walletAddress,
      withdrawalId: id,
      message: "Withdrawal requested.",
      metadata: { amount: input.amount, fee: w.fee },
    })
    setTimeout(() => {
      this.setState((prev) => ({
        ...prev,
        withdrawals: prev.withdrawals.map((x) => (x.id === id ? { ...x, status: "completed", completedAt: nowIso(), txHash: `0x${randId("tx")}` } : x)),
        updatedAt: nowIso(),
      }))

      this.emit({
        type: "withdrawal_completed",
        minerId: input.minerId,
        walletAddress: input.walletAddress,
        withdrawalId: id,
        message: "Withdrawal completed.",
      })
    }, 1800 + Math.floor(Math.random() * 1500))

    return w
  }

  retryProof(proofId: string) {
    const session = this.requireSession()
    const proof = this.state.proofs.find((p) => p.id === proofId) ?? null
    if (!proof) return null
    if (proof.minerId !== session.minerId) throw new Error("Forbidden (not your proof).")
    const sub = this.state.subscriptions.find((s) => s.id === proof.subscriptionId) ?? null
    if (!sub) return null
    if (sub.status !== "active") return null

    this.emit({
      type: "job_queued",
      minerId: proof.minerId,
      appId: proof.appId,
      subscriptionId: proof.subscriptionId,
      message: "Retry requested for rejected proof; queueing new job.",
      metadata: { proofId },
    })

    return this.enqueueJob({ subscriptionId: sub.id })
  }

  fileProofDispute(input: { proofId: string; reason: string }) {
    const session = this.requireSession()
    const reason = input.reason.trim()
    const proof = this.state.proofs.find((p) => p.id === input.proofId) ?? null
    if (!proof) return null
    if (proof.minerId !== session.minerId) throw new Error("Forbidden (not your proof).")
    const now = nowIso()

    // Record dispute request.
    this.setState((prev) => ({
      ...prev,
      proofs: prev.proofs.map((p) => (p.id === input.proofId ? { ...p, disputeFiledAt: now } : p)),
      proofDetails: prev.proofDetails.map((d) =>
        d.id === `detail_${input.proofId}`
          ? { ...d, disputeFiledAt: now, disputeReason: reason, status: "verifying" as const }
          : d,
      ),
      updatedAt: nowIso(),
    }))

    this.emit({
      type: "proof_disputed",
      minerId: proof.minerId,
      appId: proof.appId,
      subscriptionId: proof.subscriptionId,
      proofId: proof.id,
      message: "Dispute filed for rejected proof.",
      metadata: { reason },
    })

    // Demo: resolve disputes quickly and deterministically as “accepted”.
    setTimeout(() => {
      this.setState((prev) => {
        const proofs = prev.proofs.map((p) =>
          p.id === input.proofId
            ? { ...p, status: "verified" as const, verifiedAt: nowIso(), disputeResolvedAt: nowIso(), disputeOutcome: "accepted" as const }
            : p,
        )
        const proofDetails = prev.proofDetails.map((d) =>
          d.id === `detail_${input.proofId}`
            ? { ...d, status: "verified" as const, verifiedAt: nowIso(), actualEarning: proof.reward, disputeResolvedAt: nowIso(), disputeOutcome: "accepted" as const }
            : d,
        )
        const subscriptions = prev.subscriptions.map((s) =>
          s.id === proof.subscriptionId
            ? {
                ...s,
                tasksCompleted: s.tasksCompleted + 1,
                totalEarned: Number((s.totalEarned + proof.reward).toFixed(4)),
              }
            : s,
        )

        const app = prev.apps.find((a) => a.id === proof.appId) ?? null
        const miner = prev.miners.find((m) => m.id === proof.minerId) ?? null
        const minerWallet = miner?.walletAddress
        const developerWallet = app?.developerAddress

        // Same prototype split as normal verification.
        const gross = Number(proof.reward.toFixed(4))
        const minerAmount = Number((gross * 0.8).toFixed(4))
        const developerAmount = Number((gross * 0.15).toFixed(4))
        const treasuryAmount = Number((gross * 0.05).toFixed(4))

        const payoutId = randId("payout")
        const payout: Payout = {
          id: payoutId,
          createdAt: nowIso(),
          appId: proof.appId,
          minerId: proof.minerId,
          walletAddress: minerWallet,
          subscriptionId: proof.subscriptionId,
          proofId: proof.id,
          gross,
          minerAmount,
          developerAmount,
          treasuryAmount,
          developerWalletAddress: developerWallet,
        }

        const walletBalancesByAddress = { ...(prev.walletBalancesByAddress ?? {}) }
        if (minerWallet) walletBalancesByAddress[minerWallet] = Number(((walletBalancesByAddress[minerWallet] ?? 0) + minerAmount).toFixed(4))
        if (developerWallet) walletBalancesByAddress[developerWallet] = Number(((walletBalancesByAddress[developerWallet] ?? 0) + developerAmount).toFixed(4))

        const treasuryBalance = Number(((prev.treasuryBalance ?? 0) + treasuryAmount).toFixed(4))
        const payouts = [payout, ...(prev.payouts ?? [])].slice(0, 2000)

        const payoutEvent: TimelineEvent = {
          id: randId("evt"),
          type: "payout_distributed",
          createdAt: nowIso(),
          minerId: proof.minerId,
          walletAddress: minerWallet,
          appId: proof.appId,
          subscriptionId: proof.subscriptionId,
          proofId: proof.id,
          payoutId,
          message: "Payout distributed after dispute resolution (prototype split).",
          metadata: { gross, minerAmount, developerAmount, treasuryAmount },
        }

        return {
          ...prev,
          proofs,
          proofDetails,
          subscriptions,
          walletBalancesByAddress,
          treasuryBalance,
          payouts,
          events: [payoutEvent, ...prev.events].slice(0, 500),
          updatedAt: nowIso(),
        }
      })

      this.emit({
        type: "proof_dispute_resolved",
        minerId: proof.minerId,
        appId: proof.appId,
        subscriptionId: proof.subscriptionId,
        proofId: proof.id,
        message: "Dispute resolved: proof accepted and credited.",
        metadata: { outcome: "accepted", reward: proof.reward },
      })
    }, 1400 + Math.floor(Math.random() * 1200))
  }
}

let singleton: MockBackendStore | null = null

export function getMockBackendStore() {
  if (singleton) return singleton
  singleton = new MockBackendStore()
  return singleton
}

