<script lang="ts">
	import { showToast } from '$lib/stores/toast';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor } from '$lib/stores/wallet';

	const id = $derived($page.params.id);
	const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);

	let name = $state('');
	let description = $state('');
	let cpuReq = $state('');
	let gpuReq = $state('');
	let ramReq = $state('');
	let storageReq = $state('');
	let rewardPricingModel = $state('fixed');
	let baseReward = $state(0.5);
	let minReward = $state(0.05);
	let maxReward = $state(2.5);
	let feeMiner = $state(80);
	let feeDev = $state(15);
	let feeTreasury = $state(5);
	let pkgKind = $state('docker');
	let pkgVersion = $state('1.0.0');
	let pkgImage = $state('');

	$effect(() => {
		if (!app) return;
		name = app.name ?? '';
		description = app.description ?? '';
		cpuReq = app.requirements?.cpu ?? '';
		gpuReq = app.requirements?.gpu ?? '';
		ramReq = app.requirements?.ram ?? '';
		storageReq = app.requirements?.storage ?? '';
	});

	function save() {
		if (!app) return;
		backend.updateApp(id, {
			name,
			description,
			requirements: { cpu: cpuReq, gpu: gpuReq || undefined, ram: ramReq, storage: storageReq, bandwidth: app.requirements?.bandwidth ?? '50 Mbps' },
			minRewardPerTask: minReward,
			maxRewardPerTask: maxReward,
			rewardSplitMiner: feeMiner,
			rewardSplitDeveloper: feeDev,
			rewardSplitTreasury: feeTreasury,
		});
		showToast('Settings saved');
	}

	const inputClass = 'w-full h-9 px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none';
	const labelClass = 'text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5';
</script>

{#if !app}
	<div class="px-8 pt-8 pb-12">
		<p class="text-[var(--text-secondary)]">App not found.</p>
		<a href="/develop" class="text-[var(--text-accent)] text-[13px]">Back to portal</a>
	</div>
{:else}
	<div class="px-8 pt-8 pb-12" style="max-width: 720px;">
		<a href="/develop/apps/{id}" class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6 no-underline">
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to {app.name}
		</a>

		<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-6">Settings</h1>

		<div class="space-y-8">
			<!-- General -->
			<section>
				<h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">General</h2>
				<div class="space-y-4">
					<div>
						<label class={labelClass}>Project Name</label>
						<input class={inputClass} bind:value={name} />
					</div>
					<div>
						<label class={labelClass}>Description</label>
						<textarea class="{inputClass} h-auto py-2" rows="4" bind:value={description}></textarea>
					</div>
				</div>
			</section>

			<!-- Hardware Requirements -->
			<section>
				<h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">Hardware Requirements</h2>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class={labelClass}>CPU</label>
						<input class={inputClass} bind:value={cpuReq} placeholder="e.g. 4 cores" />
					</div>
					<div>
						<label class={labelClass}>GPU</label>
						<input class={inputClass} bind:value={gpuReq} placeholder="e.g. RTX 4090" />
					</div>
					<div>
						<label class={labelClass}>RAM</label>
						<input class={inputClass} bind:value={ramReq} placeholder="e.g. 16GB" />
					</div>
					<div>
						<label class={labelClass}>Storage</label>
						<input class={inputClass} bind:value={storageReq} placeholder="e.g. 500GB SSD" />
					</div>
				</div>
			</section>

			<!-- Economics -->
			<section>
				<h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">Reward Economics</h2>
				<div class="space-y-4">
					<div>
						<label class={labelClass}>Pricing Model</label>
						<select class={inputClass} bind:value={rewardPricingModel}>
							<option value="fixed">Fixed per task</option>
							<option value="variable">Variable (supply/demand)</option>
							<option value="marketplace">Marketplace auction</option>
						</select>
					</div>
					<div class="grid grid-cols-3 gap-4">
						<div>
							<label class={labelClass}>Min Reward</label>
							<input class={inputClass} type="number" step="0.01" bind:value={minReward} />
						</div>
						<div>
							<label class={labelClass}>Base Reward</label>
							<input class={inputClass} type="number" step="0.01" bind:value={baseReward} />
						</div>
						<div>
							<label class={labelClass}>Max Reward</label>
							<input class={inputClass} type="number" step="0.01" bind:value={maxReward} />
						</div>
					</div>

					<div>
						<label class={labelClass}>Fee Split (Miner / Developer / Treasury)</label>
						<div class="grid grid-cols-3 gap-4">
							<div>
								<input class={inputClass} type="number" bind:value={feeMiner} />
								<span class="text-[10px] text-[var(--text-tertiary)] mt-1 block">Miner %</span>
							</div>
							<div>
								<input class={inputClass} type="number" bind:value={feeDev} />
								<span class="text-[10px] text-[var(--text-tertiary)] mt-1 block">Developer %</span>
							</div>
							<div>
								<input class={inputClass} type="number" bind:value={feeTreasury} />
								<span class="text-[10px] text-[var(--text-tertiary)] mt-1 block">Treasury %</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Mining Package -->
			<section>
				<h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">NDSR Package</h2>
				<div class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class={labelClass}>Package Type</label>
							<select class={inputClass} bind:value={pkgKind}>
								<option value="docker">Docker</option>
								<option value="vm">Virtual Machine</option>
								<option value="ndsr">NDSR Native</option>
							</select>
						</div>
						<div>
							<label class={labelClass}>Version</label>
							<input class={inputClass} bind:value={pkgVersion} />
						</div>
					</div>
					<div>
						<label class={labelClass}>Image Reference</label>
						<input class={inputClass} bind:value={pkgImage} placeholder="e.g. registry.necter.io/mynetwork:latest" />
					</div>
				</div>
			</section>

			<!-- Save -->
			<div class="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
				<a href="/develop/apps/{id}" class="btn-secondary no-underline" style="height: 38px; padding: 0 16px; display: inline-flex; align-items: center;">Cancel</a>
				<button onclick={save} class="btn-subscribe" style="height: 38px; padding: 0 20px;">
					<Save class="h-3.5 w-3.5" /> Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
