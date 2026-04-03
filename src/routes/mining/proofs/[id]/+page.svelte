<script lang="ts">
	import { page } from '$app/state';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, showConnectModal } from '$lib/stores/wallet';
	import { showToast } from '$lib/stores/toast';
	import { CheckCircle2, Clock, AlertCircle, Copy, ArrowLeft } from 'lucide-svelte';

	let id = $derived(page.params.id);

	let copied = $state(false);
	let disputeReason = $state('');

	let detail = $derived(
		$backendState.proofDetails.find(
			(p) => p.id === id || p.id === `detail_${id}` || p.proofData === id
		) ?? null
	);
	let submission = $derived($backendState.proofs.find((p) => p.id === id) ?? null);

	let proof = $derived.by(() => {
		if (!detail) return null;
		return {
			id: submission?.id ?? id,
			subscriptionId: submission?.subscriptionId ?? detail.subscriptionId,
			status:
				submission?.status ??
				(detail.status === 'verified'
					? 'verified'
					: detail.status === 'rejected'
						? 'rejected'
						: 'pending'),
			submittedAt: detail.submittedAt,
			verifiedAt: detail.verifiedAt,
			verificationTime: detail.verificationTime,
			rejectionReason: detail.rejectionReason,
			proofData: detail.proofData,
			appId: detail.appId,
			minerId: detail.minerId,
			expectedEarning: detail.expectedEarning,
			actualEarning: detail.actualEarning,
			verifierNode: detail.verifierNode
		};
	});

	const statusConfig = {
		verified: {
			label: 'Verified',
			iconColor: 'text-[var(--success)]',
			badgeBg: 'bg-[rgba(76,183,130,0.12)]',
			badgeText: 'text-[var(--success)]'
		},
		pending: {
			label: 'Pending Verification',
			iconColor: 'text-[var(--warning)]',
			badgeBg: 'bg-[rgba(242,153,74,0.12)]',
			badgeText: 'text-[var(--warning)]'
		},
		rejected: {
			label: 'Rejected',
			iconColor: 'text-[var(--error)]',
			badgeBg: 'bg-[rgba(235,87,87,0.12)]',
			badgeText: 'text-[var(--error)]'
		}
	} as const;

	let config = $derived(
		statusConfig[(proof?.status as keyof typeof statusConfig) ?? 'pending']
	);

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function safe(fn: () => void) {
		try {
			fn();
		} catch (e: any) {
			showToast(e?.message ?? 'Action failed', 'error');
		}
	}
</script>

<svelte:head>
	<title>Proof Detail — Necter Mining App Store</title>
</svelte:head>

