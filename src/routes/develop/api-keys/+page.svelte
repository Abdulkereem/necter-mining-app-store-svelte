<script lang="ts">
  import { ArrowLeft, Copy, Check, Key, Code, BookOpen, Plus, Trash2, AlertTriangle, X } from 'lucide-svelte';
  import toast from 'svelte-french-toast';
  import { hub } from '$lib/api/hub';
  import { errorMessage } from '$lib/api/http';
  import { useQuery } from '$lib/api/query.svelte';
  import type { ApiKey, ApiScope } from '$lib/api/types';
  import { signedIn } from '$lib/stores/wallet';
  import { RPC_URL } from '$lib/config';
  import { formatDate, timeAgo, shortHex } from '$lib/format';
  import SignInGate from '$lib/components/common/SignInGate.svelte';
  import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import { Modal } from '$lib/components/ui';

  const SCOPES: { id: ApiScope; label: string; desc: string }[] = [
    { id: 'tasks:submit', label: 'tasks:submit', desc: 'Submit tasks to your projects' },
    { id: 'projects:read', label: 'projects:read', desc: 'Read your projects, versions and simulations' },
    { id: 'projects:write', label: 'projects:write', desc: 'Publish versions, assets, announcements' },
    { id: 'modules:write', label: 'modules:write', desc: 'Upload .hbc worker modules' },
    { id: 'analytics:read', label: 'analytics:read', desc: 'Analytics, health, revenue, proofs' },
  ];
  const EXPIRY = [
    { id: 'never', label: 'Never', days: 0 },
    { id: '30', label: '30 days', days: 30 },
    { id: '90', label: '90 days', days: 90 },
    { id: '365', label: '1 year', days: 365 },
  ];

  const keysQ = useQuery(() => hub.apiKeys(), { enabled: () => $signedIn });
  const projectsQ = useQuery(() => hub.myProjects(), { enabled: () => $signedIn });
  const keys = $derived(keysQ.data?.items ?? []);
  const projects = $derived(projectsQ.data?.items ?? []);

  // ── Create ──
  let showForm = $state(false);
  let name = $state('');
  let scopes = $state<ApiScope[]>(['tasks:submit']);
  let projectIds = $state<string[]>([]);
  let expiry = $state('never');
  let creating = $state(false);

  // The secret lives only in this component state until the modal is closed; it is never persisted.
  let secret = $state<string | null>(null);
  let secretOpen = $state(false);
  let copied = $state(false);

  const canCreate = $derived(name.trim().length > 0 && name.length <= 64 && scopes.length > 0);

  function toggleScope(s: ApiScope) {
    scopes = scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s];
  }
  function toggleProject(id: string) {
    projectIds = projectIds.includes(id) ? projectIds.filter((x) => x !== id) : [...projectIds, id];
  }

  async function create() {
    if (!canCreate) return;
    creating = true;
    try {
      const days = EXPIRY.find((e) => e.id === expiry)?.days ?? 0;
      const res = await hub.createApiKey({
        name: name.trim(),
        scopes,
        ...(projectIds.length ? { project_ids: projectIds } : {}),
        expires_at: days ? Math.floor(Date.now() / 1000) + days * 86400 : null,
      });
      secret = res.secret;
      secretOpen = true;
      copied = false;
      showForm = false;
      name = '';
      scopes = ['tasks:submit'];
      projectIds = [];
      expiry = 'never';
      await keysQ.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      creating = false;
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      copied = true;
    } catch {
      toast.error('Clipboard unavailable. Select the key and copy it manually.');
    }
  }

  function closeSecret() {
    secret = null;
    secretOpen = false;
  }

  // ── Revoke ──
  let revoking = $state<string | null>(null);
  let confirmRevoke = $state<ApiKey | null>(null);
  let confirmOpen = $state(false);

  async function revoke(k: ApiKey) {
    revoking = k.key_id;
    try {
      await hub.revokeApiKey(k.key_id);
      toast.success('Key revoked');
      confirmOpen = false;
      confirmRevoke = null;
      await keysQ.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      revoking = null;
    }
  }

  function projectName(id: string) {
    return projects.find((p) => p.project_id === id)?.name ?? shortHex(id);
  }

  // ── Quickstart ──
  const exampleProject = $derived(projects[0]?.project_id ?? '<project_id>');
  const curlCode = $derived(`curl -X POST '${RPC_URL}/v1/projects/${exampleProject}/tasks?wait=30' \\
  -H 'Authorization: Bearer $NECTER_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"function": "<function>", "input": {"a": 2, "b": 3}}'`);
  const jsCode = $derived(`const res = await fetch(
  '${RPC_URL}/v1/projects/${exampleProject}/tasks?wait=30',
  {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${process.env.NECTER_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ function: '<function>', input: { a: 2, b: 3 } }),
  },
);
const task = await res.json();
// 200: final result in task.output; 202: poll GET /v1/tasks/{task_id}?wait=30
console.log(task.status, task.output);`);

  const endpoints = [
    { method: 'POST', path: '/v1/projects/{id}/tasks', scope: 'tasks:submit', description: 'Submit a task to the project committee; ?wait= blocks until final' },
    { method: 'GET', path: '/v1/tasks/{task_id}', scope: '—', description: 'Task state, output and receipt' },
    { method: 'POST', path: '/v1/modules', scope: 'modules:write', description: 'Upload a .hbc worker module (base64)' },
    { method: 'GET', path: '/v1/developers/me/projects', scope: 'projects:read', description: 'Your projects in every listing status' },
    { method: 'POST', path: '/v1/developers/projects/{id}/simulations', scope: 'projects:write', description: 'Run up to 10 sample tasks on validators' },
    { method: 'GET', path: '/v1/developers/projects/{id}/analytics', scope: 'analytics:read', description: 'Tasks, miners, rewards and finality metrics' },
  ];

  let activeTab = $state<'curl' | 'javascript'>('curl');
