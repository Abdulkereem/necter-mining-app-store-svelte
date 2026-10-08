<script lang="ts">
	import toast from 'svelte-french-toast';
	import { FileText, Image, Link2, ListChecks, Palette, Loader2, Upload, X } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { ManifestListing } from '$lib/api/types';
	import { devProject } from '$lib/develop/context';
	import { toManifest } from '$lib/develop/types';
	import { uploadImage, IMAGE_ACCEPT } from '$lib/develop/upload';
	import { nextVersion, validateManifest, CATEGORY_SLUGS } from '$lib/protocol/manifest';
	import { canonicalJson } from '$lib/protocol/canonical';
	import { publishVersion, ManifestRejected } from '$lib/flows';
	import { categoryName } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	type Section = 'general' | 'media' | 'links' | 'features' | 'branding';
	const sections: { id: Section; label: string; icon: typeof FileText }[] = [
		{ id: 'general', label: 'General', icon: FileText },
		{ id: 'media', label: 'Media', icon: Image },
		{ id: 'links', label: 'Links', icon: Link2 },
		{ id: 'features', label: 'Features & tags', icon: ListChecks },
		{ id: 'branding', label: 'Branding', icon: Palette }
	];
	let active = $state<Section>('general');

	const ctx = devProject();
	const pid = $derived(ctx.project.project_id);
	const manifestQ = useQuery(() => hub.manifest(pid));

	let l = $state<ManifestListing | null>(null);
	let tagsText = $state('');
	let featuresText = $state('');
	let busy = $state(false);
	let step = $state('');
	let uploading = $state<string | null>(null);
	let problems = $state<{ path: string; message: string }[]>([]);

	$effect(() => {
		if (manifestQ.data && !l) {
			const m = toManifest(manifestQ.data.manifest);
			l = structuredClone(m.listing);
			tagsText = m.listing.tags.join(', ');
			featuresText = m.listing.features.join('\n');
		}
	});

	function draftListing(): ManifestListing | null {
		if (!l) return null;
		const snap = $state.snapshot(l) as ManifestListing;
		const nul = (v: string | null) => (v && v.trim() ? v.trim() : null);
		return {
			...snap,
			name: snap.name.trim(),
			tagline: snap.tagline.trim(),
			tags: [...new Set(tagsText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))],
			features: featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
			banner: nul(snap.banner),
			video: nul(snap.video),
			website: nul(snap.website),
			docs: nul(snap.docs),
			support: nul(snap.support),
			accent_color: snap.accent_color ? snap.accent_color.toUpperCase() : null
		};
	}

	const fieldProblems = $derived.by(() => {
		const d = draftListing();
		if (!d || !manifestQ.data) return [];
		return validateManifest({ ...toManifest(manifestQ.data.manifest), listing: d }).filter((p) => p.path.startsWith('listing'));
	});

	async function upload(e: Event, field: 'icon' | 'banner' | 'screenshot') {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file || !l) return;
		uploading = field;
		try {
			const url = await uploadImage(file);
			if (field === 'screenshot') l.screenshots = [...l.screenshots, url].slice(0, 8);
			else l[field] = url;
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			uploading = null;
		}
	}

	async function save() {
		const listing = draftListing();
		if (!listing || !manifestQ.data) return;
		const current = toManifest(manifestQ.data.manifest);
		if (canonicalJson(listing) === canonicalJson(current.listing)) return toast('Nothing changed');
		problems = [];
		busy = true;
		try {
			const r = await publishVersion(pid, nextVersion(current, { listing }), (s) => (step = s), { sendPublishTx: false });
			toast.success(`Listing updated (version ${r.version.version})`);
			l = null;
			await Promise.all([manifestQ.refresh(), ctx.refresh()]);
		} catch (e) {
			if (e instanceof ManifestRejected) problems = e.problems;
			else toast.error(errorMessage(e));
		} finally {
			busy = false;
			step = '';
		}
	}

	const inputCls = 'w-full h-[34px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-base)]';
	const labelCls = 'text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5';
</script>

