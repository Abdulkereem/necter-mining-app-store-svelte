<script>
  const faqs = [
    { q: 'How do I start mining?', a: 'Browse apps on the Discover page, open an app detail page, and click Subscribe. Follow the setup instructions.' },
    { q: 'How are earnings calculated?', a: 'Each network sets its own reward schedule. Necter aggregates earnings across all subscribed apps in the Mining dashboard.' },
    { q: 'How do I withdraw?', a: 'Go to My Mining -> Earnings tab and use the withdrawal flow.' },
    { q: 'How do I publish a network?', a: 'Click Developer Portal in the sidebar, set up your account, then use the Create Network wizard.' },
  ];

  const contacts = [
    { label: 'General support', email: 'support@necter.network' },
    { label: 'Developer listings', email: 'listings@necter.network' },
    { label: 'Security', email: 'security@necter.network' },
  ];
</script>

<div class="min-h-screen animate-fadeIn">
  <div class="px-6 pt-6 pb-12 max-w-2xl">
    <h1 class="text-[20px] font-semibold text-[var(--text-primary)] mb-1">Help & Support</h1>
    <p class="text-[13px] text-[var(--text-secondary)] mb-6">Resources and contact information.</p>

    <!-- About -->
    <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5 mb-4">
      <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-3">About Necter</h2>
      <div class="text-[13px] text-[var(--text-secondary)] leading-relaxed space-y-2">
        <p>Necter is a decentralized mining app marketplace connecting miners with DePIN, AI/ML, Storage, Compute, IoT, and Bandwidth networks.</p>
        <p>Apps listed on Necter pass a DAO governance review. Developers submit their network, attestors verify legitimacy, and approved apps become available for miners.</p>
        <p>Mining earnings are tracked on-chain with proof-of-work dashboards, leaderboards, and analytics.</p>
      </div>
    </div>

    <!-- FAQ -->
    <div class="space-y-2 mb-4">
      <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-2">FAQ</h2>
      {#each faqs as { q, a }}
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
          <p class="text-[13px] font-medium text-[var(--text-primary)] mb-1">{q}</p>
          <p class="text-[12px] text-[var(--text-secondary)]">{a}</p>
        </div>
      {/each}
    </div>

    <!-- Contact -->
    <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
      <h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Contact</h2>
      <div class="space-y-2 text-[12px]">
        {#each contacts as { label, email }}
          <div class="flex items-center gap-3">
            <span class="text-[var(--text-tertiary)] min-w-[140px]">{label}</span>
            <a href="mailto:{email}" class="text-[var(--text-accent)] hover:underline">{email}</a>
          </div>
        {/each}
      </div>
    </div>

    <div class="flex justify-center mt-6 mb-1">
      <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.06;">
        <path d="M10,1 L15,4 L15,10 L10,13 L5,10 L5,4 Z" fill="currentColor"/>
        <path d="M20,1 L25,4 L25,10 L20,13 L15,10 L15,4 Z" fill="currentColor"/>
        <path d="M15,11 L20,14 L20,20 L15,23 L10,20 L10,14 Z" fill="currentColor"/>
      </svg>
    </div>
    <p class="text-[11px] text-[var(--text-tertiary)] text-center">Necter Mining App Store - prototype build</p>
  </div>
</div>
