# Necter Mining App Store

SvelteKit 2 + Svelte 5 store for the Necter mining platform: discover projects, subscribe devices with gasless
collateral, follow proofs and payouts, publish projects, and explore rounds and epochs. All data comes from the
Hub JSON API (`spec/openapi.yaml`, served at `https://testnet-rpc.necter.network`); the store has no API of its own.

## Tech stack

- SvelteKit 2 + Svelte 5 runes, Tailwind CSS 4 (design tokens in `src/app.css`), lucide icons, svelte-french-toast
- Typed Hub client: `openapi-typescript` types generated from `spec/openapi.yaml` + `openapi-fetch` (`src/lib/api`)
- Wallet: EIP-1193 via `viem` — injected wallets discovered with EIP-6963, optional WalletConnect v2; SIWE
  (EIP-4361) sign-in gives a bearer session (`src/lib/stores/wallet.ts`)
- Protocol helpers (`src/lib/protocol`): canonical JSON, `project_id` / `subscription_id` / vault address,
  manifest validation + EIP-191 signing, SIWE and EIP-712 payload checks

## Getting started

```bash
pnpm install
pnpm dev            # talks to PUBLIC_RPC_URL (default https://testnet-rpc.necter.network)
pnpm dev:mock       # dev-only in-browser mock Hub with sample data (never in production builds)
pnpm test           # vitest: API client, SIWE, manifest signing, key stores, protocol cross-checks
pnpm test:e2e       # Playwright: smoke + CSP tests, both builds behind their CSP headers, against tests/mock-server.ts
pnpm check          # svelte-check
pnpm gen:api        # regenerate src/lib/api/schema.d.ts from spec/openapi.yaml
```

## Configuration (`PUBLIC_*`, build time)

| Variable | Default | Meaning |
|---|---|---|
| `PUBLIC_RPC_URL` | `https://testnet-rpc.necter.network` (web), `/rpc` (local) | Hub API base URL |
| `PUBLIC_APP_MODE` | `web` | `local` = store embedded in necter-miner / Tauri app |
| `PUBLIC_MINER_API_URL` | `` (local, same origin) | necter-miner local API origin |
| `PUBLIC_SIWE_DOMAIN`, `PUBLIC_SIWE_URI` | page host / origin | SIWE domain + URI (must be on the Hub allow-list) |
| `PUBLIC_WALLETCONNECT_PROJECT_ID` | unset | enables the WalletConnect option |
| `PUBLIC_CHAIN_ID`, `PUBLIC_CHAIN_RPC`, `PUBLIC_CHAIN_EXPLORER` | Sepolia | settlement chain |
| `PUBLIC_MINER_DL_MACOS` / `_WINDOWS` / `_LINUX` / `_ANDROID` / `_IOS` | unset ("Soon") | miner download links |
| `PUBLIC_MOCK_API` | unset | `1` with `vite dev` only: in-browser mock Hub |

## Build targets

Both targets are client-rendered SPAs built with `@sveltejs/adapter-static` (`index.html` fallback for deep links).

### Web store — `testnet.necter.network`

```bash
pnpm build:web          # → build/web
```

Static files only. Serve them with any static host that falls back to `index.html` for unknown paths and adds the
security headers. A ready image for DockHive app hosting (or any container host) is in `Dockerfile`:

```bash
docker build -t necter-store .     # builds build/web and serves it with nginx on :8080
```

`deploy/nginx.conf` sets the SPA fallback and long-lived caching for `/_app/immutable/*`; every location includes
`deploy/security-headers.conf` with the CSP (`deploy/csp.mjs` `webCsp()`): the local policy below for the web
origin (`script-src 'self'` without `'unsafe-inline'`, `font-src 'self'`), API calls to the Hub host only, plus the
WalletConnect endpoints. Serving the store from another Hub host needs a regenerated policy.

### Content Security Policy (both builds)

- **No inline scripts.** SvelteKit's boot script is moved into `/_app/immutable/boot.<hash>.js` after the build
  (`scripts/externalize-boot.js`, wired into the adapter in `svelte.config.js`); the build fails if any inline
  script or inline event handler remains.
- **Self-hosted fonts only** (`@fontsource-variable/geist`, `@fontsource-variable/jetbrains-mono`, OFL); Vite never
  inlines fonts as `data:` URIs. No Google Fonts / Fontshare links. Satoshi is not bundled: its ITF Free Font
  License forbids redistributing the files through repositories or public servers, so headings use Geist.
- **Local build:** runs under exactly the miner's header (PLATFORM.md errata E8). WalletConnect is disabled there
  (its relay is not an allowed origin); use the miner's embedded wallet or a browser wallet extension.
- `tests/e2e/csp.spec.ts` serves both builds behind their production headers (`tests/static-server.ts`) and fails on
  any `securitypolicyviolation`, CSP console error or third-party request.

### Local mode — necter-miner (127.0.0.1:7878) and the Tauri desktop app

```bash
pnpm build:local        # → build/local  (PUBLIC_APP_MODE=local, PUBLIC_RPC_URL=/rpc)
```

necter-miner embeds `build/local` and serves it at `http://127.0.0.1:7878` (miner-core.md §7.4); the Tauri app
loads the same URL. In this mode the store:

- reads the Hub through the miner's same-origin `/rpc/*` proxy (no CORS, the miner adds its Hub session),
- uses the miner's local API (`/api/v1/*`) for device panels: **This device** (status, start/stop, binding, wallet,
  sign requests) and the hardware checker (real hardware profile + benchmark),
- logs into the local API with the `#login=<token>` fragment opened by `necter-miner ui` (session cookie),
  or a password on remote dashboards,
- can use the miner's own wallet (embedded wallet) instead of a browser wallet.

## Project layout

| Path | Purpose |
|---|---|
| `src/lib/api/` | generated schema, typed client (`http.ts`), endpoint wrappers (`hub.ts`), session store, query helper, dev mock Hub |
| `src/lib/protocol/` | canonical JSON, ids, manifest, SIWE, EIP-712 payload checks (+ Python reference fixtures) |
| `src/lib/stores/` | wallet/session, account (me + preferences), balances, network descriptor |
| `src/lib/flows.ts` | subscribe / top-up / unbond / withdraw / claims / publish flows |
| `src/lib/local/miner.ts` | necter-miner local API client |
| `src/lib/components/common/` | empty / error / loading / coming-soon / sign-in components (brand illustrations) |
| `tests/` | Playwright smoke + CSP tests, mock Hub server, CSP static server |
| `spec/openapi.yaml` | vendored copy of the binding API spec (`pnpm gen:api` re-syncs from `../spec`) |

## License

MIT
