<script lang="ts">
	import ComingSoon from '$lib/components/common/ComingSoon.svelte';
</script>

<ComingSoon
	title={"Attestations"}
	phase="P4"
	description={"Device and project attestations (Play Integrity, App Attest, TPM, TEE) are reserved in the protocol and not used on the testnet. Today every result is checked by redundant execution in a miner committee."}
	features={["Hardware attestation for devices", "Attestation requirements per project", "Oracle-backed attestation submissions"]}
	backHref="/discover"
	backLabel="Back to Discover"
/>
