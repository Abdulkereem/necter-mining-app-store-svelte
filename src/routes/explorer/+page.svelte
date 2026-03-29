<script>
  import { backendState } from '$lib/stores/backend';
  import { minerAvatarDataUri } from '$lib/miner-avatar';

  /** @type {'apps' | 'jobs' | 'proofs' | 'payouts' | 'withdrawals' | 'events'} */
  let tab = $state('apps');

  const appsById = $derived(new Map($backendState.apps.map((a) => [a.id, a])));
  const tabs = ['apps', 'jobs', 'proofs', 'payouts', 'withdrawals', 'events'];

  function copyId(value) {
    navigator.clipboard.writeText(value).catch(() => {});
  }
</script>

<div class="min-h-screen">
  <div class="max-w-7xl mx-auto px-6 py-10 space-y-6">
    <!-- Header -->
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-[20px] font-semibold">Explorer</h1>
        <p class="text-[var(--text-secondary)] text-sm mt-1">
          Public-style views over apps, jobs, proofs, and payouts (prototype, backed by mock state).
        </p>
      </div>
      <div class="flex gap-2">
        <a href="/discover" class="btn-secondary">Browse apps</a>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="flex items-center gap-1 border-b border-[var(--border-default)]">
      {#each tabs as t}
        <button
          type="button"
          class="px-3 py-2 text-sm font-medium capitalize transition-colors duration-100"
          class:text-[var(--text-accent)]={tab === t}
          class:border-b-2={tab === t}
          class:border-[var(--text-accent)]={tab === t}
          class:text-[var(--text-secondary)]={tab !== t}
          onclick={() => (tab = t)}
        >
          {t}
        </button>
      {/each}
    </div>

    <!-- Apps tab -->
    {#if tab === 'apps'}
      <div class="grid md:grid-cols-2 gap-4">
        {#each $backendState.apps as a (a.id)}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="font-semibold truncate">{a.name}</div>
                <div class="text-xs text-[var(--text-secondary)] truncate">{a.developer}</div>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">{a.category}</span>
                  <span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]">Rep {a.reputationScore}</span>
                  <span class="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]">{a.rewardModel ?? '—'}</span>
                  <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">Miners {a.totalMiners.toLocaleString('en-US')}</span>
                </div>
              </div>
              <a href="/apps/{a.id}" class="btn-subscribe">View</a>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Jobs tab -->
    {#if tab === 'jobs'}
      <div class="space-y-3">
        {#each $backendState.jobs.slice(0, 100) as j (j.id)}
          {@const app = appsById.get(j.appId)}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium truncate">
                  Job <span class="font-mono">{j.id}</span> · {app?.name ?? `App ${j.appId}`}
                </div>
                <div class="text-xs text-[var(--text-secondary)] mt-1">
                  {j.status} · reward {j.reward.toFixed(4)} ·
                  <img src={minerAvatarDataUri(j.minerId)} alt="" class="inline-block w-[14px] h-[14px] rounded-[3px] align-text-bottom mr-0.5" />
                  miner {j.minerId}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onclick={() => copyId(j.id)} title="Copy job id">Copy</button>
                <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">{j.status}</span>
              </div>
            </div>
          </div>
        {/each}
        {#if $backendState.jobs.length === 0}
          <div class="text-sm text-[var(--text-secondary)]">No jobs yet.</div>
        {/if}
      </div>
    {/if}

    <!-- Proofs tab -->
    {#if tab === 'proofs'}
      <div class="space-y-3">
        {#each $backendState.proofs.slice(0, 100) as p (p.id)}
          {@const app = appsById.get(p.appId)}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium truncate">
                  Proof <span class="font-mono">{p.id}</span> · {app?.name ?? `App ${p.appId}`}
                </div>
                <div class="text-xs text-[var(--text-secondary)] mt-1">
                  {p.status} · reward {p.reward.toFixed(4)} ·
                  <img src={minerAvatarDataUri(p.minerId)} alt="" class="inline-block w-[14px] h-[14px] rounded-[3px] align-text-bottom mr-0.5" />
                  miner {p.minerId}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onclick={() => copyId(p.id)} title="Copy proof id">Copy</button>
                <span class="text-xs px-2 py-0.5 rounded"
                  class:bg-[var(--accent-subtle)]={p.status === 'verified'}
                  class:text-[var(--text-accent)]={p.status === 'verified'}
                  class:bg-[rgba(235,87,87,0.12)]={p.status === 'rejected'}
                  class:text-[var(--error)]={p.status === 'rejected'}
                  class:bg-[var(--surface-2)]={p.status !== 'verified' && p.status !== 'rejected'}
                >{p.status}</span>
              </div>
            </div>
          </div>
        {/each}
        {#if $backendState.proofs.length === 0}
          <div class="text-sm text-[var(--text-secondary)]">No proofs yet.</div>
        {/if}
      </div>
    {/if}

    <!-- Payouts tab -->
    {#if tab === 'payouts'}
      <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5 mb-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="font-semibold">Payouts ledger (prototype)</div>
            <div class="text-sm text-[var(--text-secondary)]">
              Reward splits (miner/developer/treasury) for verified proofs via JobEscrow. Top miners may receive a progressive pool bonus.
            </div>
          </div>
          <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">
            Treasury {Number($backendState.treasuryBalance ?? 0).toFixed(4)}
          </span>
        </div>
      </div>
      <div class="space-y-3">
        {#each ($backendState.payouts ?? []).slice(0, 100) as p (p.id)}
          {@const app = appsById.get(p.appId)}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium truncate">
                  Payout <span class="font-mono">{p.id}</span> · {app?.name ?? `App ${p.appId}`}
                </div>
                <div class="text-xs text-[var(--text-secondary)] mt-1">
                  gross {Number(p.gross).toFixed(4)} · miner {Number(p.minerAmount).toFixed(4)} · dev {Number(p.developerAmount).toFixed(4)} · treasury {Number(p.treasuryAmount).toFixed(4)}
                </div>
                <div class="text-xs text-[var(--text-secondary)] mt-1">
                  <img src={minerAvatarDataUri(p.minerId)} alt="" class="inline-block w-[14px] h-[14px] rounded-[3px] align-text-bottom mr-0.5" />
                  miner {p.minerId} · {new Date(p.createdAt).toLocaleString('en-US')}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onclick={() => copyId(p.id)} title="Copy payout id">Copy</button>
                <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)]">{Number(p.minerAmount).toFixed(4)}</span>
              </div>
            </div>
          </div>
        {/each}
        {#if ($backendState.payouts ?? []).length === 0}
          <div class="text-sm text-[var(--text-secondary)]">No payouts yet.</div>
        {/if}
      </div>
    {/if}

    <!-- Withdrawals tab -->
    {#if tab === 'withdrawals'}
      <div class="space-y-3">
        {#each $backendState.withdrawals.slice(0, 100) as w (w.id)}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium truncate">
                  Withdrawal <span class="font-mono">{w.id}</span>
                </div>
                <div class="text-xs text-[var(--text-secondary)] mt-1">
                  {w.status} · {w.amount.toFixed(4)} · fee {w.fee.toFixed(4)} ·
                  <img src={minerAvatarDataUri(w.minerId)} alt="" class="inline-block w-[14px] h-[14px] rounded-[3px] align-text-bottom mr-0.5" />
                  miner {w.minerId}
                </div>
                <div class="text-xs text-[var(--text-secondary)] mt-1 font-mono truncate">{w.walletAddress}</div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onclick={() => copyId(w.id)} title="Copy withdrawal id">Copy</button>
                <span class="text-xs px-2 py-0.5 rounded"
                  class:bg-[var(--accent-subtle)]={w.status === 'completed'}
                  class:text-[var(--text-accent)]={w.status === 'completed'}
                  class:bg-[var(--surface-2)]={w.status !== 'completed'}
                >{w.status}</span>
              </div>
            </div>
          </div>
        {/each}
        {#if $backendState.withdrawals.length === 0}
          <div class="text-sm text-[var(--text-secondary)]">No withdrawals yet.</div>
        {/if}
      </div>
    {/if}

    <!-- Events tab -->
    {#if tab === 'events'}
      <div class="space-y-3">
        {#each $backendState.events.slice(0, 150) as e (e.id)}
          <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium truncate">{e.type}</div>
                <div class="text-xs text-[var(--text-secondary)] mt-1">{e.message}</div>
                <div class="text-xs text-[var(--text-secondary)] mt-2 font-mono truncate">
                  {e.createdAt} ·
                  {#if e.minerId}
                    <img src={minerAvatarDataUri(e.minerId)} alt="" class="inline-block w-[14px] h-[14px] rounded-[3px] align-text-bottom mr-0.5" />
                  {/if}
                  miner {e.minerId ?? 'N/A'} · app {e.appId ?? 'N/A'}
                </div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded border border-[var(--border-default)] whitespace-nowrap">{e.type}</span>
            </div>
          </div>
        {/each}
        {#if $backendState.events.length === 0}
          <div class="text-sm text-[var(--text-secondary)]">No events yet.</div>
        {/if}
      </div>
    {/if}
  </div>
</div>
