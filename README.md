# Necter Mining App Store — SvelteKit

SvelteKit 2 + Svelte 5 port of the Necter Mining App Store. A decentralized mining marketplace for the Necter Network.

## Live Demo

**[mining-app-store-svelte.vercel.app](https://mining-app-store-svelte.vercel.app)**

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5 (runes: $state, $derived, $effect)
- **Styling**: Tailwind CSS 4 with CSS variables
- **Language**: TypeScript 5
- **State**: Mock backend store (shared with Next.js version)
- **Charts**: HTML/CSS bar charts (no Chart.js dependency)
- **Toasts**: svelte-french-toast
- **Icons**: lucide-svelte
- **Fonts**: Inter + JetBrains Mono

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

## Pages

- **Discover** — Hero carousel, story cards, curated collections, trending
- **App Detail** — 4 tabs (Overview, Economics, Requirements, Reviews)
- **My Mining** — Dashboard, earnings, proofs with mobile/desktop layouts
- **Leaderboards** — Projects, earners, uptime rankings
- **Governance** — Vote on proposals, review listings, create proposals
- **Activity** — Event feed with filters and day grouping
- **Settings** — Profile, devices, wallet, notifications, badges
- **Search** — Live search with suggested projects
- **Withdraw** — Earnings summary and withdrawal form

## Mobile

Full mobile responsive design with:
- Bottom tab navigation (Discover, Mining, Leaderboard, Governance, Search)
- Top bar with profile avatar, logo, help + notifications
- Bottom sheet modals
- Separate mobile/desktop layouts where needed

## License

MIT
