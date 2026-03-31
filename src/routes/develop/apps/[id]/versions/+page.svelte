<script>
  import { page } from '$app/stores';
  import { ArrowLeft, Package, Check } from 'lucide-svelte';

  const id = $derived($page.params.id);

  const mockVersions = [
    { version: 'v1.2.0', date: 'Mar 20, 2026', status: 'live', notes: 'Performance improvements, new proof verification algorithm' },
    { version: 'v1.1.0', date: 'Mar 5, 2026', status: 'archived', notes: 'Added GPU support, fixed memory leak in task runner' },
    { version: 'v1.0.1', date: 'Feb 18, 2026', status: 'archived', notes: 'Security patch for consensus mechanism' },
    { version: 'v1.0.0', date: 'Feb 1, 2026', status: 'archived', notes: 'Initial release' },
  ];
</script>

<div class="min-h-screen animate-fadeIn">
  <div class="px-4 md:px-6 pt-4 md:pt-6 pb-12">
    <div class="flex items-center gap-3 mb-6">
      <a
        href="/develop/apps/{id}"
        class="h-7 w-7 flex items-center justify-center rounded-[5px] hover:bg-[var(--surface-2)] transition-colors"
      >
        <ArrowLeft class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
      </a>
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)]">Version History</h1>
        <p class="text-[12px] text-[var(--text-tertiary)]">Deployment history and rollback</p>
      </div>
    </div>

    <div class="space-y-3">
      {#each mockVersions as v, i}
        <div class="rounded-[8px] p-4 flex items-start gap-4" style="border: 1px solid var(--border-default); background: var(--surface-1);">
          <div
            class="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
            style="background: {i === 0 ? 'var(--accent-subtle)' : 'var(--surface-3)'};"
          >
            {#if i === 0}
              <Check class="h-4 w-4" style="color: var(--text-accent);" strokeWidth={2} />
            {:else}
              <Package class="h-4 w-4" style="color: var(--text-tertiary);" strokeWidth={1.5} />
            {/if}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[13px] font-semibold font-mono" style="color: var(--text-primary);">{v.version}</span>
              {#if i === 0}
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px]" style="background: var(--accent-subtle); color: var(--text-accent);">Current</span>
              {/if}
            </div>
            <p class="text-[12px]" style="color: var(--text-secondary);">{v.notes}</p>
            <p class="text-[11px] mt-1" style="color: var(--text-tertiary);">{v.date}</p>
          </div>
          {#if i > 0}
            <button
              class="h-[28px] px-3 rounded-[5px] text-[11px] font-medium transition-colors"
              style="color: var(--text-secondary); background: var(--surface-2); border: 1px solid var(--border-default); cursor: pointer;"
            >
              Rollback
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
