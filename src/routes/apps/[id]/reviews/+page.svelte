<script lang="ts">
	import { page } from '$app/state';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, showConnectModal } from '$lib/stores/wallet';
	import { showToast, showError } from '$lib/stores/toast';
	import { appIconDataUri } from '$lib/app-icon';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import {
		ArrowLeft,
		Star,
		ThumbsUp,
		Flag,
		MessageSquare
	} from 'lucide-svelte';

	type Sort = 'helpful' | 'recent' | 'highest' | 'lowest';

	const id = $derived(page.params.id);

	let sort: Sort = $state('helpful');
	let draft = $state('');
	let rating = $state(0);
	let hover = $state(0);
	let submitting = $state(false);

	let app = $derived($backendState.apps.find((a) => a.id === id) ?? null);
	let reviews = $derived(app?.reviews ?? []);
	let avg = $derived(
		app?.averageRating ?? (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0)
	);
	let minerId = $derived($actor?.minerId ?? null);
	let hasReviewed = $derived(minerId ? reviews.some((r) => r.minerId === minerId) : false);

	let sorted = $derived.by(() => {
		return [...reviews].sort((a, b) => {
			if (sort === 'helpful') return (b.helpful ?? 0) - (a.helpful ?? 0);
			if (sort === 'highest') return b.rating - a.rating;
			if (sort === 'lowest') return a.rating - b.rating;
			return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
		});
	});

	let ratingDistribution = $derived(
		[5, 4, 3, 2, 1].map((star) => ({
			star,
			count: reviews.filter((r) => r.rating === star).length,
			pct: reviews.length ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100 : 0
		}))
	);

	let iconSrc = $derived.by(() => {
		if (!app) return '/placeholder.svg';
		if (app.icon && app.icon !== '/placeholder.svg') return app.icon;
		return appIconDataUri({ id: app.id, name: app.name });
	});

	function ratingLabel(v: number): string {
		return v === 1 ? 'Poor' : v === 2 ? 'Fair' : v === 3 ? 'Good' : v === 4 ? 'Great' : 'Excellent';
	}

	function handleSubmit() {
		if (!$actor || rating === 0 || !draft.trim()) return;
		submitting = true;
		try {
			backend.submitReview({ appId: id, rating, comment: draft });
			draft = '';
			rating = 0;
			showToast('Review submitted', 'Thanks for your feedback!');
		} catch (e: any) {
			showError('Error', e?.message ?? 'Failed to submit review.');
		} finally {
			submitting = false;
		}
	}
</script>

