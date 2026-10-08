import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// PUBLIC_* variables configure the store (see src/lib/config.ts); they are public by definition.
	envPrefix: ['VITE_', 'PUBLIC_'],
	// Never inline fonts as data: URIs — the CSP is `font-src 'self'` (PLATFORM.md errata E8).
	build: { assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
