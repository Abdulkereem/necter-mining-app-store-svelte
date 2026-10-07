import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// PUBLIC_* variables configure the store (see src/lib/config.ts); they are public by definition.
	envPrefix: ['VITE_', 'PUBLIC_'],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
