<script lang="ts">
	import { X, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { actor } from '$lib/stores/wallet';
	import { backendState, backend } from '$lib/stores/backend';
	import { appIconDataUri } from '$lib/app-icon';

	let { open = $bindable(false), onClose }: { open: boolean; onClose: () => void } = $props();

	let step = $state(1);
	let gpuModel = $state('');
	let ramSize = $state('');
	let storageSize = $state('');
	let bandwidth = $state('');
	let subscribed = $state(new Set<string>());

	const recommendations = $derived(backend.listApps().slice(0, 6));
	const minerId = $derived($actor?.minerId ?? null);
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/60"
			style="backdrop-filter: blur(4px);"
			onclick={onClose}
			role="presentation"
		></div>

		<!-- Modal -->
		<div class="relative w-[420px] max-h-[85vh] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-default)] rounded-xl">
			<!-- Progress + Close -->
			<div class="flex items-center p-4 gap-3">
				<div class="flex-1 flex gap-[3px]">
					{#each [1, 2, 3, 4] as s}
						<div
							class="flex-1 h-[2px] rounded-[1px] transition-colors duration-300"
							style="background: {s <= step ? 'var(--accent-base)' : 'var(--surface-3)'};"
						></div>
					{/each}
				</div>
				<button onclick={onClose} class="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] p-0.5 leading-none">
					<X size={14} strokeWidth={2} />
				</button>
			</div>

			<!-- Content -->
			<div class="min-h-[340px] flex flex-col">
				{#if step === 1}
					<!-- Welcome -->
					<div class="flex-1 flex flex-col px-6 pb-6 pt-2">
						<div class="flex-1">
							<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2">Getting started</p>
							<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1.5 leading-6">Start mining in under a minute</h2>
							<p class="text-[13px] text-[var(--text-secondary)] leading-5 mb-6">
								Contribute your computing resources to decentralized networks and earn rewards.
							</p>
							<div class="flex flex-col gap-2.5">
								{#each [
									{ num: '1', title: 'Tell us your hardware', desc: 'GPU, RAM, storage, bandwidth' },
									{ num: '2', title: 'Get matched to networks', desc: 'Based on what your machine can handle' },
									{ num: '3', title: 'Subscribe and start earning', desc: 'Rewards flow as you complete tasks' }
								] as item}
									<div class="flex items-start gap-3">
										<div class="w-[22px] h-[22px] rounded-full bg-[var(--surface-3)] flex items-center justify-center shrink-0 text-[11px] font-semibold text-[var(--text-secondary)] mt-px">
											{item.num}
										</div>
										<div>
											<p class="text-[13px] font-medium text-[var(--text-primary)] m-0">{item.title}</p>
											<p class="text-[12px] text-[var(--text-tertiary)] mt-px">{item.desc}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>
						<button onclick={() => step = 2} class="btn-subscribe w-full h-10 justify-center mt-6">
							Get Started <ArrowRight size={14} strokeWidth={2} />
						</button>
					</div>

				{:else if step === 2}
					<!-- Hardware -->
					<div class="flex-1 flex flex-col px-6 pb-6 pt-2">
						<div class="flex-1">
							<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2">Step 2 of 4</p>
							<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1">Your hardware</h2>
							<p class="text-[12px] text-[var(--text-tertiary)] mb-5">This helps us recommend the right networks.</p>
							<div class="flex flex-col gap-3.5">
								<div>
									<label class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5">GPU Model</label>
									<input class="w-full h-[38px] px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none" placeholder="e.g. NVIDIA RTX 4090" bind:value={gpuModel} />
								</div>
								<div class="grid grid-cols-2 gap-2.5">
									<div>
										<label class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5">RAM</label>
										<input class="w-full h-[38px] px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none" placeholder="e.g. 32GB" bind:value={ramSize} />
									</div>
									<div>
										<label class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5">Storage</label>
										<input class="w-full h-[38px] px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none" placeholder="e.g. 1TB SSD" bind:value={storageSize} />
									</div>
								</div>
								<div>
									<label class="text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5">Bandwidth</label>
									<input class="w-full h-[38px] px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none" placeholder="e.g. 100 Mbps" bind:value={bandwidth} />
								</div>
							</div>
						</div>
						<div class="flex gap-2 mt-6">
							<button onclick={() => step = 1} class="btn-secondary h-10 px-4">
								<ArrowLeft size={14} strokeWidth={2} />
							</button>
							<button onclick={() => {
								if (minerId) {
									backend.upsertHardwareProfile({ minerId, gpu: gpuModel || undefined, ram: ramSize || '8GB', storage: storageSize || '256GB', networkBandwidth: bandwidth || '50 Mbps' });
								}
								step = 3;
							}} class="btn-subscribe flex-1 h-10 justify-center">Continue</button>
						</div>
					</div>

				{:else if step === 3}
					<!-- Recommendations -->
					<div class="flex-1 flex flex-col px-6 pb-6 pt-2">
						<div class="flex-1">
							<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2">Step 3 of 4</p>
							<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1">Networks for you</h2>
							<p class="text-[12px] text-[var(--text-tertiary)] mb-4">Subscribe to start earning. You can always change this later.</p>
							<div class="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
								{#each recommendations as app (app.id)}
									{@const isSub = subscribed.has(app.id)}
									<div class="flex items-center gap-2.5 py-2 px-2.5 rounded-[6px] {isSub ? 'bg-[var(--accent-subtle)] border border-[var(--border-accent)]' : 'bg-[var(--surface-2)] border border-transparent'}">
										<img
											src={app.icon && app.icon !== '/placeholder.svg' ? app.icon : appIconDataUri({ id: app.id, name: app.name, category: app.category })}
											alt="" class="w-7 h-7 rounded-[5px] shrink-0"
										/>
										<div class="flex-1 min-w-0">
											<p class="text-[12px] font-medium text-[var(--text-primary)] m-0 truncate">{app.name}</p>
											<p class="text-[10px] text-[var(--text-tertiary)] m-0">${app.avgEarningsPerDay?.toFixed(0) ?? '0'}/day</p>
										</div>
										<button
											onclick={() => {
												if (!minerId || isSub) return;
												backend.subscribeToApp({ minerId, appId: app.id });
												subscribed = new Set([...subscribed, app.id]);
											}}
											class="h-[26px] px-2.5 rounded text-[11px] font-semibold border-none cursor-pointer shrink-0"
											style="background: {isSub ? 'var(--success)' : 'var(--surface-3)'}; color: {isSub ? '#fff' : 'var(--text-secondary)'};"
										>
											{isSub ? 'Added' : 'Add'}
										</button>
									</div>
								{/each}
							</div>
						</div>
						<div class="flex gap-2 mt-5">
							<button onclick={() => step = 2} class="btn-secondary h-10 px-4">
								<ArrowLeft size={14} strokeWidth={2} />
							</button>
							<button onclick={() => step = 4} class="btn-subscribe flex-1 h-10 justify-center">
								{subscribed.size > 0 ? 'Continue' : 'Skip'}
							</button>
						</div>
					</div>

				{:else}
					<!-- Done -->
					<div class="flex-1 flex flex-col items-center justify-center px-6 pb-8 pt-10 text-center">
						<div class="w-12 h-12 rounded-full flex items-center justify-center mb-4" style="background: rgba(76,183,130,0.12);">
							<CheckCircle2 size={24} strokeWidth={1.5} style="color: var(--success);" />
						</div>
						<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1.5">You're all set</h2>
						<p class="text-[13px] text-[var(--text-secondary)] leading-5 max-w-[280px] mb-6">
							{#if subscribed.size > 0}
								{subscribed.size} network{subscribed.size > 1 ? 's' : ''} added. Head to My Mining to start.
							{:else}
								Browse the marketplace to find the right networks for you.
							{/if}
						</p>
						<button
							onclick={() => { onClose(); goto(subscribed.size > 0 ? '/mining' : '/discover'); }}
							class="btn-subscribe h-10 px-6"
						>
							{subscribed.size > 0 ? 'Go to My Mining' : 'Browse Networks'} <ArrowRight size={14} strokeWidth={2} />
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
