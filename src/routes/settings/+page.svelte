<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { wallet, actor, showConnectModal, disconnectWallet } from '$lib/stores/wallet';
  import { showToast, showError } from '$lib/stores/toast';
  import { minerAvatarDataUri } from '$lib/miner-avatar';
  import { badgeIconDataUri } from '$lib/badge-icon';
  import { getAppIcon } from '$lib/app-icon';
  import {
    User, Wallet as WalletIcon, Bell, Monitor, Award, Save, Upload, Copy,
    Key, ChevronRight, ChevronDown, Clock, Lock, ExternalLink, Download,
    AlertTriangle, Plus, Trash2, Cpu, Server, Laptop, HardDrive, Wifi,
    LogOut
  } from 'lucide-svelte';
  import { Button, Card, Input, Textarea, Toggle, Select } from '$lib/components/ui';

  /* ── Tab config ── */
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'devices', label: 'Devices', icon: Monitor },
    { id: 'wallet', label: 'Wallet', icon: WalletIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'badges', label: 'Badges', icon: Award },
  ];

  let activeTab = $state('profile');

  const minerId = $derived($actor?.minerId ?? null);
  const walletAddress = $derived($actor?.walletAddress ?? null);

  /* ── Device helpers ── */
  const typeIcons = { desktop: Monitor, server: Server, laptop: Laptop, custom: Cpu };
  const statusConfig = {
    online: { label: 'Online', color: 'var(--success)', dot: 'rgba(76,183,130,0.3)' },
    offline: { label: 'Offline', color: 'var(--text-tertiary)', dot: 'transparent' },
    idle: { label: 'Idle', color: 'var(--warning)', dot: 'rgba(242,153,74,0.3)' },
  };

  /* ── Badge kind meta ── */
  const badgeKindMeta = {
    milestone: { color: 'var(--text-accent)', bg: 'var(--accent-subtle)', label: 'Milestone' },
    performance: { color: 'var(--success)', bg: 'rgba(76,183,130,0.12)', label: 'Performance' },
    governance: { color: 'var(--info)', bg: 'rgba(110,159,255,0.12)', label: 'Governance' },
    community: { color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)', label: 'Community' },
  };

  /* ── Available badges ── */
  const availableBadges = [
    { name: 'First Proof Verified', description: 'Submit and verify your very first proof on the Necter network. Every miner\'s journey starts here', kind: 'milestone' },
    { name: '10 Proofs Verified', description: 'Verify 10 proofs across any combination of projects. Your node is warmed up', kind: 'milestone' },
    { name: 'Centurion', description: '100 verified proofs. Your hardware has proven it can handle real workloads', kind: 'milestone' },
    { name: 'Proof Machine', description: '1,000 verified proofs. You\'re generating consistent value for the projects you serve', kind: 'milestone' },
    { name: '10K Club', description: '10,000 lifetime proofs. Your node is a pillar of the Necter ecosystem', kind: 'milestone' },
    { name: 'First Payout', description: 'Your first NECTA hits your wallet. The loop from compute to reward is complete', kind: 'milestone' },
    { name: 'Diamond Hands', description: '1,000 NECTA earned. You\'ve mined through volatility and come out ahead', kind: 'milestone' },
    { name: 'Whale Miner', description: '10,000 NECTA lifetime earnings. Top 1% of all miners on Necter', kind: 'milestone' },
    { name: 'First Withdrawal', description: 'Move NECTA from your mining balance to your own wallet for the first time', kind: 'milestone' },
    { name: 'Hardware Upgraded', description: 'Update your hardware profile after upgrading your rig. The network notices', kind: 'milestone' },
    { name: 'Ironclad', description: '99.9% uptime for 30 straight days. Your node is more reliable than most cloud providers', kind: 'performance' },
    { name: 'Always On', description: '100% uptime for a full 7 days. Zero downtime, zero missed jobs, zero excuses', kind: 'performance' },
    { name: 'Top 10 Earner', description: 'Break into the top 10 earners on any project leaderboard. The hive knows your name', kind: 'performance' },
    { name: 'Efficiency King', description: '99.5%+ proof success rate over 500 submissions. Almost zero wasted compute cycles', kind: 'performance' },
    { name: 'Zero Slashing', description: 'Complete 500+ tasks with zero slashing events. Clean record, clean reputation', kind: 'performance' },
    { name: 'Reputation 90+', description: 'Push your miner reputation score above 90. Projects trust you with their best jobs', kind: 'performance' },
    { name: 'Early Adopter', description: 'Subscribe to a project within 48 hours of launch. First movers get the best rewards', kind: 'community' },
    { name: 'Network Hopper', description: 'Mine on 3+ networks at once. Your node splits its resources across the ecosystem', kind: 'community' },
    { name: 'Category Explorer', description: 'Mine across 4+ categories: AI, Storage, DePIN, IoT, Compute. Jack of all chains', kind: 'community' },
    { name: 'Pioneer', description: 'Among the first 50 miners on a newly launched project. You took the risk before the crowd', kind: 'community' },
    { name: 'Loyal Miner', description: '90+ consecutive days on one project. Loyalty builds reputation and unlocks higher tiers', kind: 'community' },
    { name: 'Fleet Commander', description: 'Operate 5+ mining nodes from a single operator account. You\'re running infrastructure', kind: 'community' },
    { name: 'Reviewer', description: 'Leave 5 honest reviews on projects you\'ve mined. Help other miners choose wisely', kind: 'community' },
    { name: 'Node Setup Complete', description: 'Run through the full node setup wizard and get your first node online and verified', kind: 'community' },
    { name: 'Network Creator', description: 'Deploy your first mining project on Necter. From config to live in one session', kind: 'community' },
    { name: 'First Miner Attracted', description: 'A real miner subscribes to your project for the first time. Your creation has demand', kind: 'community' },
    { name: '10 Miners Onboarded', description: '10 miners are now actively running proofs on your project. You\'ve built something real', kind: 'community' },
    { name: 'Payout Distributed', description: 'Your project distributes its first round of NECTA rewards to miners automatically', kind: 'community' },
    { name: 'Multi-Project Dev', description: 'Deploy and maintain 3+ live projects on Necter. You\'re building a mining empire', kind: 'community' },
    { name: '5-Star Project', description: 'Your project reaches a 4.5+ average rating from miners. Quality recognized by the community', kind: 'community' },
    { name: 'First Vote', description: 'Cast your first vote on a Necter governance proposal. Your stake, your voice', kind: 'governance' },
    { name: 'Active Citizen', description: 'Vote on 10+ proposals. You\'re shaping how the project evolves', kind: 'governance' },
    { name: 'Proposal Author', description: 'Draft a governance proposal that reaches quorum. You moved the conversation forward', kind: 'governance' },
    { name: 'DAO Reviewer', description: 'Review and vote on 3 project listing applications. You decide what gets into the store', kind: 'governance' },
    { name: 'Watchdog', description: 'Flag 3 projects for confirmed policy violations. You keep the ecosystem honest', kind: 'governance' },
  ];

  /* ═══════════════════════════════════════════════════ */
  /*  PROFILE TAB STATE                                  */
  /* ═══════════════════════════════════════════════════ */
  let displayName = $state('');
  let email = $state('');
  let bio = $state('');
  let website = $state('');
  let location = $state('');
  let founded = $state('');
  let category = $state('');
  let tagsStr = $state('');
  let twitter = $state('');
  let discord = $state('');
  let github = $state('');
  let telegram = $state('');
  let avatarPreview = $state(null);
  let saving = $state(false);

  const enrollment = $derived(walletAddress ? backend.getDeveloperEnrollment(walletAddress) : null);

  $effect(() => {
    if (!enrollment) return;
    displayName = enrollment.displayName ?? '';
    email = enrollment.email ?? '';
    bio = enrollment.bio ?? '';
    website = enrollment.website ?? '';
    location = enrollment.location ?? '';
    founded = enrollment.founded ?? '';
    category = enrollment.category ?? '';
    tagsStr = (enrollment.tags ?? []).join(', ');
    twitter = enrollment.socialLinks?.twitter ?? '';
    discord = enrollment.socialLinks?.discord ?? '';
    github = enrollment.socialLinks?.github ?? '';
    telegram = enrollment.socialLinks?.telegram ?? '';
  });

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { avatarPreview = reader.result; };
    reader.readAsDataURL(file);
  }

  function handleSaveProfile() {
    if (!walletAddress) return;
    saving = true;
    try {
      backend.saveDeveloperProfile({
        walletAddress,
        displayName,
        bio,
        website,
        location,
        founded,
        category,
        tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
        socialLinks: { twitter, discord, github, telegram },
      });
      showToast('Profile saved', 'Your profile has been updated.');
    } catch (err) {
      showError('Error', err?.message ?? 'Failed to save profile.');
    } finally {
      saving = false;
    }
  }

  const avatarSrc = $derived(avatarPreview || (minerId ? minerAvatarDataUri(minerId) : null));
  const initials = $derived(displayName ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?');

  /* ═══════════════════════════════════════════════════ */
  /*  DEVICES TAB STATE                                  */
  /* ═══════════════════════════════════════════════════ */
  let expandedDevice = $state(null);
  let editingName = $state(null);
  let editNameValue = $state('');
  let showAddDevice = $state(false);
  let newDeviceName = $state('');
  let newDeviceType = $state('desktop');

  const devices = $derived.by(() => {
    // force reactivity on state changes
    void $backendState.updatedAt;
    if (!minerId) return [];
    return backend.listDevices(minerId);
  });

  const onlineCount = $derived(devices.filter(d => d.status === 'online').length);
  const totalDeviceEarned = $derived(devices.reduce((sum, d) => sum + d.totalEarned, 0));
  const avgUptime = $derived(devices.length > 0 ? devices.reduce((sum, d) => sum + d.uptime, 0) / devices.length : 0);

  function addDevice() {
    if (!minerId || !newDeviceName.trim()) return;
    backend.addDevice({ minerId, name: newDeviceName.trim(), type: newDeviceType, hardware: {} });
    newDeviceName = '';
    showAddDevice = false;
    showToast('Device added');
  }

  function lastSeenText(device) {
    if (device.status === 'online') return 'Now';
    const sec = Math.floor((Date.now() - new Date(device.lastSeenAt).getTime()) / 1000);
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  /* ═══════════════════════════════════════════════════ */
  /*  WALLET TAB STATE                                   */
  /* ═══════════════════════════════════════════════════ */
  let newWithdrawalAddress = $state('');

  const savedWithdrawalAddresses = $derived.by(() => {
    void $backendState.updatedAt;
    if (!minerId) return [];
    try { return backend.listWithdrawalAddresses(minerId); } catch { return []; }
  });

  const minerWithdrawals = $derived.by(() => {
    if (!minerId) return [];
    return ($backendState.withdrawals ?? [])
      .filter(w => w.minerId === minerId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  });

  const recentWithdrawals = $derived(minerWithdrawals.slice(0, 5));

  const withdrawalStatusConfig = {
    completed: { label: 'Completed', color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
    pending: { label: 'Pending', color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)' },
    processing: { label: 'Processing', color: 'var(--info)', bg: 'rgba(110,159,255,0.12)' },
    failed: { label: 'Failed', color: 'var(--error)', bg: 'rgba(239,68,68,0.12)' },
  };

  function handleExportCsv() {
    if (minerWithdrawals.length === 0) return;
    const headers = ['Date', 'Type', 'Amount (NECTA)', 'Fee (NECTA)', 'Status', 'Wallet Address', 'Tx Hash'];
    const rows = minerWithdrawals.map(w => [
      new Date(w.requestedAt).toISOString(),
      'Withdrawal',
      w.amount.toFixed(4),
      w.fee.toFixed(4),
      w.status,
      w.walletAddress,
      w.txHash ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `necter-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported', `${minerWithdrawals.length} transaction${minerWithdrawals.length !== 1 ? 's' : ''} exported.`);
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

  /* ═══════════════════════════════════════════════════ */
  /*  NOTIFICATIONS TAB STATE                            */
  /* ═══════════════════════════════════════════════════ */
  const notifPrefs = [
    { title: 'Governance Proposals', desc: 'Receive updates about new DAO proposals', defaultOn: true },
    { title: 'Mining Alerts', desc: 'Get notified if your node goes offline', defaultOn: true },
    { title: 'Reward Deposits', desc: 'Daily summary of earned rewards', defaultOn: false },
    { title: 'App Updates', desc: 'When subscribed projects push new versions', defaultOn: true },
    { title: 'Badge Earned', desc: 'Notification when you unlock a new badge', defaultOn: true },
  ];

  let notifToggles = $state(notifPrefs.map(p => p.defaultOn));

  const subscribedApps = $derived.by(() => {
    if (!minerId) return [];
    const subs = ($backendState.subscriptions ?? []).filter(s => s.minerId === minerId);
    const appMap = new Map(($backendState.apps ?? []).map(a => [a.id, a]));
    return subs.map(s => appMap.get(s.appId)).filter(Boolean);
  });

  let deliveryMethod = $state('in-app');
  let quietFrom = $state('22:00');
  let quietTo = $state('07:00');

  /* ═══════════════════════════════════════════════════ */
  /*  BADGES TAB STATE                                   */
  /* ═══════════════════════════════════════════════════ */
  let filterKind = $state('all');

  const earnedBadges = $derived.by(() => {
    if (!minerId) return [];
    return backend.listBadges(minerId);
  });

  const earnedNames = $derived(new Set(earnedBadges.map(b => b.name)));
  const notEarnedBadges = $derived(availableBadges.filter(b => !earnedNames.has(b.name)));
  const filteredEarned = $derived(filterKind === 'all' ? earnedBadges : earnedBadges.filter(b => b.kind === filterKind));
  const filteredNotEarned = $derived(filterKind === 'all' ? notEarnedBadges : notEarnedBadges.filter(b => b.kind === filterKind));
  const allBadgesFiltered = $derived([...filteredEarned.map(b => ({ ...b, earned: true })), ...filteredNotEarned.map(b => ({ ...b, earned: false, id: b.name }))]);
  const rarestBadge = $derived(earnedBadges.length > 0 ? earnedBadges[0] : null);
  const latestBadge = $derived(earnedBadges.length > 0 ? earnedBadges.reduce((a, b) => (new Date(b.mintedAt) > new Date(a.mintedAt) ? b : a)) : null);

  const badgeFilterTabs = [
    { id: 'all', label: 'All' },
    { id: 'milestone', label: 'Milestone' },
    { id: 'performance', label: 'Performance' },
    { id: 'community', label: 'Community' },
    { id: 'governance', label: 'Governance' },
  ];
</script>

<svelte:head>
  <title>Settings — Necter Mining App Store</title>
</svelte:head>

<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
  <div class="max-w-[960px] mx-auto">
    <!-- Page header -->
    <div class="mb-6">
      <h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Settings</h1>
      <p class="text-[13px] text-[var(--text-secondary)] mt-1 hidden md:block">Manage your account, devices, and preferences.</p>
    </div>

    <!-- Layout: sidebar + content -->
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
      <!-- Tab navigation: horizontal scroll on mobile, vertical sidebar on desktop -->
      <nav class="flex md:flex-col w-full md:w-[180px] flex-shrink-0 gap-0.5 md:sticky md:top-6 md:self-start overflow-x-auto">
        {#each tabs as tab}
          {@const isActive = activeTab === tab.id}
          <button
            type="button"
            class="flex items-center gap-2.5 md:w-full px-3 py-2 text-[13px] rounded-[6px] text-left transition-colors whitespace-nowrap flex-shrink-0 {isActive ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
            onclick={() => activeTab = tab.id}
          >
            <svelte:component this={tab.icon} class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
            {tab.label}
          </button>
        {/each}
      </nav>

      <!-- Content area -->
      <div class="flex-1 min-w-0">

        <!-- ═══════════════════════════════════════════ -->
        <!--  1. PROFILE TAB                             -->
        <!-- ═══════════════════════════════════════════ -->
        {#if activeTab === 'profile'}
          {#if !walletAddress}
            <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center py-12">
              <p class="text-[13px] text-[var(--text-secondary)] mb-3">Connect a wallet to edit your profile.</p>
              <button class="btn-pill" onclick={() => $showConnectModal = true}>Connect Wallet</button>
            </div>
          {:else}
            <div class="space-y-5">
              <!-- Avatar + identity header -->
              <Card>
                <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em]">Identity</h2>
                <div class="flex items-start gap-4 mb-5">
                  <div class="flex flex-col items-center gap-2">
                    <div class="relative">
                      <div class="w-[72px] h-[72px] rounded-[14px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {#if avatarSrc}
                          <img src={avatarSrc} alt="Avatar" class="w-[72px] h-[72px] object-cover rounded-[14px]" />
                        {:else}
                          <span class="text-[20px] font-bold text-[var(--text-tertiary)]">{initials}</span>
                        {/if}
                      </div>
                      <label class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--accent-base)] flex items-center justify-center cursor-pointer border-2 border-[var(--surface-1)]">
                        <Upload size={10} strokeWidth={2} class="text-[#0C0C0E]" />
                        <input type="file" accept="image/*" onchange={handleAvatarUpload} class="hidden" />
                      </label>
                    </div>
                  </div>
                  <div class="min-w-0 flex-1 pt-1">
                    <p class="text-[14px] font-semibold text-[var(--text-primary)] truncate">{displayName || 'Your Name'}</p>
                    <p class="text-[11px] text-[var(--text-tertiary)] font-mono truncate mb-2">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
                    <div class="flex items-center gap-3 flex-wrap">
                      <div class="flex items-center gap-1.5">
                        <Clock size={11} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
                        <span class="text-[11px] text-[var(--text-tertiary)]">Member since November 2025</span>
                      </div>
                      <a
                        href="/profiles/{walletAddress}"
                        class="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-accent)] hover:underline no-underline"
                      >
                        View Public Profile
                        <ExternalLink size={10} strokeWidth={1.5} />
                      </a>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Display Name <span class="text-[var(--error)]">*</span></label>
                    <Input bind:value={displayName} placeholder="e.g. NecterMiner42" />
                  </div>
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Email</label>
                    <Input type="email" bind:value={email} placeholder="user@example.com" />
                  </div>
                </div>
                <div class="mt-3">
                  <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Bio</label>
                  <Textarea
                    bind:value={bio}
                    placeholder="Short description..."
                    rows={3}
                  />
                  <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Shows on your public profile. Keep it under 200 characters.</p>
                </div>
              </Card>

              <!-- Details -->
              <Card>
                <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em]">Details</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Website</label>
                    <Input type="url" bind:value={website} placeholder="https://yourproject.com" />
                  </div>
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Location</label>
                    <Input bind:value={location} placeholder="San Francisco, CA" />
                  </div>
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Founded</label>
                    <Input bind:value={founded} placeholder="2024" />
                  </div>
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Category</label>
                    <Input bind:value={category} placeholder="IoT & Wireless" />
                  </div>
                </div>
                <div class="mt-3">
                  <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Tags</label>
                  <Input bind:value={tagsStr} placeholder="IoT, DePIN, Wireless, 5G" />
                  <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Comma-separated. Used for search and discovery.</p>
                </div>
              </Card>

              <!-- Social Links -->
              <Card>
                <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em]">Social Links</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">X / Twitter</label>
                    <Input bind:value={twitter} placeholder="handle (without @)" />
                  </div>
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Discord</label>
                    <Input bind:value={discord} placeholder="server invite code" />
                  </div>
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">GitHub</label>
                    <Input bind:value={github} placeholder="org or username" />
                  </div>
                  <div>
                    <label class="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5 block">Telegram</label>
                    <Input bind:value={telegram} placeholder="channel or group" />
                  </div>
                </div>
              </Card>

              <!-- Save -->
              <div class="flex justify-end gap-2 pt-1">
                <Button
                  onclick={handleSaveProfile}
                  disabled={saving || !displayName.trim()}
                >
                  <Save size={14} strokeWidth={2} />
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>

              <!-- Divider -->
              <div class="border-t border-[var(--border-default)] my-2"></div>

              <!-- Advanced -->
              <div class="space-y-3">
                <!-- Referral Link -->
                <div class="p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] flex items-center justify-between">
                  <div class="min-w-0 flex-1 mr-3">
                    <p class="text-[13px] font-medium text-[var(--text-primary)] mb-0.5">Referral Link</p>
                    <p class="text-[12px] font-mono text-[var(--text-secondary)] truncate">
                      https://necter.io/ref/{walletAddress?.slice(0, 8) ?? 'connect'}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="flex items-center gap-1.5 h-8 px-3 rounded-[5px] bg-[var(--surface-2)] border border-[var(--border-default)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
                    onclick={() => {
                      const url = `https://necter.io/ref/${walletAddress?.slice(0, 8) ?? 'connect'}`;
                      navigator.clipboard.writeText(url);
                      showToast('Copied', 'Referral link copied to clipboard.');
                    }}
                  >
                    <Copy class="h-3.5 w-3.5" strokeWidth={1.5} />
                    Copy
                  </button>
                </div>

                <!-- API Keys -->
                <a
                  href="/develop/api-keys"
                  class="p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] flex items-center justify-between no-underline hover:bg-[var(--surface-2)] transition-colors block"
                >
                  <div class="flex items-center gap-2.5">
                    <Key class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                    <span class="text-[13px] font-medium text-[var(--text-primary)]">Manage API Keys</span>
                  </div>
                  <ChevronRight class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                </a>

                <!-- Export Data -->
                <div class="p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <p class="text-[13px] font-medium text-[var(--text-primary)] mb-0.5">Export Data</p>
                    <p class="text-[12px] text-[var(--text-secondary)]">Download all your mining data as JSON.</p>
                  </div>
                  <button
                    type="button"
                    class="flex items-center gap-1.5 h-8 px-3 rounded-[5px] bg-[var(--surface-2)] border border-[var(--border-default)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
                    onclick={() => {
                      const exportData = {
                        exportedAt: new Date().toISOString(),
                        walletAddress,
                        minerId,
                        subscriptions: $backendState.subscriptions.filter(s => s.minerId === minerId),
                        proofs: $backendState.proofs.filter(p => p.minerId === minerId),
                        payouts: ($backendState.payouts ?? []).filter(e => e.minerId === minerId),
                      };
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `necter-export-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast('Export started', 'Your data file is downloading.');
                    }}
                  >
                    <Download class="h-3.5 w-3.5" strokeWidth={1.5} />
                    Export
                  </button>
                </div>

                <!-- Delete Account -->
                <div class="p-4 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <p class="text-[13px] font-medium text-[var(--error)] mb-0.5">Delete Account</p>
                    <p class="text-[12px] text-[var(--text-secondary)]">Permanently remove your account and all associated data.</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onclick={() => alert('This is a demo')}
                  >
                    <AlertTriangle class="h-3.5 w-3.5" strokeWidth={1.5} />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          {/if}
        {/if}

        <!-- ═══════════════════════════════════════════ -->
        <!--  2. DEVICES TAB                             -->
        <!-- ═══════════════════════════════════════════ -->
        {#if activeTab === 'devices'}
          {#if !minerId}
            <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center py-12">
              <Cpu class="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-3" strokeWidth={1} />
              <p class="text-[13px] text-[var(--text-secondary)] mb-3">Connect a wallet to view your devices.</p>
              <button class="btn-pill" onclick={() => $showConnectModal = true}>Connect Wallet</button>
            </div>
          {:else}
            <div class="space-y-4">
              <!-- Stats row -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-lg overflow-hidden">
                {#each [
                  { label: 'Devices', value: devices.length.toString() },
                  { label: 'Online', value: `${onlineCount} of ${devices.length}` },
                  { label: 'Total Earned', value: `$${totalDeviceEarned.toFixed(0)}` },
                  { label: 'Avg Uptime', value: `${avgUptime.toFixed(1)}%` },
                ] as s}
                  <div class="bg-[var(--surface-1)] px-3.5 py-3">
                    <span class="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.02em]">{s.label}</span>
                    <p class="text-[18px] font-semibold font-mono text-[var(--text-primary)] mt-1">{s.value}</p>
                  </div>
                {/each}
              </div>

              <!-- Device list -->
              {#if devices.length === 0}
                <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-12 text-center">
                  <Cpu class="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" strokeWidth={1} />
                  <p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">No devices detected</p>
                  <p class="text-[13px] text-[var(--text-secondary)] max-w-[360px] mx-auto">Install the Necter miner on your machine and sign in with this wallet.</p>
                </div>
              {:else}
                <div class="space-y-3">
                  {#each devices as device (device.id)}
                    {@const TypeIcon = typeIcons[device.type] ?? Cpu}
                    {@const status = statusConfig[device.status] ?? statusConfig.offline}
                    {@const isExpanded = expandedDevice === device.id}
                    <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
                      <!-- Main card -->
                      <button
                        type="button"
                        onclick={() => expandedDevice = isExpanded ? null : device.id}
                        class="w-full text-left bg-transparent border-none cursor-pointer p-4 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <div class="flex items-start gap-4">
                          <!-- Icon + status -->
                          <div class="relative flex-shrink-0">
                            <div class="w-11 h-11 rounded-[10px] bg-[var(--surface-3)] flex items-center justify-center">
                              <svelte:component this={TypeIcon} class="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                            </div>
                            <div
                              class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-1)]"
                              style="background: {status.color}; box-shadow: 0 0 6px {status.dot};"
                            ></div>
                          </div>

                          <!-- Info -->
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                              <h3 class="text-[14px] font-semibold text-[var(--text-primary)] truncate">{device.name}</h3>
                              <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[var(--text-tertiary)] uppercase">{device.type}</span>
                              <span class="text-[10px] font-medium" style="color: {status.color}">{status.label}</span>
                            </div>
                            <!-- Hardware specs -->
                            <div class="flex flex-wrap gap-1.5 mb-2">
                              {#if device.hardware.gpu}
                                <span class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] font-mono">{device.hardware.gpu}</span>
                              {/if}
                              {#if device.hardware.cpu}
                                <span class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] font-mono">{device.hardware.cpu}</span>
                              {/if}
                              {#if device.hardware.ram}
                                <span class="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] font-mono">{device.hardware.ram}</span>
                              {/if}
                            </div>
                            <!-- Stats row -->
                            <div class="flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
                              <span>{device.subscribedAppIds.length} project{device.subscribedAppIds.length !== 1 ? 's' : ''}</span>
                              <span class="font-mono text-[var(--text-accent)]">${device.totalEarned.toFixed(2)}</span>
                              <span>{device.uptime.toFixed(1)}% uptime</span>
                              <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {lastSeenText(device)}</span>
                            </div>
                          </div>

                          <!-- Expand chevron -->
                          <ChevronDown
                            class="h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-150 flex-shrink-0 mt-1 {isExpanded ? 'rotate-180' : ''}"
                            strokeWidth={1.5}
                          />
                        </div>
                      </button>

                      <!-- Expanded details -->
                      {#if isExpanded}
                        <div class="border-t border-[var(--border-default)] p-4 space-y-4">
                          <!-- Hardware grid -->
                          <div>
                            <p class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2">Hardware</p>
                            <div class="grid grid-cols-2 gap-2">
                              {#each [
                                { icon: Cpu, label: 'GPU', value: device.hardware.gpu ? `${device.hardware.gpu}${device.hardware.gpuVram ? ` (${device.hardware.gpuVram}GB)` : ''}` : 'None' },
                                { icon: Cpu, label: 'CPU', value: `${device.hardware.cpu ?? 'Unknown'}${device.hardware.cpuCores ? ` \u00b7 ${device.hardware.cpuCores} cores` : ''}` },
                                { icon: HardDrive, label: 'RAM', value: device.hardware.ram ?? 'Unknown' },
                                { icon: HardDrive, label: 'Storage', value: device.hardware.storage ?? 'Unknown' },
                                { icon: Wifi, label: 'Bandwidth', value: device.hardware.bandwidth ?? 'Unknown' },
                                { icon: Monitor, label: 'Location', value: device.location ?? 'Unknown' },
                              ] as spec}
                                <div class="flex items-center gap-2 p-2 rounded-[5px] bg-[var(--surface-2)]">
                                  <svelte:component this={spec.icon} class="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" strokeWidth={1.5} />
                                  <div>
                                    <p class="text-[10px] text-[var(--text-tertiary)]">{spec.label}</p>
                                    <p class="text-[11px] text-[var(--text-primary)] font-mono">{spec.value}</p>
                                  </div>
                                </div>
                              {/each}
                            </div>
                          </div>

                          <!-- Mining Resource Allocation -->
                          <div>
                            <p class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-2">Mining Resource Allocation</p>
                            <div class="space-y-3">
                              {#each [{ label: 'CPU', key: 'cpu' }, { label: 'GPU', key: 'gpu' }, { label: 'RAM', key: 'ram' }] as res}
                                <div class="flex items-center gap-3">
                                  <span class="text-[11px] text-[var(--text-secondary)] w-8 flex-shrink-0">{res.label}</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value="50"
                                    class="flex-1 h-1.5 cursor-pointer [accent-color:var(--accent-base)]"
                                    oninput={(e) => {
                                      const span = e.target.nextElementSibling;
                                      if (span) span.textContent = `${e.target.value}%`;
                                    }}
                                  />
                                  <span class="text-[11px] font-mono text-[var(--text-primary)] w-8 text-right">50%</span>
                                </div>
                              {/each}
                            </div>
                            <p class="text-[10px] text-[var(--text-tertiary)] mt-2">Percentage of each resource allocated to mining tasks on this device.</p>
                          </div>

                          <!-- Device Alerts toggle -->
                          <div class="flex items-center justify-between">
                            <div class="space-y-0.5">
                              <p class="text-[12px] font-medium text-[var(--text-primary)]">Enable alerts for this device</p>
                              <p class="text-[11px] text-[var(--text-tertiary)]">Downtime, high resource usage, proof failures</p>
                            </div>
                            <Toggle checked={true} />
                          </div>

                          <!-- Manage actions -->
                          <div class="flex items-center justify-between pt-3 border-t border-[var(--border-default)]">
                            <div class="flex items-center gap-2">
                              {#if editingName === device.id}
                                <div class="flex items-center gap-2">
                                  <input type="text" bind:value={editNameValue} class="h-7 px-2 rounded-[4px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[12px] text-[var(--text-primary)] outline-none w-[160px]" />
                                  <button type="button" onclick={() => { if (editNameValue.trim()) { backend.updateDevice(device.id, { name: editNameValue.trim() }); showToast('Device renamed'); } editingName = null; }} class="text-[11px] text-[var(--text-accent)] bg-transparent border-none cursor-pointer font-medium">Save</button>
                                  <button type="button" onclick={() => editingName = null} class="text-[11px] text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer">Cancel</button>
                                </div>
                              {:else}
                                <button type="button" onclick={() => { editingName = device.id; editNameValue = device.name; }} class="text-[11px] text-[var(--text-secondary)] bg-transparent border-none cursor-pointer hover:text-[var(--text-primary)]">Rename</button>
                              {/if}
                            </div>
                            <button type="button" onclick={() => { if (confirm(`Remove ${device.name}?`)) { backend.removeDevice(device.id); showToast('Device removed'); } }} class="text-[11px] text-[var(--error)] bg-transparent border-none cursor-pointer hover:underline">Remove</button>
                          </div>

                          <!-- Meta -->
                          <div class="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-2">
                            <span class="font-mono">{device.id}</span>
                            <span>Region: {device.location ?? 'Unknown'}</span>
                            <span>{new Date(device.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}

        <!-- ═══════════════════════════════════════════ -->
        <!--  3. WALLET TAB                              -->
        <!-- ═══════════════════════════════════════════ -->
        {#if activeTab === 'wallet'}
          <div class="space-y-5">
            <!-- Connected wallet -->
            <Card>
              <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em]">Connected Wallet</h2>
              {#if $wallet}
                <div class="bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-[8px] flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center bg-[linear-gradient(135deg,#AB9FF2,#6C5CE7)]">
                      <svg width="16" height="14" viewBox="0 0 128 112" fill="none">
                        <path d="M108.87 56.29c0 27.54-22.34 49.88-49.88 49.88h-2.5A49.88 49.88 0 0 1 8.35 62.3c2.5-28.95 27.98-50.43 57.07-48.02a49.88 49.88 0 0 1 43.45 42.01zM36.89 52.32a5.6 5.6 0 1 0 0-11.2 5.6 5.6 0 0 0 0 11.2zm25.2 0a5.6 5.6 0 1 0 0-11.2 5.6 5.6 0 0 0 0 11.2z" fill="white"/>
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <p class="font-mono text-[13px] text-[var(--text-primary)] truncate">{$wallet.address}</p>
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[11px] font-medium text-[var(--text-secondary)]">Primary</span>
                        <span class="text-[11px] text-[var(--text-tertiary)] font-mono">
                          {($backendState.walletBalancesByAddress[$wallet.address] ?? 0).toFixed(2)} NECTA
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    class="flex-shrink-0 text-[var(--error)]"
                    onclick={disconnectWallet}
                  >
                    <LogOut class="h-4 w-4 mr-1.5" />
                    Disconnect
                  </Button>
                </div>
              {:else}
                <div class="bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-[8px] flex items-center justify-between">
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
            </Card>

            <!-- Transaction history -->
            <Card>
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h2 class="text-[13px] font-semibold text-[var(--text-primary)] tracking-[0.01em]">Transaction History</h2>
                  <p class="text-[12px] text-[var(--text-secondary)] mt-0.5">Recent withdrawal activity for this miner.</p>
                </div>
                {#if minerWithdrawals.length > 0}
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={handleExportCsv}
                    class="flex items-center gap-1.5 text-[11px] h-7 px-2.5"
                  >
                    <Download size={12} strokeWidth={1.5} />
                    Export CSV
                  </Button>
                {/if}
              </div>

              {#if !minerId}
                <div class="text-[13px] text-[var(--text-secondary)]">Connect a wallet to view transactions.</div>
              {:else if recentWithdrawals.length === 0}
                <div class="text-center py-8">
                  <WalletIcon class="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" strokeWidth={1} />
                  <p class="text-[13px] text-[var(--text-secondary)]">No withdrawals yet.</p>
                  <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Completed withdrawals will appear here.</p>
                </div>
              {:else}
                <div class="space-y-0 overflow-x-auto border border-[var(--border-default)] rounded-lg [-webkit-overflow-scrolling:touch]">
                  <div class="min-w-[420px]">
                    <!-- Table header -->
                    <div class="grid gap-3 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-default)]" style="grid-template-columns: 1fr 80px 100px 90px;">
                      <span class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em]">Date</span>
                      <span class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em]">Type</span>
                      <span class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] text-right">Amount</span>
                      <span class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] text-right">Status</span>
                    </div>
                    {#each recentWithdrawals as w (w.id)}
                      {@const sc = withdrawalStatusConfig[w.status] ?? withdrawalStatusConfig.pending}
                      <div class="grid gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border-default)]" style="grid-template-columns: 1fr 80px 100px 90px;">
                        <span class="text-[12px] text-[var(--text-secondary)]">
                          {new Date(w.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span class="text-[12px] text-[var(--text-secondary)]">Withdrawal</span>
                        <span class="text-[12px] text-[var(--text-primary)] font-mono text-right">{w.amount.toFixed(2)} NECTA</span>
                        <span class="flex justify-end">
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium" style="background: {sc.bg}; color: {sc.color};">
                            {sc.label}
                          </span>
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
                {#if minerWithdrawals.length > 5}
                  <p class="text-[11px] text-[var(--text-tertiary)] mt-2 text-center">
                    Showing 5 of {minerWithdrawals.length} transactions. Export CSV for the full list.
                  </p>
                {/if}
              {/if}
            </Card>

            <!-- Withdrawal addresses -->
            <Card>
              <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1 tracking-[0.01em]">Withdrawal Address Book</h2>
              <p class="text-[12px] text-[var(--text-secondary)] mb-4">Manage saved payout addresses. Earnings uses this list to keep withdrawals simple.</p>

              {#if !minerId}
                <div class="text-[13px] text-[var(--text-secondary)]">Connect a wallet to manage saved addresses.</div>
              {:else}
                <div class="space-y-3">
                  <div class="flex gap-2">
                    <Input
                      bind:value={newWithdrawalAddress}
                      placeholder="Add address (0x...)"
                      class="flex-1 font-mono h-8"
                    />
                    <Button onclick={addAddress}>
                      <Plus class="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                  <div class="space-y-1.5">
                    {#if savedWithdrawalAddresses.length === 0}
                      <div class="text-[13px] text-[var(--text-secondary)]">No saved addresses yet.</div>
                    {:else}
                      {#each savedWithdrawalAddresses as addr}
                        <div class="flex items-center justify-between p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]">
                          <div class="font-mono text-[12px] text-[var(--text-primary)] truncate">{addr}</div>
                          <Button
                            variant="secondary"
                            class="w-7 p-0 text-[var(--error)]"
                            onclick={() => removeAddress(addr)}
                          >
                            <Trash2 class="h-4 w-4" />
                          </Button>
                        </div>
                      {/each}
                    {/if}
                  </div>
                </div>
              {/if}
            </Card>

            <!-- Additional Wallets -->
            <Card>
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-[13px] font-semibold text-[var(--text-primary)] tracking-[0.01em]">Additional Wallets</h2>
                  <p class="text-[12px] text-[var(--text-secondary)] mt-0.5">Link another wallet to your miner account for multi-chain payouts.</p>
                </div>
                <Button
                  variant="secondary"
                  onclick={() => $showConnectModal = true}
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Connect Another Wallet
                </Button>
              </div>
            </Card>
          </div>
        {/if}

        <!-- ═══════════════════════════════════════════ -->
        <!--  4. NOTIFICATIONS TAB                       -->
        <!-- ═══════════════════════════════════════════ -->
        {#if activeTab === 'notifications'}
          <div class="space-y-5">
            <!-- Global notification toggles -->
            <Card>
              <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-5 tracking-[0.01em]">Notification Preferences</h2>
              <div class="space-y-5">
                {#each notifPrefs as pref, i}
                  <div class="flex items-center justify-between">
                    <div class="space-y-0.5">
                      <label class="text-[13px] text-[var(--text-primary)]">{pref.title}</label>
                      <p class="text-[12px] text-[var(--text-secondary)]">{pref.desc}</p>
                    </div>
                    <Toggle bind:checked={notifToggles[i]} />
                  </div>
                {/each}
              </div>
            </Card>

            <!-- Per-Project Notifications -->
            <Card>
              <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1 tracking-[0.01em]">Per-Project Notifications</h2>
              <p class="text-[12px] text-[var(--text-secondary)] mb-4">Toggle notifications for each subscribed project.</p>
              {#if subscribedApps.length === 0}
                <p class="text-[12px] text-[var(--text-tertiary)]">
                  {minerId ? 'No subscribed projects yet. Subscribe to a project to configure per-project notifications.' : 'Connect a wallet to see your subscribed projects.'}
                </p>
              {:else}
                <div class="space-y-3">
                  {#each subscribedApps as app (app.id)}
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getAppIcon(app)}
                          alt=""
                          class="w-7 h-7 rounded-[5px] flex-shrink-0"
                          loading="lazy"
                        />
                        <span class="text-[13px] text-[var(--text-primary)] truncate">{app.name}</span>
                      </div>
                      <Toggle checked={true} />
                    </div>
                  {/each}
                </div>
              {/if}
            </Card>

            <!-- Delivery Method -->
            <Card>
              <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1 tracking-[0.01em]">Delivery Method</h2>
              <p class="text-[12px] text-[var(--text-secondary)] mb-4">Choose how you receive notifications.</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  onclick={() => deliveryMethod = 'in-app'}
                  class="h-[34px] px-4 rounded-[6px] text-[12px] font-medium cursor-pointer {deliveryMethod === 'in-app' ? 'border border-[var(--accent-base)] bg-[var(--accent-subtle)] text-[var(--text-accent)]' : 'border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)]'}"
                >
                  In-app only
                </button>
                <button
                  type="button"
                  disabled
                  class="h-[34px] px-4 rounded-[6px] text-[12px] font-medium border border-[var(--border-default)] cursor-not-allowed bg-[var(--surface-2)] text-[var(--text-tertiary)] opacity-50"
                >
                  Email + In-app
                  <span class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-3)] text-[var(--text-tertiary)]">coming soon</span>
                </button>
              </div>
            </Card>

            <!-- Quiet Hours -->
            <Card>
              <h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1 tracking-[0.01em]">Quiet Hours</h2>
              <p class="text-[12px] text-[var(--text-secondary)] mb-4">Suppress notifications between these times.</p>
              <div class="flex items-center gap-3">
                <div>
                  <label class="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-1">From</label>
                  <Input
                    type="time"
                    bind:value={quietFrom}
                    class="h-8 px-2.5 font-mono text-[12px] w-auto"
                  />
                </div>
                <span class="text-[12px] text-[var(--text-tertiary)] mt-4">to</span>
                <div>
                  <label class="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.04em] block mb-1">To</label>
                  <Input
                    type="time"
                    bind:value={quietTo}
                    class="h-8 px-2.5 font-mono text-[12px] w-auto"
                  />
                </div>
              </div>
            </Card>
          </div>
        {/if}

        <!-- ═══════════════════════════════════════════ -->
        <!--  5. BADGES TAB                              -->
        <!-- ═══════════════════════════════════════════ -->
        {#if activeTab === 'badges'}
          {#if !minerId}
            <div class="p-5 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border)] text-center py-12">
              <Award class="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-3" strokeWidth={1} />
              <p class="text-[13px] text-[var(--text-secondary)] mb-3">Connect a wallet to view your badges.</p>
              <button class="btn-pill" onclick={() => $showConnectModal = true}>Connect Wallet</button>
            </div>
          {:else}
            <div class="space-y-4">
              <!-- Stats row -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-lg overflow-hidden">
                {#each [
                  { label: 'Collected', value: `${earnedBadges.length} / ${availableBadges.length}` },
                  { label: 'Rarest', value: rarestBadge?.name ?? 'None yet' },
                  { label: 'Latest', value: latestBadge?.name ?? 'None yet' },
                  { label: 'Completion', value: `${Math.round((earnedBadges.length / availableBadges.length) * 100)}%` },
                ] as s}
                  <div class="bg-[var(--surface-1)] px-4 py-3.5">
                    <span class="text-[11px] font-medium text-[var(--text-tertiary)] tracking-[0.02em] uppercase">{s.label}</span>
                    <p class="text-[14px] font-semibold text-[var(--text-primary)] mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap">{s.value}</p>
                  </div>
                {/each}
              </div>

              <!-- Filter tabs -->
              <div class="flex gap-1 flex-wrap">
                {#each badgeFilterTabs as tab}
                  <button
                    type="button"
                    onclick={() => filterKind = tab.id}
                    class="h-7 px-3 rounded-[5px] text-[12px] font-medium border-none cursor-pointer transition-all duration-100 ease-out {filterKind === tab.id ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)]' : 'bg-[var(--surface-1)] text-[var(--text-secondary)]'}"
                  >
                    {tab.label}
                  </button>
                {/each}
              </div>

              <!-- All Badges (earned light up, locked are dimmed) -->
              {#if allBadgesFiltered.length === 0}
                <div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-lg px-6 py-12 text-center">
                  <p class="text-[14px] font-semibold text-[var(--text-primary)] mb-1">No badges in this category yet</p>
                  <p class="text-[13px] text-[var(--text-secondary)]">Try selecting a different filter.</p>
                </div>
              {:else}
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {#each allBadgesFiltered as b (b.id)}
                    {@const meta = badgeKindMeta[b.kind] ?? badgeKindMeta.milestone}
                    <div class="badge-card {b.earned ? '' : 'locked'}">
                      <svg class="badge-honeycomb-bg" viewBox="0 0 60 60" fill="currentColor">
                        <polygon points="30,2 52,16 52,44 30,58 8,44 8,16" fill="none" stroke="currentColor" stroke-width="1" />
                        <polygon points="30,14 41,21 41,35 30,42 19,35 19,21" fill="none" stroke="currentColor" stroke-width="0.5" />
                      </svg>
                      <div class="badge-icon w-16 h-16 relative">
                        <img src={badgeIconDataUri(b.name, b.kind)} alt="" class="w-16 h-16" loading="lazy" />
                        {#if !b.earned}
                          <div class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--surface-2)] border-2 border-[var(--surface-1)] flex items-center justify-center">
                            <Lock size={10} strokeWidth={2} class="text-[var(--text-tertiary)]" />
                          </div>
                        {/if}
                      </div>
                      <p class="text-[13px] font-semibold m-0 leading-[18px] {b.earned ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}">{b.name}</p>
                      <p class="text-[11px] leading-[16px] m-0 {b.earned ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}">{b.description}</p>
                      <div class="flex items-center gap-1.5 mt-auto flex-wrap justify-center">
                        {#if b.earned}
                          <span class="inline-flex items-center h-5 px-1.5 rounded-[3px] text-[10px] font-medium tracking-[0.02em]" style="background: {meta.bg}; color: {meta.color};">
                            {meta.label}
                          </span>
                          {#if b.mintedAt}
                            <span class="text-[10px] text-[var(--text-tertiary)]">
                              {new Date(b.mintedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          {/if}
                        {:else}
                          <span class="inline-flex items-center h-5 px-1.5 rounded-[3px] text-[10px] font-medium tracking-[0.02em] bg-[var(--surface-3)] text-[var(--text-tertiary)]">
                            {meta.label}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}

      </div>
    </div>
  </div>
</div>

<style>
  .badge-card {
    position: relative;
    background: var(--surface-1);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    transition: transform 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out;
    cursor: default;
    overflow: hidden;
  }
  .badge-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 0%, rgba(255,191,0,0.04) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 300ms ease-out;
    pointer-events: none;
  }
  .badge-card:hover::before { opacity: 1; }
  .badge-honeycomb-bg {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 60px;
    height: 60px;
    opacity: 0.04;
    pointer-events: none;
  }
  .badge-card:hover {
    transform: translateY(-4px) scale(1.02);
    border-color: var(--border-hover);
    box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px var(--border-hover);
  }
  .badge-card:hover .badge-icon {
    transform: rotateY(360deg) scale(1.1);
  }
  .badge-icon {
    transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-style: preserve-3d;
  }
  .badge-card.locked {
    opacity: 0.5;
  }
  .badge-card.locked:hover {
    opacity: 0.7;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .badge-card.locked:hover .badge-icon {
    transform: scale(1.05);
    filter: grayscale(0.6);
  }
  .badge-card.locked .badge-icon {
    filter: grayscale(1) brightness(0.7);
  }
</style>
