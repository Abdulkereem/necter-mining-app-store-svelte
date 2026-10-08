import { defineConfig, devices } from '@playwright/test';

const HUB_PORT = 4517;
const STORE_PORT = 4518;
const LOCAL_PORT = 4519;
const LOCAL_MINER_PORT = 4520; // local build + mock miner wallet API

export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 60_000,
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: `http://127.0.0.1:${STORE_PORT}`,
		...devices['Desktop Chrome'],
		viewport: { width: 1440, height: 900 },
		trace: 'retain-on-failure'
	},
	webServer: [
		{
			command: `MOCK_HUB_PORT=${HUB_PORT} STORE_ORIGIN_HOSTS=127.0.0.1:${STORE_PORT},localhost:${STORE_PORT},127.0.0.1:${LOCAL_PORT},127.0.0.1:${LOCAL_MINER_PORT} npx tsx tests/mock-server.ts`,
			url: `http://127.0.0.1:${HUB_PORT}/v1/status`,
			reuseExistingServer: false,
			timeout: 30_000
		},
		{
			// Both production builds, served with their production CSP headers (tests/static-server.ts): the web build
			// (pointed at the mock Hub) on STORE_PORT, the local build (Hub via the same-origin /rpc proxy, exactly the
			// miner's CSP from PLATFORM.md errata E8) on LOCAL_PORT. Built one after the other (shared .svelte-kit).
			command:
				`BUILD_TARGET=web PUBLIC_RPC_URL=http://127.0.0.1:${HUB_PORT} npx vite build && ` +
				`BUILD_TARGET=local PUBLIC_APP_MODE=local npx vite build && ` +
				`HUB_URL=http://127.0.0.1:${HUB_PORT} WEB_PORT=${STORE_PORT} LOCAL_PORT=${LOCAL_PORT} LOCAL_MINER_PORT=${LOCAL_MINER_PORT} npx tsx tests/static-server.ts`,
			url: `http://127.0.0.1:${LOCAL_PORT}/discover`,
			reuseExistingServer: false,
			timeout: 400_000
		}
	]
});
