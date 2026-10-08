<script lang="ts">
	import { Star, ThumbsUp, MessageSquare } from 'lucide-svelte';
	import toast from 'svelte-french-toast';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Project, Review } from '$lib/api/types';
	import { formatDate, formatNumber, formatRating, shortAddress } from '$lib/format';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { showConnectModal } from '$lib/stores/wallet';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	type Sort = 'helpful' | 'newest' | 'rating_high' | 'rating_low';

	let { project, signedIn }: { project: Project; signedIn: boolean } = $props();

	let sort = $state<Sort>('helpful');
	let helpfulPending = $state<string | null>(null);

	const q = useQuery(() => hub.reviews(project.project_id, { sort, limit: 50 }));

	const items = $derived((q.data?.items ?? []) as Review[]);
	const avgX100 = $derived(q.data?.average_rating_x100 ?? project.average_rating_x100 ?? null);
	const count = $derived(q.data?.count ?? project.review_count ?? items.length);
	const complete = $derived(!!q.data && !q.data.next_cursor);

	// Exact distribution only when every review is loaded; the API returns average + count only.
	const distribution = $derived(
		[5, 4, 3, 2, 1].map((stars) => {
			const n = items.filter((r) => r.rating === stars).length;
			return { stars, count: n, percentage: items.length ? (n / items.length) * 100 : 0 };
		})
	);

	async function helpful(r: Review) {
		if (!signedIn) {
			showConnectModal.set(true);
			return;
		}
		helpfulPending = r.review_id;
		try {
			await hub.markHelpful(project.project_id, r.review_id);
			await q.refresh();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			helpfulPending = null;
		}
	}
</script>

<div class="grid gap-4 grid-cols-1 md:[grid-template-columns:220px_1fr]">
	<!-- Rating summary -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 self-start">
		<div class="text-center mb-4">
			<p class="text-[40px] font-semibold text-[var(--text-primary)] font-mono leading-none">
				{avgX100 !== null && count > 0 ? formatRating(avgX100) : '—'}
			</p>
			<div class="flex justify-center gap-[3px] my-2">
				{#each Array(5) as _, i (i)}
					<Star
						size={12}
						strokeWidth={0}
						fill={avgX100 !== null && count > 0 && i < Math.round(avgX100 / 100) ? 'var(--accent-base)' : 'var(--surface-3)'}
					/>
				{/each}
			</div>
			<p class="text-[11px] text-[var(--text-tertiary)]">
				{formatNumber(count)} rating{count === 1 ? '' : 's'}
			</p>
		</div>

		{#if complete && items.length > 0}
			<div class="flex flex-col gap-[6px]">
				{#each distribution as item (item.stars)}
					<div class="flex items-center gap-[6px]">
						<span class="text-[11px] text-[var(--text-tertiary)] w-[10px]">{item.stars}</span>
						<Star size={9} strokeWidth={0} fill="var(--accent-base)" />
						<div class="flex-1 h-[3px] bg-[var(--surface-3)] rounded-full overflow-hidden">
							<div class="h-full bg-[var(--accent-base)] rounded-full" style="width: {item.percentage}%;"></div>
						</div>
						<span class="text-[11px] text-[var(--text-tertiary)] w-7 text-right font-mono">{item.count}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Review list -->
	<div>
		<div class="flex items-center justify-between mb-3">
			<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-0">Miner Reviews</p>
			<select
				bind:value={sort}
				aria-label="Sort reviews"
				class="h-7 px-2 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] cursor-pointer"
			>
				<option value="helpful">Most Helpful</option>
				<option value="newest">Most Recent</option>
				<option value="rating_high">Highest Rated</option>
				<option value="rating_low">Lowest Rated</option>
			</select>
		</div>

		<div class="flex flex-col gap-2">
			{#if q.loading && !q.data}
				<LoadingBlock rows={3} height="96px" />
			{:else if q.error}
				<ErrorState error={q.error} retry={() => q.refresh()} compact />
			{:else if items.length === 0}
				<EmptyState
					compact
					illustration="bee"
					title="No reviews yet"
					description="Miners who have completed at least one credited round on this project can leave a review."
				/>
			{:else}
				{#each items.slice(0, 5) as review (review.review_id)}
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px]">
						<div class="flex items-start justify-between mb-2">
							<div>
								<div class="flex items-center gap-2">
									<img src={minerAvatarDataUri(review.author)} alt="" class="w-[22px] h-[22px] rounded-[5px]" loading="lazy" />
									<a
										href="/profiles/{review.author}"
										class="text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] no-underline"
									>
										{review.author_name || shortAddress(review.author)}
									</a>
									{#if review.verified_miner}
										<span
											class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[var(--surface-3)] text-[var(--text-secondary)]"
											>Verified Miner</span
										>
									{/if}
								</div>
								<div class="flex items-center gap-[6px] mt-1">
									<div class="flex gap-0.5">
										{#each Array(5) as _, i (i)}
											<Star size={10} strokeWidth={0} fill={i < review.rating ? 'var(--accent-base)' : 'var(--surface-3)'} />
										{/each}
									</div>
									<span class="text-[11px] text-[var(--text-tertiary)]">{formatDate(review.updated_at ?? review.created_at)}</span>
								</div>
							</div>
						</div>
						<p class="text-[13px] text-[var(--text-secondary)] leading-5 mb-[10px] whitespace-pre-line break-words">
							{review.comment}
						</p>
						<div class="flex gap-4">
							<button
								type="button"
								disabled={helpfulPending === review.review_id}
								onclick={() => helpful(review)}
								class="inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-transparent border-0 cursor-pointer p-0 disabled:opacity-50"
							>
								<ThumbsUp size={12} strokeWidth={1.5} />
								Helpful ({review.helpful ?? 0})
							</button>
						</div>
					</div>
				{/each}
			{/if}

			<div class="flex items-center gap-2 mt-1">
				<a
					href="/apps/{project.project_id}/reviews"
					class="inline-flex items-center justify-center gap-[6px] h-8 px-4 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[13px] no-underline"
				>
					<MessageSquare size={13} strokeWidth={1.5} />
					View All Reviews
				</a>
				<a
					href="/apps/{project.project_id}/reviews#write"
					class="inline-flex items-center justify-center gap-[6px] h-8 px-4 rounded-[5px] bg-[var(--accent-base)] text-[#0C0C0E] text-[13px] font-medium no-underline"
				>
					Write a Review
				</a>
			</div>
		</div>
	</div>
</div>
