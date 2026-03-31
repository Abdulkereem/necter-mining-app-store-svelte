<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { educationalContent, type EducationalTerm } from '$lib/educational-content';
	import { learnArticles } from '$lib/learn-content';
	import { Search, ChevronRight, ArrowRight } from 'lucide-svelte';

	const tools = [
		{
			name: 'HiveKit',
			icon: '/brand/tools/hivekit.png',
			desc: 'Developer SDK for building and deploying mining projects on Necter. Define workloads, verification logic, and reward economics.',
			href: '/learn/guides/hivekit',
			tags: ['SDK', 'Developers'],
			darkBg: false
		},
		{
			name: 'NDSR',
			icon: '/brand/tools/ndsr.png',
			desc: 'Necter Distributed State Runtime. The execution layer inside every miner node for tasks, proofs, and ZK verification.',
			href: '/learn/guides/ndsr',
			tags: ['Runtime', 'Miners'],
			darkBg: false
		},
		{
			name: 'HivePod',
			icon: '/brand/tools/hivepod.png',
			desc: 'Containerized mining nodes. Each project runs in an isolated HivePod with resource limits and signed image verification.',
			href: '/learn/guides/hivepod',
			tags: ['Containers'],
			darkBg: true
		},
		{
			name: 'HiveFlare',
			icon: '/brand/tools/hiveflare.png',
			desc: 'Edge networking and content delivery. Job routing, peer discovery, and low-latency task distribution across the miner fleet.',
			href: '/learn/guides/hiveflare',
			tags: ['Networking'],
			darkBg: false
		},
		{
			name: 'HiveBucket',
			icon: '/brand/tools/hivebucket.png',
			desc: 'Decentralized object storage for mining artifacts, proof data, and application state. Erasure-coded and replicated.',
			href: '/learn/guides/hivebucket',
			tags: ['Storage'],
			darkBg: true
		},
		{
			name: 'Genesis Cloud',
			icon: '/brand/tools/genesis-cloud.png',
			desc: 'One-click deployment platform. From configuration to live project in minutes with managed infrastructure and monitoring.',
			href: '/learn/guides/genesis-cloud',
			tags: ['Cloud', 'Deploy'],
			darkBg: true
		},
		{
			name: 'SecureWeave',
			icon: '/brand/tools/secureweave.png',
			desc: 'Security and attestation layer. On-chain verification, trust scoring, TPM/TEE attestations, and proof dispute resolution.',
			href: '/learn/guides/secureweave',
			tags: ['Security'],
			darkBg: false
		}
	];

	let rawTab = $derived(
		($page.url.searchParams.get('tab') as 'tools' | 'guides' | 'glossary' | null) ?? 'tools'
	);
	let tab = $state<'tools' | 'guides' | 'glossary'>('tools');
	$effect(() => {
		const next = rawTab;
		if (next === 'tools' || next === 'guides' || next === 'glossary') tab = next;
	});

	let searchQuery = $state('');

	function setTabAndUrl(next: 'tools' | 'guides' | 'glossary') {
		tab = next;
		searchQuery = '';
		goto(`/learn?tab=${encodeURIComponent(next)}`, { replaceState: true, noScroll: true });
	}

	// Guides
	const minerGuides = $derived(
		learnArticles.filter(
			(a) =>
				a.path.includes('getting-started') ||
				a.path.includes('real-miner') ||
				a.path.includes('ndsr') ||
				a.path.includes('hivepod') ||
				a.path.includes('hiveflare') ||
				a.path.includes('hivebucket') ||
				a.path.includes('secureweave') ||
				a.path.includes('proofs') ||
				a.path.includes('withdrawals')
		)
	);
	const devGuides = $derived(
		learnArticles.filter((a) => a.path.includes('hivekit') || a.path.includes('genesis'))
	);
	let q = $derived(searchQuery.trim().toLowerCase());
	let allGuides = $derived(
		q
			? learnArticles.filter(
					(a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
				)
			: null
	);

	// Glossary
	let glossaryTerms = $derived(
		Object.entries(educationalContent)
			.map(([term, data]) => ({ term, ...(data as { description: string; example?: string }) }))
			.filter(
				(t) =>
					!q ||
					t.term.toLowerCase().includes(q) ||
					t.description.toLowerCase().includes(q)
			)
	);
</script>

<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
	<div style="max-width: 900px; margin: 0 auto;">
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-1">Help</h1>
			<p class="text-[13px] text-[var(--text-secondary)]">Learn about the Necter ecosystem, tools, and how mining works.</p>
		</div>

		<!-- Getting Started Hero with Bee -->
		<a
			href="/learn/guides/getting-started"
			class="flex items-center gap-3 md:gap-5 p-4 md:p-5 rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] transition-colors duration-100 no-underline mb-6 md:mb-8"
			style="background: linear-gradient(135deg, var(--surface-1) 0%, rgba(255,191,0,0.03) 100%);"
		>
			<img
				src="/brand/bee.png"
				alt=""
				class="hidden md:block flex-shrink-0"
				style="width: 64px; height: 72px; object-fit: contain;"
			/>
			<div class="flex-1">
				<p class="text-[10px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-1">New to Necter?</p>
				<h2 class="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Get started in under a minute</h2>
				<p class="text-[12px] text-[var(--text-secondary)] m-0 leading-[17px]">Connect your wallet, set up your hardware profile, subscribe to a project, and start earning rewards.</p>
			</div>
			<ArrowRight class="h-5 w-5 text-[var(--text-tertiary)] flex-shrink-0 hidden md:block" strokeWidth={1.5} />
		</a>

		<!-- Tabs -->
		<div class="flex items-center gap-1 mb-5">
			{#each [
				{ id: 'tools' as const, label: 'Ecosystem' },
				{ id: 'guides' as const, label: 'Guides' },
				{ id: 'glossary' as const, label: 'Glossary' }
			] as t}
				<button
					type="button"
					onclick={() => setTabAndUrl(t.id)}
					class="inline-flex items-center h-[28px] px-3 rounded-[5px] text-[12px] font-medium border-none cursor-pointer transition-colors {tab === t.id
						? 'bg-[var(--accent-subtle)] text-[var(--text-accent)]'
						: 'bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				>
					{t.label}
				</button>
			{/each}
		</div>

		<!-- Search (for guides and glossary only) -->
		{#if tab !== 'tools'}
			<div class="relative mb-6">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder={tab === 'guides' ? 'Search guides...' : 'Search terms...'}
					class="w-full h-9 pl-9 pr-3 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
				/>
			</div>
		{/if}

		<!-- Ecosystem Tools -->
		{#if tab === 'tools'}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				{#each tools as tool}
					<a
						href={tool.href}
						class="group flex items-start gap-4 p-4 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-[border-color,background-color] duration-100 no-underline"
					>
						<div
							class="w-14 h-14 flex-shrink-0 rounded-[10px] flex items-center justify-center"
							style="background: {tool.darkBg ? 'var(--surface-3)' : 'transparent'};"
						>
							<img src={tool.icon} alt="" class="w-12 h-12" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">{tool.name}</h3>
								{#each tool.tags as tag}
									<span class="text-[9px] font-medium px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[var(--text-tertiary)] uppercase tracking-wide">{tag}</span>
								{/each}
							</div>
							<p class="text-[12px] text-[var(--text-secondary)] leading-[17px] m-0 mb-2">{tool.desc}</p>
							<span class="text-[11px] text-[var(--text-accent)] font-medium inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								Read guide <ChevronRight class="h-3 w-3" strokeWidth={2} />
							</span>
						</div>
					</a>
				{/each}
			</div>

		<!-- Guides -->
		{:else if tab === 'guides'}
			<div>
				{#if allGuides}
					<!-- Search results -->
					{#if allGuides.length === 0}
						<p class="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No guides found.</p>
					{:else}
						<div class="space-y-2">
							{#each allGuides as article (article.path)}
								<a
									href="/learn/{article.path}"
									class="flex items-center justify-between gap-4 p-4 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-[border-color,background-color] duration-100 no-underline"
								>
									<div class="min-w-0">
										<h3 class="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">{article.title}</h3>
										<p class="text-[12px] text-[var(--text-secondary)] m-0 truncate">{article.description}</p>
									</div>
									<div class="flex items-center gap-2 flex-shrink-0">
										<span class="text-[11px] text-[var(--text-tertiary)] font-mono">{article.readingMinutes} min</span>
										<ChevronRight class="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.5} />
									</div>
								</a>
							{/each}
						</div>
					{/if}
				{:else}
					<!-- Categorized view -->
					<div class="space-y-8">
						<div>
							<p class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">For Miners</p>
							<div class="space-y-2">
								{#each minerGuides as article (article.path)}
									<a
										href="/learn/{article.path}"
										class="flex items-center justify-between gap-4 p-4 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-[border-color,background-color] duration-100 no-underline"
									>
										<div class="min-w-0">
											<h3 class="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">{article.title}</h3>
											<p class="text-[12px] text-[var(--text-secondary)] m-0 truncate">{article.description}</p>
										</div>
										<div class="flex items-center gap-2 flex-shrink-0">
											<span class="text-[11px] text-[var(--text-tertiary)] font-mono">{article.readingMinutes} min</span>
											<ChevronRight class="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.5} />
										</div>
									</a>
								{/each}
							</div>
						</div>
						<div>
							<p class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">For Developers</p>
							<div class="space-y-2">
								{#each devGuides as article (article.path)}
									<a
										href="/learn/{article.path}"
										class="flex items-center justify-between gap-4 p-4 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-[border-color,background-color] duration-100 no-underline"
									>
										<div class="min-w-0">
											<h3 class="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">{article.title}</h3>
											<p class="text-[12px] text-[var(--text-secondary)] m-0 truncate">{article.description}</p>
										</div>
										<div class="flex items-center gap-2 flex-shrink-0">
											<span class="text-[11px] text-[var(--text-tertiary)] font-mono">{article.readingMinutes} min</span>
											<ChevronRight class="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.5} />
										</div>
									</a>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

		<!-- Glossary -->
		{:else}
			<div>
				{#if glossaryTerms.length === 0}
					<p class="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No terms found.</p>
				{:else}
					<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden divide-y divide-[var(--border-default)]">
						{#each glossaryTerms as t (t.term)}
							<div class="px-4 py-3">
								<p class="text-[13px] font-semibold text-[var(--text-primary)] mb-1">{t.term}</p>
								<p class="text-[12px] text-[var(--text-secondary)] leading-[17px] m-0">{t.description}</p>
								{#if t.example}
									<p class="text-[11px] text-[var(--text-tertiary)] mt-1.5 leading-[15px] m-0" style="font-style: italic;">{t.example}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