{#if !proof}
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-4xl mx-auto px-4 md:px-8 py-12">
			<p class="text-[13px] text-[var(--text-secondary)]">Proof not found</p>
		</div>
	</div>
{:else if !$actor}
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-4xl mx-auto px-4 md:px-8 py-12">
			<div class="p-8 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
				<div class="text-[14px] font-semibold text-[var(--text-primary)]">
					Connect a wallet to view proof details
				</div>
				<div class="text-[13px] text-[var(--text-secondary)] mt-1">
					Proofs are private to your miner identity.
				</div>
				<div class="mt-4">
					<button type="button" class="btn-pill" onclick={() => showConnectModal.set(true)}>
						Connect Wallet
					</button>
				</div>
			</div>
		</div>
	</div>
{:else if proof.minerId !== $actor.minerId}
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-4xl mx-auto px-4 md:px-8 py-12">
			<a href="/mining?tab=proofs" class="btn-secondary inline-flex items-center gap-2">
				<ArrowLeft class="h-4 w-4" />
				Back to Proof Queue
			</a>
			<div class="p-8 mt-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
				<div class="text-[14px] font-semibold text-[var(--text-primary)]">
					This proof belongs to a different wallet
				</div>
				<div class="text-[13px] text-[var(--text-secondary)] mt-1">
					Connect the wallet for miner <span class="font-mono text-[12px]">{proof.minerId}</span> to
					view it.
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-[var(--surface-0)]">
		<!-- Header -->
		<div class="px-4 md:px-6 pt-4 md:pt-6">
			<div style="max-width:720px;margin:0 auto">
				<a
					href="/mining?tab=proofs"
					class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4"
				>
					<ArrowLeft class="h-3 w-3" strokeWidth={1.5} />
					Back to Proofs
				</a>
				<div class="flex items-center gap-3 mb-2">
					{#if proof.status === 'verified'}
						<CheckCircle2 class="h-6 w-6 md:h-8 md:w-8 {config.iconColor}" />
					{:else if proof.status === 'rejected'}
						<AlertCircle class="h-6 w-6 md:h-8 md:w-8 {config.iconColor}" />
					{:else}
						<Clock class="h-6 w-6 md:h-8 md:w-8 {config.iconColor}" />
					{/if}
					<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
						{config.label}
					</h1>
				</div>
				<div class="text-[12px] text-[var(--text-tertiary)] flex items-center gap-2 mb-5">
					<span class="font-mono truncate">{proof.id}</span>
					<button
						type="button"
						class="bg-transparent border-none cursor-pointer p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition"
						onclick={() => copyToClipboard(proof.id as string)}
					>
						{#if copied}
							<CheckCircle2 class="h-3.5 w-3.5 text-[var(--success)]" />
						{:else}
							<Copy class="h-3.5 w-3.5" />
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Main Content -->
		<div class="px-4 md:px-6 pb-12">
			<div style="max-width:720px;margin:0 auto">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
					<!-- Left Column - Details -->
					<div class="md:col-span-2 space-y-6">
						<!-- Status Card -->
						<div class="p-4 md:p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Proof Status</h2>
							<div class="space-y-2">
								<div
									class="flex items-center justify-between p-3 bg-[var(--surface-0)] rounded-[5px]"
								>
									<span class="text-[13px] text-[var(--text-secondary)]">Current Status</span>
									<span
										class="text-[12px] font-medium px-2 py-0.5 rounded-[4px] {config.badgeBg} {config.badgeText}"
									>
										{config.label}
									</span>
								</div>

								<div
									class="flex items-center justify-between p-3 bg-[var(--surface-0)] rounded-[5px]"
								>
									<span class="text-[13px] text-[var(--text-secondary)]">Submitted</span>
									<span class="font-mono text-[12px] text-[var(--text-primary)]">
										{new Date(proof.submittedAt).toLocaleString()}
									</span>
								</div>

								{#if proof.verifiedAt}
									<div
										class="flex items-center justify-between p-3 bg-[var(--surface-0)] rounded-[5px]"
									>
										<span class="text-[13px] text-[var(--text-secondary)]">Verified</span>
										<span class="font-mono text-[12px] text-[var(--text-primary)]">
											{new Date(proof.verifiedAt).toLocaleString()}
										</span>
									</div>
									{#if proof.verificationTime}
										<div
											class="flex items-center justify-between p-3 bg-[var(--surface-0)] rounded-[5px]"
										>
											<span class="text-[13px] text-[var(--text-secondary)]"
												>Verification Time</span
											>
											<span class="font-mono text-[12px] text-[var(--text-primary)]">
												{(proof.verificationTime / 1000 / 60).toFixed(1)} min
											</span>
										</div>
									{/if}
								{/if}

								{#if proof.rejectionReason}
									<div
										class="p-3 bg-[rgba(235,87,87,0.08)] border border-[rgba(235,87,87,0.20)] rounded-[5px]"
									>
										<p class="text-[12px] font-medium text-[var(--error)] mb-1">
											Rejection Reason
										</p>
										<p class="text-[13px] text-[var(--text-primary)]">
											{proof.rejectionReason}
										</p>
									</div>
								{/if}
							</div>
						</div>

						<!-- Proof Data Card -->
						<div class="p-4 md:p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Proof Data</h2>
							<div class="space-y-4">
								<div>
									<p class="text-[12px] text-[var(--text-secondary)] mb-2">Proof Hash</p>
									<div
										class="flex items-center gap-2 p-3 bg-[var(--surface-0)] rounded-[5px] font-mono text-[12px] text-[var(--text-primary)]"
									>
										<span class="truncate">{proof.proofData}</span>
										<button
											type="button"
											class="ml-auto bg-transparent border-none cursor-pointer hover:opacity-75 transition text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
											onclick={() => copyToClipboard(proof.proofData)}
										>
											{#if copied}
												<CheckCircle2 class="h-4 w-4 text-[var(--success)]" />
											{:else}
												<Copy class="h-4 w-4" />
											{/if}
										</button>
									</div>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div>
										<p class="text-[12px] text-[var(--text-secondary)] mb-2">Expected Earning</p>
										<p
											class="text-[16px] md:text-[20px] font-bold text-[var(--text-accent)] font-mono"
										>
											${proof.expectedEarning}
										</p>
									</div>
									{#if proof.actualEarning !== undefined}
										<div>
											<p class="text-[12px] text-[var(--text-secondary)] mb-2">Actual Earning</p>
											<p
												class="text-[16px] md:text-[20px] font-bold text-[var(--text-primary)] font-mono"
											>
												${proof.actualEarning}
											</p>
										</div>
									{/if}
								</div>

								{#if proof.verifierNode}
									<div>
										<p class="text-[12px] text-[var(--text-secondary)] mb-2">Verified By</p>
										<p
											class="font-mono text-[12px] text-[var(--text-primary)] p-2 bg-[var(--surface-0)] rounded-[5px]"
										>
											{proof.verifierNode}
										</p>
									</div>
								{/if}
							</div>
						</div>

						<!-- Dispute Section -->
						{#if proof.status === 'rejected'}
							<div
								class="p-6 bg-[var(--surface-1)] border border-[rgba(242,153,74,0.20)] rounded-[8px]"
							>
								<h2 class="text-[14px] font-semibold text-[var(--warning)] mb-4">
									Dispute This Proof
								</h2>
								<p class="text-[13px] text-[var(--text-secondary)] mb-4">
									If you believe this proof was incorrectly rejected, you can file a dispute for
									human review.
								</p>
								<div class="space-y-3">
									<textarea
										bind:value={disputeReason}
										placeholder="Explain why you believe this proof should be verified..."
										class="w-full px-3 py-2 border border-[var(--border)] rounded-[5px] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
										rows="4"
									></textarea>
									<button
										type="button"
										class="btn-subscribe w-full"
										onclick={() =>
											safe(() =>
												backend.fileProofDispute({
													proofId: proof.id as string,
													reason: disputeReason
												})
											)}
										disabled={!disputeReason.trim()}
										style:opacity={!disputeReason.trim() ? 0.4 : 1}
									>
										File Dispute
									</button>
									<button
										type="button"
										class="btn-secondary w-full"
										onclick={() => safe(() => backend.retryProof(proof.id as string))}
									>
										Retry (queue new job)
									</button>
								</div>
							</div>
						{/if}
					</div>

					<!-- Right Column - Summary -->
					<div>
						<div
							class="p-4 md:p-6 md:sticky md:top-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
						>
							<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Summary</h3>
							<div class="space-y-4">
								<div>
									<p class="text-[12px] text-[var(--text-secondary)] mb-1">Subscription</p>
									<p class="font-mono text-[12px] text-[var(--text-primary)]">
										{proof.subscriptionId}
									</p>
								</div>
								<div>
									<p class="text-[12px] text-[var(--text-secondary)] mb-1">App</p>
									<p class="font-mono text-[12px] text-[var(--text-primary)]">{proof.appId}</p>
								</div>
								<div>
									<p class="text-[12px] text-[var(--text-secondary)] mb-1">Miner</p>
									<p class="font-mono text-[12px] text-[var(--text-primary)]">{proof.minerId}</p>
								</div>
								<div class="p-3 bg-[var(--accent-subtle)] rounded-[5px]">
									<p class="text-[12px] text-[var(--text-secondary)] mb-1">Network Status</p>
									<p class="text-[13px] font-bold text-[var(--text-primary)]">
										All Systems Normal
									</p>
									<p class="text-[11px] text-[var(--text-tertiary)] mt-1">
										98.9% uptime last 30 days
									</p>
								</div>
								<a
									href="/apps/{proof.appId}"
									class="btn-subscribe w-full no-underline block text-center"
								>
									View App Details
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