{#if !l}
	<LoadingBlock rows={4} />
{:else}
	<div class="flex flex-col md:flex-row gap-4 md:gap-6">
		<nav class="flex md:flex-col w-full md:w-[170px] flex-shrink-0 gap-0.5 md:sticky md:top-6 md:self-start overflow-x-auto">
			{#each sections as s (s.id)}
				{@const Icon = s.icon}
				<button type="button" onclick={() => (active = s.id)} class="flex items-center gap-2.5 md:w-full px-3 py-2 text-[13px] rounded-[6px] text-left whitespace-nowrap border-none cursor-pointer {active === s.id ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}">
					<Icon class="h-4 w-4" strokeWidth={1.5} />{s.label}
				</button>
			{/each}
		</nav>
		<div class="flex-1 min-w-0">
			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4">
				{#if active === 'general'}
					<div><label for="ln" class={labelCls}>Name</label><input id="ln" bind:value={l.name} maxlength="64" class={inputCls} /></div>
					<div><label for="lt" class={labelCls}>Tagline</label><input id="lt" bind:value={l.tagline} maxlength="120" class={inputCls} /></div>
					<div><label for="ld" class={labelCls}>Description</label><textarea id="ld" bind:value={l.description} rows="8" maxlength="8000" class="w-full p-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px]"></textarea></div>
					<div>
						<label for="lc" class={labelCls}>Category</label>
						<select id="lc" bind:value={l.category} class={inputCls}>{#each CATEGORY_SLUGS as c (c)}<option value={c}>{categoryName(c)}</option>{/each}</select>
					</div>
				{:else if active === 'media'}
					<div class="flex items-center gap-4">
						<ProjectIcon project={{ project_id: pid, name: l.name, category: l.category, icon: l.icon }} size={64} rounded="14px" />
						<label class="btn-secondary inline-flex items-center gap-1.5 cursor-pointer">
							{#if uploading === 'icon'}<Loader2 class="h-3.5 w-3.5 animate-spin" />{:else}<Upload class="h-3.5 w-3.5" />{/if} Upload icon
							<input type="file" accept={IMAGE_ACCEPT} class="hidden" onchange={(e) => upload(e, 'icon')} />
						</label>
					</div>
					<div>
						<span class={labelCls}>Banner</span>
						{#if l.banner}<img src={l.banner} alt="" class="w-full max-h-[140px] object-cover rounded-[8px] mb-2" referrerpolicy="no-referrer" />{/if}
						<div class="flex gap-2">
							<label class="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"><Upload class="h-3.5 w-3.5" /> Upload banner<input type="file" accept={IMAGE_ACCEPT} class="hidden" onchange={(e) => upload(e, 'banner')} /></label>
							{#if l.banner}<button type="button" class="btn-secondary" onclick={() => (l!.banner = null)}>Remove</button>{/if}
						</div>
					</div>
					<div>
						<span class={labelCls}>Screenshots ({l.screenshots.length}/8)</span>
						<div class="flex flex-wrap gap-2 mb-2">
							{#each l.screenshots as s, i (s)}
								<div class="relative"><img src={s} alt="" class="h-[90px] rounded-[6px]" referrerpolicy="no-referrer" /><button type="button" aria-label="Remove" class="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 border-none cursor-pointer flex items-center justify-center" onclick={() => (l!.screenshots = l!.screenshots.filter((_, j) => j !== i))}><X class="h-3 w-3 text-white" /></button></div>
							{/each}
						</div>
						{#if l.screenshots.length < 8}<label class="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"><Upload class="h-3.5 w-3.5" /> Add screenshot<input type="file" accept={IMAGE_ACCEPT} class="hidden" onchange={(e) => upload(e, 'screenshot')} /></label>{/if}
					</div>
					<div><label for="lv" class={labelCls}>Video URL (https)</label><input id="lv" bind:value={l.video} class={inputCls} placeholder="https://…" /></div>
				{:else if active === 'links'}
					<div><label for="lw" class={labelCls}>Website</label><input id="lw" bind:value={l.website} class={inputCls} placeholder="https://…" /></div>
					<div><label for="ldo" class={labelCls}>Docs</label><input id="ldo" bind:value={l.docs} class={inputCls} placeholder="https://…" /></div>
					<div><label for="ls" class={labelCls}>Support</label><input id="ls" bind:value={l.support} class={inputCls} placeholder="https://…" /></div>
				{:else if active === 'features'}
					<div><label for="ltg" class={labelCls}>Tags (comma separated, up to 8: a-z, 0-9, -)</label><input id="ltg" bind:value={tagsText} class={inputCls} /></div>
					<div><label for="lf" class={labelCls}>Features (one per line, up to 12)</label><textarea id="lf" bind:value={featuresText} rows="6" class="w-full p-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px]"></textarea></div>
				{:else}
					<div>
						<label for="lac" class={labelCls}>Accent color</label>
						<div class="flex items-center gap-2">
							<input type="color" value={l.accent_color ?? '#FFC933'} oninput={(e) => (l!.accent_color = (e.currentTarget as HTMLInputElement).value.toUpperCase())} class="h-[34px] w-[48px] rounded-[6px] bg-transparent border border-[var(--border)]" />
							<input id="lac" bind:value={l.accent_color} placeholder="#FFC933" class="{inputCls} font-mono max-w-[140px]" />
							{#if l.accent_color}<button type="button" class="btn-secondary" onclick={() => (l!.accent_color = null)}>Default</button>{/if}
						</div>
					</div>
				{/if}
			</div>

			{#each [...fieldProblems, ...problems] as pr (pr.path + pr.message)}<p class="text-[12px] text-[var(--error)] mt-2">{pr.path}: {pr.message}</p>{/each}
			<div class="flex items-center justify-between gap-3 mt-4 flex-wrap">
				<p class="text-[11px] text-[var(--text-tertiary)]">Saving signs a listing-only version: no transaction, effective immediately.</p>
				<button type="button" class="btn-subscribe inline-flex items-center gap-1.5" disabled={busy || fieldProblems.length > 0 || !!uploading} onclick={save}>
					{#if busy}<Loader2 class="h-3.5 w-3.5 animate-spin" />{step || 'Working…'}{:else}Sign & save listing{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
