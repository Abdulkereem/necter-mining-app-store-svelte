<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Megaphone, Trash2 } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import { devProject } from '$lib/develop/context';
	import { timeAgo } from '$lib/format';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	type Kind = 'update' | 'maintenance' | 'feature' | 'alert';
	const ctx = devProject();
	const pid = $derived(ctx.project.project_id);
	const q = useQuery(() => hub.announcements(pid));
	let title = $state('');
	let content = $state('');
	let type = $state<Kind>('update');
	let busy = $state(false);
	const color: Record<string, string> = { update: 'var(--info)', maintenance: 'var(--warning)', feature: 'var(--success)', alert: 'var(--error)' };

	async function post() {
		busy = true;
		try {
			await hub.createAnnouncement(pid, { title: title.trim(), content: content.trim(), type });
			toast.success('Announcement posted');
			title = '';
			content = '';
			await q.refresh();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			busy = false;
		}
	}
	async function remove(id: string) {
		try {
			await hub.deleteAnnouncement(pid, id);
			await q.refresh();
		} catch (e) {
			toast.error(errorMessage(e));
		}
	}
</script>

<div class="space-y-5">
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
		<h2 class="text-[15px] font-semibold mb-3">New announcement</h2>
		<div class="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-2">
			<input bind:value={title} maxlength="120" placeholder="Title" class="h-[34px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px]" />
			<select bind:value={type} class="h-[34px] px-2 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px]">
				<option value="update">Update</option><option value="feature">Feature</option><option value="maintenance">Maintenance</option><option value="alert">Alert</option>
			</select>
		</div>
		<textarea bind:value={content} maxlength="8000" rows="4" placeholder="What miners should know" class="w-full mt-2 p-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px]"></textarea>
		<button type="button" class="btn-subscribe mt-3 inline-flex items-center gap-1.5" disabled={busy || !title.trim() || !content.trim()} onclick={post}><Megaphone class="h-3.5 w-3.5" /> Post</button>
	</div>
	{#if q.loading && !q.data}
		<LoadingBlock rows={3} />
	{:else if (q.data?.items?.length ?? 0) === 0}
		<EmptyState compact illustration="bee" title="No announcements yet" description="Announcements show on your public project page." />
	{:else}
		<div class="space-y-2">
			{#each q.data?.items ?? [] as a (a.announcement_id)}
				<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 flex gap-3">
					<span class="h-2 w-2 rounded-full mt-1.5 flex-shrink-0" style="background:{color[a.type]}"></span>
					<div class="flex-1 min-w-0">
						<p class="text-[13px] font-semibold">{a.title} <span class="text-[11px] font-normal text-[var(--text-tertiary)] capitalize">· {a.type} · {timeAgo(a.created_at)}</span></p>
						<p class="text-[12px] text-[var(--text-secondary)] mt-1 whitespace-pre-line">{a.content}</p>
					</div>
					<button type="button" aria-label="Delete" class="bg-transparent border-none cursor-pointer p-1 self-start" onclick={() => remove(a.announcement_id)}><Trash2 class="h-4 w-4 text-[var(--text-tertiary)]" /></button>
				</div>
			{/each}
		</div>
	{/if}
</div>
