<script lang="ts">
	import { X, User, CreditCard, Cpu, Bell, LogOut } from 'lucide-svelte';
	import { wallet, actor, disconnectWallet } from '$lib/stores/wallet';
	import { backendState, backend } from '$lib/stores/backend';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { showToast } from '$lib/stores/toast';

	let { open = $bindable(false) }: { open: boolean } = $props();
	let tab = $state<'menu' | 'profile' | 'wallet' | 'hardware' | 'notifications'>('menu');

	function handleClose() {
		open = false;
		tab = 'menu';
	}
</script>

{#if open && $wallet}
	<div class="fixed inset-0 z-50 flex items-end md:items-center justify-center md:justify-end">
		<div class="absolute inset-0 bg-black/40" onclick={handleClose} role="presentation"></div>
		<div class="relative w-[320px] max-h-[480px] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-default)] rounded-xl md:mr-4 mb-4 md:mb-0">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
				<h2 class="text-[14px] font-semibold text-[var(--text-primary)]">
					{tab === 'menu' ? 'Account' : tab === 'profile' ? 'Profile' : tab === 'wallet' ? 'Wallet' : tab === 'hardware' ? 'Hardware' : 'Notifications'}
				</h2>
				<button onclick={handleClose} class="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] p-1 leading-none">
					<X size={14} strokeWidth={2} />
				</button>
			</div>

			{#if tab === 'menu'}
				<!-- Wallet info -->
				<div class="px-5 py-4 border-b border-[var(--border-default)]">
					<div class="flex items-center gap-3">
						<img src={minerAvatarDataUri($actor?.minerId ?? $wallet.address)} alt="" class="h-10 w-10 rounded-[8px]" />
						<div class="flex-1 min-w-0">
							<p class="text-[13px] font-mono text-[var(--text-primary)] truncate">{$wallet.address.slice(0, 8)}...{$wallet.address.slice(-6)}</p>
							<p class="text-[12px] text-[var(--text-tertiary)]">Connected</p>
						</div>
					</div>
				</div>

				<!-- Menu items -->
				<div class="p-2">
					{#each [
						{ id: 'profile', label: 'Profile', icon: User },
						{ id: 'wallet', label: 'Wallet & Assets', icon: CreditCard },
						{ id: 'hardware', label: 'Hardware', icon: Cpu },
						{ id: 'notifications', label: 'Notifications', icon: Bell },
					] as item}
						<button onclick={() => tab = item.id} class="w-full flex items-center gap-3 px-3 py-2.5 rounded-[5px] hover:bg-[var(--surface-2)] transition-colors text-left bg-transparent border-none cursor-pointer">
							<svelte:component this={item.icon} class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
							<span class="text-[13px] text-[var(--text-primary)]">{item.label}</span>
						</button>
					{/each}
					<div class="border-t border-[var(--border-default)] mt-2 pt-2">
						<button onclick={() => { disconnectWallet(); handleClose(); }} class="w-full flex items-center gap-3 px-3 py-2.5 rounded-[5px] hover:bg-[var(--surface-2)] transition-colors text-left bg-transparent border-none cursor-pointer">
							<LogOut class="h-4 w-4 text-[var(--error)]" strokeWidth={1.5} />
							<span class="text-[13px] text-[var(--error)]">Disconnect</span>
						</button>
					</div>
				</div>

			{:else}
				<!-- Sub-page with back button -->
				<div class="p-4">
					<button onclick={() => tab = 'menu'} class="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer mb-3">
						← Back
					</button>
					<p class="text-[13px] text-[var(--text-tertiary)]">
						Manage your {tab} in <a href="/settings" onclick={handleClose} class="text-[var(--text-accent)]">full Settings page</a>.
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