{#if app}
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12" style="max-width:760px;margin:0 auto">
		<!-- Back -->
		<a
			href="/apps/{id}"
			class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4"
		>
			<ArrowLeft class="h-3 w-3" strokeWidth={1.5} />
			Back to {app.name}
		</a>

		<!-- Header -->
		<div class="flex items-start gap-3 md:gap-4 mb-6 flex-wrap">
			<img
				src={iconSrc}
				alt={app.name}
				width="56"
				height="56"
				class="rounded-[10px] flex-shrink-0"
			/>
			<div class="flex-1 min-w-0">
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
					{app.name} Reviews
				</h1>
				<div class="flex items-center gap-3 mt-1">
					<div class="flex items-center gap-1">
						<Star class="h-4 w-4 text-[var(--warning)] fill-[var(--warning)]" strokeWidth={1.5} />
						<span class="text-[14px] font-semibold text-[var(--text-primary)]">{avg.toFixed(1)}</span>
					</div>
					<span class="text-[12px] text-[var(--text-tertiary)]">
						{reviews.length} review{reviews.length !== 1 ? 's' : ''}
					</span>
					<span class="text-[11px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)]">
						{app.category}
					</span>
				</div>
			</div>

			<!-- Sort -->
			<select
				bind:value={sort}
				class="h-8 px-2.5 rounded-[5px] bg-[var(--surface-1)] border border-[var(--border)] text-[12px] text-[var(--text-secondary)] outline-none cursor-pointer"
			>
				<option value="helpful">Most helpful</option>
				<option value="recent">Most recent</option>
				<option value="highest">Highest rated</option>
				<option value="lowest">Lowest rated</option>
			</select>
		</div>

		<!-- Rating distribution -->
		<div class="p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] mb-6">
			<div class="flex flex-col md:flex-row items-center gap-4 md:gap-6">
				<!-- Big avg -->
				<div class="text-center flex-shrink-0" style="min-width:80px">
					<p class="text-[32px] font-bold text-[var(--text-primary)] font-mono leading-none">
						{avg.toFixed(1)}
					</p>
					<div class="flex items-center justify-center gap-0.5 mt-1.5">
						{#each [1, 2, 3, 4, 5] as s}
							<Star
								class="h-3 w-3 {s <= Math.round(avg)
									? 'text-[var(--warning)] fill-[var(--warning)]'
									: 'text-[var(--text-tertiary)]'}"
								strokeWidth={1.5}
							/>
						{/each}
					</div>
					<p class="text-[10px] text-[var(--text-tertiary)] mt-1">{reviews.length} ratings</p>
				</div>

				<!-- Bars -->
				<div class="flex-1 space-y-1.5 w-full">
					{#each ratingDistribution as d}
						<div class="flex items-center gap-2">
							<span class="text-[11px] text-[var(--text-tertiary)] w-3 text-right font-mono">
								{d.star}
							</span>
							<Star class="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={1.5} />
							<div class="flex-1 h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
								<div
									class="h-full rounded-full bg-[var(--warning)] transition-all"
									style="width:{d.pct}%"
								></div>
							</div>
							<span class="text-[10px] text-[var(--text-tertiary)] font-mono w-6 text-right">
								{d.count}
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Write a review -->
		{#if !$actor}
			<div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] mb-6 text-center">
				<MessageSquare class="h-6 w-6 mx-auto text-[var(--text-tertiary)] mb-2" strokeWidth={1.5} />
				<p class="text-[13px] text-[var(--text-secondary)] mb-3">Connect your wallet to leave a review</p>
				<button type="button" class="btn-pill" onclick={() => $showConnectModal = true}>
					Connect wallet
				</button>
			</div>
		{:else if hasReviewed}
			<div class="p-4 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--border-accent)] mb-6">
				<p class="text-[13px] text-[var(--text-accent)] font-medium">You've already reviewed this project</p>
			</div>
		{:else}
			<div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] mb-6">
				<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Write a review</h2>

				<!-- Star rating picker -->
				<div class="mb-4">
					<label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-2">
						Your rating
					</label>
					<div class="flex items-center gap-0.5">
						{#each [1, 2, 3, 4, 5] as star}
							<button
								type="button"
								class="bg-transparent border-none cursor-pointer p-0.5 transition-transform hover:scale-110"
								onmouseenter={() => (hover = star)}
								onmouseleave={() => (hover = 0)}
								onclick={() => (rating = star)}
							>
								<Star
									class="transition-colors {star <= (hover || rating)
										? 'text-[var(--warning)] fill-[var(--warning)]'
										: 'text-[var(--text-tertiary)]'}"
									style="width:24px;height:24px"
									strokeWidth={1.5}
								/>
							</button>
						{/each}
						{#if rating > 0}
							<span class="text-[12px] text-[var(--text-secondary)] ml-2 font-medium">
								{ratingLabel(rating)}
							</span>
						{/if}
					</div>
				</div>

				<!-- Comment -->
				<div class="mb-4">
					<label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-2">
						Your experience
					</label>
					<textarea
						bind:value={draft}
						placeholder="Share your mining experience — uptime, reward consistency, support quality, setup difficulty..."
						rows="4"
						class="w-full text-[13px] rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] p-3 resize-y leading-relaxed focus:border-[var(--accent-base)] outline-none transition-colors"
					></textarea>
					<p class="text-[10px] text-[var(--text-tertiary)] mt-1">{draft.length}/500 characters</p>
				</div>

				<!-- Submit -->
				<button
					type="button"
					disabled={rating === 0 || !draft.trim() || submitting}
					onclick={handleSubmit}
					class="btn-subscribe flex items-center gap-1.5"
					style="opacity:{rating === 0 || !draft.trim() || submitting ? 0.4 : 1}"
				>
					<MessageSquare class="h-4 w-4" strokeWidth={1.5} />
					{submitting ? 'Submitting...' : 'Submit Review'}
				</button>
			</div>
		{/if}

		<!-- Reviews list -->
		{#if sorted.length === 0}
			<div class="p-12 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center">
				<Star class="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" strokeWidth={1} />
				<p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">No reviews yet</p>
				<p class="text-[13px] text-[var(--text-secondary)]">Be the first to share your mining experience.</p>
			</div>
		{:else}
			<div class="space-y-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden divide-y divide-[var(--border-default)]">
				{#each sorted as review (review.id)}
					<div class="p-4">
						<!-- Header -->
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-center gap-2.5">
								<img
									src={minerAvatarDataUri(review.minerId)}
									alt=""
									class="w-7 h-7 rounded-[6px]"
								/>
								<div>
									<div class="flex items-center gap-2">
										<span class="text-[13px] font-medium text-[var(--text-primary)]">
											{review.minerUsername}
										</span>
										<span
											class="text-[9px] font-medium uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-[3px]"
											style="background:rgba(76,183,130,0.12);color:var(--success)"
										>
											Verified Miner
										</span>
									</div>
									<div class="flex items-center gap-2 mt-0.5">
										<div class="flex items-center gap-0.5">
											{#each [1, 2, 3, 4, 5] as s}
												<Star
													class="h-3 w-3 {s <= review.rating
														? 'text-[var(--warning)] fill-[var(--warning)]'
														: 'text-[var(--text-tertiary)]'}"
													strokeWidth={1.5}
												/>
											{/each}
										</div>
										<span class="text-[10px] text-[var(--text-tertiary)] font-mono">
											{new Date(review.timestamp).toLocaleDateString('en-US', {
												month: 'short',
												day: 'numeric',
												year: 'numeric'
											})}
										</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Comment -->
						<p class="text-[13px] text-[var(--text-secondary)] mt-3 leading-relaxed">
							{review.comment}
						</p>

						<!-- Actions -->
						<div class="flex items-center gap-4 mt-3">
							<button
								type="button"
								class="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer transition-colors"
							>
								<ThumbsUp class="h-3.5 w-3.5" strokeWidth={1.5} />
								Helpful ({review.helpful ?? 0})
							</button>
							<button
								type="button"
								class="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer transition-colors"
							>
								<Flag class="h-3.5 w-3.5" strokeWidth={1.5} />
								Report
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="px-4 md:px-6 pt-4 md:pt-6 pb-12" style="max-width:760px;margin:0 auto">
		<p class="text-[14px] text-[var(--text-secondary)]">App not found.</p>
	</div>
{/if}
