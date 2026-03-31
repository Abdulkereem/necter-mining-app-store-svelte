<script lang="ts">
	import { educationalContent, type EducationalTerm } from '$lib/educational-content';
	import { Search, BookOpen, ArrowLeft } from 'lucide-svelte';

	let searchQuery = $state('');

	const allTerms = Object.entries(educationalContent).map(([term, data]) => ({
		term: term as EducationalTerm,
		...data
	}));

	let filteredTerms = $derived(
		searchQuery.trim()
			? allTerms.filter(
					(t) =>
						t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
						t.description.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: allTerms
	);

	function termSlug(term: string) {
		return encodeURIComponent(term.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, ''));
	}
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
			<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
				Glossary
			</h1>
		</div>
		<p class="text-[13px] text-[var(--text-secondary)] mb-6">
			Key terms and concepts used across the Necter mining ecosystem.
		</p>

		<!-- Search filter -->
		<div class="relative mb-6">
			<Search
				class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]"
				strokeWidth={1.5}
			/>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search terms..."
				class="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)] text-[var(--text-primary)] text-[13px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
			/>
		</div>

		<!-- Term cards -->
		{#if filteredTerms.length === 0}
			<div
				class="p-8 text-center border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)]"
			>
				<p class="text-[13px] text-[var(--text-secondary)]">
					No terms match "{searchQuery}"
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each filteredTerms as item (item.term)}
					<a
						href="/learn/glossary/{termSlug(item.term)}"
						class="block p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors no-underline"
					>
						<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
							{item.term}
						</h3>
						<p class="text-[13px] text-[var(--text-secondary)] line-clamp-2">
							{item.description}
						</p>
					</a>
				{/each}
			</div>
		{/if}

		<p class="text-[11px] text-[var(--text-tertiary)] mt-6">
			{filteredTerms.length} of {allTerms.length} terms
		</p>
	</div>
</div>
