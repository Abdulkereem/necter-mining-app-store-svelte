/**
 * Build/runtime configuration.
 *
 * Values come from `PUBLIC_*` environment variables at build time (Vite `envPrefix` includes `PUBLIC_`).
 * Two build targets exist (see README "Build targets"):
 *   - web   — the hosted store at testnet.necter.network, talks to the Hub at PUBLIC_RPC_URL.
 *   - local — the store embedded in necter-miner (127.0.0.1:7878) and the Tauri desktop app; reads the Hub
 *             through the miner's same-origin `/rpc` proxy and device panels through `/api/v1`.
 */

export type AppMode = 'web' | 'local';

const env = (import.meta.env ?? {}) as Record<string, string | boolean | undefined>;

function str(name: string): string | undefined {
	const v = env[name];
	return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

export const APP_MODE: AppMode = str('PUBLIC_APP_MODE') === 'local' ? 'local' : 'web';

/** Default public Hub host (PLATFORM.md §k). */
export const DEFAULT_RPC_URL = 'https://testnet-rpc.necter.network';

/** Base URL of the Hub JSON API. In local mode the miner proxies the Hub at `/rpc`. */
export const RPC_URL: string = (str('PUBLIC_RPC_URL') ?? (APP_MODE === 'local' ? '/rpc' : DEFAULT_RPC_URL)).replace(
	/\/+$/,
	''
);

/** Base URL of the local miner API (miner-core.md §7). Same origin in local mode. */
export const MINER_API_URL: string = (str('PUBLIC_MINER_API_URL') ?? (APP_MODE === 'local' ? '' : 'http://127.0.0.1:7878')).replace(
	/\/+$/,
	''
);

/** Settlement chain (Sepolia). */
export const CHAIN_ID = Number(str('PUBLIC_CHAIN_ID') ?? 11155111);
export const CHAIN_NAME = 'Ethereum Sepolia';
export const CHAIN_EXPLORER = str('PUBLIC_CHAIN_EXPLORER') ?? 'https://sepolia.etherscan.io';
export const CHAIN_RPC_PUBLIC = str('PUBLIC_CHAIN_RPC') ?? 'https://ethereum-sepolia-rpc.publicnode.com';

/** Network id the store expects (PLATFORM.md §0). */
export const NETWORK_ID = str('PUBLIC_NETWORK_ID') ?? 'necter-testnet';

/** Optional WalletConnect v2 project id; the WalletConnect option is hidden without it. */
export const WALLETCONNECT_PROJECT_ID = str('PUBLIC_WALLETCONNECT_PROJECT_ID');

/**
 * Dev-only mock Hub. Only honoured in `vite dev` (import.meta.env.DEV); production builds never include it.
 */
export const MOCK_API: boolean = Boolean(env.DEV) && str('PUBLIC_MOCK_API') === '1';

/** SIWE statement required by the Hub (openapi `/v1/auth/siwe`). */
export const SIWE_STATEMENT = 'Sign in to Necter testnet.';

/**
 * SIWE domain. The Hub allows `testnet.necter.network`, `127.0.0.1:7878`, `localhost:7878`, `necter-miner.app`.
 * Defaults to the page host.
 */
export function siweDomain(): string {
	const configured = str('PUBLIC_SIWE_DOMAIN');
	if (configured) return configured;
	if (typeof location !== 'undefined') return location.host;
	return 'testnet.necter.network';
}

export function siweUri(): string {
	const configured = str('PUBLIC_SIWE_URI');
	if (configured) return configured;
	if (typeof location !== 'undefined') return location.origin;
	return 'https://testnet.necter.network';
}

/** Miner download links (placeholders until releases are published). */
export const MINER_DOWNLOADS = {
	macos: str('PUBLIC_MINER_DL_MACOS') ?? null,
	windows: str('PUBLIC_MINER_DL_WINDOWS') ?? null,
	linux: str('PUBLIC_MINER_DL_LINUX') ?? null,
	android: str('PUBLIC_MINER_DL_ANDROID') ?? null,
	ios: str('PUBLIC_MINER_DL_IOS') ?? null,
	docker: 'necter/miner'
} as const;
