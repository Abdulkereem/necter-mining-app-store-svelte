// Category → [fromHue, toHue] pairs (HSL)
const CATEGORY_PALETTES: Record<string, [number, number]> = {
  "DePIN":              [220, 270],  // blue → purple
  "AI/ML":             [270, 320],  // violet → pink
  "Storage":           [150, 185],  // green → teal
  "Compute":           [25,  45],   // orange → amber
  "IoT":               [190, 220],  // cyan → blue
  "Bandwidth":         [5,   30],   // red → orange
  "Hardware Staking":  [235, 255],  // indigo → blue
  "Data Sovereignty":  [165, 195],  // teal → green
}

const DEFAULT_PALETTE: [number, number] = [200, 240]

function fnv32a(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

function pickHue(rangeStart: number, rangeEnd: number, seed: number): number {
  const span = Math.abs(rangeEnd - rangeStart)
  return rangeStart + (seed % (span === 0 ? 1 : span))
}

// Hexagon points for a 256×256 viewbox, with slight inset for visual padding
const HEX_POINTS = "128,8 236,40 236,176 128,248 20,176 20,40"
// Inner hex for the clip path (used to contain decorative elements)
const HEX_CLIP = "128,12 232,42 232,174 128,244 24,174 24,42"

export function appIconDataUri(input: { id: string; name: string; category?: string }) {
  const seed = fnv32a(`${input.id}:${input.name}`)
  const seed2 = fnv32a(`${input.name}:${input.id}:2`)

  // Category-driven palette
  const category = input.category ?? ""
  const [palFrom, palTo] = CATEGORY_PALETTES[category] ?? DEFAULT_PALETTE

  const hue1 = pickHue(palFrom, palTo, seed % (Math.abs(palTo - palFrom) || 1) + palFrom)
  const hue2 = pickHue(palFrom, palTo, seed2 % (Math.abs(palTo - palFrom) || 1) + palFrom)

  // Fine-tune saturation and lightness with the hash for variety
  const sat1 = 72 + (seed % 20)          // 72–91%
  const sat2 = 68 + (seed2 % 22)         // 68–89%
  const lit1 = 50 + (seed % 12)          // 50–61%
  const lit2 = 44 + (seed2 % 14)         // 44–57%

  // 2-letter abbreviation: first 2 non-space chars, uppercased
  const stripped = (input.name || "?").replace(/\s+/g, "").toUpperCase()
  const label = stripped.length >= 2 ? stripped.slice(0, 2) : stripped.padEnd(2, stripped[0] ?? "?")

  // Small honeycomb accent cells (decorative) — positioned based on seed
  const cellX1 = 30 + (seed % 60)
  const cellY1 = 30 + (seed2 % 40)
  const cellX2 = 160 + (seed2 % 50)
  const cellY2 = 150 + (seed % 50)
  const cellSize = 18

  // Mini hex path generator
  const miniHex = (cx: number, cy: number, r: number) => {
    const pts = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
    }
    return pts.join(" ")
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue1},${sat1}%,${lit1}%)"/>
      <stop offset="100%" stop-color="hsl(${hue2},${sat2}%,${lit2}%)"/>
    </linearGradient>
    <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.14)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.12)"/>
    </linearGradient>
    <clipPath id="clip">
      <polygon points="${HEX_CLIP}"/>
    </clipPath>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
  </defs>
  <!-- Hexagonal base -->
  <polygon points="${HEX_POINTS}" fill="url(#g)" filter="url(#s)"/>
  <!-- Sheen overlay -->
  <polygon points="${HEX_POINTS}" fill="url(#g2)"/>
  <!-- Decorative honeycomb accent cells -->
  <polygon points="${miniHex(cellX1, cellY1, cellSize)}" fill="rgba(255,255,255,0.08)" clip-path="url(#clip)"/>
  <polygon points="${miniHex(cellX2, cellY2, cellSize)}" fill="rgba(0,0,0,0.10)" clip-path="url(#clip)"/>
  <polygon points="${miniHex(cellX2 - 28, cellY2 - 16, cellSize * 0.7)}" fill="rgba(255,255,255,0.05)" clip-path="url(#clip)"/>
  <!-- 2-letter label -->
  <text
    x="128" y="148"
    text-anchor="middle"
    font-family="ui-sans-serif,system-ui,-apple-system,sans-serif"
    font-size="${label.length === 2 ? "82" : "100"}"
    font-weight="800"
    letter-spacing="-2"
    fill="rgba(255,255,255,0.93)"
  >${label}</text>
</svg>`.trim()

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
