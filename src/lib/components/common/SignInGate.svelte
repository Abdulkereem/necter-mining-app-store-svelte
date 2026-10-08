<script lang="ts">
	import type { Snippet } from 'svelte';
	import { wallet, signedIn, showConnectModal, signIn, isSigningIn } from '$lib/stores/wallet';
	import { errorMessage } from '$lib/api/http';
	import toast from 'svelte-french-toast';
	import EmptyState from './EmptyState.svelte';

	let {
		title = 'Connect your wallet',
		description = 'Sign in with your wallet to see this page. Signing is free and does not send a transaction.',
		illustration = 'bee',
		children
	}: {
		title?: string;
		description?: string;
		illustration?: 'bee' | 'platform' | 'security' | 'compute' | 'network' | 'ecosystem';
		children: Snippet;
	} = $props();

	async function doSignIn() {
		try {
			await signIn();
		} catch (e) {
			toast.error(errorMessage(e));
		}
	}
</script>

{#if $signedIn}
	{@render children()}
{:else}
	<div class="px-4 md:px-8 py-8 max-w-[880px] mx-auto">
		<EmptyState {illustration} {title} {description}>
			{#if $wallet}
				<button type="button" class="n-gate-btn" onclick={doSignIn} disabled={$isSigningIn} data-testid="gate-sign-in">
					{$isSigningIn ? 'Check your wallet…' : 'Sign in with wallet'}
				</button>
			{:else}
				<button type="button" class="n-gate-btn" onclick={() => showConnectModal.set(true)} data-testid="gate-connect">
					Connect wallet
				</button>
			{/if}
		</EmptyState>
	</div>
{/if}

<style>
	.n-gate-btn {
		height: 36px;
		padding: 0 18px;
		border-radius: 6px;
		border: none;
		background: var(--accent-base);
		color: #0c0c0e;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 120ms;
	}
	.n-gate-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}
	.n-gate-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
