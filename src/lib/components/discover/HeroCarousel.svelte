<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { ProjectSummary } from '$lib/api/types';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import { heroMediaFor } from './heroMedia';

	type Listing = { banner?: string | null; video?: string | null };

	let {
		apps,
		listings,
		labelOf,
		accentOf
	}: {
		apps: ProjectSummary[];
		/** project_id → listing (banner/video) from the full project, when fetched. */
		listings: Map<string, Listing>;
		labelOf: (p: ProjectSummary) => string;
		accentOf: (p: ProjectSummary, i: number) => string;
	} = $props();

	const INTERVAL_MS = 7000;

	let active = $state(0);
	let timer: ReturnType<typeof setInterval> | null = null;
	// Video only on wider screens, without reduced motion or Save-Data; posters (with a slow pan) otherwise.
	let allowVideo = $state(false);
	let videos = $state<(HTMLVideoElement | null)[]>([]);

	const media = $derived(apps.map((a) => heroMediaFor(a as ProjectSummary & { kind?: string }, listings.get(a.project_id))));
	const current = $derived(apps[Math.min(active, apps.length - 1)]);

	function resetTimer() {
		if (timer) clearInterval(timer);
		timer = setInterval(() => {
			if (apps.length > 0) active = (active + 1) % apps.length;
		}, INTERVAL_MS);
	}

	function go(dir: 'prev' | 'next') {
		const n = apps.length;
		if (n === 0) return;
		active = dir === 'next' ? (active + 1) % n : (active - 1 + n) % n;
		resetTimer();
	}

	function show(i: number) {
		active = i;
		resetTimer();
	}

	$effect(() => {
		if (active >= apps.length) active = 0;
	});

	// Only the active slide's video plays; the rest are paused (and never fetched until shown: preload="none").
	$effect(() => {
		const on = allowVideo;
		const idx = active;
		videos.forEach((v, i) => {
			if (!v) return;
			if (on && i === idx) {
				v.play().catch(() => {
					/* autoplay refused: the poster stays */
				});
			} else if (!v.paused) {
				v.pause();
			}
		});
	});

	function glow(hex: string, alpha: string): string {
		return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex;
	}

	onMount(() => {
		resetTimer();
		const wide = window.matchMedia('(min-width: 768px)');
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
		const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
		const update = () => (allowVideo = wide.matches && !calm.matches && !saveData);
		update();
		wide.addEventListener('change', update);
		calm.addEventListener('change', update);
		return () => {
			if (timer) clearInterval(timer);
			wide.removeEventListener('change', update);
			calm.removeEventListener('change', update);
		};
	});
</script>

