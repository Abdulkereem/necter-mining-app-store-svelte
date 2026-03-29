<script lang="ts">
	import { page } from '$app/stores';
	import { getLearnArticleByPath } from '$lib/learn-content';
	import { ArrowLeft } from 'lucide-svelte';

	let slug = $derived($page.params.slug ?? '');
	let path = $derived(Array.isArray(slug) ? slug.join('/') : String(slug));
	let article = $derived(getLearnArticleByPath(path));
</script>

{#if !article}
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-3xl mx-auto px-6 py-12">
			<a href="/learn" class="btn-secondary inline-flex items-center gap-2">
				<ArrowLeft class="h-4 w-4" />
				Back to Learn
			</a>
			<div class="p-6 mt-6 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)]">
				<div class="text-lg font-semibold">Article not found</div>
				<div class="text-sm text-[var(--text-secondary)] mt-1">This article path isn't registered in the prototype.</div>
			</div>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-3xl mx-auto px-6 py-12">
			<a href="/learn?tab={article.tab}" class="btn-secondary inline-flex items-center gap-2">
				<ArrowLeft class="h-4 w-4" />
				Back
			</a>

			<div class="mt-6">
				<div class="flex items-center gap-2 mb-2">
					<span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)] capitalize">{article.tab}</span>
					<span class="text-xs px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">{article.readingMinutes} min</span>
				</div>
				<h1 class="text-[20px] font-semibold mb-2">{article.title}</h1>
				<p class="text-[var(--text-secondary)]">{article.description}</p>
			</div>

			<div class="mt-8 space-y-6">
				{#each article.sections as s (s.heading)}
					<div class="p-6 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)]">
						<div class="text-lg font-semibold mb-3">{s.heading}</div>
						<div class="space-y-3 text-sm text-[var(--text-secondary)]">
							{#each s.body as p}
								<p>{p}</p>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
