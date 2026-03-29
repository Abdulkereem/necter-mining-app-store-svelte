// Generate themed screenshot placeholders for app detail pages
// Each app gets 3 unique "screenshots" showing key data visualizations

const categoryColors: Record<string, { bg: string; accent: string }> = {
  "DePIN": { bg: "#0d1b2a", accent: "#4CB782" },
  "AI/ML": { bg: "#1a0d2e", accent: "#C084FC" },
  "Storage": { bg: "#0d1e14", accent: "#4CB782" },
  "Compute": { bg: "#1e140d", accent: "#FFBF00" },
  "IoT": { bg: "#0d1520", accent: "#6E9FFF" },
  "Bandwidth": { bg: "#1e0d0d", accent: "#FF8664" },
  "Hardware Staking": { bg: "#0d0d1e", accent: "#6E9FFF" },
  "Data Sovereignty": { bg: "#0d1e1a", accent: "#4CB782" },
}

function generateScreenshotSVG(
  title: string,
  subtitle: string,
  stat: string,
  statLabel: string,
  bgColor: string,
  accentColor: string,
  variant: number
): string {
  const patterns = [
    // Variant 0: Dashboard view
    `<rect x="40" y="140" width="200" height="8" rx="4" fill="${accentColor}" opacity="0.3"/>
     <rect x="40" y="140" width="${80 + variant * 30}" height="8" rx="4" fill="${accentColor}"/>
     <rect x="40" y="160" width="200" height="8" rx="4" fill="${accentColor}" opacity="0.3"/>
     <rect x="40" y="160" width="${120 + variant * 20}" height="8" rx="4" fill="${accentColor}"/>
     <rect x="40" y="180" width="200" height="8" rx="4" fill="${accentColor}" opacity="0.3"/>
     <rect x="40" y="180" width="${60 + variant * 40}" height="8" rx="4" fill="${accentColor}"/>
     <rect x="280" y="100" width="100" height="100" rx="8" fill="${accentColor}" opacity="0.08"/>
     <text x="330" y="155" text-anchor="middle" font-family="system-ui" font-size="28" font-weight="700" fill="${accentColor}">${stat}</text>
     <text x="330" y="178" text-anchor="middle" font-family="system-ui" font-size="10" fill="rgba(255,255,255,0.4)">${statLabel}</text>`,
    // Variant 1: Chart view
    `<polyline points="40,200 80,180 120,190 160,160 200,170 240,140 280,150 320,120 360,130 400,100" fill="none" stroke="${accentColor}" stroke-width="2"/>
     <polyline points="40,200 80,180 120,190 160,160 200,170 240,140 280,150 320,120 360,130 400,100 400,220 40,220" fill="${accentColor}" opacity="0.08"/>
     <circle cx="400" cy="100" r="4" fill="${accentColor}"/>
     <rect x="300" y="70" width="80" height="24" rx="4" fill="${accentColor}" opacity="0.15"/>
     <text x="340" y="86" text-anchor="middle" font-family="system-ui" font-size="11" font-weight="600" fill="${accentColor}">${stat}</text>`,
    // Variant 2: Grid/table view
    `<rect x="40" y="100" width="360" height="1" fill="rgba(255,255,255,0.06)"/>
     <rect x="40" y="130" width="360" height="1" fill="rgba(255,255,255,0.06)"/>
     <rect x="40" y="160" width="360" height="1" fill="rgba(255,255,255,0.06)"/>
     <rect x="40" y="190" width="360" height="1" fill="rgba(255,255,255,0.06)"/>
     <circle cx="56" cy="115" r="8" fill="${accentColor}" opacity="0.2"/>
     <rect x="72" y="110" width="80" height="10" rx="3" fill="rgba(255,255,255,0.15)"/>
     <rect x="320" y="110" width="50" height="10" rx="3" fill="${accentColor}" opacity="0.3"/>
     <circle cx="56" cy="145" r="8" fill="${accentColor}" opacity="0.2"/>
     <rect x="72" y="140" width="100" height="10" rx="3" fill="rgba(255,255,255,0.15)"/>
     <rect x="320" y="140" width="40" height="10" rx="3" fill="${accentColor}" opacity="0.3"/>
     <circle cx="56" cy="175" r="8" fill="${accentColor}" opacity="0.2"/>
     <rect x="72" y="170" width="70" height="10" rx="3" fill="rgba(255,255,255,0.15)"/>
     <rect x="320" y="170" width="60" height="10" rx="3" fill="${accentColor}" opacity="0.3"/>`,
  ]

  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <rect width="440" height="280" rx="12" fill="${bgColor}"/>
  <rect x="0" y="0" width="440" height="280" rx="12" fill="rgba(255,255,255,0.02)"/>
  <text x="40" y="52" font-family="system-ui" font-size="14" font-weight="600" fill="rgba(255,255,255,0.9)">${title}</text>
  <text x="40" y="72" font-family="system-ui" font-size="11" fill="rgba(255,255,255,0.4)">${subtitle}</text>
  ${patterns[variant % 3]}
</svg>`.trim())}`
}