{#if current}
	<div class="hero relative w-full overflow-hidden bg-[#0c0c0e] h-[300px] md:h-[440px]" aria-roledescription="carousel">
		<!-- Background media -->
		{#each apps as a, i (a.project_id)}
			{@const m = media[i]}
			{@const accent = accentOf(a, i)}
			{@const isActive = i === active}
			<div class="absolute inset-0 transition-opacity duration-1000 {isActive ? 'opacity-100' : 'opacity-0'}" aria-hidden="true">
				<img
					src={m.poster}
					alt=""
					loading={i === 0 ? 'eager' : 'lazy'}
					decoding="async"
					fetchpriority={i === 0 ? 'high' : 'auto'}
					referrerpolicy="no-referrer"
					class="absolute inset-0 w-full h-full object-cover {isActive && !(allowVideo && m.video) ? 'kenburns' : ''}"
				/>
				{#if allowVideo && m.video}
					<video
						bind:this={videos[i]}
						src={m.video}
						poster={m.poster}
						muted
						loop
						playsinline
						autoplay={isActive}
						preload={isActive ? 'auto' : 'none'}
						disablepictureinpicture
						tabindex="-1"
						class="absolute inset-0 w-full h-full object-cover"
					></video>
				{/if}
				<!-- Accent glow behind the app card -->
				<div
					class="absolute inset-0 pointer-events-none"
					style="background: radial-gradient(ellipse 45% 70% at 82% 45%, {glow(accent, '40')} 0%, transparent 70%)"
				></div>
			</div>
		{/each}

		<!-- Readability: left-to-right and bottom-up shade, plus the honeycomb tint -->
		<div
			class="absolute inset-0 z-[1] pointer-events-none"
			style="background: linear-gradient(90deg, rgba(8,8,10,0.92) 0%, rgba(8,8,10,0.7) 38%, rgba(8,8,10,0.15) 75%, rgba(8,8,10,0.05) 100%)"
		></div>
		<div
			class="absolute inset-x-0 bottom-0 h-[70%] z-[1] pointer-events-none"
			style="background: linear-gradient(to top, rgba(8,8,10,0.92) 0%, rgba(8,8,10,0.4) 45%, transparent 100%)"
		></div>
		<div class="absolute inset-0 bg-honeycomb opacity-50 z-[1] pointer-events-none"></div>

		<!-- Slide content; the whole slide links to the project -->
		<a href="/apps/{current.project_id}" class="absolute inset-0 z-10 no-underline cursor-pointer" aria-label="Open {current.name}">
			{#each apps as a, i (a.project_id)}
				{@const accent = accentOf(a, i)}
				{@const isActive = i === active}
				<!-- App card on the media (desktop) -->
				<div
					class="hidden md:flex absolute right-[9%] top-1/2 -translate-y-[58%] transition-all duration-700 {isActive
						? 'opacity-100 translate-x-0'
						: 'opacity-0 translate-x-4'}"
				>
					<div
						class="flex flex-col items-center gap-3 rounded-[22px] p-5 pb-4 bg-black/35 border border-white/15 backdrop-blur-md w-[190px]"
						style="box-shadow: 0 24px 60px -12px {glow(accent, '66')}, inset 0 1px 0 rgba(255,255,255,0.08)"
					>
						<ProjectIcon project={a} size={104} rounded="24px" class="shadow-2xl" />
						<div class="text-center min-w-0 w-full">
							<p class="text-[13px] font-semibold text-white m-0 truncate">{a.name}</p>
							{#if a.developer_name}
								<p class="text-[11px] text-white/55 m-0 truncate">{a.developer_name}</p>
							{/if}
						</div>
					</div>
				</div>

				<div
					class="absolute bottom-9 md:bottom-12 left-4 md:left-16 right-4 md:right-[34%] transition-all duration-500 {isActive
						? 'opacity-100 translate-y-0'
						: 'opacity-0 translate-y-2 pointer-events-none'}"
				>
					<div class="flex items-center gap-3 mb-3 md:hidden">
						<ProjectIcon
							project={a}
							size={44}
							rounded="12px"
							class="shrink-0 ring-1 ring-white/20"
						/>
					</div>
					<p class="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style="color: {accent}">
						{labelOf(a)}
					</p>
					<h2 class="text-[22px] md:text-[34px] font-semibold text-white leading-[1.12] mb-2 max-w-[560px] tracking-[-0.01em]">
						{a.name}
					</h2>
					{#if a.tagline}
						<p class="text-[13px] md:text-[15px] text-white/70 max-w-[520px] line-clamp-2 leading-snug m-0">
							{a.tagline}
						</p>
					{/if}
				</div>
			{/each}
		</a>

		<!-- Media credit (Pexels licence asks for attribution where possible) -->
		{#if media[active]?.credit}
			{@const c = media[active].credit!}
			<a
				href={c.url}
				target="_blank"
				rel="noopener noreferrer"
				class="absolute bottom-2.5 right-3 z-20 text-[10px] text-white/45 hover:text-white/80 no-underline transition-colors"
				title="Background video by {c.author} on Pexels"
			>
				{c.author} · Pexels
			</a>
		{/if}

		{#if apps.length > 1}
			<button
				type="button"
				aria-label="Previous"
				onclick={() => go('prev')}
				class="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/35 border border-white/10 backdrop-blur-sm items-center justify-center hover:bg-black/55 transition-colors"
			>
				<ChevronLeft class="h-5 w-5 text-white/85" strokeWidth={1.5} />
			</button>
			<button
				type="button"
				aria-label="Next"
				onclick={() => go('next')}
				class="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/35 border border-white/10 backdrop-blur-sm items-center justify-center hover:bg-black/55 transition-colors"
			>
				<ChevronRight class="h-5 w-5 text-white/85" strokeWidth={1.5} />
			</button>

			<div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
				{#each apps as a, i (a.project_id)}
					<button
						type="button"
						aria-label="Show {a.name}"
						aria-current={i === active}
						onclick={() => show(i)}
						class="h-[6px] rounded-full transition-all duration-300 {i === active
							? 'w-[18px] bg-white/90'
							: 'w-[6px] bg-white/30 hover:bg-white/50'}"
					></button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.kenburns {
		animation: kenburns 22s ease-in-out infinite alternate;
		transform-origin: 70% 50%;
		will-change: transform;
	}
	@keyframes kenburns {
		from {
			transform: scale(1.02) translate3d(0, 0, 0);
		}
		to {
			transform: scale(1.14) translate3d(-2%, -1.5%, 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kenburns {
			animation: none;
		}
	}
</style>
