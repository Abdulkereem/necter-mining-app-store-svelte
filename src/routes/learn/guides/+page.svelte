<script lang="ts">
	import { learnArticles } from '$lib/learn-content';
	import { ArrowLeft, BookOpen, Code, Pickaxe } from 'lucide-svelte';

	// Split guides into miner-facing and developer-facing
	const minerGuides = learnArticles.filter(
		(a) =>
			a.tab === 'guides' &&
			['guides/getting-started', 'guides/hardware', 'guides/earnings', 'guides/real-miner-flow'].includes(
				a.path
			)
	);
	const helpArticles = learnArticles.filter((a) => a.tab === 'help');
	const devGuides = learnArticles.filter(
		(a) =>
			a.tab === 'guides' &&
			['guides/ndsr', 'guides/hivekit'].includes(a.path)
	);

	// Combine miner-facing: guides + help articles
	const forMiners = [...minerGuides, ...helpArticles];
	const forDevelopers = devGuides;
</script>

<div class="min-h-screen bg-[var(--surface-0)]">
	<div class="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
		<!-- Back link -->
		<a
			href="/learn"
			class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-6"
		>
			<ArrowLeft class="h-3 w-3" strokeWidth={1.5} />
			Back to Learn
		</a>

		<!-- Header -->
		<div class="flex items-center gap-3 mb-2">
			<BookOpen class="h-6 w-6 text-[var(--text-accent)]" strokeWidth={1.5} />
			<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Guides</h1>
		</div>
		<p class="text-[13px] text-[var(--text-secondary)] mb-8">
			Step-by-step guides for miners and developers building on Necter.
		</p>

		<!-- For Miners -->
		<section class="mb-10">
			<div class="flex items-center gap-2 mb-4">
				<Pickaxe class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
				<h2 class="text-[16px] font-semibold text-[var(--text-primary)]">For Miners</h2>
			</div>
			<div class="space-y-3">
				{#each forMiners as article (article.path)}
					<a
						href="/learn/{article.path}"
						class="block p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors no-underline"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
									{article.title}
								</h3>
								<p class="text-[13px] text-[var(--text-secondary)] line-clamp-2">
									{article.description}
								</p>
							</div>
							<span
								class="flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-tertiary)]"
							>
								{article.readingMinutes} min
							</span>
						</div>
					</a>
				{/each}
			</div>
		</section>

		<!-- For Developers -->
		<section>
			<div class="flex items-center gap-2 mb-4">
				<Code class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
				<h2 class="text-[16px] font-semibold text-[var(--text-primary)]">For Developers</h2>
			</div>
			<div class="space-y-3">
				{#each forDevelopers as article (article.path)}
					<a
						href="/learn/{article.path}"
						class="block p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors no-underline"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
									{article.title}
								</h3>
								<p class="text-[13px] text-[var(--text-secondary)] line-clamp-2">
									{article.description}
								</p>
							</div>
							<span
								class="flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-tertiary)]"
							>
								{article.readingMinutes} min
							</span>
						</div>
					</a>
				{/each}
			</div>
		</section>
	</div>
</div>
