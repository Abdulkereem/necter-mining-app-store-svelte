<script lang="ts">
	import {
		showConnectModal,
		isConnecting,
		isSigningIn,
		connectWallet,
		signIn,
		wallet,
		signedIn,
		walletOptions
	} from '$lib/stores/wallet';
	import { discoverWallets, type WalletOption } from '$lib/wallet/providers';
	import { errorMessage } from '$lib/api/http';
	import { APP_MODE } from '$lib/config';
	import { shortAddress } from '$lib/format';
	import { Loader2, Wallet, ShieldCheck, X } from 'lucide-svelte';
	import LocalWalletSetup from '$lib/components/wallet/LocalWalletSetup.svelte';

	const LOCAL = APP_MODE === 'local';

	let error = $state<string | null>(null);
	let pendingId = $state<string | null>(null);
	// Local mode: step of the miner-wallet setup. While a new recovery phrase is on screen the dialog cannot be
	// dismissed by accident (Escape / backdrop), only through its own buttons.
	let localStep = $state<'menu' | 'create' | 'backup' | 'confirm' | 'import-phrase' | 'import-key' | 'done'>('menu');
	const pinned = $derived(LOCAL && (localStep === 'backup' || localStep === 'confirm'));

	$effect(() => {
		if ($showConnectModal) {
			error = null;
			localStep = 'menu';
			discoverWallets();
		}
	});

	// Close automatically once signed in.
	$effect(() => {
		if ($showConnectModal && $signedIn) showConnectModal.set(false);
	});

	function handleClose() {
		if (pinned) return;
		showConnectModal.set(false);
	}

	const localTitle = $derived(
		localStep === 'backup' || localStep === 'confirm' ? 'Back up your wallet' : localStep === 'done' ? 'Wallet ready' : 'Set up your wallet'
	);

	function friendly(e: unknown): string {
		const code = (e as { code?: number })?.code;
		if (code === 4001) return 'Request rejected in the wallet.';
		if (code === -32002) return 'Your wallet already has a pending request — open it to continue.';
		return errorMessage(e);
	}

	async function choose(opt: WalletOption) {
		error = null;
		pendingId = opt.id;
		try {
			await connectWallet(opt);
			await signIn();
		} catch (e) {
			error = friendly(e);
		} finally {
			pendingId = null;
		}
	}

	async function retrySignIn() {
		error = null;
		try {
			await signIn();
		} catch (e) {
			error = friendly(e);
		}
	}
</script>

{#if $showConnectModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] bg-black/60 flex items-end md:items-center justify-center"
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
	>
		<div
			class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-t-[12px] md:rounded-[12px] w-full md:max-w-md md:mx-4 p-6"
			role="dialog"
			aria-modal="true"
			aria-labelledby="connect-title"
			data-testid="connect-modal"
		>
			<div class="flex items-start justify-between mb-4">
				<div>
					<h2 id="connect-title" class="text-[16px] font-semibold text-[var(--text-primary)]">
						{LOCAL ? localTitle : $wallet && !$signedIn ? 'Sign in' : 'Connect Wallet'}
					</h2>
					<p class="text-[13px] text-[var(--text-secondary)] mt-1" hidden={LOCAL && localStep !== 'menu'}>
						{#if LOCAL}
							{#if localStep === 'menu'}Mining uses a wallet kept by Necter Miner on this computer. Create one or bring your own.{/if}
						{:else if $wallet && !$signedIn}
							Sign a message to prove you own {shortAddress($wallet.address)}. It is free and sends no transaction.
						{:else}
							Connect a wallet on Ethereum Sepolia to mine, publish projects and manage your earnings.
						{/if}
					</p>
				</div>
				<button type="button" onclick={handleClose} hidden={pinned} class="h-7 w-7 flex items-center justify-center rounded-[5px] hover:bg-[var(--surface-2)] bg-transparent border-none cursor-pointer" aria-label="Close">
					<X class="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.8} />
				</button>
			</div>

			{#if LOCAL}
				<LocalWalletSetup bind:step={localStep} onDone={() => showConnectModal.set(false)} />
			{:else if $wallet && !$signedIn}
				<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4 flex items-center gap-3">
					<ShieldCheck class="h-5 w-5 text-[var(--text-accent)] flex-shrink-0" strokeWidth={1.6} />
					<div class="flex-1 min-w-0">
						<p class="text-[13px] font-medium font-mono text-[var(--text-primary)] truncate">{$wallet.address}</p>
						<p class="text-[11px] text-[var(--text-tertiary)]">{$wallet.connector.name}</p>
					</div>
				</div>
				<button
					type="button"
					onclick={retrySignIn}
					disabled={$isSigningIn}
					class="mt-4 w-full h-[38px] rounded-[6px] bg-[var(--accent-base)] text-[#0C0C0E] text-[13px] font-semibold border-none cursor-pointer hover:bg-[var(--accent-hover)] disabled:opacity-60 flex items-center justify-center gap-2"
					data-testid="modal-sign-in"
				>
					{#if $isSigningIn}<Loader2 class="h-4 w-4 animate-spin" />Check your wallet…{:else}Sign in with Ethereum{/if}
				</button>
			{:else}
				<div class="grid gap-2.5 py-2">
					{#each $walletOptions as w (w.id)}
						<button
							type="button"
							class="p-4 border border-[var(--border-default)] rounded-[8px] bg-[var(--surface-1)] transition-all hover:border-[var(--border-accent)] text-left w-full {pendingId || $isConnecting ? 'opacity-60 pointer-events-none' : ''}"
							onclick={() => choose(w)}
							data-testid="wallet-option"
						>
							<div class="flex items-center gap-4">
								<div class="h-10 w-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
									{#if w.icon}
										<img src={w.icon} alt="" class="h-7 w-7" />
									{:else}
										<Wallet class="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.6} />
									{/if}
								</div>
								<div class="flex-1">
									<span class="font-medium text-[14px]">{w.name}</span>
									{#if w.kind === 'walletconnect'}
										<p class="text-[12px] text-[var(--text-secondary)]">Scan with a mobile wallet</p>
									{/if}
								</div>
								{#if pendingId === w.id}
									<Loader2 class="h-5 w-5 animate-spin text-[var(--text-accent)]" />
								{/if}
							</div>
						</button>
					{:else}
						{#if !LOCAL}
							<div class="rounded-[8px] border border-dashed border-[var(--border-strong)] p-5 text-center">
								<p class="text-[13px] font-medium text-[var(--text-primary)]">No browser wallet found</p>
								<p class="text-[12px] text-[var(--text-secondary)] mt-1">
									Install a wallet extension such as MetaMask or Rabby, then reload this page.
								</p>
								<a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" class="inline-block mt-3 text-[12px] font-medium text-[var(--text-accent)]">Get MetaMask →</a>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			{#if error}
				<p class="mt-3 text-[12px] text-[var(--error)]" role="alert">{error}</p>
			{/if}

			<div class="text-[11px] text-center text-[var(--text-tertiary)] mt-4" hidden={pinned}>
				Mining needs no Sepolia ETH — collateral, claims and the faucet are gasless.
			</div>
		</div>
	</div>
{/if}
