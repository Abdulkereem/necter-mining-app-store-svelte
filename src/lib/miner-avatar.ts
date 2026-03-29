/**
 * Deterministic abstract avatar for miners.
 * Generates a unique geometric pattern from the miner ID.
 */

function fnv32a(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

const PALETTES: [string, string][] = [
  ["#6C5CE7", "#A29BFE"], // purple
  ["#00B894", "#55EFC4"], // green
  ["#0984E3", "#74B9FF"], // blue
  ["#E17055", "#FAB1A0"], // coral
  ["#FDCB6E", "#FFEAA7"], // gold
  ["#E84393", "#FD79A8"], // pink
  ["#00CEC9", "#81ECEC"], // teal
  ["#6C5CE7", "#FD79A8"], // purple-pink
  ["#0984E3", "#00CEC9"], // blue-teal
  ["#E17055", "#FDCB6E"], // coral-gold
]

export function minerAvatarDataUri(minerId: string, size = 128): string {
  const seed = fnv32a(minerId)
  const seed2 = fnv32a(minerId + ":2")
  const seed3 = fnv32a(minerId + ":3")

  const [c1, c2] = PALETTES[seed % PALETTES.length]

  // Grid of 4x4 cells, mirrored horizontally for symmetry (like identicons)
  const cells: boolean[][] = []
  for (let row = 0; row < 4; row++) {
    const rowCells: boolean[] = []
    for (let col = 0; col < 2; col++) {
      const bit = fnv32a(`${minerId}:${row}:${col}`) % 3 !== 0 // ~66% fill
      rowCells.push(bit)
    }
    // Mirror
    cells.push([...rowCells, ...rowCells.reverse()])
  }

  const cellSize = size / 4
  const padding = size * 0.1
  const innerSize = size - padding * 2
  const innerCell = innerSize / 4

  // Rotation of the gradient
  const angle = (seed2 % 360)

  let rects = ""
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (cells[r][c]) {
        const x = padding + c * innerCell
        const y = padding + r * innerCell
        const rx = 2 + (fnv32a(`${minerId}:r:${r}:${c}`) % 3)
        rects += `<rect x="${x}" y="${y}" width="${innerCell}" height="${innerCell}" rx="${rx}" fill="url(#mg)" opacity="${0.6 + (fnv32a(`${minerId}:o:${r}:${c}`) % 40) / 100}"/>`
      }
    }
  }

  // Optional accent shape (circle or diamond) in center
  const mid = size / 2
  const accentR = innerCell * 0.4
  const accent = seed3 % 2 === 0
    ? `<circle cx="${mid}" cy="${mid}" r="${accentR}" fill="${c2}" opacity="0.5"/>`
    : `<rect x="${mid - accentR}" y="${mid - accentR}" width="${accentR * 2}" height="${accentR * 2}" rx="2" transform="rotate(45 ${mid} ${mid})" fill="${c2}" opacity="0.4"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="var(--surface-2, #1a1a2e)"/>
  ${rects}
  ${accent}
</svg>`.trim()

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
