<script lang="ts">
	import { X, ArrowRight, ArrowLeft, CheckCircle2, Download, Wallet, Droplets, Pickaxe } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { wallet, signedIn, showConnectModal, signIn } from '$lib/stores/wallet';
	import { errorMessage } from '$lib/api/http';
	import toast from 'svelte-french-toast';
	import { me } from '$lib/stores/account';
	import { balances, nectaOf } from '$lib/stores/balances';
	import { formatToken } from '$lib/format';

	/**
	 * "How to start mining" walkthrough. Explains the real flow (no data is written here):
	 * install necter-miner → connect the owner wallet and bind the device → get test NECTA from the faucet →
	 * subscribe to a project (gasless collateral bond).
	 */
	let { open = $bindable(false), onClose }: { open: boolean; onClose: () => void } = $props();

	let step = $state(1);
	const LAST = 5;

	const necta = $derived(nectaOf($balances));
	const devices = $derived($me?.devices ?? 0);

	$effect(() => {
		if (!open) step = 1;
	});

	async function connect() {
		if (!$wallet) {
			showConnectModal.set(true);
			return;
		}
		try {
			await signIn();
		} catch (e) {
			toast.error(errorMessage(e));
		}
	}

	function finish(href: string) {
		onClose();
		void goto(href);
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/60" style="backdrop-filter: blur(4px);" onclick={onClose} role="presentation"></div>

		{#if step === 1}
			<!-- Step 1: Side-by-side layout with bee -->
			<div
				class="relative flex flex-col sm:flex-row max-h-[90vh] rounded-xl overflow-hidden border border-[var(--border-default)]"
				style="width: min(640px, calc(100vw - 32px));"
			>
				<!-- Bee image — top banner on mobile -->
				<div
					class="md:hidden w-full h-[100px] flex items-center justify-center"
					style="background: linear-gradient(170deg, #FF9809 0%, #FFE37D 100%); background-image: linear-gradient(170deg, #FF9809 0%, #FFE37D 100%), url('/brand/hero-honeycomb.png'); background-size: cover, 200px; background-blend-mode: normal, overlay;"
				>
					<img
						src="/brand/3d/bee-dark.png"
						alt=""
						loading="lazy"
						class="w-[80px] h-auto object-contain"
						style="filter: drop-shadow(0 4px 20px rgba(0,0,0,0.3));"
					/>
				</div>
				<!-- Bee image — left panel on desktop -->
				<div
					class="hidden md:flex w-[240px] shrink-0 items-center justify-center p-6"
					style="background: linear-gradient(170deg, #FF9809 0%, #FFE37D 100%); background-image: linear-gradient(170deg, #FF9809 0%, #FFE37D 100%), url('/brand/hero-honeycomb.png'); background-size: cover, 200px; background-blend-mode: normal, overlay;"
				>
					<img
						src="/brand/3d/bee-dark.png"
						alt=""
						loading="lazy"
						class="w-[180px] h-auto object-contain"
						style="filter: drop-shadow(0 4px 20px rgba(0,0,0,0.3));"
					/>
				</div>

				<!-- Right — content -->
				<div class="flex-1 bg-[var(--surface-1)] flex flex-col px-7 pt-7 pb-6">
					<!-- Close -->
					<button
						type="button"
						aria-label="Close"
						onclick={onClose}
						class="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] p-0.5 leading-none"
					>
						<X size={14} strokeWidth={2} />
					</button>

					<div class="flex-1">
						<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2.5">Getting started</p>
						<h2 class="text-[20px] font-semibold text-[var(--text-primary)] mb-2 leading-[26px]">How mining on Necter works</h2>
						<p class="text-[13px] text-[var(--text-secondary)] leading-5 mb-7">
							Your device runs project workloads in committee rounds. Matching results are verified and rewarded per epoch.
						</p>

						<div class="flex flex-col gap-3">
							{#each [
								{ num: '1', title: 'Install necter-miner', desc: 'On the phone, laptop or server that will mine' },
								{ num: '2', title: 'Connect your wallet', desc: 'Bind the device to the wallet that owns it' },
								{ num: '3', title: 'Get test NECTA', desc: 'Collateral comes from the testnet faucet' },
								{ num: '4', title: 'Subscribe to a project', desc: 'Bond collateral gaslessly and start earning' }
							] as item (item.num)}
								<div class="flex items-start gap-3">
									<div
										class="w-6 h-6 rounded-full bg-[var(--surface-3)] flex items-center justify-center shrink-0 text-[11px] font-semibold text-[var(--text-secondary)]"
									>
										{item.num}
									</div>
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)] m-0">{item.title}</p>
										<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5 mb-0">{item.desc}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<button onclick={() => (step = 2)} class="btn-subscribe w-full h-10 justify-center mt-5">
						Get Started <ArrowRight size={14} strokeWidth={2} />
					</button>
				</div>
			</div>
		{:else}
			<!-- Steps 2-5: Standard modal -->
			<div
				class="relative max-h-[90vh] bg-[var(--surface-1)] border border-[var(--border-default)] rounded-xl overflow-hidden overflow-y-auto"
				style="width: min(420px, calc(100vw - 32px));"
			>
				<!-- Top bar — progress + close -->
				<div class="flex items-center px-5 py-4 gap-3">
					<div class="flex-1 flex gap-[3px]">
						{#each [2, 3, 4, 5] as s (s)}
							<div
								class="flex-1 h-0.5 rounded-[1px] transition-colors duration-300"
								style="background: {s <= step ? 'var(--accent-base)' : 'var(--surface-3)'};"
							></div>
						{/each}
					</div>
					<button
						aria-label="Close"
						onclick={onClose}
						class="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] p-0.5 leading-none"
					>
						<X size={14} strokeWidth={2} />
					</button>
				</div>

				<!-- Content -->
				<div class="min-h-[340px] flex flex-col">
					{#if step === 2}
						<div class="flex-1 flex flex-col pt-2 px-6 pb-6">
							<div class="flex-1">
								<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2">Step 1 of 4</p>
								<div class="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] flex items-center justify-center mb-3">
									<Download size={18} strokeWidth={1.6} class="text-[var(--text-accent)]" />
								</div>
								<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1.5">Install necter-miner</h2>
								<p class="text-[12px] text-[var(--text-tertiary)] leading-5 mb-4">
									necter-miner runs project workloads in a sandboxed engine and reports its hardware profile and benchmark to the
									network. Each install creates its own device key.
								</p>
								<p class="text-[12px] text-[var(--text-secondary)] leading-5">
									The hardware checker shows how to install it and what your device can run.
								</p>
								{#if devices > 0}
									<div
										class="mt-4 p-3 rounded-[6px] border border-[var(--border-accent)] bg-[var(--accent-subtle)] flex items-center gap-2"
									>
										<CheckCircle2 size={14} class="text-[var(--text-accent)] shrink-0" />
										<p class="text-[12px] text-[var(--text-accent)] m-0">
											{devices} device{devices === 1 ? '' : 's'} already bound to your wallet
										</p>
									</div>
								{/if}
							</div>
							<div class="flex gap-2 mt-6">
								<button aria-label="Back" onclick={() => (step = 1)} class="btn-secondary h-10 px-4">
									<ArrowLeft size={14} strokeWidth={2} />
								</button>
								<button onclick={() => finish('/mining/hardware-checker')} class="btn-secondary flex-1 h-10 justify-center">
									Open hardware checker
								</button>
								<button onclick={() => (step = 3)} class="btn-subscribe flex-1 h-10 justify-center">Continue</button>
							</div>
						</div>
					{:else if step === 3}
						<div class="flex-1 flex flex-col pt-2 px-6 pb-6">
							<div class="flex-1">
								<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2">Step 2 of 4</p>
								<div class="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] flex items-center justify-center mb-3">
									<Wallet size={18} strokeWidth={1.6} class="text-[var(--text-accent)]" />
								</div>
								<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1.5">Connect your wallet</h2>
								<p class="text-[12px] text-[var(--text-tertiary)] leading-5 mb-4">
									Your wallet is your miner identity: it owns your devices, bonds collateral and receives rewards. In the miner,
									connect the same wallet and sign the binding message to link the device to it. Signing is free.
								</p>
								{#if $signedIn}
									<div
										class="p-3 rounded-[6px] border border-[var(--border-accent)] bg-[var(--accent-subtle)] flex items-center gap-2"
									>
										<CheckCircle2 size={14} class="text-[var(--text-accent)] shrink-0" />
										<p class="text-[12px] text-[var(--text-accent)] m-0">Wallet connected and signed in</p>
									</div>
								{:else}
									<button type="button" class="btn-secondary h-9 px-4" onclick={connect}>
										{$wallet ? 'Sign in with wallet' : 'Connect wallet'}
									</button>
								{/if}
							</div>
							<div class="flex gap-2 mt-6">
								<button aria-label="Back" onclick={() => (step = 2)} class="btn-secondary h-10 px-4">
									<ArrowLeft size={14} strokeWidth={2} />
								</button>
								<button onclick={() => (step = 4)} class="btn-subscribe flex-1 h-10 justify-center">Continue</button>
							</div>
						</div>
					{:else if step === 4}
						<div class="flex-1 flex flex-col pt-2 px-6 pb-6">
							<div class="flex-1">
								<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2">Step 3 of 4</p>
								<div class="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] flex items-center justify-center mb-3">
									<Droplets size={18} strokeWidth={1.6} class="text-[var(--text-accent)]" />
								</div>
								<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1.5">Get test NECTA</h2>
								<p class="text-[12px] text-[var(--text-tertiary)] leading-5 mb-4">
									Projects ask for NECTA collateral, which can be slashed for invalid results or missed rounds. On testnet the
									faucet sends it for free. You don't need Sepolia ETH: bonding is gasless, you only sign.
								</p>
								{#if necta}
									<div class="flex items-center justify-between p-3 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border-default)]">
										<span class="text-[12px] text-[var(--text-tertiary)]">Your balance</span>
										<span class="text-[13px] font-mono text-[var(--text-primary)]">{formatToken(necta.amount, necta.token)}</span>
									</div>
								{/if}
							</div>
							<div class="flex gap-2 mt-6">
								<button aria-label="Back" onclick={() => (step = 3)} class="btn-secondary h-10 px-4">
									<ArrowLeft size={14} strokeWidth={2} />
								</button>
								<button onclick={() => finish('/faucet')} class="btn-secondary flex-1 h-10 justify-center">Open faucet</button>
								<button onclick={() => (step = LAST)} class="btn-subscribe flex-1 h-10 justify-center">Continue</button>
							</div>
						</div>
					{:else}
						<!-- Done -->
						<div class="flex-1 flex flex-col items-center justify-center px-6 pb-8 pt-10 text-center">
							<div class="w-12 h-12 rounded-full flex items-center justify-center mb-4" style="background: rgba(76,183,130,0.12);">
								<Pickaxe size={22} strokeWidth={1.5} style="color: var(--success);" />
							</div>
							<p class="text-[11px] font-semibold text-[var(--text-accent)] uppercase tracking-[0.05em] mb-2">Step 4 of 4</p>
							<h2 class="text-[18px] font-semibold text-[var(--text-primary)] mb-1.5">Subscribe to a project</h2>
							<p class="text-[13px] text-[var(--text-secondary)] leading-5 max-w-[300px] mb-6">
								Pick a project, choose your device, check compatibility and bond collateral. Your device starts receiving rounds
								once the bond confirms.
							</p>
							<button onclick={() => finish('/discover')} class="btn-subscribe h-10 px-6">
								Browse projects <ArrowRight size={14} strokeWidth={2} />
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
