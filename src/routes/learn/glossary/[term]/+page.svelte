<script lang="ts">
	import { page } from '$app/state';
	import { educationalContent, type EducationalTerm } from '$lib/educational-content';
	import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-svelte';

	let termSlug = $derived(page.params.term);

	// Reverse the slug back to a term name
	let allTerms = Object.keys(educationalContent) as EducationalTerm[];

	function slugify(term: string) {
		return term.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
	}

	let matchedTerm = $derived(allTerms.find((t) => slugify(t) === termSlug) ?? null);
	let termData = $derived(matchedTerm ? educationalContent[matchedTerm] : null);

	// Find prev/next for navigation
	let currentIndex = $derived(matchedTerm ? allTerms.indexOf(matchedTerm) : -1);
	let prevTerm = $derived(currentIndex > 0 ? allTerms[currentIndex - 1] : null);
	let nextTerm = $derived(
		currentIndex >= 0 && currentIndex < allTerms.length - 1 ? allTerms[currentIndex + 1] : null
	);
</script>

<div class="min-h-screen bg-[var(--surface-0)]">
	<div class="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
		<!-- Back link -->
		<a
			href="/learn/glossary"
			class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-6"
		>
			<ArrowLeft class="h-3 w-3" strokeWidth={1.5} />
			Back to Glossary
		</a>

		{#if !matchedTerm || !termData}
			<div class="p-8 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)]">
				<div class="text-[14px] font-semibold text-[var(--text-primary)]">Term not found</div>
				<div class="text-[13px] text-[var(--text-secondary)] mt-1">
					This glossary term doesn't exist. Check the
					<a href="/learn/glossary" class="underline">full glossary</a>.
				</div>
			</div>
		{:else}
			<!-- Term header -->
			<div class="flex items-center gap-3 mb-2">
				<BookOpen class="h-6 w-6 text-[var(--text-accent)]" strokeWidth={1.5} />
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
					{matchedTerm}
				</h1>
			</div>

			<!-- Description -->
			<div
				class="mt-6 p-5 md:p-6 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)]"
			>
				<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Definition</h2>
				<p class="text-[13px] text-[var(--text-secondary)] leading-relaxed">
					{termData.description}
				</p>
			</div>

			<!-- Example -->
			{#if termData.example}
				<div
					class="mt-4 p-5 md:p-6 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)]"
				>
					<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Example</h2>
					<p
						class="text-[13px] text-[var(--text-secondary)] leading-relaxed font-mono bg-[var(--surface-0)] p-3 rounded-[5px]"
					>
						{termData.example}
					</p>
				</div>
			{/if}

			<!-- Learn more link -->
			{#if termData.learnMoreUrl && termData.learnMoreUrl !== '#'}
				<div class="mt-4">
					<a
						href={termData.learnMoreUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-accent)] hover:underline no-underline"
					>
						Learn more
						<ExternalLink class="h-3.5 w-3.5" strokeWidth={1.5} />
					</a>
				</div>
			{/if}

			<!-- Prev / Next navigation -->
			<div
				class="mt-8 pt-6 border-t border-[var(--border)] flex items-center justify-between gap-4"
			>
				{#if prevTerm}
					<a
						href="/learn/glossary/{slugify(prevTerm)}"
						class="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline transition-colors"
					>
						&larr; {prevTerm}
					</a>
				{:else}
					<div></div>
				{/if}
				{#if nextTerm}
					<a
						href="/learn/glossary/{slugify(nextTerm)}"
						class="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline transition-colors"
					>
						{nextTerm} &rarr;
					</a>
				{:else}
					<div></div>
				{/if}
			</div>
		{/if}
	</div>
</div>
