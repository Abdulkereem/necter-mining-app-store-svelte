<script>
  import { backendState, backend } from '$lib/stores/backend';
  import { actor, showConnectModal } from '$lib/stores/wallet';
  import { badgeIconDataUri } from '$lib/badge-icon';
  import { ChevronLeft, Lock } from 'lucide-svelte';

  const badgeKindMeta = {
    milestone: { color: 'var(--text-accent)', bg: 'var(--accent-subtle)', label: 'Milestone' },
    performance: { color: 'var(--success)', bg: 'rgba(76,183,130,0.12)', label: 'Performance' },
    governance: { color: 'var(--info)', bg: 'rgba(110,159,255,0.12)', label: 'Governance' },
    community: { color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)', label: 'Community' },
  };

  const availableBadges = [
    { name: 'First Proof Verified', description: 'Submit and verify your very first proof on the Necter network.', kind: 'milestone' },
    { name: '10 Proofs Verified', description: 'Verify 10 proofs across any combination of networks.', kind: 'milestone' },
    { name: 'Centurion', description: '100 verified proofs. Your hardware has proven it can handle real workloads.', kind: 'milestone' },
    { name: 'Proof Machine', description: "1,000 verified proofs. You're generating consistent value.", kind: 'milestone' },
    { name: '10K Club', description: '10,000 lifetime proofs. Your node is a pillar of the Necter ecosystem.', kind: 'milestone' },
    { name: 'First Payout', description: 'Your first NECTA hits your wallet.', kind: 'milestone' },
    { name: 'Diamond Hands', description: "1,000 NECTA earned. You've mined through volatility.", kind: 'milestone' },
    { name: 'Whale Miner', description: '10,000 NECTA lifetime earnings. Top 1% of all miners.', kind: 'milestone' },
    { name: 'First Withdrawal', description: 'Move NECTA from your mining balance to your own wallet.', kind: 'milestone' },
    { name: 'Hardware Upgraded', description: 'Update your hardware profile after upgrading your rig.', kind: 'milestone' },
    { name: 'Ironclad', description: '99.9% uptime for 30 straight days.', kind: 'performance' },
    { name: 'Always On', description: '100% uptime for a full 7 days.', kind: 'performance' },
    { name: 'Top 10 Earner', description: 'Break into the top 10 earners on any network leaderboard.', kind: 'performance' },
    { name: 'Efficiency King', description: '99.5%+ proof success rate over 500 submissions.', kind: 'performance' },
    { name: 'Zero Slashing', description: '500+ tasks with zero slashing events.', kind: 'performance' },
    { name: 'Reputation 90+', description: 'Push your miner reputation score above 90.', kind: 'performance' },
    { name: 'Early Adopter', description: 'Subscribe to a network within 48 hours of launch.', kind: 'community' },
    { name: 'Network Hopper', description: 'Mine on 3+ networks at once.', kind: 'community' },
    { name: 'Category Explorer', description: 'Mine across 4+ categories.', kind: 'community' },
    { name: 'Pioneer', description: 'Among the first 50 miners on a newly launched network.', kind: 'community' },
    { name: 'Loyal Miner', description: '90+ consecutive days on one network.', kind: 'community' },
    { name: 'Fleet Commander', description: 'Operate 5+ mining nodes from a single operator account.', kind: 'community' },
    { name: 'Reviewer', description: 'Leave 5 honest reviews on networks.', kind: 'community' },
    { name: 'Node Setup Complete', description: 'Run through the full node setup wizard.', kind: 'community' },
    { name: 'Network Creator', description: 'Deploy your first mining network on Necter.', kind: 'community' },
    { name: 'First Miner Attracted', description: 'A real miner subscribes to your network.', kind: 'community' },
    { name: '10 Miners Onboarded', description: '10 miners are now actively running proofs on your network.', kind: 'community' },
    { name: 'Payout Distributed', description: 'Your network distributes its first round of NECTA rewards.', kind: 'community' },
    { name: 'Multi-Network Dev', description: 'Deploy and maintain 3+ live networks on Necter.', kind: 'community' },
    { name: '5-Star Network', description: 'Your network reaches a 4.5+ average rating.', kind: 'community' },
    { name: 'First Vote', description: 'Cast your first vote on a Necter governance proposal.', kind: 'governance' },
    { name: 'Active Citizen', description: "Vote on 10+ proposals. You're shaping how the network evolves.", kind: 'governance' },
    { name: 'Proposal Author', description: 'Draft a governance proposal that reaches quorum.', kind: 'governance' },
    { name: 'DAO Reviewer', description: 'Review and vote on 3 network listing applications.', kind: 'governance' },
    { name: 'Watchdog', description: 'Flag 3 networks for confirmed policy violations.', kind: 'governance' },
  ];

  let filterKind = $state('all');

  const minerId = $derived($actor?.minerId ?? null);
  const earned = $derived(minerId ? backend.listBadges(minerId) : []);
  const earnedNames = $derived(new Set(earned.map((b) => b.name)));
  const notEarned = $derived(availableBadges.filter((b) => !earnedNames.has(b.name)));

  const filteredEarned = $derived(filterKind === 'all' ? earned : earned.filter((b) => b.kind === filterKind));
  const filteredNotEarned = $derived(filterKind === 'all' ? notEarned : notEarned.filter((b) => b.kind === filterKind));

  const rarestBadge = $derived(earned.length > 0 ? earned[0] : null);
  const latestBadge = $derived(earned.length > 0 ? earned.reduce((a, b) => (new Date(b.mintedAt) > new Date(a.mintedAt) ? b : a)) : null);

  const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'milestone', label: 'Milestone' },
    { id: 'performance', label: 'Performance' },
    { id: 'community', label: 'Community' },
    { id: 'governance', label: 'Governance' },
  ];
