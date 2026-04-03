<script lang="ts">
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { ArrowLeft, Megaphone, Plus, Trash2, ChevronUp } from 'lucide-svelte';

  const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
    update: { label: 'Update', color: 'var(--text-accent)', bg: 'var(--accent-subtle)' },
    maintenance: { label: 'Maintenance', color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)' },
    feature: { label: 'Feature', color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
    alert: { label: 'Alert', color: 'var(--error)', bg: 'rgba(239,68,68,0.12)' },
  };

  const typeKeys = /** @type {const} */ (['update', 'maintenance', 'feature', 'alert']);

  const id = $derived($page.params.id ?? '');
  const announcements = $derived(backend.listAnnouncements(id));

  let showForm = $state(false);
  let title = $state('');
  let content = $state('');
  let type = $state('update');

  function handleSubmit(e: any) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    backend.createAnnouncement({ appId: id, title: title.trim(), content: content.trim(), type: type as any });
    title = '';
    content = '';
    type = 'update';
    showForm = false;
  }

  function handleDelete(announcementId: any) {
    backend.deleteAnnouncement(id, announcementId);
  }
</script>

<div class="min-h-screen animate-fadeIn">
  <div class="px-4 md:px-6 pt-4 md:pt-6 pb-12 max-w-[800px] mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <a
        href="/develop/apps/{id}"
        class="h-7 w-7 flex items-center justify-center rounded-[5px] hover:bg-[var(--surface-2)] transition-colors"
      >
        <ArrowLeft class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
      </a>
      <div class="flex-1">
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)]">Announcements</h1>
        <p class="text-[12px] text-[var(--text-tertiary)]">
          Keep your miners informed with release notes and updates
        </p>
      </div>
      <button
        onclick={() => { showForm = !showForm; }}
        class="h-[32px] px-3 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors"
        style="background: var(--accent-base); color: var(--surface-0);"
      >
        <Plus class="h-3.5 w-3.5" strokeWidth={2} />
        New Announcement
      </button>
    </div>

    <!-- New Announcement Form -->
    {#if showForm}
      <div
        class="rounded-[8px] border mb-6 overflow-hidden"
        style="border-color: var(--border-default); background: var(--surface-1);"
      >
        <button
          onclick={() => { showForm = false; }}
          class="w-full flex items-center justify-between px-4 py-3 text-[12px] font-medium bg-transparent cursor-pointer"
          style="color: var(--text-secondary); border: none; border-bottom: 1px solid var(--border-default);"
        >
          <span class="flex items-center gap-2">
            <Megaphone class="h-3.5 w-3.5" strokeWidth={1.5} />
            Create Announcement
          </span>
          <ChevronUp class="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <form onsubmit={handleSubmit} class="p-4 space-y-4">
          <!-- Type selector -->
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style="color: var(--text-tertiary);">
              Type
            </label>
            <div class="flex gap-2">
              {#each typeKeys as t}
                <button
                  type="button"
                  onclick={() => { type = t; }}
                  class="h-[28px] px-3 rounded-[5px] text-[11px] font-medium transition-all"
                  style="background: {type === t ? typeConfig[t].bg : 'var(--surface-2)'}; color: {type === t ? typeConfig[t].color : 'var(--text-tertiary)'}; border: {type === t ? `1px solid ${typeConfig[t].color}` : '1px solid var(--border-default)'};"
                >
                  {typeConfig[t].label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Title -->
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style="color: var(--text-tertiary);">
              Title
            </label>
            <input
              type="text"
              bind:value={title}
              placeholder="e.g. v1.3.0 Released — Improved GPU scheduling"
              class="w-full h-[36px] px-3 rounded-[6px] text-[13px] outline-none transition-colors"
              style="background: var(--surface-0); border: 1px solid var(--border-default); color: var(--text-primary);"
            />
          </div>

          <!-- Content -->
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style="color: var(--text-tertiary);">
              Content
            </label>
            <textarea
              bind:value={content}
              placeholder="Describe what changed, what miners should know, or any action needed..."
              rows="4"
              class="w-full px-3 py-2.5 rounded-[6px] text-[13px] outline-none resize-y transition-colors leading-relaxed"
              style="background: var(--surface-0); border: 1px solid var(--border-default); color: var(--text-primary);"
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onclick={() => { showForm = false; }}
              class="h-[32px] px-4 rounded-[6px] text-[12px] font-medium transition-colors"
              style="background: var(--surface-2); color: var(--text-secondary); border: 1px solid var(--border-default);"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="h-[32px] px-4 rounded-[6px] text-[12px] font-medium transition-colors"
              style="background: var(--accent-base); color: var(--surface-0); border: none;"
            >
              Publish
            </button>
          </div>
        </form>
      </div>
    {/if}

    <!-- Announcements List -->
    {#if announcements.length === 0}
      <div
        class="rounded-[8px] border flex flex-col items-center justify-center py-16 px-6"
        style="border-color: var(--border-default); background: var(--surface-1);"
      >
        <div
          class="h-12 w-12 rounded-full flex items-center justify-center mb-4"
          style="background: var(--surface-2);"
        >
          <Megaphone class="h-5 w-5" style="color: var(--text-tertiary);" strokeWidth={1.5} />
        </div>
        <p class="text-[14px] font-medium mb-1" style="color: var(--text-primary);">
          No announcements yet
        </p>
        <p class="text-[12px]" style="color: var(--text-tertiary);">
          Keep your miners informed.
        </p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each announcements as ann}
          {@const cfg = typeConfig[ann.type] ?? typeConfig.update}
          <div
            class="rounded-[8px] border p-4 group"
            style="border-color: var(--border-default); background: var(--surface-1);"
          >
            <div class="flex items-start gap-3">
              <div
                class="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style="background: {cfg.bg};"
              >
                <Megaphone class="h-3.5 w-3.5" style="color: {cfg.color};" strokeWidth={1.5} />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-[3px]"
                    style="background: {cfg.bg}; color: {cfg.color};"
                  >
                    {cfg.label}
                  </span>
                  <span class="text-[11px]" style="color: var(--text-tertiary);">
                    {new Date(ann.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h3 class="text-[14px] font-semibold mb-1" style="color: var(--text-primary);">
                  {ann.title}
                </h3>
                <p class="text-[12px] leading-relaxed whitespace-pre-wrap" style="color: var(--text-secondary);">
                  {ann.content}
                </p>
              </div>
              <button
                onclick={() => handleDelete(ann.id)}
                class="h-7 w-7 flex items-center justify-center rounded-[5px] opacity-0 group-hover:opacity-100 transition-all"
                style="background: var(--surface-2); border: none; cursor: pointer;"
                title="Delete announcement"
              >
                <Trash2 class="h-3.5 w-3.5" style="color: var(--error);" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
