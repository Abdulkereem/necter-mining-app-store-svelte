<script lang="ts">
	import { User, Wallet, LogOut } from 'lucide-svelte';
	import { wallet, disconnectWallet } from '$lib/stores/wallet';
	import { backendState } from '$lib/stores/backend';
	import { goto } from '$app/navigation';

	let { open = $bindable(false) }: { open: boolean } = $props();

	function handleClose() {
		open = false;
	}

	function goTo(path: string) {
		handleClose();
		goto(path);
	}

	let balance = $derived(
		$wallet?.address ? ($backendState.walletBalancesByAddress[$wallet.address] ?? 0) : 0
	);
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
					<p class="text-[16px] font-semibold font-mono text-[var(--text-accent)]">{balance.toFixed(2)}</p>
					<p class="text-[10px] text-[var(--text-tertiary)]">NECTA</p>
				</div>
			{/if}

			<div class="border-t border-[var(--border-default)]"></div>

			<!-- Actions -->
			<div class="p-1">
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
						onclick={() => { disconnectWallet(); handleClose(); }}
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
