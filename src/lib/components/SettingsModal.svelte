<script lang="ts">
	import { User, Wallet, LogOut, Droplets, KeyRound } from 'lucide-svelte';
	import { wallet, signedIn, disconnectWallet, signIn, isSigningIn } from '$lib/stores/wallet';
	import { balances, nectaOf } from '$lib/stores/balances';
	import { formatAmount } from '$lib/format';
	import { errorMessage } from '$lib/api/http';
	import toast from 'svelte-french-toast';
	import { goto } from '$app/navigation';

	let { open = $bindable(false) }: { open: boolean } = $props();

	function handleClose() {
		open = false;
	}

	function goTo(path: string) {
		handleClose();
		goto(path);
	}

	const necta = $derived(nectaOf($balances));

	async function doSignIn() {
		try {
			await signIn();
			handleClose();
		} catch (e) {
			toast.error(errorMessage(e));
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50">
		<!-- Backdrop (no bg tint, just click-to-close) -->
		<div class="absolute inset-0" onclick={handleClose} role="presentation"></div>

		<!-- Popover anchored bottom-left above the wallet button -->
		<div
			class="absolute left-[12px] bottom-[64px] bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[10px] w-[196px] overflow-hidden"
			style="box-shadow: 0 8px 30px rgba(0,0,0,0.40);"
		>
			<!-- Balance -->
			{#if $wallet}
				<div class="px-3 pt-3 pb-2">
					<p class="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">Balance</p>
					<p class="text-[16px] font-semibold font-mono text-[var(--text-accent)]">
						{necta ? formatAmount(necta.amount, necta.token.decimals, { maxFrac: 2 }) : '—'}
					</p>
					<p class="text-[10px] text-[var(--text-tertiary)]">NECTA · {$wallet.connector.name}</p>
				</div>
			{/if}

			<div class="border-t border-[var(--border-default)]"></div>

			<!-- Actions -->
			<div class="p-1">
				{#if $wallet && !$signedIn}
					<button
						type="button"
						onclick={doSignIn}
						disabled={$isSigningIn}
						class="w-full flex items-center gap-2 h-[32px] px-2.5 rounded-[5px] text-[12px] font-medium text-[var(--text-accent)] hover:bg-[var(--accent-subtle)] transition-colors text-left bg-transparent border-none cursor-pointer"
					>
						<KeyRound class="h-3.5 w-3.5" strokeWidth={1.5} />
						{$isSigningIn ? 'Check your wallet…' : 'Sign in'}
					</button>
				{/if}
				<button
					type="button"
					onclick={() => goTo('/faucet')}
					class="w-full flex items-center gap-2 h-[32px] px-2.5 rounded-[5px] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors text-left bg-transparent border-none cursor-pointer"
				>
					<Droplets class="h-3.5 w-3.5" strokeWidth={1.5} />
					Testnet faucet
				</button>
				<button
					type="button"
					onclick={() => goTo('/settings')}
					class="w-full flex items-center gap-2 h-[32px] px-2.5 rounded-[5px] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors text-left bg-transparent border-none cursor-pointer"
				>
					<User class="h-3.5 w-3.5" strokeWidth={1.5} />
					Settings
				</button>
				<button
					type="button"
					onclick={() => goTo('/withdraw')}
					class="w-full flex items-center gap-2 h-[32px] px-2.5 rounded-[5px] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors text-left bg-transparent border-none cursor-pointer"
				>
					<Wallet class="h-3.5 w-3.5" strokeWidth={1.5} />
					Withdraw
				</button>

				{#if $wallet}
					<div class="my-0.5 mx-2 border-t border-[var(--border-default)]"></div>
					<button
						type="button"
						onclick={() => { void disconnectWallet(); handleClose(); }}
						class="w-full flex items-center gap-2 h-[32px] px-2.5 rounded-[5px] text-[12px] text-[var(--error)] hover:bg-[rgba(235,87,87,0.08)] transition-colors text-left bg-transparent border-none cursor-pointer"
					>
						<LogOut class="h-3.5 w-3.5" strokeWidth={1.5} />
						Disconnect
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
