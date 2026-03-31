<script lang="ts">
	import { showConnectModal, isConnecting, connectWallet } from '$lib/stores/wallet';
	import { Loader2 } from 'lucide-svelte';

	const walletOptions = [
		{
			id: 'metamask',
			name: 'MetaMask',
			icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEyIiBoZWlnaHQ9IjE4OSIgdmlld0JveD0iMCAwIDIxMiAxODkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xXzMpIj4KPHBhdGggZD0iTTYwLjc1OTYgMTczLjI1MUw4OC41MTI1IDE4MC41NjNWMTc0LjE0M0w5MS4wMTI1IDE3MS42NDNIMTEzLjAxM1YxODkuMDYzSDkxLjAxMjVMNjAuNzU5NiAxNzMuMjUxWiIgZmlsbD0iI0NERDE1MiIvPgo8cGF0aCBkPSJNMTUxLjI1IDE3My4yNTFMMTIzLjQ5NyAxODAuNTYzVjE3NC4xNDNMMTIwLjk5NyAxNzEuNjQzSDk4Ljk5NjlWMTg5LjA2M0gxMjAuOTk3TDE1MS4yNSAxNzMuMjUxWiIgZmlsbD0iI0NERDE1MiIvPgo8L2c+Cjwvc3ZnPgo=',
			popular: true
		},
		{
			id: 'coinbase',
			name: 'Coinbase Wallet',
			icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiB2aWV3Qm94PSIwIDAgMTAyNCAxMDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8Y2lyY2xlIGN4PSI1MTIiIGN5PSI1MTIiIHI9IjUxMiIgZmlsbD0iIzAwNTJGRiIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE1MiA1MTJDMTU1IDcxMSAzMTMgODcyIDUxMiA4NzJDNzExIDg3MiA4NzIgNzExIDg3MiA1MTJDODcyIDMxMyA3MTEgMTUyIDUxMiAxNTJDMzEzIDE1MiAxNTUgMzEzIDE1MiA1MTJaTTQyMCA0MTZINDE2VjYwOEg2MDRWNjA4SDYwOFY0MTZINjA0SDQyMFoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
			popular: true
		},
		{
			id: 'walletconnect',
			name: 'WalletConnect',
			icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iMTYiIGZpbGw9IiMzQjk5RkMiLz4KPHBhdGggZD0iTTkuNTg4NiAxMS41MjY0QzEzLjEyOTMgNy45ODU3MSAxOC44NzA3IDcuOTg1NzEgMjIuNDExNCAxMS41MjY0TDIyLjkwOTMgMTIuMDI0M0MyMy4wODY0IDEyLjIwMTQgMjMuMDg2NCAxMi40OTI5IDIyLjkwOTMgMTIuNjdMMjEuMTk2NCAxNC4zODI5QzIxLjEwNzkgMTQuNDcxNCAyMC45NjIxIDE0LjQ3MTQgMjAuODczNiAxNC4zODI5TDIwLjE1NTcgMTMuNjY1QzE3Ljc0MjEgMTEuMjUxNCAxMy44NTc5IDExLjI1MTQgMTEuNDQ0MyAxMy42NjVMMTAuNjcxNCAxNC40Mzc5QzEwLjU4MjkgMTQuNTI2NCAxMC40MzcxIDE0LjUyNjQgMTAuMzQ4NiAxNC40Mzc5TDguNjM1NzEgMTIuNzI1QzguNDU4NTcgMTIuNTQ3OSA4LjQ1ODU3IDEyLjI1NjQgOC42MzU3MSAxMi4wNzkzTDkuNTg4NiAxMS41MjY0Wk0yNS4yMiAxNC4zMzVMMjYuNzY2NCAxNS44ODE0QzI2Ljk0MzYgMTYuMDU4NiAyNi45NDM2IDE2LjM1IDI2Ljc2NjQgMTYuNTI3MUwyMC4wNDM2IDIzLjI1QzE5Ljg2NjQgMjMuNDI3MSAxOS41NzUgMjMuNDI3MSAxOS4zOTc5IDIzLjI1TDE0LjQ2MjkgMTguMzE1QzE0LjQxODYgMTguMjcwNyAxNC4zNDU3IDE4LjI3MDcgMTQuMzAxNCAxOC4zMTVMOS4zNjY0MyAyMy4yNUM5LjE4OTI5IDIzLjQyNzEgOC44OTc4NiAyMy40MjcxIDguNzIwNzEgMjMuMjVMMi4wMDE0MyAxNi41Mjc5QzEuODI0MjkgMTYuMzUwNyAxLjgyNDI5IDE2LjA1OTMgMi4wMDE0MyAxNS44ODIxTDMuNTQ3ODYgMTQuMzM1N0MzLjcyNSAxNC4xNTg2IDQuMDE2NDMgMTQuMTU4NiA0LjE5MzU3IDE0LjMzNTdMOS4xMjg1NyAxOS4yNzA3QzkuMTcyODYgMTkuMzE1IDkuMjQ1NzEgMTkuMzE1IDkuMjkgMTkuMjcwN0wxNC4yMjUgMTQuMzM1N0MxNC40MDIxIDE0LjE1ODYgMTQuNjkzNiAxNC4xNTg2IDE0Ljg3MDcgMTQuMzM1N0wxOS44MDU3IDE5LjI3MDdDMTkuODUgMTkuMzE1IDE5LjkyMjkgMTkuMzE1IDE5Ljk2NzEgMTkuMjcwN0wyNC45MDIxIDE0LjMzNTdDMjUuMDc5MyAxNC4xNTg2IDI1LjM3MDcgMTQuMTU4NiAyNS41NDc5IDE0LjMzNTdMMjUuMjIgMTQuMzM1WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
			popular: false
		},
		{
			id: 'phantom',
			name: 'Phantom',
			icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZD0iTTExMC41NjQgNjQuMzI0MkM5Ny44OTQyIDY0LjMyNDIgODcuOTQxOSA1NC4zNzIgODcuOTQxOSA0MS43MDIxQzg3Ljk0MTkgMzguMTM2MyA4NC4wMzkxIDM2LjM3MTUgODEuMTE5MSAzOC41NjNDNjkuODAxMiA0Ni44NTggNjQuMDAwNyA2MS4wMjM1IDY0LjAwMDcgNzYuOTk5NUM2NC4wMDA3IDkzLjQ0MjkgNzcuNTU3NSAxMDYuOTk5IDk0LjAwMSAxMDYuOTk5QzExMC40NDQgMTA2Ljk5OSAxMjQgOTMuNDQyOSAxMjQgNzYuOTk5NVY3Ni41MTdDMTI0IDY5Ljc3MjkgMTE4LjIyNyA2NC4zMjQyIDExMC41NjQgNjQuMzI0MloiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8xXzMpIi8+CjxwYXRoIGQ9Ik0xNy40MzYgNjQuMzI0MkMzMC4xMDU4IDY0LjMyNDIgNDAuMDU4MSA1NC4zNzIgNDAuMDU4MSA0MS43MDIxQzQwLjA1ODEgMzguMTM2MyA0My45NjA5IDM2LjM3MTUgNDYuODgwOSAzOC41NjNDNTguMTk4OCA0Ni44NTggNjMuOTk5MyA2MS4wMjM1IDYzLjk5OTMgNzYuOTk5NUM2My45OTkzIDkzLjQ0MjkgNTAuNDQyNSAxMDYuOTk5IDM0Ljk5OSAxMDYuOTk5QzE4LjU1NTUgMTA2Ljk5OSA0IDkzLjQ0MjkgNCA3Ni45OTk1Vjc2LjUxN0M0IDY5Ljc3MjkgOS43NzI5OCA2NC4zMjQyIDE3LjQzNiA2NC4zMjQyWiIgZmlsbD0idXJsKCNwYWludDFfbGluZWFyXzFfMykiLz4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8xXzMiIHgxPSI4OSIgeTE9IjI4IiB4Mj0iMTI0IiB5Mj0iMTA2Ljk5OSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjNTM0QkI1Ii8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzU1MUJGOSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MV9saW5lYXJfMV8zIiB4MT0iMzkiIHkxPSIyOCIgeDI9IjQiIHkyPSIxMDYuOTk5IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiM1MzRCQjUiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNTUxQkY5Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==',
			popular: false
		}
	];

	function handleClose() {
		showConnectModal.set(false);
	}

	function handleConnect(walletId: string) {
		connectWallet(walletId);
	}
