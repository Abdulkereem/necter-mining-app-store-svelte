<script lang="ts">
	import ComingSoon from '$lib/components/common/ComingSoon.svelte';
</script>

<ComingSoon
	title={"New proposal"}
	phase="P4"
	description={"Creating proposals needs on-chain governance, which comes after the testnet's mining and payout phases."}
	features={["Parameter-change and treasury proposals", "Proposal deposit returned when quorum is met", "Templates for common changes"]}
	backHref="/governance"
	backLabel="Back to Governance"
/>
