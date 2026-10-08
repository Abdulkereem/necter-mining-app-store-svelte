/**
 * Static help content for /learn (PLATFORM.md §j.3, P0). Describes the Necter testnet as specified in
 * spec/PLATFORM.md and spec/miner-core.md — no sample projects or numbers from external networks.
 */
export type LearnTabId = "guides" | "help"

export type LearnAudience = "miners" | "developers"

export type LearnArticle = {
  tab: LearnTabId
  audience: LearnAudience
  path: string // e.g. "guides/getting-started"
  title: string
  description: string
  readingMinutes: number
  sections: Array<{ heading: string; body: string[] }>
}

export const learnArticles: LearnArticle[] = [
  {
    tab: "guides",
    audience: "miners",
    path: "guides/getting-started",
    title: "Getting started with mining",
    description: "Wallet, test NECTA, a device and your first subscription on the Necter testnet.",
    readingMinutes: 4,
    sections: [
      {
        heading: "What you need",
        body: [
          "A wallet (any EIP-1193 browser wallet, or WalletConnect). Your wallet address is your miner identity: earnings, collateral and your public profile all hang off it.",
          "A device to mine with: a phone or tablet (Necter mobile app), a laptop or desktop (Necter desktop app), or a server (the necter-miner daemon).",
          "Testnet NECTA for collateral. You do not need Sepolia ETH: every miner action (bonding, unbonding, withdrawing, claiming) is signed as a gasless intent and relayed by the Hub.",
        ],
      },
      {
        heading: "Your first steps",
        body: [
          "1) Connect your wallet and sign in. Sign-in is a free signed message (SIWE), not a transaction.",
          "2) Get test NECTA from the faucet: 1,000 NECTA per address every 24 hours.",
          "3) Install the miner on a device and bind it to your wallet. Binding is a short text that both your wallet and the device's node key sign.",
          "4) Open a project in Discover, check your device against its requirements and subscribe. Subscribing bonds the project's minimum collateral (or more) in NECTA.",
          "5) Keep the miner running. It picks up task offers from the projects you subscribed to and earns compute units for every round it gets right.",
        ],
      },
      {
        heading: "Where to look for what",
        body: [
          "My Mining shows your devices, subscriptions, leases and proofs as they happen.",
          "Earnings and Withdraw show settled epochs, what you can claim and your collateral withdrawals.",
          "The Explorer shows every round, reward epoch, settlement and slash on the network — no sign-in needed.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "miners",
    path: "guides/apps",
    title: "Desktop, mobile and server miners",
    description: "Which miner to install on which device, and how each one runs in the background.",
    readingMinutes: 4,
    sections: [
      {
        heading: "One core, three ways to run it",
        body: [
          "Every miner runs the same Rust core with the NDSR runtime embedded. It executes project tasks in a deterministic WebAssembly engine, so a phone, a Mac and a Linux server produce byte-identical results for the same task.",
          "Miners only make outbound connections: one WebSocket to the Hub relay carries offers, leases and results. No open ports, no port forwarding — it works behind NAT and on mobile networks.",
        ],
      },
      {
        heading: "Desktop app (macOS, Windows, Linux)",
        body: [
          "The desktop app is built with Tauri and ships as .dmg, .msi, AppImage, .deb and .rpm. It starts the bundled miner, shows a local dashboard, and lives in the tray or menu bar.",
          "You can install it as a login service so mining continues after you close the window. Policies let you cap CPU use, pause while you are using the computer, or mine only on a schedule.",
        ],
      },
      {
        heading: "Mobile app (Android, iOS)",
        body: [
          "The mobile app is built with Flutter and calls the miner core directly. By default it mines only while charging, on Wi-Fi, above 40% battery and below a safe thermal level.",
          "On Android it runs as a foreground service with a persistent notification; on iOS it mines in the foreground and in background processing windows while on power.",
        ],
      },
      {
        heading: "Servers (necter-miner)",
        body: [
          "necter-miner is the CLI and daemon for headless machines. `necter-miner init` creates the data directory and node key, `necter-miner service install` sets up a systemd service, and `necter-miner join --project <project_id>` binds, funds from the faucet if needed, subscribes and starts mining in one step.",
          "A Docker image (necter/miner) is available as well. The local dashboard listens on 127.0.0.1:7878; remote access is opt-in and password-protected.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "miners",
    path: "guides/hardware",
    title: "Hardware & compatibility",
    description: "Device classes, project requirements and the benchmark every miner runs.",
    readingMinutes: 3,
    sections: [
      {
        heading: "Device profile and benchmark",
        body: [
          "Each device reports its class (phone, tablet, laptop, desktop or server), platform, CPU, memory and engine. On first start the miner runs a benchmark suite with known-answer receipts.",
          "The benchmark doubles as a correctness check: a device whose engine produces a wrong receipt is caught before it ever votes in a committee round.",
        ],
      },
      {
        heading: "Checking a project",
        body: [
          "Every project lists the device classes it accepts and its minimum requirements. The compatibility check compares a device profile against them and explains any mismatch.",
          "Use the Hardware Checker from My Mining or from a project page. Inside the desktop or mobile app it reads the profile from the local miner; in a browser you can enter the specs by hand.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "miners",
    path: "guides/committee-mining",
    title: "Committee mining and rounds",
    description: "How tasks are assigned to committees of miners, checked by validators and turned into compute units.",
    readingMinutes: 6,
    sections: [
      {
        heading: "Committees, not single miners",
        body: [
          "Each task is executed redundantly by a small committee of miners subscribed to the project (3 to 31 primaries, plus ordered backups). Every member runs the same deterministic module and signs the receipt hash of its result.",
          "A round is clean when at least two thirds plus one of the counted votes agree on one result and no counted vote names another. Otherwise it is contested.",
        ],
      },
      {
        heading: "Who gets picked",
        body: [
          "Before each project epoch the Hub publishes a snapshot of eligible miners, built from on-chain collateral and verified device bindings and attested by a validator quorum.",
          "Committees are drawn from that snapshot with a public random beacon (a Sepolia block hash taken 16 minutes before the epoch starts). Selection is weighted by bonded collateral, capped per device, times your reputation on that project — so nobody, including the Hub, can steer who is picked.",
        ],
      },
      {
        heading: "Validator finality and audits",
        body: [
          "When every leased member has voted or the deadline passes, validators check the votes and sign a finality record. A round is final once two thirds plus one of the validators signed the same record.",
          "Validators re-execute every contested round and a random share of clean rounds (about 10% on the testnet). The audit randomness comes from a block mined after the round's deadline, so miners cannot predict which rounds are checked.",
          "If no committee can be formed (too few miners, no snapshot, or the project's escrow is empty) validators run the task themselves. These validator fallback rounds return results to the client but earn no miner units.",
        ],
      },
      {
        heading: "Compute units",
        body: [
          "Every miner listed as an agreeing voter in a round's finality record earns max(1, ceil(gas_used / 1,000,000)) compute units for that round.",
          "Units are summed per project epoch and turned into token amounts by the project's reward model (see Earnings & withdrawals).",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "miners",
    path: "guides/earnings",
    title: "Earnings & withdrawals",
    description: "Reward epochs, fee splits, Merkle claims and getting your collateral back.",
    readingMinutes: 5,
    sections: [
      {
        heading: "Reward epochs",
        body: [
          "Each project pays per reward epoch — one hour on most testnet projects (projects may choose 1 to 24 hours). After an epoch closes, validators compute each miner's units and amount and sign a reward receipt (v2) with a Merkle root of all payouts.",
          "Two reward models exist: Per-task (a fixed amount per compute unit, capped by the project's daily emission) and Per-epoch (a fixed pool per epoch shared by units).",
        ],
      },
      {
        heading: "Fee split",
        body: [
          "The gross reward of an epoch is split between miners, the developer and the treasury in basis points set by the project. Miners always receive at least half; rounding dust goes to the treasury.",
          "Rewards are paid in the project's own reward token (any ERC-20). Collateral is always NECTA.",
        ],
      },
      {
        heading: "Settlement and claims",
        body: [
          "The Hub relayer settles each attested receipt on the project's vault on Sepolia. After a one-hour challenge window the amounts become claimable.",
          "Payouts are pull-based: you claim with Merkle proofs. The Withdraw page batches claims across projects and epochs into one gasless request.",
        ],
      },
      {
        heading: "Collateral",
        body: [
          "Unbonding a subscription starts a 24-hour unbonding period; after it ends you can withdraw the NECTA back to your wallet, also gaslessly.",
          "Every receipt and settlement is public in the Explorer, so you can check your amounts against the validators' signatures.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "miners",
    path: "guides/real-miner-flow",
    title: "From task to payout",
    description: "The full path of one task on the testnet: offer, lease, vote, finality, epoch, settlement, claim.",
    readingMinutes: 5,
    sections: [
      {
        heading: "1. Offer and lease",
        body: [
          "A client sends a task for a project to the Hub. The Hub computes the committee for that slot and sends an offer to each selected miner over the relay.",
          "Your miner has 10 seconds to accept, based on its policies (battery, temperature, network, schedule, free slots). Accepting creates a lease with a deadline.",
        ],
      },
      {
        heading: "2. Execute and vote",
        body: [
          "The miner downloads the project's worker module (content-addressed, verified locally), runs the task in NDSR and signs a task vote over the receipt hash with its node key.",
          "Votes are delivered over the same relay connection; if the connection drops, the session resumes and acknowledged messages are not resent.",
        ],
      },
      {
        heading: "3. Finality",
        body: [
          "Validators verify all votes, audit when required, and sign a finality record that lists the miners whose result matches the final one. Those miners earn compute units.",
        ],
      },
      {
        heading: "4. Epoch, settlement, claim",
        body: [
          "At the end of the project epoch validators sign a reward receipt with each miner's units and amount and a Merkle root. The Hub settles it on the project vault on Sepolia.",
          "After the challenge window you claim from the Withdraw page. Track every step in the Explorer: the round, the epoch, its receipt and the settlement transaction.",
        ],
      },
    ],
  },
  {
    tab: "help",
    audience: "miners",
    path: "help/proofs-and-disputes",
    title: "Proofs, slashing and disputes",
    description: "When a vote is rejected, what can be slashed on the testnet, and how to dispute it.",
    readingMinutes: 4,
    sections: [
      {
        heading: "Proof states",
        body: [
          "Each of your votes appears as a proof: pending (voted, not final yet), verified (your result matched the final one and earned units), rejected (your result differed) or missed (you accepted a lease but did not vote in time).",
          "There is nothing to retry: every round is independent and new offers keep coming while your device is eligible.",
        ],
      },
      {
        heading: "What can be slashed on the testnet",
        body: [
          "Equivocation — signing two different results for the same round — slashes the full bond of that subscription.",
          "Invalid results proven by a validator audit can be slashed up to the share the project sets (at most 50%).",
          "Missed leases only lower your reputation on the testnet; they are never slashed. Reputation recovers as you complete rounds correctly.",
        ],
      },
      {
        heading: "Disputes",
        body: [
          "A slash is first proposed on-chain and can only execute after the project's dispute window. During that window you can file a dispute from your proof or slash page.",
          "On the testnet the network operator reviews disputes and either cancels the slash or lets it stand. Slashed NECTA goes to the treasury; if the remaining bond falls below the project minimum the subscription is jailed until you top it up.",
        ],
      },
    ],
  },
  {
    tab: "help",
    audience: "miners",
    path: "help/withdrawals",
    title: "Withdrawals",
    description: "Claiming rewards and withdrawing collateral without holding ETH.",
    readingMinutes: 3,
    sections: [
      {
        heading: "Before you withdraw",
        body: [
          "Sign in with the wallet that owns your devices. Claims pay out to the payout address of each subscription.",
          "Only settled epochs past their challenge window are claimable. Open epochs and epochs still being attested show as pending.",
        ],
      },
      {
        heading: "Fees",
        body: [
          "There are no withdrawal fees on the testnet. Claims and collateral withdrawals are signed intents that the Hub relayer submits, so you never pay gas.",
        ],
      },
    ],
  },
  {
    tab: "help",
    audience: "miners",
    path: "help/faucet",
    title: "Test NECTA faucet",
    description: "How much test NECTA you get and how often.",
    readingMinutes: 2,
    sections: [
      {
        heading: "Amount and cooldown",
        body: [
          "The faucet sends 1,000 testnet NECTA to a signed-in address once every 24 hours. Testnet NECTA has no value and exists only for collateral and testing.",
          "There is no ETH faucet: miners never need Sepolia ETH because every miner action is relayed gaslessly. Developers need a little Sepolia ETH only to create a project vault.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "developers",
    path: "guides/ndsr",
    title: "NDSR: Necter Distributed State Runtime",
    description: "The deterministic WebAssembly runtime that executes and signs every task on Necter.",
    readingMinutes: 5,
    sections: [
      {
        heading: "What is NDSR?",
        body: [
          "NDSR is the runtime used by validators and embedded in every miner. It executes HiveKit modules (.hbc files) in a deterministic WebAssembly engine with gas metering and a stack limit, and produces signed receipts.",
          "Native and Pulley engines produce identical receipts on x86, ARM64 and ARMv7, which is what lets phones and servers sit in the same committee.",
        ],
      },
      {
        heading: "Receipts",
        body: [
          "A receipt records the module, function, input hash, output hash, events hash, gas used and success flag. Its hash is what miners vote on and what validators finalize.",
          "Validators run NDSR as full nodes: they finalize committee rounds, audit by re-executing, attest reward receipts and agree with the SecureWeave BFT protocol.",
        ],
      },
      {
        heading: "Stateless workers",
        body: [
          "Committee mining needs a stateless worker module: no persistent storage and no calls to other modules. Phones keep no state and never sync, so every task must be answerable from its input alone.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "developers",
    path: "guides/secureweave",
    title: "SecureWeave: validator consensus",
    description: "How validators agree on finality records and reward receipts, and why the Hub cannot forge payouts.",
    readingMinutes: 4,
    sections: [
      {
        heading: "What validators sign",
        body: [
          "Validators sign three kinds of records with their ed25519 node keys: finality records for committee rounds, attested miner-set snapshots for each project epoch, and v2 reward receipts.",
          "A record counts once two thirds plus one of the current validators signed the same hash. A validator signs at most one finality record per round; conflicting signatures are equivocation.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "The Hub routes work and relays transactions but cannot change results or payouts: every settlement carries a receipt hash whose validator signatures are public in the Explorer.",
          "On the testnet the validator set is operated by the Necter team; stake-elected validators come later.",
        ],
      },
    ],
  },
  {
    tab: "guides",
    audience: "developers",
    path: "guides/hivekit",
    title: "HiveKit: build a project",
    description: "Write a worker module, sign a project manifest, fund a vault and get listed.",
    readingMinutes: 6,
    sections: [
      {
        heading: "What is HiveKit?",
        body: [
          "HiveKit is the SDK family for writing Necter modules in Rust, Go, TypeScript (AssemblyScript), JavaScript or Python. It compiles to .hbc modules that NDSR executes.",
          "A project is a worker module plus a signed project manifest that defines how the work is scheduled, verified and paid.",
        ],
      },
      {
        heading: "Publishing a project",
        body: [
          "1) Enroll as a developer. On the testnet verification is automatic on enrollment.",
          "2) Upload your stateless worker module and describe the project in the Create wizard: category, device classes, requirements, committee size, epoch length, reward model, fee split, collateral and slashing shares.",
          "3) Sign the manifest with your wallet. The project id is derived from your address and the project slug.",
          "4) Create and fund the project vault with your reward token (this step needs a little Sepolia ETH). The vault pays epochs as they settle; when it runs low the project pauses until it is funded again.",
          "5) The listing is reviewed by the network operator on the testnet before it appears in Discover.",
        ],
      },
      {
        heading: "Changing a live project",
        body: [
          "Listing fields (name, description, screenshots, links) update instantly and need no transaction.",
          "Consensus fields (economics, committee, modules) need an on-chain transaction and activate after a one-hour delay so miners are never surprised mid-epoch. The epoch length is fixed for the life of a vault.",
        ],
      },
      {
        heading: "Monitoring",
        body: [
          "The Developer Portal shows your project's miners, rounds, proofs, revenue and escrow runway, and lets you run simulations of sample tasks on validators before you go live.",
        ],
      },
    ],
  },
]

export function getLearnArticleByPath(path: string): LearnArticle | null {
  const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "")
  return learnArticles.find((a) => a.path === normalized) ?? null
}

export const minerArticles = learnArticles.filter((a) => a.audience === "miners")
export const developerArticles = learnArticles.filter((a) => a.audience === "developers")
