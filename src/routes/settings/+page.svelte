<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { wallet, actor, showConnectModal, disconnectWallet } from '$lib/stores/wallet';
  import { User, Wallet as WalletIcon, Bell, Shield, LogOut, Plus, Trash2, Cpu } from 'lucide-svelte';

  let activeTab = $state('profile');
  let newWithdrawalAddress = $state('');

  const minerId = $derived($actor?.minerId ?? null);

  const savedWithdrawalAddresses = $derived.by(() => {
    if (!minerId) return [];
    try { return backend.listWithdrawalAddresses(minerId); } catch { return []; }
  });

  const hardwareDefaults = { cpuCores: 8, ramGb: 16, storageGb: 256, networkMbps: 50 };

  let hwCpuCores = $state(8);
  let hwCpuThreads = $state(0);
  let hwRamGb = $state(16);
  let hwGpuModel = $state('');
  let hwGpuVram = $state(0);
  let hwStorageGb = $state(256);
  let hwNetworkMbps = $state(50);

  $effect(() => {
    if (!minerId) return;
    const existing = backend.getHardwareProfile(minerId);
    if (existing) {
      hwCpuCores = existing.cpuCores ?? 8;
      hwCpuThreads = existing.cpuThreads ?? 0;
      hwRamGb = existing.ramGb ?? 16;
      hwGpuModel = existing.gpuModel ?? '';
      hwGpuVram = existing.gpuVram ?? 0;
      hwStorageGb = existing.storageGb ?? 256;
      hwNetworkMbps = existing.networkMbps ?? 50;
    }
  });

  function saveHardware() {
    if (!minerId) return;
    backend.upsertHardwareProfile({
      minerId,
      profile: {
        minerId,
        cpuCores: hwCpuCores,
        cpuThreads: hwCpuThreads || undefined,
        ramGb: hwRamGb,
        gpuModel: hwGpuModel || undefined,
        gpuVram: hwGpuVram || undefined,
        storageGb: hwStorageGb,
        networkMbps: hwNetworkMbps,
      }
    });
  }

  function addAddress() {
    const v = newWithdrawalAddress.trim();
    if (!v || !minerId) return;
    backend.addWithdrawalAddress({ minerId, walletAddress: v });
    newWithdrawalAddress = '';
  }

  function removeAddress(addr) {
    if (!minerId) return;
    backend.removeWithdrawalAddress({ minerId, walletAddress: addr });
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'wallet', label: 'Wallet & Assets', icon: WalletIcon },
    { id: 'hardware', label: 'My Hardware', icon: Cpu },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  // Notification toggles
  let notifGovernance = $state(true);
  let notifMining = $state(true);
  let notifRewards = $state(false);

  // Security toggles
  let sessionLock = $state(false);

  // Roles
  const roles = $derived($wallet ? backend.listRoles($wallet.address) : []);
  const hasGovernance = $derived(roles.includes('governance'));
  const hasOperator = $derived(roles.includes('operator'));
  const enrollment = $derived($wallet ? backend.getDeveloperEnrollment($wallet.address) : null);
  const enrollmentStatus = $derived(enrollment?.status ?? 'none');
</script>

