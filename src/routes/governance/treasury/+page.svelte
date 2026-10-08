<script lang="ts">
	import ComingSoon from '$lib/components/common/ComingSoon.svelte';
	import CopyText from '$lib/components/common/CopyText.svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { formatToken } from '$lib/format';

	const treasury = useQuery(() => hub.treasury());
</script>

<ComingSoon
	title="Treasury"
	phase="P4"
	description="The treasury receives the protocol share of every project's epoch fees. Spending it through governance comes later; on the testnet it is held by the deployer address."
	features={['Grants voted by NECTA stakers', 'Transparent inflows per project epoch', 'Allocation reports']}
	backHref="/governance"
	backLabel="Back to Governance"
/>

{#if treasury.data}
	<div class="px-4 md:px-8 -mt-4 pb-10 max-w-[960px] mx-auto">
		<div class="rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] p-5 flex flex-wrap items-center gap-6" data-testid="treasury-balance">
			<div>
				<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Treasury address</p>
				<CopyText value={treasury.data.address} />
			</div>
			{#each treasury.data.balances as b (b.token.address)}
				<div>
					<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{b.token.symbol} balance</p>
					<p class="text-[16px] font-semibold font-mono text-[var(--text-accent)]">{formatToken(b.amount, b.token, { maxFrac: 2 })}</p>
				</div>
			{/each}
		</div>
	</div>
{/if}