</script>

{#if $showConnectModal}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] bg-black/60 flex items-end md:items-center justify-center"
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
	>
		<!-- Modal -->
		<div
			class="bg-[var(--surface-1)] border border-[var(--border)] rounded-t-[12px] md:rounded-[12px] w-full md:max-w-md md:mx-4 p-6"
			role="dialog"
			aria-modal="true"
		>
			<div class="mb-4">
				<h2 class="text-[16px] font-semibold text-[var(--text-primary)]">Connect Wallet</h2>
				<p class="text-[13px] text-[var(--text-secondary)] mt-1">
					Connect your wallet to start mining and manage your earnings.
				</p>
			</div>
			<div class="grid gap-3 py-4">
				{#each walletOptions as w (w.id)}
					<button
						type="button"
						class="p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface-1)] transition-all hover:border-[var(--border-accent)] text-left w-full {$isConnecting ? 'opacity-50 pointer-events-none' : ''}"
						onclick={() => handleConnect(w.id)}
					>
						<div class="flex items-center gap-4">
							<div class="h-10 w-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
								<img src={w.icon} alt={w.name} class="h-8 w-8" />
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="font-medium">{w.name}</span>
									{#if w.popular}
										<span class="text-xs bg-[var(--accent-subtle)] text-primary px-2 py-0.5 rounded">Popular</span>
									{/if}
								</div>
							</div>
							{#if $isConnecting}
								<Loader2 class="h-5 w-5 animate-spin text-primary" />
							{/if}
						</div>
					</button>
				{/each}
			</div>
			<div class="text-xs text-center text-[var(--text-secondary)]">
				By connecting a wallet, you agree to Necter's Terms of Service and Privacy Policy.
			</div>
		</div>
	</div>
{/if}
