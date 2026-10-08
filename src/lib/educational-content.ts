// Glossary of Necter testnet concepts (PLATFORM.md). Static content shown on /learn and /learn/glossary.
export const educationalContent = {
  "Redundant Execution": {
    description:
      "Every task in a Necter project is run by a small committee of miners. Results count only when enough committee members return the same receipt hash, so no single miner has to be trusted.",
    example: "A project with committee size 5 accepts a result once at least 4 miners agree on the receipt.",
    learnMoreUrl: "#",
  },
  "Committee": {
    description:
      "The miners selected for a round. Selection is a weighted draw by collateral and reputation, seeded by a public Sepolia block hash, so nobody can pick their own committee.",
    example: "Five primaries plus three backups; backups step in when a phone goes to sleep.",
    learnMoreUrl: "#",
  },
  "Validator Finality": {
    description:
      "Validators check the committee's votes, sign a finality record and re-execute a random sample of rounds (10% on the testnet) to catch collusion.",
    example: "A contested round is always re-executed by validators before it is finalized.",
    learnMoreUrl: "#",
  },
  "Collateral": {
    description:
      "NECTA bonded per device and project. It weights committee selection and can be slashed for provably wrong results or equivocation. Bonding is gasless: you sign an EIP-712 request and the network relays it.",
    example: "A project with a 10 NECTA minimum needs at least 10 NECTA bonded for each device you subscribe.",
    learnMoreUrl: "#",
  },
  "Unbonding": {
    description:
      "Leaving a project starts an unbonding period (24 hours on the testnet). After it ends you withdraw the collateral, again without paying gas.",
    example: "Unbond on Monday at 10:00, withdraw from Tuesday 10:00.",
    learnMoreUrl: "#",
  },
  "Epoch": {
    description:
      "Projects pay out per epoch (one hour or longer). At the end of an epoch validators attest the units each miner earned and the vault settles the payouts.",
    example: "An hourly epoch closes at :00 and becomes claimable after the one-hour challenge window.",
    learnMoreUrl: "#",
  },
  "Merkle Claim": {
    description:
      "Settled epochs publish a Merkle root of every miner's amount. You claim with a short proof; the network batches claims and pays the gas.",
    example: "Claim all released epochs from the Withdraw page in one click.",
    learnMoreUrl: "https://en.wikipedia.org/wiki/Merkle_tree",
  },
  "Compute Unit": {
    description:
      "The measure of work a finalized task earns: gas used divided by one million, rounded up, with a minimum of one unit.",
    example: "A task that used 2.5 million gas earns 3 units for each agreeing committee member.",
    learnMoreUrl: "#",
  },
  "Fee Split": {
    description:
      "Each epoch's reward is split between miners, the project developer and the treasury in basis points. Miners always receive at least half.",
    example: "8500 / 1000 / 500 bp → 85% to miners, 10% to the developer, 5% to the treasury.",
    learnMoreUrl: "#",
  },
  "Slashing": {
    description:
      "Collateral is cut when evidence proves an invalid result or equivocation. Evidence is proposed first and can be disputed during the project's dispute window. Missed tasks only lower reputation on the testnet.",
    example: "A 10% invalid-result penalty on 50 NECTA removes 5 NECTA after the dispute window.",
    learnMoreUrl: "#",
  },
  "Reputation": {
    description:
      "A per-subscription score from 10% to 100% based on agreement, misses and uptime. Higher reputation means more committee seats.",
    example: "New subscriptions start at 50% and rise as their votes agree with finalized results.",
    learnMoreUrl: "#",
  },
  "Device Binding": {
    description:
      "A signed link between a miner's node key and your wallet. Both keys sign a human-readable message, so nobody can claim your device or your rewards.",
    example: "Run `necter-miner bind --owner 0x…` and approve the message in your wallet.",
    learnMoreUrl: "#",
  },
  "Sign-In with Ethereum": {
    description:
      "The store signs you in by asking your wallet to sign a short message (EIP-4361). It sends no transaction and costs nothing.",
    example: "testnet.necter.network wants you to sign in with your Ethereum account…",
    learnMoreUrl: "https://eips.ethereum.org/EIPS/eip-4361",
  },
  "Hardware Compatibility": {
    description:
      "Each project lists the device classes, CPU cores, memory, storage and benchmark score it needs. The checker compares your device with every listed project.",
    example: "A project that needs 4 cores and 8 GB RAM accepts a desktop but not an older phone.",
    learnMoreUrl: "#",
  },
}

export type EducationalTerm = keyof typeof educationalContent
