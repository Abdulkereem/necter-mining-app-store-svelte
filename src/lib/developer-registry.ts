// ─── Developer Registry ──────────────────────────────────────────────────────
// Rich metadata for each developer org that shows on their profile page.
// Keyed by developerAddress (unique per org).

export interface DeveloperProfile {
  address: string
  name: string
  bio: string
  website: string
  logo: string // path to logo in /public/logos/
  founded: string // "YYYY" or "Month YYYY"
  location: string
  category: string // primary focus
  socialLinks: {
    twitter?: string
    discord?: string
    github?: string
    telegram?: string
  }
  verified: boolean
  tags: string[]
}

export const developerRegistry: Record<string, DeveloperProfile> = {
  // ── 1. Helium Foundation ──
  "0xHELI...a1b2": {
    address: "0xHELI...a1b2",
    name: "Helium Foundation",
    bio: "Building the world's largest decentralized wireless network. Helium enables IoT devices to connect through a people-powered network of hotspots, rewarding operators with HNT tokens.",
    website: "https://helium.com",
    logo: "/logos/helium.png",
    founded: "2013",
    location: "San Francisco, CA",
    category: "IoT & Wireless",
    socialLinks: {
      twitter: "helaborateum",
      discord: "helium",
      github: "helium",
    },
    verified: true,
    tags: ["IoT", "Wireless", "LoRaWAN", "5G"],
  },

  // ── 2. Render Foundation ──
  "0xRNDR...c3d4": {
    address: "0xRNDR...c3d4",
    name: "Render Foundation",
    bio: "Distributed GPU rendering platform connecting artists and studios with idle GPU power. Powering next-generation 3D content creation, AI inference, and spatial computing.",
    website: "https://rendernetwork.com",
    logo: "/logos/render.png",
    founded: "2017",
    location: "Los Angeles, CA",
    category: "GPU Computing",
    socialLinks: {
      twitter: "rendernetwork",
      discord: "render",
      github: "rendernetwork",
    },
    verified: true,
    tags: ["GPU", "Rendering", "AI", "3D"],
  },

  // ── 3. Protocol Labs ──
  "0xFILE...e5f6": {
    address: "0xFILE...e5f6",
    name: "Protocol Labs",
    bio: "Research, development, and deployment of network protocols. Creators of Filecoin, IPFS, and libp2p — building the next generation of the internet's infrastructure.",
    website: "https://protocol.ai",
    logo: "/logos/filecoin.png",
    founded: "2014",
    location: "San Francisco, CA",
    category: "Storage & Infrastructure",
    socialLinks: {
      twitter: "protocollabs",
      github: "protocol",
    },
    verified: true,
    tags: ["Storage", "IPFS", "Infrastructure"],
  },

  // ── 4. Akash Network ──
  "0xAKSH...g7h8": {
    address: "0xAKSH...g7h8",
    name: "Akash Network",
    bio: "The world's first decentralized cloud computing marketplace. Akash provides a fast, efficient, and low-cost alternative to centralized cloud providers like AWS and Google Cloud.",
    website: "https://akash.network",
    logo: "/logos/akash.png",
    founded: "2018",
    location: "San Francisco, CA",
    category: "Cloud Computing",
    socialLinks: {
      twitter: "akaboratehnetwork",
      discord: "akash",
      github: "akash-network",
    },
    verified: true,
    tags: ["Compute", "Cloud", "DeCloud", "Kubernetes"],
  },

  // ── 5. Ocean Protocol Foundation ──
  "0xOCEA...i9j0": {
    address: "0xOCEA...i9j0",
    name: "Ocean Protocol Foundation",
    bio: "Unlocking data for AI. Ocean Protocol provides tools for data sharing, monetization, and consumption while preserving privacy through compute-to-data technology.",
    website: "https://oceanprotocol.com",
    logo: "/logos/ocean.jpg",
    founded: "2017",
    location: "Singapore",
    category: "Data Economy",
    socialLinks: {
      twitter: "oceanprotocol",
      discord: "ocean-protocol",
      github: "oceanprotocol",
    },
    verified: true,
    tags: ["Data", "AI", "Privacy", "Marketplace"],
  },

  // ── 6. Livepeer Inc ──
  "0xLIVE...k1l2": {
    address: "0xLIVE...k1l2",
    name: "Livepeer Inc",
    bio: "Decentralized video transcoding network built on Ethereum. Livepeer dramatically reduces the cost of video streaming infrastructure by leveraging idle compute resources.",
    website: "https://livepeer.org",
    logo: "/logos/livepeer.png",
    founded: "2017",
    location: "New York, NY",
    category: "Video Infrastructure",
    socialLinks: {
      twitter: "livepeer",
      discord: "livepeer",
      github: "livepeer",
    },
    verified: true,
    tags: ["Video", "Transcoding", "Streaming"],
  },

  // ── 7. Theta Labs ──
  "0xTHET...m3n4": {
    address: "0xTHET...m3n4",
    name: "Theta Labs",
    bio: "Next-generation video and entertainment blockchain. Theta's decentralized CDN reduces video delivery costs while rewarding users for sharing bandwidth and compute resources.",
    website: "https://thetatoken.org",
    logo: "/logos/theta.png",
    founded: "2017",
    location: "San Jose, CA",
    category: "Content Delivery",
    socialLinks: {
      twitter: "theta_network",
      discord: "theta",
      github: "thetatoken",
    },
    verified: true,
    tags: ["CDN", "Video", "Streaming", "Edge"],
  },

  // ── 8. Arweave Team ──
  "0xARWE...o5p6": {
    address: "0xARWE...o5p6",
    name: "Arweave Team",
    bio: "Permanent data storage protocol. Arweave enables truly permanent information storage with a novel blockweave structure, ensuring data persists for centuries at a one-time cost.",
    website: "https://arweave.org",
    logo: "/logos/arweave.jpg",
    founded: "2017",
    location: "London, UK",
    category: "Permanent Storage",
    socialLinks: {
      twitter: "araborateweaveeco",
      discord: "arweave",
      github: "arweaveTeam",
    },
    verified: true,
    tags: ["Storage", "Permanent", "Permaweb"],
  },

  // ── 9. Storj Labs ──
  "0xSTRJ...q7r8": {
    address: "0xSTRJ...q7r8",
    name: "Storj Labs",
    bio: "Enterprise-grade decentralized cloud storage. Storj distributes and encrypts files across a global network of nodes, delivering better performance, privacy, and economics than legacy cloud.",
    website: "https://storj.io",
    logo: "/logos/storj.png",
    founded: "2014",
    location: "Atlanta, GA",
    category: "Cloud Storage",
    socialLinks: {
      twitter: "storj",
      discord: "storj",
      github: "storj",
    },
    verified: true,
    tags: ["Storage", "Enterprise", "S3-Compatible"],
  },

  // ── 10. Golem Factory ──
  "0xGOLM...s9t0": {
    address: "0xGOLM...s9t0",
    name: "Golem Factory",
    bio: "Global, open-source, decentralized supercomputer. Golem creates a peer-to-peer network enabling users to rent out their idle computing power or purchase compute from others.",
    website: "https://golem.network",
    logo: "/logos/golem.png",
    founded: "2016",
    location: "Warsaw, Poland",
    category: "Distributed Compute",
    socialLinks: {
      twitter: "goaboratelemproject",
      discord: "golem",
      github: "golemfactory",
    },
    verified: true,
    tags: ["Compute", "P2P", "Supercomputer"],
  },

  // ── 11. The Graph Foundation ──
  "0xGRPH...u1v2": {
    address: "0xGRPH...u1v2",
    name: "The Graph Foundation",
    bio: "Indexing protocol for organizing blockchain data. The Graph makes it easy to query networks like Ethereum and IPFS through open APIs called subgraphs.",
    website: "https://thegraph.com",
    logo: "/logos/the-graph.png",
    founded: "2018",
    location: "San Francisco, CA",
    category: "Data Indexing",
    socialLinks: {
      twitter: "graphprotocol",
      discord: "the-graph",
      github: "graphprotocol",
    },
    verified: true,
    tags: ["Indexing", "GraphQL", "APIs", "DeFi"],
  },

  // ── 12. Chainlink Labs ──
  "0xLINK...w3x4": {
    address: "0xLINK...w3x4",
    name: "Chainlink Labs",
    bio: "The industry-standard decentralized oracle network. Chainlink enables smart contracts to securely connect to external data sources, APIs, and payment systems.",
    website: "https://chain.link",
    logo: "/logos/chainlink.png",
    founded: "2017",
    location: "Grand Cayman",
    category: "Oracle Network",
    socialLinks: {
      twitter: "chainlink",
      discord: "chainlink",
      github: "smartcontractkit",
    },
    verified: true,
    tags: ["Oracle", "Data Feeds", "CCIP", "VRF"],
  },

  // ── 13. IoTeX Foundation ──
  "0xIOTX...y5z6": {
    address: "0xIOTX...y5z6",
    name: "IoTeX Foundation",
    bio: "Modular infrastructure for DePIN. IoTeX powers trusted data from trusted devices, enabling machine-backed intelligence for real-world applications and IoT economies.",
    website: "https://iotex.io",
    logo: "/logos/iotex.png",
    founded: "2017",
    location: "Menlo Park, CA",
    category: "IoT & DePIN",
    socialLinks: {
      twitter: "iotex_io",
      discord: "iotex",
      github: "iotexproject",
    },
    verified: true,
    tags: ["IoT", "DePIN", "W3bstream", "Devices"],
  },

  // ── 14. 0x Labs ──
  "0x00ZX...a7b8": {
    address: "0x00ZX...a7b8",
    name: "0x Labs",
    bio: "Building infrastructure for the tokenized world. 0x provides the core exchange infrastructure for the decentralized finance ecosystem through open-source protocol and API.",
    website: "https://0x.org",
    logo: "/logos/0x.png",
    founded: "2017",
    location: "San Francisco, CA",
    category: "DeFi Infrastructure",
    socialLinks: {
      twitter: "0xproject",
      discord: "0x",
      github: "0xProject",
    },
    verified: true,
    tags: ["DEX", "Liquidity", "Trading", "DeFi"],
  },

  // ── 15. Hivemapper Inc ──
  "0xHIVE...c9d0": {
    address: "0xHIVE...c9d0",
    name: "Hivemapper Inc",
    bio: "Building a decentralized map of the world using dashcams. Hivemapper incentivizes contributors to build and maintain a fresh, detailed global map through drive-to-earn mechanics.",
    website: "https://hivemapper.com",
    logo: "/logos/hivemapper.png",
    founded: "2015",
    location: "San Francisco, CA",
    category: "Mapping & DePIN",
    socialLinks: {
      twitter: "hivemapper",
      discord: "hivemapper",
      github: "hivemapper",
    },
    verified: true,
    tags: ["DePIN", "Mapping", "Dashcam", "Geospatial"],
  },

  // ── 16. Opentensor Foundation ──
  "0xBTSR...e1f2": {
    address: "0xBTSR...e1f2",
    name: "Opentensor Foundation",
    bio: "Decentralized machine intelligence network. Bittensor creates a peer-to-peer market for AI models, where miners compete to serve the best machine learning models across specialized subnets.",
    website: "https://bittensor.com",
    logo: "/logos/bittensor.jpg",
    founded: "2019",
    location: "Toronto, Canada",
    category: "AI/ML",
    socialLinks: {
      twitter: "opentensor",
      discord: "bittensor",
      github: "opentensor",
    },
    verified: true,
    tags: ["AI", "ML", "Subnets", "TAO"],
  },

  // ── 17. Digital Infrastructure Inc (DIMO) ──
  "0xDIMO...g3h4": {
    address: "0xDIMO...g3h4",
    name: "Digital Infrastructure Inc",
    bio: "DIMO is a user-owned IoT platform connecting vehicles to create a decentralized data marketplace. Drivers earn tokens by sharing their vehicle data while maintaining full ownership.",
    website: "https://dimo.zone",
    logo: "/logos/dimo.png",
    founded: "2021",
    location: "Chattanooga, TN",
    category: "Vehicle IoT",
    socialLinks: {
      twitter: "daborateimo_xyz",
      discord: "dimo",
      github: "DIMO-Network",
    },
    verified: true,
    tags: ["IoT", "Vehicles", "DePIN", "Data"],
  },

  // ── 18. Wynd Labs ──
  "0xWYND...i5j6": {
    address: "0xWYND...i5j6",
    name: "Wynd Labs",
    bio: "Creators of Grass — the network that lets users sell their unused internet bandwidth. Wynd Labs is building infrastructure to power the next generation of AI data pipelines.",
    website: "https://getgrass.io",
    logo: "/logos/grass.jpg",
    founded: "2022",
    location: "Remote",
    category: "Bandwidth & AI Data",
    socialLinks: {
      twitter: "getgrass_io",
      discord: "grass",
    },
    verified: true,
    tags: ["DePIN", "Bandwidth", "AI Data", "Passive"],
  },

  // ── 19. Tools for Humanity ──
  "0xWRLD...k7l8": {
    address: "0xWRLD...k7l8",
    name: "Tools for Humanity",
    bio: "Building Worldcoin — a global identity and financial network. Tools for Humanity develops the World ID protocol and World App, creating proof-of-personhood through iris biometrics.",
    website: "https://worldcoin.org",
    logo: "/logos/worldcoin.png",
    founded: "2019",
    location: "San Francisco, CA",
    category: "Identity & Compute",
    socialLinks: {
      twitter: "worldcoin",
      discord: "worldcoin",
      github: "worldcoin",
    },
    verified: true,
    tags: ["Identity", "DePIN", "AI", "Biometrics"],
  },

  // ── 20. Nosana BV ──
  "0xNOSA...m9n0": {
    address: "0xNOSA...m9n0",
    name: "Nosana BV",
    bio: "Decentralized GPU cloud for AI inference. Nosana makes GPU computing accessible and affordable on Solana, enabling AI teams to run inference workloads without centralized cloud dependency.",
    website: "https://nosana.io",
    logo: "/logos/nosana.jpg",
    founded: "2021",
    location: "Amsterdam, Netherlands",
    category: "GPU Compute",
    socialLinks: {
      twitter: "nosaborateana_ai",
      discord: "nosana",
      github: "nosana-ci",
    },
    verified: true,
    tags: ["Compute", "AI", "GPU", "Solana"],
  },

  // ── 21. Aethir Foundation ──
  "0xAETH...o1p2": {
    address: "0xAETH...o1p2",
    name: "Aethir Foundation",
    bio: "Enterprise-grade distributed GPU cloud infrastructure. Aethir aggregates underutilized GPU compute from telecom operators, cloud providers, and crypto miners for AI and gaming workloads.",
    website: "https://aethir.com",
    logo: "/logos/aethir.png",
    founded: "2023",
    location: "Singapore",
    category: "GPU Infrastructure",
    socialLinks: {
      twitter: "aaborateethircloud",
      discord: "aethir",
      github: "aethir",
    },
    verified: true,
    tags: ["Compute", "GPU", "Gaming", "AI"],
  },

  // ── 22. Web3 Foundation ──
  "0xDOTS...q3r4": {
    address: "0xDOTS...q3r4",
    name: "Web3 Foundation",
    bio: "Nurturing cutting-edge applications for decentralized web software protocols. Founded by Ethereum co-founder Dr. Gavin Wood, the foundation stewards the Polkadot ecosystem.",
    website: "https://web3.foundation",
    logo: "/logos/polkadot.png",
    founded: "2017",
    location: "Zug, Switzerland",
    category: "Blockchain Infrastructure",
    socialLinks: {
      twitter: "polkadot",
      discord: "polkadot",
      github: "polkadot-fellows",
    },
    verified: true,
    tags: ["Blockchain", "Parachains", "Governance", "Interop"],
  },

  // ── 23. StarkWare ──
  "0xSTRK...s5t6": {
    address: "0xSTRK...s5t6",
    name: "StarkWare",
    bio: "Scaling Ethereum with STARK-based zero-knowledge proofs. StarkWare builds StarkEx and Starknet — production-grade scaling engines trusted by dYdX, Immutable, and more.",
    website: "https://starkware.co",
    logo: "/logos/starknet.png",
    founded: "2018",
    location: "Netanya, Israel",
    category: "ZK Scaling",
    socialLinks: {
      twitter: "starknet",
      discord: "starknet",
      github: "starkware-libs",
    },
    verified: true,
    tags: ["ZK-Proofs", "L2", "STARK", "Scaling"],
  },

  // ── 24. Bandwidth Labs ──
  "0xBWDT...u7v8": {
    address: "0xBWDT...u7v8",
    name: "Bandwidth Labs",
    bio: "Decentralized content delivery protocol. Bandwidth Labs builds peer-to-peer CDN infrastructure that rewards node operators for caching and delivering web content at the edge.",
    website: "https://bandwidthprotocol.io",
    logo: "/logos/bandwidth.png",
    founded: "2022",
    location: "Austin, TX",
    category: "Content Delivery",
    socialLinks: {
      twitter: "bandwidth_proto",
    },
    verified: false,
    tags: ["CDN", "Bandwidth", "Edge", "P2P"],
  },

  // ── 25. Polygon Labs ──
  "0xPOLY...w9x0": {
    address: "0xPOLY...w9x0",
    name: "Polygon Labs",
    bio: "Building Ethereum's internet of blockchains. Polygon provides a suite of scaling solutions including Polygon PoS, zkEVM, and CDK, serving millions of users across DeFi, gaming, and enterprise.",
    website: "https://polygon.technology",
    logo: "/logos/polygon.png",
    founded: "2017",
    location: "Remote (Global)",
    category: "Blockchain Scaling",
    socialLinks: {
      twitter: "0xPolygon",
      discord: "polygon",
      github: "0xPolygon",
    },
    verified: true,
    tags: ["L2", "zkEVM", "Scaling", "DeFi"],
  },

  // ── 26. Flux Labs ──
  "0xFLUX...y1z2": {
    address: "0xFLUX...y1z2",
    name: "Flux Labs",
    bio: "Decentralized computational network and cloud infrastructure. Flux provides a blockchain-as-a-service solution with FluxOS enabling Docker-based app deployment across thousands of nodes.",
    website: "https://runonflux.io",
    logo: "/logos/flux.png",
    founded: "2018",
    location: "Remote (Global)",
    category: "Cloud Infrastructure",
    socialLinks: {
      twitter: "runonflux",
      discord: "flux",
      github: "RunOnFlux",
    },
    verified: true,
    tags: ["Compute", "Docker", "Cloud", "Nodes"],
  },

  // ── 27. Fetch.ai Foundation ──
  "0xFETH...a3b4": {
    address: "0xFETH...a3b4",
    name: "Fetch.ai Foundation",
    bio: "Building an open-access AI agent network. Fetch.ai creates autonomous economic agents that perform useful work — from supply chain optimization to DeFi automation — powered by machine learning.",
    website: "https://fetch.ai",
    logo: "/logos/fetchai.png",
    founded: "2017",
    location: "Cambridge, UK",
    category: "AI Agents",
    socialLinks: {
      twitter: "fetch_ai",
      discord: "fetch-ai",
      github: "fetchai",
    },
    verified: true,
    tags: ["AI", "Agents", "Automation", "ML"],
  },
  "0xDOCK...h1v3": {
    address: "0xDOCK...h1v3",
    name: "Hive Innovation Lab",
    bio: "Building DockHive, the decentralized cloud hosting protocol for Web3 and Web2 applications. Deploy, scale, and own your infrastructure.",
    website: "https://dockhive.io",
    logo: "/logos/hive-innovation-lab.svg",
    founded: "2024",
    location: "Global",
    category: "Cloud Infrastructure",
    socialLinks: {
      twitter: "dockhive",
    },
    verified: true,
    tags: ["Cloud", "Hosting", "Containers", "DVMs", "Storage"],
  },
  "0xTIWA...g3o2": {
    address: "0xTIWA...g3o2",
    name: "TIWA Protocol",
    bio: "Decentralized geospatial intelligence network building the world's most comprehensive open-source spatial data layer through distributed sensor and mapping infrastructure.",
    website: "https://tiwa.io",
    logo: "/logos/tiwa.png",
    founded: "2025",
    location: "Global",
    category: "Geospatial DePIN",
    socialLinks: {},
    verified: true,
    tags: ["DePIN", "Geospatial", "IoT", "Mapping", "Sensors"],
  },
  "0xATUM...r5s4": {
    address: "0xATUM...r5s4",
    name: "Atum Research",
    bio: "Decentralized AI training and fine-tuning network. Enabling researchers and startups to train large models across distributed GPU infrastructure without centralized cloud monopolies.",
    website: "https://atum.ai",
    logo: "/logos/atum.png",
    founded: "2024",
    location: "Global",
    category: "AI/ML Training",
    socialLinks: {},
    verified: true,
    tags: ["AI", "ML", "Training", "GPU", "Distributed Compute"],
  },
}

/** Look up a developer profile by wallet address */
export function getDeveloperByAddress(address: string): DeveloperProfile | undefined {
  return developerRegistry[address]
}

/** Get developer profile from any app in the apps list matching this address */
export function getDeveloperNameByAddress(address: string, apps: { developer: string; developerAddress: string }[]): string {
  const profile = developerRegistry[address]
  if (profile) return profile.name
  // Fallback: derive from apps
  const app = apps.find((a) => a.developerAddress === address)
  return app?.developer ?? `Dev ${address.slice(2, 6)}`
}
