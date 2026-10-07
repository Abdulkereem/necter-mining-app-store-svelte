import adapter from '@sveltejs/adapter-static';
import { relative, sep } from 'node:path';

/**
 * Build targets (see README "Build targets"):
 *   BUILD_TARGET=web   (default) → build/web   hosted store for testnet.necter.network (static SPA)
 *   BUILD_TARGET=local           → build/local store embedded in necter-miner (127.0.0.1:7878) and the Tauri app
 * Both are client-rendered SPAs with an index.html fallback for deep links.
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
		adapter: adapter({
			pages: `build/${target}`,
			assets: `build/${target}`,
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		version: { pollInterval: 0 }
	}
};

export default config;
