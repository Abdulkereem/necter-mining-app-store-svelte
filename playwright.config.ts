import { defineConfig, devices } from '@playwright/test';

const HUB_PORT = 4517;
const STORE_PORT = 4518;

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
			command: `MOCK_HUB_PORT=${HUB_PORT} STORE_ORIGIN_HOSTS=127.0.0.1:${STORE_PORT},localhost:${STORE_PORT} npx tsx tests/mock-server.ts`,
			url: `http://127.0.0.1:${HUB_PORT}/v1/status`,
			reuseExistingServer: false,
			timeout: 30_000
		},
		{
			// Production web build pointed at the mock Hub, served by vite preview.
			command: `BUILD_TARGET=web PUBLIC_RPC_URL=http://127.0.0.1:${HUB_PORT} npx vite build && npx vite preview --port ${STORE_PORT} --strictPort --host 127.0.0.1`,
			url: `http://127.0.0.1:${STORE_PORT}/discover`,
			reuseExistingServer: false,
			timeout: 240_000
		}
	]
});
