<script>
  import { page } from '$app/stores';
  import { backendState, backend } from '$lib/stores/backend';
  import { getAppIcon } from '$lib/app-icon';
  import { ArrowLeft, Rocket, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight, Circle } from 'lucide-svelte';

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const statusStyles = {
    building: { color: 'var(--info)', bg: 'rgba(110,159,255,0.12)' },
    deploying: { color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)' },
    live: { color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
    failed: { color: 'var(--error)', bg: 'rgba(239,68,68,0.12)' },
    rolled_back: { color: 'var(--text-tertiary)', bg: 'var(--surface-3)' },
  };

  const stepDotColor = {
    completed: 'var(--success)',
    running: 'var(--warning)',
    failed: 'var(--error)',
    pending: 'var(--text-tertiary)',
  };

  const id = $derived($page.params.id);
  const app = $derived($backendState.apps.find((a) => a.id === id) ?? null);
  const logs = $derived(backend.listDeploymentLogs(id));
  const iconSrc = $derived(
    getAppIcon({ id: id, name: app?.name ?? '', icon: app?.icon, category: app?.category })
  );

  let showForm = $state(false);
  let version = $state('');
  let expandedId = $state(null);

  function handleDeploy() {
    const v = version.trim();
    if (!v) return;
    try {
      const log = backend.triggerDeployment(id, v);
      version = '';
      showForm = false;
      expandedId = log.id;
    } catch (e) {
      // deploy failed
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') handleDeploy();
  }
</script>

<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12" style="max-width: 860px; margin: 0 auto;">
  <a href="/develop/apps/{id}" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4">
    <ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to Project
  </a>

  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-4">
      {#if app}
        <img src={iconSrc} alt="" class="w-10 h-10 rounded-[8px]" />
      {/if}
      <div>
        <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Deployments</h1>
        <p class="text-[12px] text-[var(--text-secondary)]">{app?.name ?? id}</p>
      </div>
    </div>
    <button
      type="button"
      class="h-[32px] px-3 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors"
      style="background: var(--accent-base); color: var(--surface-0); border: none; cursor: pointer;"
      onclick={() => { showForm = !showForm; }}
    >
      <Rocket class="h-3.5 w-3.5" /> Deploy New Version
    </button>
  </div>

  <!-- Deploy form -->
  {#if showForm}
    <div class="p-4 rounded-[8px] mb-6" style="border: 1px solid var(--text-accent); background: var(--accent-subtle);">
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={version}
          placeholder="e.g. v1.3.0"
          class="flex-1 h-9 px-3 rounded-[5px] text-[13px] font-mono outline-none"
          style="background: var(--surface-0); border: 1px solid var(--border-default); color: var(--text-primary);"
          onkeydown={handleKeydown}
        />
        <button
          type="button"
          class="h-9 px-4 rounded-[5px] text-[12px] font-medium"
          style="background: var(--accent-base); color: var(--surface-0); border: none; cursor: pointer;"
          onclick={handleDeploy}
        >Deploy</button>
        <button
          type="button"
          class="h-9 px-3 rounded-[5px] text-[12px] font-medium"
          style="background: var(--surface-2); color: var(--text-secondary); border: 1px solid var(--border-default); cursor: pointer;"
          onclick={() => { showForm = false; }}
        >Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Deployment list -->
  {#if logs.length === 0}
    <div class="p-12 rounded-[8px] text-center" style="background: var(--surface-1); border: 1px solid var(--border-default);">
      <Rocket class="h-8 w-8 mx-auto mb-3" style="color: var(--text-tertiary);" strokeWidth={1} />
      <p class="text-[14px] font-semibold mb-1" style="color: var(--text-primary);">No deployments yet</p>
      <p class="text-[13px]" style="color: var(--text-secondary);">Deploy your first version to see the pipeline here.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each logs as log}
        {@const isExpanded = expandedId === log.id}
        {@const sc = statusStyles[log.status] ?? statusStyles.failed}
        <div class="rounded-[8px] overflow-hidden" style="border: 1px solid var(--border-default); background: var(--surface-1);">
          <button
            type="button"
            onclick={() => { expandedId = isExpanded ? null : log.id; }}
            class="w-full text-left p-4 hover:bg-[var(--surface-2)] transition-colors"
            style="background: transparent; border: none; cursor: pointer;"
          >
            <div class="flex items-center gap-3">
              <span class="text-[13px] font-mono font-semibold" style="color: var(--text-primary);">{log.version}</span>
              <span class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-[3px]" style="background: {sc.bg}; color: {sc.color};">
                {log.status.replace('_', ' ')}
              </span>
              <div class="flex-1"></div>
              <span class="text-[11px] font-mono" style="color: var(--text-tertiary);">{log.triggeredBy.slice(0, 6)}...{log.triggeredBy.slice(-4)}</span>
              <span class="text-[10px]" style="color: var(--text-tertiary);">{timeAgo(log.startedAt)}</span>
              {#if isExpanded}
                <ChevronDown class="h-3.5 w-3.5" style="color: var(--text-tertiary);" />
              {:else}
                <ChevronRight class="h-3.5 w-3.5" style="color: var(--text-tertiary);" />
              {/if}
            </div>
          </button>

          {#if isExpanded}
            <div class="p-4" style="border-top: 1px solid var(--border-default);">
              <div class="space-y-0 relative">
                <!-- Vertical line -->
                <div class="absolute left-[7px] top-3 bottom-3 w-px" style="background: var(--border-default);"></div>

                {#each log.steps as step}
                  {@const dotColor = stepDotColor[step.status] ?? stepDotColor.pending}
                  <div class="flex gap-3 pb-4 last:pb-0 relative">
                    <div class="flex-shrink-0 w-[15px] flex justify-center z-10">
                      {#if step.status === 'completed'}
                        <CheckCircle2 class="h-[15px] w-[15px]" style="color: {dotColor};" strokeWidth={2} />
                      {:else if step.status === 'failed'}
                        <XCircle class="h-[15px] w-[15px]" style="color: {dotColor};" strokeWidth={2} />
                      {:else if step.status === 'running'}
                        <Clock class="h-[15px] w-[15px]" style="color: {dotColor};" strokeWidth={2} />
                      {:else}
                        <Circle class="h-[15px] w-[15px]" style="color: {dotColor};" strokeWidth={2} />
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-[12px] font-medium" style="color: var(--text-primary);">{step.name}</span>
                        <span class="text-[10px] capitalize" style="color: {dotColor};">{step.status}</span>
                      </div>
                      {#if step.logs.length > 0}
                        <pre class="text-[11px] font-mono p-2.5 overflow-x-auto leading-[18px] m-0 rounded-[4px]" style="color: var(--text-tertiary); background: var(--surface-0); border: 1px solid var(--border-default);">{step.logs.join('\n')}</pre>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
