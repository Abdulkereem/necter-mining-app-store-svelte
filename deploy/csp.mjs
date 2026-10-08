// Content-Security-Policy for both builds (single source for tests; deploy/nginx.conf carries the web policy
// verbatim and src/lib/csp.test.ts checks that it matches `webCsp(DEFAULT_HUB)`).

export const DEFAULT_HUB = 'https://testnet-rpc.necter.network';

/**
 * `https://host[:port]` → `wss://host[:port]` (the Hub relay origin, PLATFORM.md §k).
 * @param {string} hubOrigin
 * @returns {string}
 */
export function relayOrigin(hubOrigin) {
	return hubOrigin.replace(/^http/, 'ws');
}

/**
 * PLATFORM.md errata E8 — the exact header the miner sends with the local build (127.0.0.1:7878 and the desktop
 * app). The local build reaches the Hub through the same-origin `/rpc` proxy, but the policy still names the
 * Hub origins as the spec does.
 * @param {string} [hubOrigin]
 * @param {string} [relay]
 * @returns {string}
 */
export function localCsp(hubOrigin = DEFAULT_HUB, relay = relayOrigin(hubOrigin)) {
	return [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"font-src 'self'",
		"img-src 'self' data: https:",
		`connect-src 'self' ${hubOrigin} ${relay}`,
		"frame-ancestors 'none'",
		"base-uri 'none'",
		"form-action 'self'"
	].join('; ');
}

/** WalletConnect v2 endpoints, used by the web build only when PUBLIC_WALLETCONNECT_PROJECT_ID is set. */
export const WALLETCONNECT_CONNECT = [
	'wss://relay.walletconnect.com',
	'wss://relay.walletconnect.org',
	'https://rpc.walletconnect.com',
	'https://rpc.walletconnect.org',
	'https://verify.walletconnect.com',
	'https://verify.walletconnect.org'
];
export const WALLETCONNECT_FRAMES = ['https://verify.walletconnect.com', 'https://verify.walletconnect.org'];

/**
 * The web store (testnet.necter.network): the local policy for the web origin — same script/style/font/img rules
 * (no 'unsafe-inline' scripts, self-hosted fonts) — plus the WalletConnect endpoints and the public Sepolia RPC
 * the WalletConnect provider reads from.
 * @param {string} [hubOrigin]
 * @param {string} [sepoliaRpc]
 * @returns {string}
 */
export function webCsp(hubOrigin = DEFAULT_HUB, sepoliaRpc = 'https://ethereum-sepolia-rpc.publicnode.com') {
	return [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"font-src 'self'",
		"img-src 'self' data: https:",
		`connect-src 'self' ${hubOrigin} ${relayOrigin(hubOrigin)} ${WALLETCONNECT_CONNECT.join(' ')} ${sepoliaRpc}`,
		`frame-src ${WALLETCONNECT_FRAMES.join(' ')}`,
		"frame-ancestors 'none'",
		"base-uri 'none'",
		"form-action 'self'"
	].join('; ');
}
