/**
 * Necter badge illustrations — abstract shapes, 2.5D depth, hive-inspired palette.
 * No literal bees or honeycombs. Pure geometric abstraction with depth and glow.
 */

function fnv(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  return h >>> 0
}

function hsl(h: number, s: number, l: number) { return `hsl(${h},${s}%,${l}%)` }

const KIND_HUES: Record<string, [number, number]> = {
  milestone: [35, 55],
  performance: [140, 175],
  governance: [210, 250],
  community: [15, 40],
}

export function badgeIconDataUri(name: string, kind: string, size = 128): string {
  const s1 = fnv(name), s2 = fnv(name + ":2"), s3 = fnv(name + kind)
  const s4 = fnv(kind + name), s5 = fnv(name + ":5"), s6 = fnv(name + ":6:" + kind)
  const mid = size / 2, R = size * 0.44
  const [hMin, hMax] = KIND_HUES[kind] ?? [35, 55]
  const span = Math.max(hMax - hMin, 1)
  const h1 = hMin + (s1 % span), h2 = hMin + (s2 % span)

  const dark = hsl(h1, 55 + (s1 % 25), 18 + (s1 % 8))
  const base = hsl(h1, 60 + (s1 % 20), 35 + (s1 % 12))
  const mid1 = hsl(h2, 55 + (s2 % 20), 48 + (s2 % 10))
  const light = hsl(h2, 50 + (s2 % 15), 62 + (s2 % 10))
  const glow = hsl(h1, 45 + (s1 % 20), 75 + (s1 % 10))
  const uid = `n${s1 % 99999}`
  const dy = size * 0.045 // 2.5D depth

  // ── OUTER SHAPE (8 abstract variants) ──
  const shapeType = s1 % 8
  let pts: string, sideFaces = ""

  const hexP = (cx: number, cy: number, r: number, rot = -Math.PI / 6) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + rot
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
    })

  const polyStr = (arr: { x: number; y: number }[]) => arr.map(p => `${p.x},${p.y}`).join(" ")

  const makeSide = (arr: { x: number; y: number }[]) => {
    let s = ""
    for (let i = 0; i < arr.length; i++) {
      const p1 = arr[i], p2 = arr[(i + 1) % arr.length]
      if (p1.y > mid - dy && p2.y > mid - dy) {
        s += `<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p2.x},${p2.y + dy} ${p1.x},${p1.y + dy}" fill="${dark}" opacity="0.55"/>`
      }
    }
    return s
  }

  if (shapeType === 0) {
    // Blob — organic shape via bezier
    const points: { x: number; y: number }[] = []
    const n = 7 + (s1 % 4)
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i
      const wobble = R * (0.85 + ((fnv(`${name}:b:${i}`) % 30) / 100))
      points.push({ x: mid + wobble * Math.cos(a), y: mid + wobble * Math.sin(a) })
    }
    // Smooth closed path
    let d = `M${points[0].x},${points[0].y}`
    for (let i = 0; i < points.length; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n]
      const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }
    d += "Z"
    pts = d // use as path
    sideFaces = `<path d="${d}" fill="${dark}" opacity="0.4" transform="translate(0,${dy})"/>`
  } else if (shapeType === 1) {
    // Squircle
    const r = R * 0.88, k = r * 0.6
    const d = `M${mid},${mid - r} C${mid + k},${mid - r} ${mid + r},${mid - k} ${mid + r},${mid} C${mid + r},${mid + k} ${mid + k},${mid + r} ${mid},${mid + r} C${mid - k},${mid + r} ${mid - r},${mid + k} ${mid - r},${mid} C${mid - r},${mid - k} ${mid - k},${mid - r} ${mid},${mid - r}Z`
    pts = d
    sideFaces = `<path d="${d}" fill="${dark}" opacity="0.4" transform="translate(0,${dy})"/>`
  } else if (shapeType === 2) {
    // Abstract crystal — irregular polygon
    const verts: { x: number; y: number }[] = []
    const n = 5 + (s2 % 3)
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i - Math.PI / 2
      const r = R * (0.8 + (fnv(`${name}:cr:${i}`) % 25) / 100)
      verts.push({ x: mid + r * Math.cos(a), y: mid + r * Math.sin(a) })
    }
    pts = polyStr(verts)
    sideFaces = makeSide(verts)
  } else if (shapeType === 3) {
    // Rounded triangle
    const verts = Array.from({ length: 3 }, (_, i) => {
      const a = (Math.PI * 2 / 3) * i - Math.PI / 2
      return { x: mid + R * Math.cos(a), y: mid + R * Math.sin(a) }
    })
    const rr = R * 0.15
    let d = ""
    for (let i = 0; i < 3; i++) {
      const p = verts[i], pn = verts[(i + 1) % 3], pp = verts[(i + 2) % 3]
      const dx1 = pn.x - p.x, dy1 = pn.y - p.y, len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
      const dx2 = pp.x - p.x, dy2 = pp.y - p.y, len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
      const sx = p.x + (dx2 / len2) * rr, sy = p.y + (dy2 / len2) * rr
      const ex = p.x + (dx1 / len1) * rr, ey = p.y + (dy1 / len1) * rr
      d += `${i === 0 ? "M" : "L"}${sx},${sy} Q${p.x},${p.y} ${ex},${ey} `
    }
    pts = d + "Z"
    sideFaces = `<path d="${d}Z" fill="${dark}" opacity="0.4" transform="translate(0,${dy})"/>`
  } else if (shapeType === 4) {
    // Pill / capsule (horizontal or vertical)
    const horizontal = s2 % 2 === 0
    const w = horizontal ? R * 1.1 : R * 0.7
    const h = horizontal ? R * 0.7 : R * 1.1
    const rr = Math.min(w, h)
    const d = `M${mid - w + rr},${mid - h} L${mid + w - rr},${mid - h} Q${mid + w},${mid - h} ${mid + w},${mid - h + rr} L${mid + w},${mid + h - rr} Q${mid + w},${mid + h} ${mid + w - rr},${mid + h} L${mid - w + rr},${mid + h} Q${mid - w},${mid + h} ${mid - w},${mid + h - rr} L${mid - w},${mid - h + rr} Q${mid - w},${mid - h} ${mid - w + rr},${mid - h}Z`
    pts = d
    sideFaces = `<path d="${d}" fill="${dark}" opacity="0.4" transform="translate(0,${dy})"/>`
  } else if (shapeType === 5) {
    // Petal / leaf
    const d = `M${mid},${mid - R} Q${mid + R * 1.1},${mid - R * 0.2} ${mid + R * 0.3},${mid + R * 0.9} Q${mid},${mid + R * 0.5} ${mid - R * 0.3},${mid + R * 0.9} Q${mid - R * 1.1},${mid - R * 0.2} ${mid},${mid - R}Z`
    pts = d
    sideFaces = `<path d="${d}" fill="${dark}" opacity="0.4" transform="translate(0,${dy})"/>`
  } else if (shapeType === 6) {
    // Abstract 4-lobe
    const lobes = 4, lr = R * 0.58
    let d = ""
    for (let i = 0; i < lobes; i++) {
      const a1 = (Math.PI * 2 / lobes) * i, a2 = (Math.PI * 2 / lobes) * (i + 0.5), a3 = (Math.PI * 2 / lobes) * (i + 1)
      const inR = R * 0.3
      if (i === 0) d += `M${mid + inR * Math.cos(a1)},${mid + inR * Math.sin(a1)} `
      d += `Q${mid + lr * Math.cos(a2)},${mid + lr * Math.sin(a2)} ${mid + inR * Math.cos(a3)},${mid + inR * Math.sin(a3)} `
    }
    pts = d + "Z"
    sideFaces = `<path d="${d}Z" fill="${dark}" opacity="0.4" transform="translate(0,${dy})"/>`
  } else {
    // Stacked hex (2 offset hexagons merged)
    const h1p = hexP(mid - R * 0.12, mid - R * 0.06, R * 0.75)
    const h2p = hexP(mid + R * 0.12, mid + R * 0.06, R * 0.75, -Math.PI / 6 + 0.3)
    // Union as two overlapping polys — just layer them
    pts = polyStr(h1p) // primary
    sideFaces = `<polygon points="${polyStr(h2p)}" fill="${dark}" opacity="0.35" transform="translate(0,${dy})"/>` + makeSide(h1p)
  }

  // Determine if pts is a path (string starting with M) or polygon points
  const isPath = pts.startsWith("M")
  const baseEl = isPath
    ? `<path d="${pts}"/>`
    : `<polygon points="${pts}"/>`
  const clipEl = isPath
    ? `<path d="${pts}"/>`
    : `<polygon points="${pts}"/>`

  // ── INTERIOR PATTERN (6 abstract variants) ──
  const patType = s3 % 6
  let pattern = ""
  const pR = R * 0.7

  if (patType === 0) {
    // Concentric rings with varying opacity
    for (let i = 1; i <= 6; i++) {
      const r = pR * (i / 6)
      pattern += `<circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${light}" stroke-width="${0.5 + (6 - i) * 0.15}" opacity="${0.03 + i * 0.015}"/>`
    }
  } else if (patType === 1) {
    // Noise dots field
    for (let i = 0; i < 30; i++) {
      const si = fnv(`${name}:dot:${i}`)
      const a = ((si % 360) * Math.PI) / 180
      const d = (si % Math.floor(pR * 0.9))
      const x = mid + d * Math.cos(a), y = mid + d * Math.sin(a)
      pattern += `<circle cx="${x}" cy="${y}" r="${1 + si % 3}" fill="${glow}" opacity="${0.05 + (si % 8) / 100}"/>`
    }
  } else if (patType === 2) {
    // Diagonal slashes
    for (let i = -5; i <= 5; i++) {
      const off = i * size * 0.08
      pattern += `<line x1="${mid + off - pR}" y1="${mid - pR}" x2="${mid + off + pR}" y2="${mid + pR}" stroke="${light}" stroke-width="0.6" opacity="0.05"/>`
    }
  } else if (patType === 3) {
    // Scattered micro shapes
    for (let i = 0; i < 15; i++) {
      const si = fnv(`${name}:ms:${i}`)
      const a = ((si % 360) * Math.PI) / 180, d = si % Math.floor(pR * 0.8)
      const x = mid + d * Math.cos(a), y = mid + d * Math.sin(a), r = 2 + si % 4
      if (si % 3 === 0) pattern += `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="1" transform="rotate(${si % 45} ${x} ${y})" fill="${glow}" opacity="0.06"/>`
      else if (si % 3 === 1) pattern += `<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="${glow}" opacity="0.07"/>`
      else { const tri = `${x},${y - r} ${x + r * 0.87},${y + r * 0.5} ${x - r * 0.87},${y + r * 0.5}`; pattern += `<polygon points="${tri}" fill="${glow}" opacity="0.05"/>` }
    }
  } else if (patType === 4) {
    // Arcs / crescents
    for (let i = 0; i < 4; i++) {
      const si = fnv(`${name}:arc:${i}`)
      const a = ((si % 360) * Math.PI) / 180
      const ar = pR * 0.3 + (si % Math.floor(pR * 0.4))
      const cx = mid + (pR * 0.2) * Math.cos(a), cy = mid + (pR * 0.2) * Math.sin(a)
      const startA = si % 180, sweep = 90 + si % 90
      const rad = (startA * Math.PI) / 180
      const endRad = ((startA + sweep) * Math.PI) / 180
      pattern += `<path d="M${cx + ar * Math.cos(rad)},${cy + ar * Math.sin(rad)} A${ar},${ar} 0 0 1 ${cx + ar * Math.cos(endRad)},${cy + ar * Math.sin(endRad)}" fill="none" stroke="${glow}" stroke-width="1.2" opacity="0.08"/>`
    }
  } else {
    // Radial spokes
    const spokes = 8 + (s3 % 8)
    for (let i = 0; i < spokes; i++) {
      const a = (Math.PI * 2 / spokes) * i
      const len = pR * (0.4 + (fnv(`${name}:sp:${i}`) % 40) / 100)
      pattern += `<line x1="${mid}" y1="${mid}" x2="${mid + len * Math.cos(a)}" y2="${mid + len * Math.sin(a)}" stroke="${light}" stroke-width="0.5" opacity="0.06"/>`
    }
  }

  // ── CENTER MARK (10 abstract variants) ──
  const markType = s4 % 10
  const eR = size * 0.14
  let mark = ""

  // Subtle backing glow
  mark += `<circle cx="${mid}" cy="${mid}" r="${eR * 1.6}" fill="${dark}" opacity="0.35"/>`

  if (markType === 0) {
    // Concentric rings
    mark += `<circle cx="${mid}" cy="${mid}" r="${eR}" fill="none" stroke="${glow}" stroke-width="2" opacity="0.7"/>
    <circle cx="${mid}" cy="${mid}" r="${eR * 0.5}" fill="${glow}" opacity="0.8"/>
    <circle cx="${mid}" cy="${mid}" r="${eR * 0.18}" fill="white" opacity="0.5"/>`
  } else if (markType === 1) {
    // Cross
    const a = eR * 0.85, w = eR * 0.28
    mark += `<rect x="${mid - w}" y="${mid - a}" width="${w * 2}" height="${a * 2}" rx="3" fill="${glow}" opacity="0.85"/>
    <rect x="${mid - a}" y="${mid - w}" width="${a * 2}" height="${w * 2}" rx="3" fill="${glow}" opacity="0.85"/>`
  } else if (markType === 2) {
    // Stacked dots (3 vertical)
    for (let i = -1; i <= 1; i++) {
      const r = eR * (i === 0 ? 0.35 : 0.22)
      mark += `<circle cx="${mid}" cy="${mid + i * eR * 0.6}" r="${r}" fill="${glow}" opacity="${i === 0 ? 0.9 : 0.6}"/>`
    }
  } else if (markType === 3) {
    // Nested squares (rotated)
    for (let i = 0; i < 3; i++) {
      const r = eR * (1 - i * 0.3), rot = i * 15
      mark += `<rect x="${mid - r}" y="${mid - r}" width="${r * 2}" height="${r * 2}" rx="2" transform="rotate(${rot} ${mid} ${mid})" fill="${i === 2 ? glow : "none"}" stroke="${glow}" stroke-width="${i === 0 ? "1.5" : "0.8"}" opacity="${0.3 + i * 0.25}"/>`
    }
  } else if (markType === 4) {
    // Abstract spark (4 lines radiating)
    const len = eR * 0.9
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 4) * (i * 2) + Math.PI / 8
      mark += `<line x1="${mid}" y1="${mid}" x2="${mid + len * Math.cos(a)}" y2="${mid + len * Math.sin(a)}" stroke="${glow}" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/>`
    }
    mark += `<circle cx="${mid}" cy="${mid}" r="${eR * 0.2}" fill="${glow}" opacity="0.9"/>`
  } else if (markType === 5) {
    // Triangle
    const pts = Array.from({ length: 3 }, (_, i) => {
      const a = (Math.PI * 2 / 3) * i - Math.PI / 2
      return `${mid + eR * Math.cos(a)},${mid + eR * Math.sin(a)}`
    }).join(" ")
    mark += `<polygon points="${pts}" fill="${glow}" opacity="0.85"/>
    <circle cx="${mid}" cy="${mid + eR * 0.1}" r="${eR * 0.22}" fill="white" opacity="0.3"/>`
  } else if (markType === 6) {
    // Pill pair
    const pw = eR * 0.22, ph = eR * 0.75
    mark += `<rect x="${mid - eR * 0.4 - pw}" y="${mid - ph}" width="${pw * 2}" height="${ph * 2}" rx="${pw}" fill="${glow}" opacity="0.8"/>
    <rect x="${mid + eR * 0.4 - pw}" y="${mid - ph * 0.7}" width="${pw * 2}" height="${ph * 1.4}" rx="${pw}" fill="${glow}" opacity="0.6"/>`
  } else if (markType === 7) {
    // Ring with notch
    mark += `<circle cx="${mid}" cy="${mid}" r="${eR}" fill="none" stroke="${glow}" stroke-width="3" stroke-dasharray="${eR * 5.5} ${eR * 0.8}" opacity="0.8"/>
    <circle cx="${mid}" cy="${mid}" r="${eR * 0.3}" fill="${glow}" opacity="0.7"/>`
  } else if (markType === 8) {
    // Diamond
    mark += `<rect x="${mid - eR * 0.7}" y="${mid - eR * 0.7}" width="${eR * 1.4}" height="${eR * 1.4}" rx="2" transform="rotate(45 ${mid} ${mid})" fill="${glow}" opacity="0.85"/>
    <rect x="${mid - eR * 0.25}" y="${mid - eR * 0.25}" width="${eR * 0.5}" height="${eR * 0.5}" rx="1" transform="rotate(45 ${mid} ${mid})" fill="white" opacity="0.25"/>`
  } else {
    // Wave / tilde
    const w = eR * 1.2
    mark += `<path d="M${mid - w} ${mid} Q${mid - w * 0.5} ${mid - eR * 0.6} ${mid} ${mid} Q${mid + w * 0.5} ${mid + eR * 0.6} ${mid + w} ${mid}" fill="none" stroke="${glow}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`
  }

  const gradAngle = s5 % 180

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="${uid}g" gradientTransform="rotate(${gradAngle})">
      <stop offset="0%" stop-color="${base}"/>
      <stop offset="50%" stop-color="${mid1}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="${uid}h" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.14)"/>
      <stop offset="40%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.2)"/>
    </linearGradient>
    <clipPath id="${uid}c">${clipEl}</clipPath>
  </defs>
  <!-- 2.5D depth -->
  ${sideFaces}
  <!-- Base -->
  <g fill="url(#${uid}g)">${baseEl}</g>
  <!-- Sheen -->
  <g fill="url(#${uid}h)">${baseEl}</g>
  <!-- Interior -->
  <g clip-path="url(#${uid}c)">
    ${pattern}
    <ellipse cx="${mid - R * 0.1}" cy="${mid - R * 0.3}" rx="${R * 0.45}" ry="${R * 0.18}" fill="white" opacity="0.04"/>
  </g>
  <!-- Center -->
  ${mark}
</svg>`.trim()

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
