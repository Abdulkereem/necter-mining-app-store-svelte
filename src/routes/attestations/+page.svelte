<script lang="ts">
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import { Shield, Clock, CheckCircle2 } from 'lucide-svelte';

  let tab = $state('pending');
  const tabs = ['pending', 'oracle', 'capabilities'];
  const tabLabels = { pending: 'Pending DAO review', oracle: 'AttestationOracle', capabilities: 'Miner capabilities' };

  const minerId = $derived($actor?.minerId ?? null);

  const pendingListings = $derived(
    $backendState.governance
      .filter((g) => ($backendState.listingStatusByAppId[g.appId] ?? 'draft') === 'pending_governance')
      .map((g) => ({ g, app: $backendState.apps.find((a) => a.id === g.appId) ?? null }))
      .filter((x) => x.app)
  );

  const oracleByAppId = $derived($backendState.attestationOracleByAppId ?? {});
  const oracleVerifiedCount = $derived(Object.values(oracleByAppId).filter((r) => r?.status === 'verified').length);
  const listedCount = $derived(Object.values($backendState.listingStatusByAppId).filter((s) => s === 'listed' || s === 'beta').length);
  const caps = $derived(minerId ? $backendState.attestationCapabilitiesByMinerId?.[minerId] ?? null : null);
</script>

