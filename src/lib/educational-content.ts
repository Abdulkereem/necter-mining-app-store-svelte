export const educationalContent = {
  "Proof of Work": {
    description:
      "A consensus mechanism where miners compete to solve cryptographic puzzles. The first to solve it gets to add the next block and receives rewards.",
    example: "Bitcoin uses PoW where miners hash block headers until finding a valid solution.",
    learnMoreUrl: "https://en.wikipedia.org/wiki/Proof_of_work",
  },
  "Proof of Stake": {
    description:
      "Validators stake tokens to participate in consensus. Block proposers are chosen based on stake amount, reducing energy consumption.",
    example: "Ethereum 2.0 validators stake 32 ETH to participate in consensus.",
    learnMoreUrl: "https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/",
  },
  "Proof of Space-Time": {
    description:
      "Miners prove they stored data over a period of time. Combines proof of space (storage capacity) with proof of time (duration).",
    example: "Filecoin miners store client data and prove continuous storage availability.",
    learnMoreUrl: "https://docs.filecoin.io/basics/what-is-filecoin/proofs",
  },
  "Proof of Coverage": {
    description:
      "Nodes prove they provide wireless network coverage in specific geographic locations using radio frequency challenges.",
    example: "Helium hotspots prove coverage by responding to nearby device challenges.",
    learnMoreUrl: "https://docs.helium.com/blockchain/proof-of-coverage/",
  },
  "ZK-SNARK": {
    description:
      "Zero-Knowledge Succinct Non-Interactive Argument of Knowledge. Allows proving computation validity without revealing inputs.",
    example: "Verify a miner completed 1000 tasks without seeing which tasks they were.",
    learnMoreUrl: "https://z.cash/technology/zksnarks/",
  },
  "Merkle Proof": {
    description:
      "A cryptographic proof that verifies a specific transaction is included in a block without downloading the entire blockchain.",
    example: "Prove a miner submitted proof X at timestamp Y using just the merkle path.",
    learnMoreUrl: "https://en.wikipedia.org/wiki/Merkle_tree",
  },
  "Threshold Signature": {
    description:
      "Multiple parties must cooperate to create a valid signature. Requires M-of-N participants to authorize an action.",
    example: "Require 3 of 5 attestors to approve before an app goes live.",
    learnMoreUrl: "https://en.wikipedia.org/wiki/Threshold_cryptosystem",
  },
  Slashing: {
    description:
      "A penalty mechanism that destroys a portion of staked tokens when validators act maliciously or fail to meet SLA requirements.",
    example: "A miner loses 10% of staked tokens for submitting invalid proofs.",
    learnMoreUrl: "https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/#slashing",
  },
  "SLA (Service Level Agreement)": {
    description:
      "A contract defining expected uptime, performance metrics, and penalties for failing to meet commitments.",
    example: "Miner must maintain 99% uptime or face reputation score reduction.",
    learnMoreUrl: "https://en.wikipedia.org/wiki/Service-level_agreement",
  },
  "Mining Profile": {
    description:
      "A JSON configuration that defines how a decentralized network operates - task domain, consensus, rewards, verification, and hardware requirements.",
    example:
      "A storage network profile specifying Proof of Space-Time consensus, 1TB minimum storage, and merkle proof verification.",
    learnMoreUrl: "#",
  },
  "Task Orchestration": {
    description:
      "The system that distributes work to miners, tracks task assignment, and coordinates proof submission and verification.",
    example: "Assign storage tasks to miners with available capacity, collect proofs every hour.",
    learnMoreUrl: "#",
  },
  Attestation: {
    description:
      "A signed statement from a trusted party verifying that an application meets quality, security, and legitimacy standards.",
    example: "Three governance members review code and economics, then sign attestation on-chain.",
    learnMoreUrl: "#",
  },
  "Reputation Score": {
    description:
      "A numerical rating based on miner performance history including uptime, proof success rate, and SLA compliance.",
    example: "Score ranges from 0-100, calculated from 98% uptime + 99.5% proof success rate.",
    learnMoreUrl: "#",
  },
  "Hardware Compatibility": {
    description: "Minimum and recommended hardware specifications required to run mining operations profitably.",
    example: "GPU mining requires RTX 3060+ with 8GB VRAM, 16GB RAM, and 100Mbps internet.",
    learnMoreUrl: "#",
  },
  "ROI (Return on Investment)": {
    description:
      "The ratio of net profit to initial hardware and electricity costs, showing how long until mining becomes profitable.",
    example: "A $2000 setup earning $15/day with $3/day electricity has 182-day break-even.",
    learnMoreUrl: "https://en.wikipedia.org/wiki/Return_on_investment",
  },
}

export type EducationalTerm = keyof typeof educationalContent