<div class="animate-fadeIn px-6 pt-6 pb-12">
  <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-6">Account Settings</h1>

  <div class="flex flex-col md:flex-row gap-6">
    <!-- Sidebar Nav -->
    <div class="flex flex-col h-auto bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] space-y-0.5 w-full md:w-52 p-1.5">
      {#each tabs as tab}
        <button
          type="button"
          class="w-full flex items-center px-3 py-2 text-[13px] rounded-[5px] transition-colors"
          class:bg-[var(--accent-subtle)]={activeTab === tab.id}
          class:text-[var(--text-accent)]={activeTab === tab.id}
          class:text-[var(--text-secondary)]={activeTab !== tab.id}
          onclick={() => activeTab = tab.id}
        >
          <svelte:component this={tab.icon} class="h-4 w-4 mr-2.5" />
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Content Area -->
    <div class="flex-1">

      <!-- Profile Tab -->
      {#if activeTab === 'profile'}
        <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
          <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Public Profile</h2>
          <div class="flex items-center gap-5 mb-5">
            <div class="h-16 w-16 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--text-accent)] font-bold text-[20px]">
              N
            </div>
            <div>
              <button type="button" class="btn-secondary mb-1.5">Upload New Avatar</button>
              <p class="text-[11px] text-[var(--text-tertiary)]">JPG, GIF or PNG. Max size of 800K</p>
            </div>
          </div>

          <div class="grid gap-4">
            <div class="grid gap-1.5">
              <label class="text-[12px] font-medium text-[var(--text-secondary)]">Display Name</label>
              <input value="NecterUser_9382" class="h-8 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
            </div>
            <div class="grid gap-1.5">
              <label class="text-[12px] font-medium text-[var(--text-secondary)]">Email Address</label>
              <input value="user@example.com" class="h-8 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
            </div>
            <div class="grid gap-1.5">
              <label class="text-[12px] font-medium text-[var(--text-secondary)]">Bio</label>
              <input value="Building decentralized AI infrastructure." class="h-8 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
            </div>
          </div>

          <div class="mt-5 flex justify-end">
            <button type="button" class="btn-subscribe">Save Changes</button>
          </div>
        </div>
      {/if}

      <!-- Wallet Tab -->
      {#if activeTab === 'wallet'}
        <div class="space-y-5">
          <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
            <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Connected Wallets</h2>
            {#if $wallet}
              <div class="bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-[8px] flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
                  <div class="min-w-0">
                    <p class="font-mono text-[13px] text-[var(--text-primary)] truncate">{$wallet.address}</p>
                    <div class="flex items-center gap-2">
                      <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[11px] font-medium text-[var(--text-secondary)]">Primary</span>
                      <span class="text-[11px] text-[var(--text-tertiary)] font-mono">
                        Balance: {($backendState.walletBalancesByAddress[$wallet.address] ?? 0).toFixed(2)} NECTA
                      </span>
                    </div>
                  </div>
                </div>
                <button type="button" class="btn-secondary" style="color: var(--error)" onclick={disconnectWallet}>
                  <LogOut class="h-4 w-4 mr-1.5" />
                  Disconnect
                </button>
              </div>
            {:else}
              <div class="bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-[8px] flex items-center justify-between mb-4">
                <div>
                  <p class="text-[13px] font-medium text-[var(--text-primary)]">No wallet connected</p>
                  <p class="text-[12px] text-[var(--text-secondary)] mt-0.5">Connect to manage mining and withdrawals.</p>
                </div>
                <button type="button" class="btn-pill" onclick={() => $showConnectModal = true}>
                  <WalletIcon class="h-4 w-4 mr-1.5" />
                  Connect
                </button>
              </div>
            {/if}
          </div>

          <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
            <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Withdrawal Address Book</h2>
            <p class="text-[12px] text-[var(--text-secondary)] mb-4">
              Manage saved payout addresses here.
            </p>

            {#if !minerId}
              <div class="text-[13px] text-[var(--text-secondary)]">Connect a wallet to manage saved addresses.</div>
            {:else}
              <div class="space-y-3">
                <div class="flex gap-2">
                  <input
                    bind:value={newWithdrawalAddress}
                    placeholder="Add address (0x...)"
                    class="flex-1 h-8 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3 placeholder:text-[var(--text-tertiary)]"
                  />
                  <button type="button" class="btn-subscribe" onclick={addAddress}>
                    <Plus class="h-4 w-4" />
                    Add
                  </button>
                </div>
                <div class="space-y-1.5">
                  {#if savedWithdrawalAddresses.length === 0}
                    <div class="text-[13px] text-[var(--text-secondary)]">No saved addresses yet.</div>
                  {:else}
                    {#each savedWithdrawalAddresses as addr}
                      <div class="flex items-center justify-between p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]">
                        <div class="font-mono text-[12px] text-[var(--text-primary)] truncate">{addr}</div>
                        <button
                          type="button"
                          class="btn-secondary"
                          style="color: var(--error); width: 28px; padding: 0;"
                          onclick={() => removeAddress(addr)}
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Hardware Tab -->
      {#if activeTab === 'hardware'}
        <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">My Hardware</h2>
              <p class="text-[12px] text-[var(--text-secondary)]">
                Your saved hardware profile used for compatibility checks and earnings estimates.
              </p>
            </div>
            <a href="/mining/hardware-checker" class="btn-secondary">Open Compatibility Checker</a>
          </div>

          {#if !minerId}
            <div class="mt-4 bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-[8px] flex items-center justify-between">
              <div>
                <p class="text-[13px] font-medium text-[var(--text-primary)]">Connect a wallet to save hardware</p>
                <p class="text-[12px] text-[var(--text-secondary)] mt-0.5">Your hardware profile is stored per wallet.</p>
              </div>
              <button type="button" class="btn-pill" onclick={() => $showConnectModal = true}>
                <WalletIcon class="h-4 w-4 mr-1.5" />
                Connect
              </button>
            </div>
          {:else}
            <div class="mt-5 grid gap-4">
              <div class="grid gap-1.5">
                <label class="text-[12px] font-medium text-[var(--text-secondary)]">CPU Cores</label>
                <input type="number" bind:value={hwCpuCores} class="h-8 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
              </div>
              <div class="grid gap-1.5">
                <label class="text-[12px] font-medium text-[var(--text-secondary)]">CPU Threads (optional)</label>
                <input type="number" bind:value={hwCpuThreads} class="h-8 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
              </div>
              <div class="grid gap-1.5">
                <label class="text-[12px] font-medium text-[var(--text-secondary)]">RAM (GB)</label>
                <input type="number" bind:value={hwRamGb} class="h-8 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
              </div>
              <div class="grid gap-1.5">
                <label class="text-[12px] font-medium text-[var(--text-secondary)]">GPU Model (optional)</label>
                <input bind:value={hwGpuModel} placeholder="e.g. NVIDIA RTX 3080" class="h-8 text-[13px] rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3 placeholder:text-[var(--text-tertiary)]" />
              </div>
              <div class="grid gap-1.5">
                <label class="text-[12px] font-medium text-[var(--text-secondary)]">GPU VRAM (GB, optional)</label>
                <input type="number" bind:value={hwGpuVram} class="h-8 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
              </div>
              <div class="grid gap-1.5">
                <label class="text-[12px] font-medium text-[var(--text-secondary)]">Storage (GB)</label>
                <input type="number" bind:value={hwStorageGb} class="h-8 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
              </div>
              <div class="grid gap-1.5">
                <label class="text-[12px] font-medium text-[var(--text-secondary)]">Network (Mbps)</label>
                <input type="number" bind:value={hwNetworkMbps} class="h-8 text-[13px] font-mono rounded-[5px] bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3" />
              </div>
              <div class="pt-1 flex justify-end">
                <button type="button" class="btn-subscribe" onclick={saveHardware}>Save Hardware Profile</button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Notifications Tab -->
      {#if activeTab === 'notifications'}
        <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
          <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-5">Notification Preferences</h2>
          <div class="space-y-5">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <label class="text-[13px] text-[var(--text-primary)]">Governance Proposals</label>
                <p class="text-[12px] text-[var(--text-secondary)]">Receive updates about new DAO proposals</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" bind:checked={notifGovernance} class="sr-only peer" />
                <div class="w-9 h-5 bg-[var(--surface-3)] peer-checked:bg-[var(--accent-base)] rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <label class="text-[13px] text-[var(--text-primary)]">Mining Alerts</label>
                <p class="text-[12px] text-[var(--text-secondary)]">Get notified if your node goes offline</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" bind:checked={notifMining} class="sr-only peer" />
                <div class="w-9 h-5 bg-[var(--surface-3)] peer-checked:bg-[var(--accent-base)] rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <label class="text-[13px] text-[var(--text-primary)]">Reward Deposits</label>
                <p class="text-[12px] text-[var(--text-secondary)]">Daily summary of earned rewards</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" bind:checked={notifRewards} class="sr-only peer" />
                <div class="w-9 h-5 bg-[var(--surface-3)] peer-checked:bg-[var(--accent-base)] rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>
        </div>
      {/if}

      <!-- Security Tab -->
      {#if activeTab === 'security'}
        <div class="space-y-5">
          <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
            <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Security</h2>
            <p class="text-[12px] text-[var(--text-secondary)] mb-5">
              Prototype settings (replace with real auth, MFA, and device management in production).
            </p>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <label class="text-[13px] text-[var(--text-primary)]">Require wallet for sensitive actions</label>
                  <p class="text-[12px] text-[var(--text-secondary)]">Subscriptions, withdrawals, governance actions</p>
                </div>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-[rgba(76,183,130,0.12)] text-[11px] font-medium text-[var(--success)]">Enabled</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <label class="text-[13px] text-[var(--text-primary)]">Session lock</label>
                  <p class="text-[12px] text-[var(--text-secondary)]">Auto-lock UI after inactivity</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" bind:checked={sessionLock} class="sr-only peer" />
                  <div class="w-9 h-5 bg-[var(--surface-3)] peer-checked:bg-[var(--accent-base)] rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>
          </div>

          <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)]">
            <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Prototype Roles</h2>
            <p class="text-[12px] text-[var(--text-secondary)] mb-5">
              In production, roles come from on-chain state + verification.
            </p>

            {#if !$wallet}
              <div class="bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-[8px] flex items-center justify-between">
                <div>
                  <p class="text-[13px] font-medium text-[var(--text-primary)]">Connect a wallet to manage roles</p>
                  <p class="text-[12px] text-[var(--text-secondary)] mt-0.5">Roles are stored per wallet address.</p>
                </div>
                <button type="button" class="btn-pill" onclick={() => $showConnectModal = true}>
                  <WalletIcon class="h-4 w-4 mr-1.5" />
                  Connect
                </button>
              </div>
            {:else}
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <div class="space-y-0.5">
                    <label class="text-[13px] text-[var(--text-primary)]">Developer enrollment</label>
                    <p class="text-[12px] text-[var(--text-secondary)]">
                      Apply to access the Developer Portal. Status:
                      <span class="capitalize text-[var(--text-primary)] font-medium">
                        {enrollmentStatus === 'none' ? 'not enrolled' : enrollmentStatus}
                      </span>
                    </p>
                  </div>
                  <a href="/develop" class="btn-secondary">Open</a>
                </div>
                <div class="flex items-center justify-between">
                  <div class="space-y-0.5">
                    <label class="text-[13px] text-[var(--text-primary)]">Governance</label>
                    <p class="text-[12px] text-[var(--text-secondary)]">Create proposals, vote, and review listings.</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasGovernance}
                      onchange={(e) => backend.setRoleEnabled({ walletAddress: $wallet.address, role: 'governance', enabled: e.target.checked })}
                      class="sr-only peer"
                    />
                    <div class="w-9 h-5 bg-[var(--surface-3)] peer-checked:bg-[var(--accent-base)] rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
                <div class="flex items-center justify-between">
                  <div class="space-y-0.5">
                    <label class="text-[13px] text-[var(--text-primary)]">Operator</label>
                    <p class="text-[12px] text-[var(--text-secondary)]">Use fleet operations tooling inside Dev Portal.</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasOperator}
                      onchange={(e) => backend.setRoleEnabled({ walletAddress: $wallet.address, role: 'operator', enabled: e.target.checked })}
                      class="sr-only peer"
                    />
                    <div class="w-9 h-5 bg-[var(--surface-3)] peer-checked:bg-[var(--accent-base)] rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>
