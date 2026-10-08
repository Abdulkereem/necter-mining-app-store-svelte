// Moves SvelteKit's inline boot script out of every built HTML page into a content-hashed file, so the store
// runs under `script-src 'self'` with no 'unsafe-inline' and no hashes (PLATFORM.md errata E8: the miner serves
// the local build with a fixed CSP header; the web build's nginx CSP is equally strict).
//
// The boot script stays a classic, synchronous script: it reads `document.currentScript.parentElement` to find
// the mount point, which works the same for an external file. Its dynamic imports must be absolute (the
// fallback page always is); relative ones would resolve against the script URL instead of the page, so they
// are rejected instead of silently breaking.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const INLINE = /<script>([\s\S]*?)<\/script>/g;

/**
 * @param {string} dir
 * @returns {string[]}
 */
function htmlFiles(dir) {
	/** @type {string[]} */
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
		else if (name.endsWith('.html')) out.push(p);
	}
	return out;
}

/**
 * Rewrites `dir`'s HTML files in place; returns the number of scripts moved.
 * @param {string} dir
 * @param {string} [appDir]
 * @returns {number}
 */
export function externalizeBoot(dir, appDir = '_app') {
	let moved = 0;
	for (const file of htmlFiles(dir)) {
		const html = readFileSync(file, 'utf8');
		const next = html.replace(INLINE, (/** @type {string} */ _m, /** @type {string} */ body) => {
			if (/import\(\s*["']\.\.?\//.test(body)) {
				throw new Error(`${file}: boot script uses relative imports; set kit.paths.relative = false`);
			}
			const code = body.replace(/^\s*\n/, '').replace(/\s+$/, '') + '\n';
			const hash = createHash('sha256').update(code).digest('hex').slice(0, 12);
			const name = `boot.${hash}.js`;
			mkdirSync(join(dir, appDir, 'immutable'), { recursive: true });
			writeFileSync(join(dir, appDir, 'immutable', name), code);
			moved++;
			return `<script src="/${appDir}/immutable/${name}"></script>`;
		});
		if (/<script(?![^>]*\bsrc=)[^>]*>/.test(next)) throw new Error(`${file}: inline script left after externalizing`);
		if (/\son[a-z]+\s*=/i.test(next.replace(/<script[\s\S]*?<\/script>/g, ''))) throw new Error(`${file}: inline event handler`);
		writeFileSync(file, next);
	}
	return moved;
}

/**
 * Wraps a SvelteKit adapter so its output is post-processed by `externalizeBoot`.
 * @param {import('@sveltejs/kit').Adapter} adapter
 * @param {string} outDir
 * @returns {import('@sveltejs/kit').Adapter}
 */
export function withExternalBoot(adapter, outDir) {
	return {
		...adapter,
		/** @param {import('@sveltejs/kit').Builder} builder */
		async adapt(builder) {
			await adapter.adapt(builder);
			const n = externalizeBoot(outDir);
			if (n === 0) throw new Error(`no SvelteKit boot script found in ${outDir}`);
			builder.log.minor(`Moved ${n} inline boot script(s) to external files (CSP script-src 'self')`);
		}
	};
}
