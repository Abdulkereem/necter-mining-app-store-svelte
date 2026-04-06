<script lang="ts">
	import { showToast } from '$lib/stores/toast';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save, Upload, X, Image as ImageIcon } from 'lucide-svelte';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor } from '$lib/stores/wallet';
	import { getAppIcon } from '$lib/app-icon';

	const id = $derived($page.params.id);
	const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);

	// ── General ──
	let name = $state('');
	let description = $state('');

	// ── Hardware ──
	let cpuReq = $state('');
	let gpuReq = $state('');
	let ramReq = $state('');
	let storageReq = $state('');

	// ── Economics ──
	let rewardPricingModel = $state('fixed');
	let baseReward = $state(0.5);
	let minReward = $state(0.05);
	let maxReward = $state(2.5);
	let feeMiner = $state(80);
	let feeDev = $state(15);
	let feeTreasury = $state(5);

	// ── Branding & Media ──
	let iconPreview: string | null = $state(null);
	let screenshotPreviews: string[] = $state([]);
	let featuresStr = $state('');
	let tagsStr = $state('');
	let brandAccentColor = $state('#FFC933');
	let brandLogoUrl = $state('');
	let brandBannerUrl = $state('');
	let brandTagline = $state('');

	// ── NDSR Package ──
	let pkgKind = $state('docker');
	let pkgVersion = $state('1.0.0');
	let pkgImage = $state('');

	// ── Hydrate from app ──
	$effect(() => {
		if (!app) return;
		name = app.name ?? '';
		description = app.description ?? '';
		cpuReq = app.requirements?.cpu ?? '';
		gpuReq = app.requirements?.gpu ?? '';
		ramReq = app.requirements?.ram ?? '';
		storageReq = app.requirements?.storage ?? '';
		iconPreview = app.icon ?? null;
		screenshotPreviews = app.screenshots ?? [];
		featuresStr = (app.features ?? []).join('\n');
		tagsStr = (app.tags ?? []).join(', ');
		brandAccentColor = app.branding?.accentColor ?? '#FFC933';
		brandLogoUrl = app.branding?.logoUrl ?? '';
		brandBannerUrl = app.branding?.bannerUrl ?? '';
		brandTagline = app.branding?.tagline ?? '';
	});

	// ── File reading ──
	function readFileAsDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const r = new FileReader();
			r.onload = () => resolve(r.result as string);
			r.onerror = reject;
			r.readAsDataURL(file);
		});
	}

	async function handleIconUpload(e: any) {
		const f = e.target.files?.[0];
		if (f) iconPreview = await readFileAsDataUrl(f);
	}

	async function handleScreenshotUpload(e: any) {
		const files = Array.from(e.target.files || []).slice(0, 5 - screenshotPreviews.length) as File[];
		const urls = await Promise.all(files.map(readFileAsDataUrl));
		screenshotPreviews = [...screenshotPreviews, ...urls].slice(0, 5);
	}

	function removeScreenshot(idx: number) {
		screenshotPreviews = screenshotPreviews.filter((_, j) => j !== idx);
	}

	// ── Save ──
	function save() {
		if (!app) return;
		backend.updateApp(id as string, {
			name,
			description,
			icon: iconPreview || app.icon,
			screenshots: screenshotPreviews,
			features: featuresStr ? featuresStr.split('\n').map((f) => f.trim()).filter(Boolean) : [],
			tags: tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [],
			requirements: { cpu: cpuReq, gpu: gpuReq || undefined, ram: ramReq, storage: storageReq, bandwidth: app.requirements?.bandwidth ?? '50 Mbps' },
			minRewardPerTask: minReward,
			maxRewardPerTask: maxReward,
			rewardSplitMiner: feeMiner,
			rewardSplitDeveloper: feeDev,
			rewardSplitTreasury: feeTreasury,
			branding: {
				accentColor: brandAccentColor || undefined,
				logoUrl: brandLogoUrl || undefined,
				bannerUrl: brandBannerUrl || undefined,
				tagline: brandTagline || undefined,
			},
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

			<!-- Branding & Media -->
			<section>
				<h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">Branding & Media</h2>
				<div class="space-y-4">
					<!-- Icon -->
					<div>
						<label class={labelClass}>App Icon</label>
						<div class="flex items-center gap-3">
							<div class="w-16 h-16 rounded-[14px] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden shrink-0" style="border:{iconPreview ? 'none' : '2px dashed var(--border-default)'}">
								{#if iconPreview}
									<img src={iconPreview} alt="Icon" width="64" height="64" class="rounded-[14px] object-cover" />
								{:else}
									<ImageIcon size={24} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
								{/if}
							</div>
							<div>
								<label class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors">
									<Upload size={12} strokeWidth={1.5} /> Upload Icon
									<input type="file" accept="image/*" onchange={handleIconUpload} class="hidden" />
								</label>
								<p class="text-[11px] text-[var(--text-tertiary)] mt-1">512x512 recommended</p>
							</div>
						</div>
					</div>

					<!-- Screenshots -->
					<div>
						<label class={labelClass}>Screenshots ({screenshotPreviews.length}/5)</label>
						<div class="grid grid-cols-5 gap-2">
							{#each screenshotPreviews as src, i}
								<div class="relative aspect-[16/10] rounded-[6px] overflow-hidden border border-[var(--border-default)]">
									<img {src} alt="Screenshot {i + 1}" class="w-full h-full object-cover" />
									<button
										type="button"
										onclick={() => removeScreenshot(i)}
										class="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 border-none cursor-pointer flex items-center justify-center"
									>
										<X size={12} strokeWidth={2} class="text-white" />
									</button>
								</div>
							{/each}
							{#if screenshotPreviews.length < 5}
								<label class="aspect-[16/10] rounded-[6px] border border-dashed border-[var(--border-default)] bg-[var(--surface-2)] flex flex-col items-center justify-center cursor-pointer gap-1 hover:border-[var(--border-hover)] transition-colors">
									<Upload size={16} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
									<span class="text-[10px] text-[var(--text-tertiary)]">Add</span>
									<input type="file" accept="image/*" multiple onchange={handleScreenshotUpload} class="hidden" />
								</label>
							{/if}
						</div>
					</div>

					<!-- Tagline -->
					<div>
						<label class={labelClass}>Tagline</label>
						<input class={inputClass} bind:value={brandTagline} placeholder="A short tagline for your project" />
					</div>

					<!-- Accent Color -->
					<div>
						<label class={labelClass}>Accent Color</label>
						<div class="flex items-center gap-3">
							<input type="color" bind:value={brandAccentColor} class="w-9 h-9 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] cursor-pointer p-0.5" />
							<input class={inputClass} bind:value={brandAccentColor} placeholder="#FFC933" style="flex:1" />
						</div>
					</div>

					<!-- Logo URL -->
					<div>
						<label class={labelClass}>Logo URL</label>
						<input class={inputClass} bind:value={brandLogoUrl} placeholder="https://example.com/logo.png" />
					</div>

					<!-- Banner -->
					<div>
						<label class={labelClass}>Banner Image URL</label>
						<input class={inputClass} bind:value={brandBannerUrl} placeholder="https://example.com/banner.png" />
					</div>

					<!-- Preview -->
					{#if brandAccentColor || brandLogoUrl}
						<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-0)] p-4">
							<span class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide block mb-2">Preview</span>
							<div class="flex items-center gap-3">
								{#if brandLogoUrl}
									<img src={brandLogoUrl} alt="Logo preview" class="w-10 h-10 rounded-[8px] object-cover border border-[var(--border-default)]" />
								{:else}
									<div class="w-10 h-10 rounded-[8px] border border-[var(--border-default)]" style="background:{brandAccentColor}"></div>
								{/if}
								<div>
									<span class="text-[13px] font-medium text-[var(--text-primary)] block">{name || 'Project Name'}</span>
									{#if brandTagline}
										<span class="text-[11px] text-[var(--text-tertiary)]">{brandTagline}</span>
									{/if}
								</div>
								<div class="ml-auto flex gap-1.5">
									<div class="w-4 h-4 rounded-full" style="background:{brandAccentColor}"></div>
									<div class="w-4 h-4 rounded-full" style="background:{brandAccentColor};opacity:0.5"></div>
									<div class="w-4 h-4 rounded-full" style="background:{brandAccentColor};opacity:0.2"></div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</section>

			<!-- Features & Tags -->
			<section>
				<h2 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-4">Features & Discovery</h2>
				<div class="space-y-4">
					<div>
						<label class={labelClass}>Features</label>
						<textarea class="{inputClass} h-auto py-2" rows="4" bind:value={featuresStr} placeholder={"Real-time coverage mapping\nAutomatic proof of coverage\nRewards tracking dashboard"}></textarea>
						<p class="text-[11px] text-[var(--text-tertiary)] mt-1">One per line. Shown on the app detail page.</p>
					</div>
					<div>
						<label class={labelClass}>Tags</label>
						<input class={inputClass} bind:value={tagsStr} placeholder="IoT, DePIN, Wireless, 5G" />
						<p class="text-[11px] text-[var(--text-tertiary)] mt-1">Comma-separated. Used for search and discovery.</p>
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
