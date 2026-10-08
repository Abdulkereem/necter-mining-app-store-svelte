<script lang="ts">
	import { page } from '$app/state';
	import toast from 'svelte-french-toast';
	import { ArrowLeft, Star, MessageSquare, Trash2 } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { ApiError, errorMessage } from '$lib/api/http';
	import { account, signedIn, showConnectModal } from '$lib/stores/wallet';
	import { categoryShort, formatRating } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ReviewsTab from '$lib/components/apps/ReviewsTab.svelte';

	const id = $derived((page.params.id ?? '').toLowerCase());
	const projectQ = useQuery(() => hub.project(id));
	// The caller's own review (if any) — found in the full list; one review per wallet per project.
	const mineQ = useQuery(() => hub.reviews(id, { sort: 'newest', limit: 200 }), { enabled: () => $signedIn });
	const mine = $derived(mineQ.data?.items.find((r) => r.author === $account) ?? null);

	let draft = $state('');
	let rating = $state(0);
	let hover = $state(0);
	let submitting = $state(false);
	let listKey = $state(0);
	let forbidden = $state<string | null>(null);

	$effect(() => {
		if (mine) {
			rating = mine.rating;
			draft = mine.comment;
		}
	});

	const ratingLabel = (r: number) => ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][r] ?? '';

	async function submit() {
		submitting = true;
		forbidden = null;
		try {
			await hub.upsertReview(id, rating, draft.trim());
			toast.success(mine ? 'Review updated' : 'Review posted');
			await Promise.all([mineQ.refresh(), projectQ.refresh()]);
			listKey++;
		} catch (e) {
			if (e instanceof ApiError && e.status === 403) forbidden = e.message || 'Only miners with a credited round on this project can review it.';
			else toast.error(errorMessage(e));
		} finally {
			submitting = false;
		}
	}

	async function remove() {
		submitting = true;
		try {
			await hub.deleteReview(id);
			toast.success('Review deleted');
			rating = 0;
			draft = '';
			await Promise.all([mineQ.refresh(), projectQ.refresh()]);
			listKey++;
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{projectQ.data ? `Reviews · ${projectQ.data.name}` : 'Reviews'} · Necter</title>
</svelte:head>

<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12" style="max-width:860px;margin:0 auto">
	<a href="/apps/{id}" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4">
		<ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to project
	</a>

	{#if projectQ.loading}
		<LoadingBlock rows={3} height="80px" />
	{:else if projectQ.error}
		<ErrorState error={projectQ.error} retry={projectQ.refresh} />
	{:else if !projectQ.data}
		<EmptyState illustration="platform" title="Project not found" description="It may not be listed yet, or the link is wrong.">
			<a href="/discover" class="btn-subscribe">Browse projects</a>
		</EmptyState>
	{:else}
		{@const p = projectQ.data}
		<div class="flex items-start gap-3 md:gap-4 mb-6 flex-wrap">
			<ProjectIcon project={p} size={48} />
			<div class="flex-1 min-w-0">
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">{p.name} reviews</h1>
				<div class="flex items-center gap-3 mt-1">
					<div class="flex items-center gap-1">
						<Star class="h-4 w-4 text-[var(--warning)] fill-[var(--warning)]" strokeWidth={1.5} />
						<span class="text-[14px] font-semibold text-[var(--text-primary)]">{formatRating(p.average_rating_x100)}</span>
					</div>
					<span class="text-[12px] text-[var(--text-tertiary)]">{p.review_count ?? 0} reviews</span>
					<span class="text-[11px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)]">{categoryShort(p.category)}</span>
				</div>
			</div>
		</div>

		{#if !$signedIn}
			<div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] mb-6 text-center">
				<p class="text-[13px] text-[var(--text-secondary)] mb-3">Sign in with your wallet to review. Reviews are open to wallets that mined this project.</p>
				<button type="button" class="btn-pill" onclick={() => showConnectModal.set(true)}>Connect wallet</button>
			</div>
		{:else}
			<div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] mb-6">
				<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">{mine ? 'Your review' : 'Write a review'}</h2>
				<div class="mb-4">
					<span class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-2">Your rating</span>
					<div class="flex items-center gap-0.5">
						{#each [1, 2, 3, 4, 5] as star (star)}
							<button
								type="button"
								aria-label="{star} stars"
								class="bg-transparent border-none cursor-pointer p-0.5 transition-transform hover:scale-110"
								onmouseenter={() => (hover = star)}
								onmouseleave={() => (hover = 0)}
								onclick={() => (rating = star)}
							>
								<Star
									class="transition-colors {star <= (hover || rating) ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--text-tertiary)]'}"
									style="width:24px;height:24px"
									strokeWidth={1.5}
								/>
							</button>
						{/each}
						{#if rating > 0}<span class="text-[12px] text-[var(--text-secondary)] ml-2 font-medium">{ratingLabel(rating)}</span>{/if}
					</div>
				</div>
				<div class="mb-4">
					<label for="review-text" class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-2">Your experience</label>
					<textarea
						id="review-text"
						bind:value={draft}
						maxlength="2000"
						placeholder="Share your mining experience — uptime, reward consistency, setup difficulty…"
						rows="4"
						class="w-full text-[13px] rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] p-3 resize-y leading-relaxed focus:border-[var(--accent-base)] outline-none transition-colors"
					></textarea>
					<p class="text-[10px] text-[var(--text-tertiary)] mt-1">{draft.length}/2000 characters</p>
				</div>
				{#if forbidden}<p class="text-[12px] text-[var(--warning)] mb-3">{forbidden}</p>{/if}
				<div class="flex items-center gap-2">
					<button
						type="button"
						disabled={rating === 0 || !draft.trim() || submitting}
						onclick={submit}
						class="btn-subscribe flex items-center gap-1.5"
						style="opacity:{rating === 0 || !draft.trim() || submitting ? 0.4 : 1}"
					>
						<MessageSquare class="h-4 w-4" strokeWidth={1.5} />
						{submitting ? 'Saving…' : mine ? 'Update review' : 'Submit review'}
					</button>
					{#if mine}
						<button type="button" class="btn-secondary inline-flex items-center gap-1.5" disabled={submitting} onclick={remove}>
							<Trash2 class="h-3.5 w-3.5" /> Delete
						</button>
					{/if}
				</div>
			</div>
		{/if}

		{#key listKey}
			<ReviewsTab project={p} signedIn={$signedIn} />
		{/key}
	{/if}
</div>
