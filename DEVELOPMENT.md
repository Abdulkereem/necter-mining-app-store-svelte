# Necter Mining App Store — SvelteKit

## Quick Start

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production build
```

## Architecture

- **Framework**: SvelteKit 2 + Svelte 5 (runes: $state, $derived, $effect)
- **Styling**: Tailwind CSS 4 with CSS custom properties design system
- **State**: Mock backend store (`src/lib/mock-backend/store.ts`) with localStorage persistence
- **Fonts**: Geist Sans (body), Satoshi (headings), JetBrains Mono (code)
- **Icons**: lucide-svelte
- **Toasts**: svelte-french-toast

## Design System

All tokens are in `src/app.css` under the `.dark` block:

- **Color palettes**: cod-gray (surfaces), gray-suit (text), kournikova (gold accent), brown-tumbleweed (warm), pastel-green (success)
- **Semantic tokens**: `--surface-0` through `--surface-4`, `--text-primary/secondary/tertiary`, `--accent-base/hover/pressed`, `--border-default/hover/strong`
- **Primary accent**: `#FFC933` (warm gold)

## UI Components

Reusable components at `src/lib/components/ui/`:
- Button (primary/secondary/ghost/destructive, sm/md/lg)
- Card, Badge, Input, Select, Textarea, Modal, Toggle, StatCard, TabBar

Import: `import { Button, Card, Badge } from '$lib/components/ui'`

**Note**: ~40% of pages use these components. The rest still use raw Tailwind classes. Migration is incomplete.

## Key Files

| File | Purpose |
|------|---------|
| `src/app.css` | Design system tokens + base styles |
| `src/lib/mock-backend/store.ts` | Mock backend (~5000 lines, needs splitting) |
| `src/lib/mock-backend/types.ts` | All TypeScript types (40+ entities) |
| `src/lib/mock-data.ts` | 34 mining projects with real data |
| `src/lib/stores/backend.ts` | Svelte store wrapping the mock backend |
| `src/lib/stores/wallet.ts` | Mock wallet connection |
| `src/lib/app-icon.ts` | Deterministic SVG icon generator + `getAppIcon()` |
| `src/lib/components/ui/` | Reusable component library |

## Known Technical Debt

1. **198 TypeScript errors** (mostly implicit `any` types) — app runs fine but `svelte-check` complains
2. **Large page files** — `mining/[id]` and `apps/[id]` are 1500+ lines, should be broken into sub-components
3. **Mock store is one file** — 5000+ lines, should be split into domain modules (governance, mining, developer, etc.)
4. **Inconsistent component usage** — some pages use `<Button>`, others use raw `<button class="btn-subscribe">`
5. **Inline styles remain** — ~200 dynamic inline styles (legitimate) + some static ones that could be Tailwind

## Mock Backend

The entire app runs on a mock backend with localStorage persistence. Key:
- Storage key: `necter_mock_backend_v2`
- Icons/screenshots always sync from fresh mock data on hydrate
- Clear localStorage to reset all state

## When Connecting Real Backend

Replace these files:
- `src/lib/stores/backend.ts` — swap `MockBackendStore` for real API client
- `src/lib/stores/wallet.ts` — swap mock wallet for real Web3 provider (ethers/viem/wagmi)
- Keep `src/lib/mock-backend/types.ts` as your type definitions — they map well to real entities

## Brand Assets

- `static/brand/` — logos, hero images, honeycomb patterns
- `static/brand/3d/` — 3D rendered illustrations (bee, hourglass, network nodes, etc.)
- `static/logos/` — project logos (Bitcoin, Ethereum, DockHive, TIWA, etc.)
- `static/screenshots/` — project screenshots (optimized to 800px max)

## Deployment

Auto-deploys to Vercel on push to `main`. Uses `@sveltejs/adapter-vercel`.
