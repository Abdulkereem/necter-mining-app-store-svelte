import adapter from '@sveltejs/adapter-static';
import { relative, sep } from 'node:path';
import { withExternalBoot } from './scripts/externalize-boot.js';

/**
 * Build targets (see README "Build targets"):
 *   BUILD_TARGET=web   (default) → build/web   hosted store for testnet.necter.network (static SPA)
 *   BUILD_TARGET=local           → build/local store embedded in necter-miner (127.0.0.1:7878) and the Tauri app
 * Both are client-rendered SPAs with an index.html fallback for deep links. Neither has inline scripts: the boot
 * script is moved to a file after the build (scripts/externalize-boot.js), so both run under `script-src 'self'`
 * (the miner's CSP for the local build, PLATFORM.md errata E8; deploy/nginx.conf for the web build).
 */
const target = process.env.BUILD_TARGET === 'local' ? 'local' : 'web';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');
			return isExternalLibrary ? undefined : true;
		}
	},
	kit: {
		adapter: withExternalBoot(
			adapter({
				pages: `build/${target}`,
				assets: `build/${target}`,
				fallback: 'index.html',
				precompress: false,
				strict: true
			}),
			`build/${target}`
		),
		// Absolute asset URLs: the boot script lives in its own file, so its imports must not be page-relative.
		paths: { relative: false },
		version: { pollInterval: 0 }
	}
};

export default config;