</script>

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
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 0%, rgba(255,191,0,0.04) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 300ms ease-out;
    pointer-events: none;
  }
  .badge-card:hover {
    transform: translateY(-4px) scale(1.02);
    border-color: var(--border-hover);
    box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px var(--border-hover);
  }
  .badge-card:hover::before { opacity: 1; }
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

{#if !$actor}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width: 1152px; margin: 0 auto; text-align: center; padding-top: 120px;">
      <p style="font-size: 13px; color: var(--text-secondary);">Connect a wallet to view your badges.</p>
      <button class="btn-pill" onclick={() => $showConnectModal = true} style="font-size: 13px; height: 32px; padding: 0 16px; margin-top: 16px;">
        Connect Wallet
      </button>
    </div>
  </div>
{:else}
  <div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
    <div style="max-width: 1152px; margin: 0 auto;">
      <a
        href="/mining"
        style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text-secondary); text-decoration: none; margin-bottom: 16px;"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Back to Mining
      </a>
      <h1 style="font-size: 20px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.015em; line-height: 28px; margin: 0;">
        The Hive Collection
      </h1>
      <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; line-height: 20px;">
        Every badge is a piece of your mining story. Earn them by proving yourself on the network.
      </p>

      <!-- Stats row -->
      <div
        style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; margin-top: 24px;"
      >
        {#each [
          { label: 'Collected', value: `${earned.length} / ${availableBadges.length}` },
          { label: 'Rarest', value: rarestBadge?.name ?? 'None yet' },
          { label: 'Latest', value: latestBadge?.name ?? 'None yet' },
          { label: 'Completion', value: `${Math.round((earned.length / availableBadges.length) * 100)}%` },
        ] as s}
          <div style="background: var(--surface-1); padding: 14px 16px;">
            <span style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); letter-spacing: 0.02em; text-transform: uppercase;">{s.label}</span>
            <p style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 6px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{s.value}</p>
          </div>
        {/each}
      </div>

      <!-- Filter tabs -->
      <div style="display: flex; gap: 4px; margin-top: 24px; margin-bottom: 16px; flex-wrap: wrap;">
        {#each filterTabs as tab}
          <button
            type="button"
            onclick={() => filterKind = tab.id}
            style="height: 28px; padding: 0 12px; border-radius: 5px; font-size: 12px; font-weight: 500; border: none; cursor: pointer; background: {filterKind === tab.id ? 'var(--accent-subtle)' : 'var(--surface-1)'}; color: {filterKind === tab.id ? 'var(--text-accent)' : 'var(--text-secondary)'}; transition: all 100ms ease-out;"
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Earned Badges -->
      {#if filteredEarned.length > 0}
        <div style="margin-bottom: 32px;">
          <p style="font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 12px;">
            Earned ({filteredEarned.length})
          </p>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            {#each filteredEarned as b}
              {@const meta = badgeKindMeta[b.kind] ?? badgeKindMeta.milestone}
              <div class="badge-card">
                <div class="badge-icon" style="width: 64px; height: 64px; position: relative;">
                  <img src={badgeIconDataUri(b.name, b.kind)} alt="" style="width: 64px; height: 64px;" />
                </div>
                <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0; line-height: 18px;">{b.name}</p>
                <p style="font-size: 11px; color: var(--text-secondary); line-height: 16px; margin: 0;">{b.description}</p>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: auto; flex-wrap: wrap; justify-content: center;">
                  <span style="display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 3px; font-size: 10px; font-weight: 500; background: {meta.bg}; color: {meta.color}; letter-spacing: 0.02em;">
                    {meta.label}
                  </span>
                  {#if b.mintedAt}
                    <span style="font-size: 10px; color: var(--text-tertiary);">
                      {new Date(b.mintedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Locked Badges -->
      <div>
        <p style="font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 12px;">
          {filteredEarned.length > 0 ? `Locked (${filteredNotEarned.length})` : `All Badges (${filteredNotEarned.length})`}
        </p>
        {#if filteredNotEarned.length === 0 && filteredEarned.length === 0}
          <div style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 48px 24px; text-align: center;">
            <p style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No badges in this category yet</p>
            <p style="font-size: 13px; color: var(--text-secondary);">Try selecting a different filter.</p>
          </div>
        {:else}
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            {#each filteredNotEarned as b}
              {@const meta = badgeKindMeta[b.kind] ?? badgeKindMeta.milestone}
              <div class="badge-card locked">
                <div class="badge-icon" style="width: 64px; height: 64px; position: relative;">
                  <img src={badgeIconDataUri(b.name, b.kind)} alt="" style="width: 64px; height: 64px;" />
                  <div style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px; border-radius: 50%; background: var(--surface-2); border: 2px solid var(--surface-1); display: flex; align-items: center; justify-content: center;">
                    <Lock size={10} strokeWidth={2} style="color: var(--text-tertiary);" />
                  </div>
                </div>
                <p style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin: 0; line-height: 18px;">{b.name}</p>
                <p style="font-size: 11px; color: var(--text-tertiary); line-height: 16px; margin: 0;">{b.description}</p>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: auto; flex-wrap: wrap; justify-content: center;">
                  <span style="display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 3px; font-size: 10px; font-weight: 500; background: var(--surface-3); color: var(--text-tertiary); letter-spacing: 0.02em;">
                    {meta.label}
                  </span>
                  <span style="font-size: 10px; color: var(--text-tertiary);">Locked</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