</script>

<svelte:head>
  <title>API Keys — Necter Mining App Store</title>
</svelte:head>

<SignInGate title="API keys" description="Sign in with your developer wallet to create and manage API keys." illustration="security">
<div class="min-h-screen animate-fadeIn" style="background: var(--surface-0);">
  <div style="max-width: 860px; margin: 0 auto;" class="px-4 md:px-6 pt-4 md:pt-6 pb-12">
    <!-- Header -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
      <a
        href="/develop"
        style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 5px; text-decoration: none;"
        class="hover:bg-[var(--surface-2)] transition-colors"
      >
        <ArrowLeft style="width: 16px; height: 16px; color: var(--text-tertiary);" strokeWidth={1.5} />
      </a>
      <div style="flex: 1;">
        <h1 style="font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); margin: 0;">
          API Keys & SDK
        </h1>
        <p style="font-size: 12px; color: var(--text-tertiary); margin: 2px 0 0;">
          Manage your API credentials and submit tasks to your projects
        </p>
      </div>
      <button type="button" class="btn-subscribe" onclick={() => { showForm = !showForm; }}>
        <Plus size={12} strokeWidth={2} /> New Key
      </button>
    </div>

    <!-- API Key Section -->
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <Key style="width: 16px; height: 16px; color: var(--text-accent);" strokeWidth={1.5} />
        <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">Testnet API Keys</h2>
      </div>
      <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px;">
        Keys authenticate server-side requests as Bearer tokens. Keep them secret and never expose them in client-side code. The full key is shown once, when you create it.
      </p>

      {#if showForm}
        <div style="background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 6px; padding: 14px; margin-bottom: 16px;" class="flex flex-col gap-3">
          <div>
            <label for="ak-name" style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">Name</label>
            <input id="ak-name" class="n-input" maxlength="64" bind:value={name} placeholder="e.g. production backend" />
          </div>
          <div>
            <span style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">Scopes</span>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {#each SCOPES as s (s.id)}
                {@const on = scopes.includes(s.id)}
                <button
                  type="button"
                  onclick={() => toggleScope(s.id)}
                  class="text-left px-3 py-2 rounded-[5px] cursor-pointer"
                  style="border: 1px solid {on ? 'var(--border-accent)' : 'var(--border-default)'}; background: {on ? 'var(--accent-subtle)' : 'var(--surface-2)'};"
                >
                  <span class="block text-[12px] font-mono font-semibold" style="color: {on ? 'var(--text-accent)' : 'var(--text-primary)'}">{s.label}</span>
                  <span class="block text-[11px]" style="color: var(--text-tertiary)">{s.desc}</span>
                </button>
              {/each}
            </div>
          </div>
          {#if projects.length > 0}
            <div>
              <span style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">Projects <span style="text-transform:none;font-weight:400">(none selected = all your projects)</span></span>
              <div class="flex flex-wrap gap-1.5">
                {#each projects as p (p.project_id)}
                  {@const on = projectIds.includes(p.project_id)}
                  <button
                    type="button"
                    onclick={() => toggleProject(p.project_id)}
                    class="h-[28px] px-3 rounded-[5px] text-[12px] font-medium cursor-pointer"
                    style="border: 1px solid {on ? 'var(--border-accent)' : 'var(--border-default)'}; background: {on ? 'var(--accent-subtle)' : 'var(--surface-2)'}; color: {on ? 'var(--text-accent)' : 'var(--text-secondary)'};"
                  >{p.name}</button>
                {/each}
              </div>
            </div>
          {/if}
          <div>
            <span style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">Expires</span>
            <div class="flex flex-wrap gap-1.5">
              {#each EXPIRY as e (e.id)}
                <button
                  type="button"
                  onclick={() => { expiry = e.id; }}
                  class="h-[28px] px-3 rounded-[5px] text-[12px] font-medium cursor-pointer"
                  style="border: 1px solid {expiry === e.id ? 'var(--border-accent)' : 'var(--border-default)'}; background: {expiry === e.id ? 'var(--accent-subtle)' : 'var(--surface-2)'}; color: {expiry === e.id ? 'var(--text-accent)' : 'var(--text-secondary)'};"
                >{e.label}</button>
              {/each}
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary" onclick={() => { showForm = false; }}>Cancel</button>
            <button type="button" class="btn-subscribe" disabled={!canCreate || creating} onclick={create}>
              {creating ? 'Creating…' : 'Create Key'}
            </button>
          </div>
        </div>
      {/if}

      {#if keysQ.loading && !keysQ.data}
        <LoadingBlock rows={2} height="52px" />
      {:else if keysQ.error}
        <ErrorState error={keysQ.error} retry={keysQ.refresh} compact />
      {:else if keys.length === 0}
        <EmptyState compact illustration="security" title="No API keys yet" description="Create a key to submit tasks to your projects from your own servers.">
          <button type="button" class="btn-subscribe" onclick={() => { showForm = true; }}><Plus size={12} strokeWidth={2} /> New Key</button>
        </EmptyState>
      {:else}
        <div style="border: 1px solid var(--border-default); border-radius: 6px; overflow: hidden;">
          {#each keys as k, idx (k.key_id)}
            {@const expired = !!k.expires_at && k.expires_at * 1000 < Date.now()}
            <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--surface-0); {idx > 0 ? 'border-top: 1px solid var(--border-default);' : ''}">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">{k.name}</span>
                  <code style="font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary);">{k.prefix}…</code>
                  {#if expired}
                    <span style="font-size: 10px; font-weight: 500; padding: 1px 6px; border-radius: 3px; background: rgba(235,87,87,0.12); color: var(--error);">Expired</span>
                  {/if}
                </div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                  {#each k.scopes as s}
                    <span style="font-size: 10px; font-family: var(--font-mono); padding: 1px 6px; border-radius: 3px; background: var(--surface-3); color: var(--text-secondary);">{s}</span>
                  {/each}
                  {#each k.project_ids ?? [] as pid}
                    <span style="font-size: 10px; padding: 1px 6px; border-radius: 3px; background: var(--accent-subtle); color: var(--text-accent);">{projectName(pid)}</span>
                  {/each}
                </div>
                <span style="font-size: 11px; color: var(--text-tertiary); display: block; margin-top: 4px;">
                  Created {formatDate(k.created_at)} · {k.last_used_at ? `last used ${timeAgo(k.last_used_at)}` : 'never used'}{k.expires_at ? ` · expires ${formatDate(k.expires_at)}` : ''}
                </span>
              </div>
              <button
                type="button"
                disabled={revoking === k.key_id}
                onclick={() => { confirmRevoke = k; confirmOpen = true; }}
                style="display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-2); cursor: pointer; color: var(--error); font-size: 12px; font-weight: 500; flex-shrink: 0;"
              >
                <Trash2 size={12} strokeWidth={1.5} />
                Revoke
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Quickstart -->
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <Code style="width: 16px; height: 16px; color: var(--text-accent);" strokeWidth={1.5} />
        <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">Quickstart</h2>
      </div>
      <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px;">
        Submit a task to your project. The committee executes it and the result is final once validators confirm the round.
      </p>

      <div style="display: flex; gap: 0; margin-bottom: 0;">
        {#each [{ id: 'curl', label: 'curl' }, { id: 'javascript', label: 'JavaScript' }] as const as tab}
          <button
            onclick={() => { activeTab = tab.id; }}
            style="height: 32px; padding: 0 14px; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 500; border: 1px solid var(--border-default); border-bottom: {activeTab === tab.id ? '1px solid var(--surface-0)' : '1px solid var(--border-default)'}; background: {activeTab === tab.id ? 'var(--surface-0)' : 'var(--surface-2)'}; color: {activeTab === tab.id ? 'var(--text-accent)' : 'var(--text-secondary)'}; cursor: pointer; margin-bottom: -1px; position: relative; z-index: {activeTab === tab.id ? 1 : 0};"
          >
            {tab.label}
          </button>
        {/each}
      </div>
      <div style="background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 0 6px 6px 6px; padding: 16px; overflow: auto;">
        <pre style="font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); line-height: 20px; margin: 0; white-space: pre;">{activeTab === 'curl' ? curlCode : jsCode}</pre>
      </div>
    </div>

    <!-- Endpoint Reference -->
    <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <BookOpen style="width: 16px; height: 16px; color: var(--text-accent);" strokeWidth={1.5} />
        <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">Endpoint Reference</h2>
      </div>
      <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px;">
        Base URL: <code style="font-family: var(--font-mono); color: var(--text-secondary);">{RPC_URL}</code>
      </p>

      <div style="border: 1px solid var(--border-default); border-radius: 6px; overflow-x: auto;">
        <div style="min-width: 620px;">
          <div style="display: grid; grid-template-columns: 70px 300px 110px 1fr; background: var(--surface-2); border-bottom: 1px solid var(--border-default); padding: 8px 14px;">
            {#each ['Method', 'Endpoint', 'Scope', 'Description'] as h}
              <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em;">{h}</span>
            {/each}
          </div>
          {#each endpoints as ep, idx}
            <div style="display: grid; grid-template-columns: 70px 300px 110px 1fr; padding: 10px 14px; {idx < endpoints.length - 1 ? 'border-bottom: 1px solid var(--border-default);' : ''} align-items: center;">
              <span style="font-size: 11px; font-weight: 600; font-family: var(--font-mono); color: {ep.method === 'POST' ? 'var(--text-accent)' : 'var(--success)'}; background: {ep.method === 'POST' ? 'var(--accent-subtle)' : 'rgba(76,183,130,0.12)'}; padding: 2px 6px; border-radius: 3px; width: fit-content;">
                {ep.method}
              </span>
              <code style="font-size: 12px; font-family: var(--font-mono); color: var(--text-primary);">{ep.path}</code>
              <code style="font-size: 11px; font-family: var(--font-mono); color: var(--text-tertiary);">{ep.scope}</code>
              <span style="font-size: 12px; color: var(--text-secondary);">{ep.description}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
</SignInGate>

<!-- Secret, shown once -->
<Modal bind:open={secretOpen} onClose={closeSecret} maxWidth="520px">
  <div style="padding: 20px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0;">Your new API key</h3>
      <button type="button" onclick={closeSecret} style="background: transparent; border: none; cursor: pointer; color: var(--text-tertiary);" aria-label="Close"><X size={14} /></button>
    </div>
    <div style="display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 6px; background: rgba(242,153,74,0.08); border: 1px solid rgba(242,153,74,0.25); margin-bottom: 12px;">
      <AlertTriangle size={14} strokeWidth={1.5} style="color: var(--warning); flex-shrink: 0; margin-top: 2px;" />
      <span style="font-size: 12px; color: var(--text-primary); line-height: 18px;">
        Copy this key now. It is shown only once; the Hub stores only its hash. If you lose it, revoke it and create a new one.
      </span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 6px; padding: 10px 14px;">
      <code style="flex: 1; font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); word-break: break-all; user-select: all;">{secret ?? ''}</code>
      <button
        type="button"
        onclick={copySecret}
        style="display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-2); cursor: pointer; color: var(--text-secondary); font-size: 12px; font-weight: 500; flex-shrink: 0;"
      >
        {#if copied}<Check size={12} strokeWidth={2} style="color: var(--success);" /> Copied{:else}<Copy size={12} strokeWidth={1.5} /> Copy{/if}
      </button>
    </div>
    <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
      <button type="button" class="btn-subscribe" onclick={closeSecret}>I've saved it</button>
    </div>
  </div>
</Modal>

<!-- Revoke confirmation -->
<Modal bind:open={confirmOpen} onClose={() => { confirmRevoke = null; }} maxWidth="420px">
  <div style="padding: 20px;">
    <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px;">Revoke “{confirmRevoke?.name}”?</h3>
    <p style="font-size: 12px; color: var(--text-secondary); line-height: 18px; margin: 0 0 16px;">
      Requests using <code style="font-family: var(--font-mono);">{confirmRevoke?.prefix}…</code> will be rejected immediately. This cannot be undone.
    </p>
    <div style="display: flex; justify-content: flex-end; gap: 8px;">
      <button type="button" class="btn-secondary" onclick={() => { confirmOpen = false; confirmRevoke = null; }}>Cancel</button>
      <button
        type="button"
        class="btn-subscribe"
        style="background: var(--error); color: #fff;"
        disabled={!confirmRevoke || revoking === confirmRevoke?.key_id}
        onclick={() => confirmRevoke && revoke(confirmRevoke)}
      >
        {revoking ? 'Revoking…' : 'Revoke key'}
      </button>
    </div>
  </div>
</Modal>
