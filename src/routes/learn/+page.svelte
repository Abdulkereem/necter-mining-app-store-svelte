<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { educationalContent, type EducationalTerm } from '$lib/educational-content';
	import { learnArticles } from '$lib/learn-content';
	import { BookOpen, Search, GraduationCap, Lightbulb, Cpu, Coins, ExternalLink } from 'lucide-svelte';

	const categoryIcons: Record<string, typeof Cpu> = {
		'Consensus Mechanisms': Cpu,
		'Verification Methods': Lightbulb,
		'Platform Concepts': GraduationCap,
		'Mining Economics': Coins
	};

	// Keep backwards-compatibility: `tab=help` maps into Guides.
	let rawTab = $derived(($page.url.searchParams.get('tab') as 'guides' | 'help' | 'glossary' | null) ?? 'guides');
	let initialTab = $derived(rawTab === 'help' ? 'guides' : rawTab);

	let tab = $state<'guides' | 'glossary'>('guides');
	$effect(() => {
		const next = initialTab;
		if (next === 'guides' || next === 'glossary') tab = next;
	});

	let searchQuery = $state('');

	function setTabAndUrl(next: 'guides' | 'glossary') {
		tab = next;
		goto(`/learn?tab=${encodeURIComponent(next)}`, { replaceState: true, noScroll: true });
	}

	const categories: Record<string, string[]> = {
		'Consensus Mechanisms': ['Proof of Work', 'Proof of Stake', 'Proof of Space-Time', 'Proof of Coverage'],
		'Verification Methods': ['ZK-SNARK', 'Merkle Proof', 'Threshold Signature'],
		'Platform Concepts': ['Mining Profile', 'Task Orchestration', 'Attestation', 'Reputation Score'],
		'Mining Economics': ['Hardware Compatibility', 'ROI (Return on Investment)', 'SLA (Service Level Agreement)', 'Slashing']
	};

	// Help articles are merged into guides
	let guides = $derived(learnArticles.filter((a) => a.tab === 'guides' || a.tab === 'help'));
	let q = $derived(searchQuery.trim().toLowerCase());

	let filteredGuides = $derived(
		q ? guides.filter((a) => `${a.title} ${a.description}`.toLowerCase().includes(q)) : guides
	);
</script>

<div class="min-h-screen pb-12">
	<!-- Page Header -->
	<div class="border-b border-[var(--border-default)]">
		<div class="max-w-6xl mx-auto px-6 py-8">
			<h1 class="text-[20px] font-semibold mb-2">Learn</h1>
			<p class="text-[var(--text-secondary)]">Guides, FAQs, and a glossary for mining networks.</p>
		</div>
	</div>

	<div class="max-w-6xl mx-auto px-6 py-8">
		<div class="mb-8 flex items-center justify-between gap-4 flex-wrap">
			<div class="relative max-w-md w-full">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
				<input
					type="text"
					placeholder="Search guides..."
					class="w-full pl-10 pr-4 py-2 text-[13px] rounded-[5px] border border-[var(--border)] bg-[var(--surface-0)] text-[var(--text-primary)] outline-none"
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<!-- Tab switcher -->
		<div class="grid w-full grid-cols-2 gap-1 mb-6">
			<button
				type="button"
				class="py-2 text-[13px] rounded-[5px] border transition-colors {tab === 'guides' ? 'bg-[var(--accent)] text-[#0C0C0E] border-[var(--accent)]' : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				onclick={() => setTabAndUrl('guides')}
			>
				Guides
			</button>
			<button
				type="button"
				class="py-2 text-[13px] rounded-[5px] border transition-colors {tab === 'glossary' ? 'bg-[var(--accent)] text-[#0C0C0E] border-[var(--accent)]' : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				onclick={() => setTabAndUrl('glossary')}
			>
				Glossary
			</button>
		</div>

		{#if tab === 'guides'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-semibold">Guides</h2>
					<span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]">{filteredGuides.length}</span>
				</div>
				<div class="grid md:grid-cols-3 gap-4">
					{#each filteredGuides as a (a.path)}
						<a href="/learn/{a.path}" class="no-underline">
							<div class="p-5 h-full border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)] hover:border-[var(--border-accent)] transition-colors cursor-pointer">
								<div class="flex items-start gap-3">
									<BookOpen class="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
									<div class="min-w-0">
										<div class="flex items-center gap-2">
											<h3 class="font-medium truncate">{a.title}</h3>
											<span class="text-xs px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">{a.readingMinutes}m</span>
										</div>
										<p class="text-sm text-[var(--text-secondary)] mt-1">{a.description}</p>
									</div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{:else}
			<div class="space-y-10">
				{#each Object.entries(categories) as [category, terms]}
					{@const IconComponent = categoryIcons[category] || BookOpen}
					{@const filteredTerms = q
						? terms.filter((t) => t.toLowerCase().includes(q) || (educationalContent[t as EducationalTerm]?.description ?? '').toLowerCase().includes(q))
						: terms}

					{#if filteredTerms.length > 0}
						<div>
							<div class="flex items-center gap-2 mb-4">
								<IconComponent class="h-5 w-5 text-primary" />
								<h2 class="text-xl font-semibold">{category}</h2>
								<span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]">{filteredTerms.length}</span>
							</div>
							<div class="grid md:grid-cols-2 gap-4">
								{#each filteredTerms as term}
									{@const content = educationalContent[term as EducationalTerm]}
									{#if content}
										<a href="/learn/glossary/{encodeURIComponent(term)}" class="no-underline">
											<div class="p-5 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)] hover:border-[var(--border-accent)] transition-colors cursor-pointer">
												<div class="flex items-start justify-between mb-2">
													<h3 class="font-medium">{term}</h3>
													<span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]">{category.split(' ')[0]}</span>
												</div>
												<p class="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{content.description}</p>
												<div class="text-xs text-[var(--text-secondary)]">Open term &rarr;</div>
											</div>
										</a>
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				{/each}

				<div class="p-6 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)]">
					<div class="flex items-start justify-between gap-4">
						<div>
							<div class="font-semibold">External references</div>
							<div class="text-sm text-[var(--text-secondary)] mt-1">
								Some glossary entries link to deeper background material.
							</div>
						</div>
						<button
							type="button"
							class="btn-secondary flex items-center gap-2"
							onclick={() => window.open('https://en.wikipedia.org/wiki/Consensus_(computer_science)', '_blank')}
						>
							Browse
							<ExternalLink class="h-4 w-4" />
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
