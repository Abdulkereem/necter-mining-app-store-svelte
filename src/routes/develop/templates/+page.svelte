<script lang="ts">
  import { ArrowLeft, Code, Terminal, FileCode, BookOpen } from 'lucide-svelte';
  import { HIVEKIT_TEMPLATES } from '$lib/develop/templates';
  import CopyText from '$lib/components/common/CopyText.svelte';

  const steps = [
    { n: 1, title: 'Write a worker', body: 'Export deterministic functions with HiveKit. Committee workers must be stateless: no storage or hive.call imports.' },
    { n: 2, title: 'Build a .hbc', body: 'hivec packages module.wasm and its manifest into a content-addressed .hbc artifact.' },
    { n: 3, title: 'Upload and publish', body: 'Upload the .hbc in the project wizard, choose the functions miners run, set economics and sign the manifest.' },
  ];
</script>

<svelte:head>
  <title>HiveKit Templates — Necter Mining App Store</title>
</svelte:head>

<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12">
  <div style="max-width:900px;margin:0 auto">
    <!-- Back link -->
    <a
      href="/develop"
      class="btn-secondary"
      style="margin-bottom:16px;width:fit-content;text-decoration:none"
    >
      <ArrowLeft class="h-3 w-3" strokeWidth={1.5} style="margin-right:6px" />
      Back to Develop
    </a>

    <!-- Header -->
    <h1 style="font-size:20px;font-weight:600;color:var(--text-primary);letter-spacing:-0.015em;line-height:28px;margin:0">
      Templates & Starter Kits
    </h1>
    <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:20px">
      Every Necter project runs a HiveKit worker module. Pick an SDK, build a .hbc, then publish it from the project wizard.
    </p>

    <!-- How it works -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:20px">
      {#each steps as s (s.n)}
        <div style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:8px;padding:14px 16px">
          <span style="font-size:11px;font-weight:600;font-family:var(--font-mono);color:var(--text-accent)">0{s.n}</span>
          <p style="font-size:13px;font-weight:600;color:var(--text-primary);margin:4px 0 2px">{s.title}</p>
          <p style="font-size:12px;color:var(--text-secondary);line-height:18px;margin:0">{s.body}</p>
        </div>
      {/each}
    </div>

    <!-- Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:24px">
      {#each HIVEKIT_TEMPLATES as t (t.id)}
        <div
          id={t.id}
          class="tpl-card"
          style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:12px;scroll-margin-top:80px"
        >
          <!-- Top: Icon + Name + Badge -->
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:8px;background:var(--accent-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <Code size={16} strokeWidth={1.5} style="color:var(--text-accent)" />
            </div>
            <div style="flex:1;min-width:0">
              <p style="font-size:14px;font-weight:600;color:var(--text-primary);letter-spacing:-0.006em;line-height:20px;margin:0">{t.name}</p>
            </div>
            <span style="display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:3px;font-size:11px;font-weight:500;background:var(--surface-2);color:var(--text-secondary);flex-shrink:0">
              {t.language}
            </span>
          </div>

          <!-- Description -->
          <p style="font-size:12px;color:var(--text-secondary);line-height:18px;margin:0">{t.description}</p>

          <!-- Key specs -->
          <div style="display:flex;flex-direction:column;gap:8px;padding:10px 12px;background:var(--surface-2);border-radius:5px">
            {#each [
              { label: 'SDK', value: t.sdk, icon: FileCode },
              { label: 'Setup', value: t.install, icon: Terminal },
              { label: 'Build', value: t.build, icon: Terminal },
              { label: 'Example', value: t.example, icon: FileCode },
            ] as row}
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;min-width:0">
                <span style="font-size:11px;color:var(--text-tertiary);flex-shrink:0;display:inline-flex;align-items:center;gap:4px">
                  <row.icon size={11} strokeWidth={1.5} /> {row.label}
                </span>
                {#if row.label === 'Setup' || row.label === 'Build'}
                  <span style="min-width:0;overflow:hidden"><CopyText value={row.value} short={false} class="text-[11px] truncate" /></span>
                {:else}
                  <span style="font-size:11px;color:var(--text-secondary);font-family:var(--font-mono);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{row.value}</span>
                {/if}
              </div>
            {/each}
          </div>

          <!-- Footer -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:8px">
            <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary)">
              <BookOpen size={12} strokeWidth={1.5} />
              Docs
              <span style="font-size:10px;font-weight:500;padding:1px 6px;border-radius:3px;background:var(--surface-3);color:var(--text-secondary)">Coming soon</span>
            </span>
            <a href="/develop/create" class="btn-subscribe" style="text-decoration:none">
              Start Project
            </a>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .tpl-card {
    transition: border-color 100ms ease-out, transform 100ms ease-out;
  }
  .tpl-card:hover {
    border-color: var(--border-hover) !important;
    transform: translateY(-1px);
  }
</style>
