// Background media for the Discover hero slides. A project's own listing media (listing.video / listing.banner on the
// Hub manifest) wins; otherwise the store picks a clip by slug, then by category. Clips are self-hosted under
// /static/hero (720p H.264, ~10 s loops, WebP posters) from Pexels — free to use, credited on the slide.

export interface HeroMedia {
	/** Same-origin MP4, or null for a still-only slide. */
	video: string | null;
	/** Poster / still image (WebP, or a Hub banner URL). */
	poster: string;
	/** Attribution shown on the slide; null for the project's own media. */
	credit: { author: string; url: string } | null;
}

const CLIPS = {
	hash: {
		video: '/hero/hash.mp4',
		poster: '/hero/hash.webp',
		credit: { author: 'Chandresh Uike', url: 'https://www.pexels.com/video/digital-data-flow-in-a-futuristic-tunnel-34127877/' }
	},
	servers: {
		video: '/hero/servers.mp4',
		poster: '/hero/servers.webp',
		credit: { author: 'MrColo', url: 'https://www.pexels.com/video/close-up-of-a-cpu-7140928/' }
	},
	neural: {
		video: '/hero/neural.mp4',
		poster: '/hero/neural.webp',
		credit: { author: 'Nicola Narracci', url: 'https://www.pexels.com/video/vibrant-abstract-network-of-glowing-nodes-36245490/' }
	},
	hive: {
		video: '/hero/hive.mp4',
		poster: '/hero/hive.webp',
		credit: { author: 'Rostislav Uzunov', url: 'https://www.pexels.com/video/golden-hexagons-on-a-background-of-gold-9629254/' }
	}
} satisfies Record<string, HeroMedia>;

const BY_SLUG: Record<string, HeroMedia> = {
	'hashchain-lab': CLIPS.hash,
	'dockhive-functions': CLIPS.servers,
	'tiwa-agent-eval': CLIPS.neural
};

const BY_CATEGORY: Record<string, HeroMedia> = {
	compute: CLIPS.servers,
	storage: CLIPS.servers,
	'content-delivery': CLIPS.servers,
	bandwidth: CLIPS.servers,
	'machine-learning': CLIPS.neural,
	blockchain: CLIPS.hash,
	'hardware-staking': CLIPS.hash
};

/** Only same-origin video plays under the store CSP (media-src falls back to 'self'). */
function sameOrigin(u: string | null | undefined): u is string {
	return !!u && u.startsWith('/') && !u.startsWith('//');
}

export function heroMediaFor(
	p: { slug?: string | null; category?: string | null; kind?: string | null },
	listing?: { banner?: string | null; video?: string | null } | null
): HeroMedia {
	const banner = listing?.banner && (listing.banner.startsWith('https://') || sameOrigin(listing.banner)) ? listing.banner : null;
	if (sameOrigin(listing?.video)) return { video: listing.video, poster: banner ?? CLIPS.hive.poster, credit: null };
	if (banner) return { video: null, poster: banner, credit: null };
	if (p.slug && BY_SLUG[p.slug]) return BY_SLUG[p.slug];
	if (p.kind === 'proof-of-work') return CLIPS.hash;
	return (p.category && BY_CATEGORY[p.category]) || CLIPS.hive;
}