<div class="min-h-screen pb-12">
  <!-- Page header -->
  <div class="border-b border-[var(--border-default)]">
    <div class="max-w-6xl mx-auto px-6 py-8">
      <div class="flex items-center gap-2 mb-2">
        <Shield class="h-5 w-5 text-[var(--text-accent)]" />
        <h1 class="text-[20px] font-semibold">Trust & Attestations</h1>
      </div>
      <p class="text-[var(--text-secondary)]">
        In this prototype, "attestations" show up as (1) DAO listing reviews and (2) code-hash submissions to the AttestationOracle.
      </p>
    </div>
  </div>

  <div class="max-w-6xl mx-auto px-6 py-8 space-y-6">
    <!-- Stats cards -->
    <div class="grid md:grid-cols-3 gap-4">
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex items-center justify-between">
          <div class="text-xs text-[var(--text-secondary)]">Pending listings</div>
          <span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]">{pendingListings.length}</span>
        </div>
        <div class="text-2xl font-bold mt-2">{pendingListings.length}</div>
        <div class="text-xs text-[var(--text-secondary)] mt-1">Apps awaiting DAO review</div>
      </div>
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex items-center justify-between">
          <div class="text-xs text-[var(--text-secondary)]">Listed apps</div>
          <span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]">{listedCount}</span>
        </div>
        <div class="text-2xl font-bold mt-2">{listedCount}</div>
        <div class="text-xs text-[var(--text-secondary)] mt-1">Live (listed + beta)</div>
      </div>
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
        <div class="flex items-center justify-between">
          <div class="text-xs text-[var(--text-secondary)]">Oracle verified</div>
          <span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]">{oracleVerifiedCount}</span>
        </div>
        <div class="text-2xl font-bold mt-2">{oracleVerifiedCount}</div>
        <div class="text-xs text-[var(--text-secondary)] mt-1">Apps with verified code-hash</div>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="flex items-center gap-1 border-b border-[var(--border-default)]">
      {#each tabs as t}
        <button
          type="button"
          class="px-3 py-2 text-sm font-medium transition-colors duration-100"
          class:text-[var(--text-accent)]={tab === t}
          class:border-b-2={tab === t}
          class:border-[var(--text-accent)]={tab === t}
          class:text-[var(--text-secondary)]={tab !== t}
          onclick={() => (tab = t)}
        >
          {(tabLabels as any)[t]}
        </button>
      {/each}
    </div>

    <!-- Pending DAO review -->
    {#if tab === 'pending'}
      <div class="space-y-3">
        {#if pendingListings.length === 0}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-6">
            <div class="font-semibold">No pending listings right now</div>
            <div class="text-sm text-[var(--text-secondary)] mt-1">When apps are submitted, they'll show up here and in Governance.</div>
            <div class="mt-4">
              <a href="/governance" class="btn-secondary">Open governance</a>
            </div>
          </div>
        {:else}
          {#each pendingListings as { app, g } (app?.id)}
            <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="font-semibold truncate">{app?.name}</div>
                  <div class="text-xs text-[var(--text-secondary)] mt-1">
                    {app?.developer} · {app?.category} · votes {g.yesVotes}/{g.requiredAttestations}
                  </div>
                  {#if g.voteEndsAt}
                    <div class="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-2">
                      <Clock class="h-3 w-3" /> ends {new Date(g.voteEndsAt).toLocaleTimeString('en-US')}
                    </div>
                  {/if}
                </div>
                <div class="flex gap-2">
                  <a href="/governance/review/{app?.id}" class="btn-subscribe">Review</a>
                  <a href="/apps/{app?.id}" class="btn-secondary">Public page</a>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    <!-- AttestationOracle -->
    {#if tab === 'oracle'}
      <div class="space-y-3">
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-6">
          <div class="font-semibold">AttestationOracle submissions</div>
          <div class="text-sm text-[var(--text-secondary)] mt-1">
            Developers submit a code hash / runtime measurement per app. In this demo it auto-verifies after ~5 seconds.
          </div>
        </div>
        {#if Object.keys(oracleByAppId).length === 0}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-6">
            <div class="text-sm text-[var(--text-secondary)]">
              No submissions yet. Open any developer app's <span class="font-mono">Attestation</span> tab to submit.
            </div>
            <div class="mt-4">
              <a href="/develop" class="btn-secondary">Go to developer apps</a>
            </div>
          </div>
        {:else}
          {#each Object.values(oracleByAppId).slice(0, 25) as r (r.appId)}
            {@const app = $backendState.apps.find((a) => a.id === r.appId) ?? null}
            <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="font-semibold truncate">{app?.name ?? r.appId}</div>
                  <div class="text-xs text-[var(--text-secondary)] mt-1 font-mono break-all">{r.codeHash ?? '—'}</div>
                  <div class="text-xs text-[var(--text-secondary)] mt-1">
                    status: <span class="capitalize">{r.status}</span> · submitted {r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-US') : '—'}
                  </div>
                </div>
                <div class="flex gap-2">
                  <span class="text-xs px-2 py-0.5 rounded capitalize"
                    class:bg-[var(--accent-subtle)]={r.status === 'verified'}
                    class:text-[var(--text-accent)]={r.status === 'verified'}
                    class:bg-[var(--surface-2)]={r.status === 'pending'}
                    class:border={r.status !== 'verified' && r.status !== 'pending'}
                    class:border-[var(--border-default)]={r.status !== 'verified' && r.status !== 'pending'}
                  >{r.status}</span>
                  {#if app}
                    <a href="/develop/apps/{app.id}/attestation" class="btn-secondary">Open</a>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    <!-- Miner capabilities -->
    {#if tab === 'capabilities'}
      <div class="space-y-3">
        {#if !$actor}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-6">
            <div class="flex items-center justify-between gap-4">
              <div>
                <div class="font-semibold">Connect wallet</div>
                <div class="text-sm text-[var(--text-secondary)] mt-1">We'll show your miner's attestation capabilities here.</div>
              </div>
              <button type="button" class="btn-pill" onclick={() => showConnectModal.set(true)}>Connect</button>
            </div>
          </div>
        {:else}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-6">
            <div class="font-semibold">Your miner attestation capabilities</div>
            <div class="text-sm text-[var(--text-secondary)] mt-2">
              Miner:
              <img src={minerAvatarDataUri(minerId!)} alt="" class="inline-block w-[16px] h-[16px] rounded-[3px] align-text-bottom mr-1" />
              <span class="font-mono">{minerId}</span>
            </div>
            <div class="mt-4 grid md:grid-cols-3 gap-4">
              {#each ['TPM', 'TEE', 'SGX'] as capName}
                {@const capKey = capName.toLowerCase()}
                {@const supported = (caps as any)?.[capKey] ?? false}
                <div class="rounded-lg border border-[var(--border-default)] p-4">
                  <div class="text-xs text-[var(--text-secondary)]">{capName}</div>
                  <div class="mt-2 flex items-center gap-2">
                    <CheckCircle2 class="h-4 w-4 {supported ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}" />
                    <span class="font-medium">{supported ? 'Supported' : 'Not detected'}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
