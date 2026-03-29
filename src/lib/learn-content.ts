export type LearnTabId = "guides" | "help"

export type LearnArticle = {
  tab: LearnTabId
  path: string // e.g. "guides/getting-started"
  title: string
  description: string
  readingMinutes: number
  sections: Array<{ heading: string; body: string[] }>
}

export const learnArticles: LearnArticle[] = [
  {
    tab: "guides",
    path: "guides/getting-started",
    title: "Getting started with mining",
    description: "What “start mining” means in this prototype, and what to do first.",
    readingMinutes: 4,
    sections: [
      {
        heading: "What “start mining” means",
        body: [
          "In this Next.js prototype, “Start mining” does not download or install a real native miner.",
          "It simulates the lifecycle you’d expect in production: subscribe → jobs are queued → proofs are submitted → proofs are verified → rewards are credited.",
        ],
      },
      {
        heading: "Your first steps",
        body: [
          "1) Connect a wallet (needed for miner-specific data).",
          "2) Pick a network (app) in Discover and subscribe.",
          "3) Go to My Mining to see activity, earnings, and proofs.",
        ],
      },
      {
        heading: "Where to look for what",
        body: [
          "My Mining → Activity shows jobs and proofs as they happen.",
          "My Mining → Earnings shows credited rewards and withdrawals.",
          "Proof Queue shows pending/verified/rejected proofs.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    path: "guides/hardware",
    title: "Hardware & compatibility",
    description: "Save your hardware once, then use it for compatibility checks.",
    readingMinutes: 3,
    sections: [
      {
        heading: "Save your hardware profile",
        body: [
          "Go to Settings → My Hardware and enter your CPU/GPU/RAM/storage/network.",
          "This profile is used by the Hardware Compatibility Checker and can power “works on my machine” matching later.",
        ],
      },
      {
        heading: "Run a compatibility check",
        body: [
          "Open Mining → Hardware Compatibility Checker (or from any app page).",
          "The checker estimates compatibility and earnings based on the app’s requirement strings and your saved profile.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    path: "guides/earnings",
    title: "Understanding earnings & withdrawals",
    description: "How rewards are credited and how withdrawals work in the demo.",
    readingMinutes: 4,
    sections: [
      {
        heading: "How rewards show up",
        body: [
          "Rewards are credited when proofs are verified (or when a dispute is resolved in your favor).",
          "Your wallet’s NECTA balance is updated in the mock backend for demo purposes.",
        ],
      },
      {
        heading: "Withdrawal addresses",
        body: [
          "Manage your withdrawal address book in Settings → Wallet & Assets.",
          "Earnings uses that list to keep withdrawals simple and consistent.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    path: "guides/real-miner-flow",
    title: "Real miner flow (production)",
    description: "What the real Necter Miner CLI and job/proof flow look like in production (no simulation).",
    readingMinutes: 6,
    sections: [
      {
        heading: "1. Install the miner (real)",
        body: [
          "In production you install the Necter Miner CLI on your machine (Linux/macOS/Windows). It is a real binary that talks to the Necter JobManager and runs workloads.",
          "After you subscribe to a network in the app, you run the real commands on your machine. Example (replace app slug with the network’s slug):",
          "  necter miner install --app <app-slug>   # installs the miner runtime (Docker/VM/NDSR image) for that network",
          "  necter miner run --app <app-slug> --mode daemon   # starts the miner; it registers with the JobManager and stays running",
          "  necter miner status --app <app-slug>   # shows status, current job, uptime",
          "  necter miner logs --app <app-slug> --follow   # stream logs",
          "The miner binary pulls the runtime image (Docker/VM/NDSR) that the developer published for that app, then connects to the JobManager API.",
        ],
      },
      {
        heading: "2. Run tasks (real)",
        body: [
          "The JobManager assigns jobs to your miner based on your subscription and app capacity. Your miner process receives job payloads over the wire (e.g. task ID, input data, timeout).",
          "The miner executes the workload locally (e.g. run inference, store data, relay packets) according to the app’s task domain. No simulation: real compute/storage/bandwidth is used.",
          "When the task completes, the miner produces a proof (e.g. result hash, attestation) and sends it back to the verifier API.",
        ],
      },
      {
        heading: "3. Submit proof → verification → escrow release (real)",
        body: [
          "The miner submits the proof to the Necter verifier service (or on-chain verifier contract, depending on app config).",
          "The verifier validates the proof (signature, hash, SLA). If valid, it marks the proof as verified and triggers the payout pipeline.",
          "JobEscrow (app escrow) releases the reward: miner share is sent to your wallet, developer share to the app owner, treasury share to the protocol. Your wallet balance is updated on-chain or via the settlement layer.",
        ],
      },
      {
        heading: "4. Earn rewards (real)",
        body: [
          "Your miner wallet balance is updated when proofs are verified and payouts are executed. You can withdraw to your preferred address via the app or directly from the escrow/contract once the withdrawal flow is supported.",
          "In this prototype, the same flow is simulated in the browser (no real binary, no real workloads). The real flow uses the same concepts: subscribe → jobs → proofs → verification → escrow release → balance.",
        ],
      },
    ],
  },
  {
    tab: "help",
    path: "help/proofs-and-disputes",
    title: "Proofs, rejections, and disputes",
    description: "What to do when a proof is rejected, and how disputes work.",
    readingMinutes: 4,
    sections: [
      {
        heading: "Rejected proofs",
        body: [
          "A job can fail verification and generate a rejected proof with a reason.",
          "You can retry a rejected proof, which queues a new job.",
        ],
      },
      {
        heading: "Disputes",
        body: [
          "If you believe a proof was incorrectly rejected, you can file a dispute.",
          "In this prototype, disputes resolve quickly and may credit rewards if accepted.",
        ],
      },
    ],
  },
  {
    tab: "help",
    path: "help/withdrawals",
    title: "Withdrawals",
    description: "Common issues and what to check before withdrawing.",
    readingMinutes: 3,
    sections: [
      {
        heading: "Before you withdraw",
        body: [
          "Make sure your wallet is connected so the app knows which miner profile to use.",
          "Add at least one payout address in Settings → Wallet & Assets.",
        ],
      },
      {
        heading: "Fees",
        body: [
          "Withdrawals include a small network fee and protocol fee deducted automatically from the withdrawal amount.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    path: "guides/ndsr",
    title: "NDSR: Necter Distributed State Runtime",
    description: "The runtime that powers every mining workload on Necter. How tasks execute, proofs are generated, and state is verified.",
    readingMinutes: 8,
    sections: [
      {
        heading: "What is NDSR?",
        body: [
          "NDSR (Necter Distributed State Runtime) is the execution layer that runs inside every miner node. When you subscribe to a network and start mining, your node downloads an NDSR container specific to that network.",
          "The container handles everything: receiving job payloads from the JobManager, executing the workload (AI inference, data storage, bandwidth relay, sensor processing), generating cryptographic proofs, and submitting results for verification.",
        ],
      },
      {
        heading: "How tasks flow through NDSR",
        body: [
          "1. The JobManager assigns a task to your miner based on capacity and network rules.",
          "2. Your NDSR container receives the task payload (input data, parameters, timeout).",
          "3. The runtime executes the workload locally using your GPU, CPU, storage, or bandwidth.",
          "4. On completion, NDSR generates a proof: a cryptographic attestation that the work was done correctly.",
          "5. The proof is submitted to the network's verifier (on-chain or off-chain depending on the network's consensus mechanism).",
          "6. If verified, the JobEscrow releases your reward automatically.",
        ],
      },
      {
        heading: "ZK-backed proof generation",
        body: [
          "NDSR supports zero-knowledge proof generation for networks that require it. This means your miner can prove it completed a task correctly without revealing the input data or internal state.",
          "ZK proofs are used by AI/ML networks (proving inference was run on the correct model), storage networks (proving data availability without downloading), and validation networks (proving data integrity).",
        ],
      },
      {
        heading: "Container isolation and security",
        body: [
          "Each network's NDSR container runs in an isolated sandbox. One network's workload cannot access another network's data, keys, or state.",
          "The runtime enforces resource limits (CPU time, memory, disk I/O) based on your mining allocation settings. If a container exceeds its allocation, it's throttled, not killed.",
          "Developers publish signed NDSR images. Your miner verifies the signature before running any container, preventing tampered or malicious code from executing.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    path: "guides/hivekit",
    title: "HiveKit: Developer SDK",
    description: "The SDK that network developers use to build, deploy, and manage mining networks on Necter.",
    readingMinutes: 7,
    sections: [
      {
        heading: "What is HiveKit?",
        body: [
          "HiveKit is the developer toolkit for building mining networks on Necter. It provides SDKs, CLI tools, and runtime libraries that handle the complexity of distributed task orchestration, proof verification, and reward distribution.",
          "Instead of building mining infrastructure from scratch, developers define their network's logic (what tasks look like, how proofs are verified, how rewards are calculated) and HiveKit handles the rest.",
        ],
      },
      {
        heading: "Building a network with HiveKit",
        body: [
          "1. Define your task schema: what input data miners receive, what output they produce, and how long tasks should take.",
          "2. Implement your verification logic: how the network checks that a miner's proof is valid.",
          "3. Configure reward economics: per-task pricing, miner/developer/treasury splits, staking requirements, and SLA penalties.",
          "4. Package your mining runtime as an NDSR container: the actual code that miners will run.",
          "5. Deploy via the Developer Portal or HiveKit CLI. Your network goes through governance review before listing.",
        ],
      },
      {
        heading: "Supported workload types",
        body: [
          "AI/ML inference: Miners run model predictions on GPU hardware. HiveKit provides model serving templates for PyTorch, TensorFlow, and ONNX.",
          "Decentralized storage: Miners provide disk space. HiveKit handles erasure coding, replication policies, and retrieval market configuration.",
          "DePIN and IoT: Miners operate physical infrastructure (hotspots, sensors, gateways). HiveKit includes coverage mapping and signal attestation tools.",
          "General compute: Miners contribute GPU/CPU cycles for rendering, training, or parallel workloads. HiveKit manages job queues and failover.",
        ],
      },
      {
        heading: "Monitoring and analytics",
        body: [
          "HiveKit provides real-time dashboards for network developers: active miners, proof success rates, earnings distribution, and miner growth over time.",
          "Developers can set up alerts for anomalies: sudden miner drops, proof rejection spikes, or escrow runway warnings.",
          "The analytics API integrates with the Developer Portal, where you can view network health, manage versions, and respond to governance reviews.",
        ],
      },
    ],
  },
]

export function getLearnArticleByPath(path: string): LearnArticle | null {
  const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "")
  return learnArticles.find((a) => a.path === normalized) ?? null
}