// Real screenshots for apps — sourced from official project websites, blogs, and social media
const realScreenshots: Record<string, string[]> = {
  "Helium Network": ["/screenshots/helium-1.jpg", "/screenshots/helium-2.png"],
  "Render Network": ["/screenshots/render-1.jpg"],
  "Filecoin Storage": ["/screenshots/filecoin-1.png"],
  "Chainlink": ["/screenshots/chainlink-1.png", "/screenshots/chainlink-2.jpg", "/screenshots/chainlink-3.jpg"],
  "Akash Network": ["/screenshots/akash-1.png"],
  "The Graph": ["/screenshots/thegraph-2.jpg", "/screenshots/thegraph-1.png"],
  "Storj": ["/screenshots/storj-1.webp", "/screenshots/storj-2.webp"],
  "Ocean Protocol": ["/screenshots/ocean-1.png"],
  "Polkadot": ["/screenshots/polkadot-1.png"],
  "Grass": ["/screenshots/grass-1.png"],
  "Bittensor": ["/screenshots/bittensor-1.png"],
  "Golem Network": ["/screenshots/golem-1.png", "/screenshots/golem-2.jpg"],
  "Livepeer Network": ["/screenshots/livepeer-1.png"],
  "Arweave": ["/screenshots/arweave-1.jpg"],
  // New screenshots from official sources
  "Theta Network": ["/screenshots/theta-1.jpg"],
  "IoTeX": ["/screenshots/iotex-1.png", "/screenshots/iotex-2.png"],
  "0x Protocol": ["/screenshots/0x-1.jpg", "/screenshots/0x-2.jpg"],
  "Hivemapper": ["/screenshots/hivemapper-1.jpg", "/screenshots/hivemapper-2.jpg"],
  "DIMO": ["/screenshots/dimo-1.png", "/screenshots/dimo-2.png"],
  "Worldcoin": ["/screenshots/worldcoin-1.png", "/screenshots/worldcoin-2.jpg"],
  "Nosana": ["/screenshots/nosana-1.png", "/screenshots/nosana-2.png"],
  "Aethir": ["/screenshots/aethir-1.png"],
  "Starknet": ["/screenshots/starknet-1.jpg", "/screenshots/starknet-2.jpg"],
  "Bandwidth Protocol": ["/screenshots/bandwidth-1.png"],
  "Polygon": ["/screenshots/polygon-1.webp"],
  "Flux Network": ["/screenshots/flux-1.webp", "/screenshots/flux-2.webp"],
  "Fetch.ai": ["/screenshots/fetchai-1.png", "/screenshots/fetchai-2.png"],
  "DockHive": ["/screenshots/dockhive-1.jpg", "/screenshots/dockhive-2.png"],
}

export function getAppScreenshots(app: { id: string; name: string; category: string; avgEarningsPerDay: number; totalMiners: number; reputationScore: number }): string[] {
  // Use real screenshots if available, fill remaining with generated
  const real = realScreenshots[app.name] || []
  if (real.length >= 3) return real.slice(0, 3)
  const colors = categoryColors[app.category] || { bg: "#0d1520", accent: "#FFBF00" }

  const generated = [
    generateScreenshotSVG(
      `${app.name} Dashboard`,
      "Network performance overview",
      `$${(app.avgEarningsPerDay ?? 0).toFixed(0)}`,
      "daily earnings",
      colors.bg,
      colors.accent,
      0
    ),
    generateScreenshotSVG(
      "Earnings History",
      "30-day revenue trend",
      `${(app.totalMiners ?? 0).toLocaleString()}`,
      "active miners",
      colors.bg,
      colors.accent,
      1
    ),
    generateScreenshotSVG(
      "Mining Activity",
      "Proof submissions and verification",
      `${app.reputationScore ?? 0}%`,
      "reputation",
      colors.bg,
      colors.accent,
      2
    ),
  ]

  // Merge: real first, then fill with generated
  return [...real, ...generated].slice(0, 3)
}
