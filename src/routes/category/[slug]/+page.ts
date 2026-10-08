import { redirect } from '@sveltejs/kit';
import { CATEGORIES, isCategory } from '$lib/format';
import type { Category } from '$lib/api/types';
import type { PageLoad } from './$types';

/** Old store links used display names ("DePIN", "AI%2FML", "ai") — map them onto the API Category slugs. */
const ALIASES: Record<string, Category> = {
	ai: 'machine-learning',
	ml: 'machine-learning',
	aiml: 'machine-learning',
	cdn: 'content-delivery'
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function resolveCategory(raw: string): Category | null {
	let s = raw;
	try {
		s = decodeURIComponent(raw);
	} catch {
		/* keep raw */
	}
	const lower = s.trim().toLowerCase();
	if (isCategory(lower)) return lower;
	const n = norm(lower);
	if (!n) return null;
	const hit = CATEGORIES.find((c) => norm(c.slug) === n || norm(c.name) === n || norm(c.short) === n);
	return hit?.slug ?? ALIASES[n] ?? null;
}

export const load: PageLoad = ({ params }) => {
	if (isCategory(params.slug)) return { category: params.slug as Category };
	const resolved = resolveCategory(params.slug);
	if (resolved) redirect(308, `/category/${resolved}`);
	return { category: null as Category | null };
};
