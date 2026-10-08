<script lang="ts">
	/**
	 * Local mode (desktop app / store served by necter-miner): the miner's embedded wallet is the only wallet.
	 * Use it when it exists, unlock it when locked, otherwise create one from a new recovery phrase or import a
	 * recovery phrase / private key. Browser wallets and WalletConnect are never offered here (errata E8 CSP).
	 */
	import { onMount } from 'svelte';
	import { Loader2, Cpu, Sparkles, KeyRound, FileKey2, ArrowLeft, Eye, EyeOff, ShieldAlert, Lock, CheckCircle2 } from 'lucide-svelte';
	import { minerApi, minerConnection, connectMiner } from '$lib/local/miner';
	import { connectMinerWallet } from '$lib/stores/wallet';
	import { shortAddress } from '$lib/format';
	import {
		walletState,
		walletErrorMessage,
		createWithPhrase,
		importPhrase,
		importPrivateKey,
		previewPhrase,
		unlockWallet,
		phraseWords,
		phraseLengthOk,
		looksLikePrivateKey,
		confirmationOk,
		MAX_ACCOUNT_INDEX,
		type LocalWalletState,
		type CreatedWallet
	} from '$lib/local/wallet-setup';

	type Step = 'menu' | 'create' | 'backup' | 'confirm' | 'import-phrase' | 'import-key' | 'done';

	let { step = $bindable<Step>('menu'), onDone }: { step?: Step; onDone?: () => void } = $props();

	let ws = $state<LocalWalletState | null>(null);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state<string | null>(null);

	// create
	let length = $state<12 | 24>(12);
	let created = $state<CreatedWallet | null>(null);
	let revealed = $state(false);
	let savedIt = $state(false);
	let answers = $state<Record<number, string>>({});

	// import (phrase)
	let phraseText = $state('');
	let showAdvanced = $state(false);
	let accountIndex = $state(0);
	let passphrase = $state('');
	let preview = $state<{ address: string | null; error: string | null; checking: boolean }>({ address: null, error: null, checking: false });

	// import (key)
	let keyText = $state('');
	let showKey = $state(false);

	let doneAddress = $state<string | null>(null);

	const words = $derived(phraseWords(phraseText));
	const lengthOk = $derived(phraseLengthOk(words));

	async function load() {
		loading = true;
		error = null;
		try {
			if ($minerConnection.state !== 'ready') await connectMiner();
			if ($minerConnection.state !== 'ready') {
				ws = null;
				return;
			}
			ws = walletState(await minerApi.wallet());
		} catch (e) {
			error = walletErrorMessage(e);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
	});

	function go(s: Step) {
		error = null;
		step = s;
	}

	function wipe() {
		created = null;
		answers = {};
		revealed = false;
		savedIt = false;
		phraseText = '';
		passphrase = '';
		keyText = '';
		preview = { address: null, error: null, checking: false };
	}

	async function run(fn: () => Promise<void>) {
		busy = true;
		error = null;
		try {
			await fn();
		} catch (e) {
			error = walletErrorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function finish(address: string) {
		wipe();
		doneAddress = address;
		ws = walletState(await minerApi.wallet());
		step = 'done';
	}

	const useExisting = () =>
		run(async () => {
			const w = await connectMinerWallet();
			if (!w) throw new Error('The miner wallet is locked.');
			onDone?.();
		});

	const unlock = () =>
		run(async () => {
			await unlockWallet();
			const w = await connectMinerWallet();
			if (!w) throw new Error('The miner wallet is still locked.');
			onDone?.();
		});

	const create = () =>
		run(async () => {
			created = await createWithPhrase(length);
			answers = {};
			step = 'backup';
		});

	const confirmBackup = () =>
		run(async () => {
			if (!created || !confirmationOk(created.words, created.confirm, answers)) {
				throw new Error('Those words do not match your recovery phrase. Check your copy and try again.');
			}
			await finish(created.address);
		});

	const doImportPhrase = () =>
		run(async () => {
			const a = await importPhrase({ text: phraseText, passphrase, accountIndex });
			await finish(a);
		});

	const doImportKey = () =>
		run(async () => {
			const a = await importPrivateKey(keyText);
			await finish(a);
		});

	// Live check of the pasted phrase through the miner (checksum + derived address); nothing is stored.
	let previewSeq = 0;
	$effect(() => {
		const text = words.join(' ');
		const ok = lengthOk;
		const idx = accountIndex;
		const pass = passphrase;
		if (step !== 'import-phrase' || !ok) {
			preview = { address: null, error: null, checking: false };
			return;
		}
		const seq = ++previewSeq;
		preview = { address: null, error: null, checking: true };
		const t = setTimeout(async () => {
			try {
				const a = await previewPhrase({ text, passphrase: pass, accountIndex: idx });
				if (seq === previewSeq) preview = { address: a, error: null, checking: false };
			} catch (e) {
				if (seq === previewSeq) preview = { address: null, error: walletErrorMessage(e), checking: false };
			}
		}, 250);
		return () => clearTimeout(t);
	});

	const optionCls =
		'p-4 border border-[var(--border-default)] rounded-[8px] bg-[var(--surface-1)] transition-all hover:border-[var(--border-accent)] text-left w-full cursor-pointer';
	const primaryCls =
		'w-full h-[38px] rounded-[6px] bg-[var(--accent-base)] text-[#0C0C0E] text-[13px] font-semibold border-none cursor-pointer hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-default flex items-center justify-center gap-2';
	const inputCls =
		'w-full px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-base)]';
</script>

{#snippet back(to: Step)}
	<button
		type="button"
		class="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer p-0 mb-3"
		onclick={() => {
			wipe();
			go(to);
		}}
	>
		<ArrowLeft class="h-3.5 w-3.5" /> Back
	</button>
{/snippet}

<div data-testid="local-wallet-setup">
	{#if loading}
		<div class="py-8 flex justify-center"><Loader2 class="h-5 w-5 animate-spin text-[var(--text-tertiary)]" /></div>
	{:else if !ws}
		<div class="rounded-[8px] border border-dashed border-[var(--border-strong)] p-5 text-center">
			<p class="text-[13px] font-medium text-[var(--text-primary)]">Necter Miner is not reachable</p>
			<p class="text-[12px] text-[var(--text-secondary)] mt-1">The wallet lives in the miner on this computer. Make sure it is running, then try again.</p>
			<button type="button" class="btn-secondary mt-3" onclick={load}>Retry</button>
		</div>
	{:else if step === 'menu'}
		<div class="grid gap-2.5 py-2">
			{#if ws.kind === 'ready'}
				<button type="button" class="{optionCls} !border-[var(--border-accent)] !bg-[var(--accent-subtle)]" onclick={useExisting} disabled={busy} data-testid="use-miner-wallet">
					<div class="flex items-center gap-4">
						<div class="h-10 w-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center"><Cpu class="h-5 w-5 text-[var(--text-accent)]" strokeWidth={1.6} /></div>
						<div class="flex-1 min-w-0">
							<span class="font-medium text-[14px]">Use this miner's wallet</span>
							<p class="text-[12px] text-[var(--text-secondary)] font-mono truncate">{shortAddress(ws.address)}</p>
						</div>
						{#if busy}<Loader2 class="h-5 w-5 animate-spin text-[var(--text-accent)]" />{/if}
					</div>
				</button>
			{:else if ws.kind === 'locked'}
				<button type="button" class={optionCls} onclick={unlock} disabled={busy} data-testid="unlock-miner-wallet">
					<div class="flex items-center gap-4">
						<div class="h-10 w-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center"><Lock class="h-5 w-5 text-[var(--text-accent)]" strokeWidth={1.6} /></div>
						<div class="flex-1 min-w-0">
							<span class="font-medium text-[14px]">Unlock the miner wallet</span>
							<p class="text-[12px] text-[var(--text-secondary)] font-mono truncate">{shortAddress(ws.address)} · key held by your system keychain</p>
						</div>
						{#if busy}<Loader2 class="h-5 w-5 animate-spin text-[var(--text-accent)]" />{/if}
					</div>
				</button>
			{:else if ws.kind === 'external'}
				<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-4 text-[12px] text-[var(--text-secondary)]">
					This miner is set to sign with an external wallet{ws.address ? ` (${shortAddress(ws.address)})` : ''}. Switch it to the embedded wallet
					(<span class="font-mono">wallet.mode = "embedded"</span>) to create or import a wallet here.
				</div>
			{:else}
				<button type="button" class={optionCls} onclick={() => go('create')} data-testid="local-create">
					<div class="flex items-center gap-4">
						<div class="h-10 w-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center"><Sparkles class="h-5 w-5 text-[var(--text-accent)]" strokeWidth={1.6} /></div>
						<div class="flex-1">
							<span class="font-medium text-[14px]">Create a new wallet</span>
							<p class="text-[12px] text-[var(--text-secondary)]">Get a recovery phrase to back up</p>
						</div>
					</div>
				</button>
				<button type="button" class={optionCls} onclick={() => go('import-phrase')} data-testid="local-import-phrase">
					<div class="flex items-center gap-4">
						<div class="h-10 w-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center"><FileKey2 class="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.6} /></div>
						<div class="flex-1">
							<span class="font-medium text-[14px]">Import with recovery phrase</span>
							<p class="text-[12px] text-[var(--text-secondary)]">12 or 24 words from any Ethereum wallet</p>
						</div>
					</div>
				</button>
				<button type="button" class={optionCls} onclick={() => go('import-key')} data-testid="local-import-key">
					<div class="flex items-center gap-4">
						<div class="h-10 w-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center"><KeyRound class="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.6} /></div>
						<div class="flex-1">
							<span class="font-medium text-[14px]">Import with private key</span>
							<p class="text-[12px] text-[var(--text-secondary)]">A single account's 64-character key</p>
						</div>
					</div>
				</button>
			{/if}
		</div>
		<p class="text-[11px] text-[var(--text-tertiary)] mt-2">
			Keys stay on this computer, encrypted with a key held by your system keychain. Necter never sees them.
		</p>
	{:else if step === 'create'}
		{@render back('menu')}
		<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">Create a new wallet</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mt-1 mb-4">
			You will see a recovery phrase once. It is the only way to restore this wallet on another device — write it down and keep it offline.
		</p>
		<div class="flex gap-2 mb-4" role="radiogroup" aria-label="Phrase length">
			{#each [12, 24] as n (n)}
				<button
					type="button"
					role="radio"
					aria-checked={length === n}
					class="flex-1 h-[34px] rounded-[6px] text-[13px] border cursor-pointer {length === n ? 'border-[var(--accent-base)] bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium' : 'border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)]'}"
					onclick={() => (length = n as 12 | 24)}
				>
					{n} words
				</button>
			{/each}
		</div>
		<button type="button" class={primaryCls} onclick={create} disabled={busy} data-testid="create-wallet">
			{#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if}Create wallet
		</button>
	{:else if step === 'backup' && created}
		<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">Your recovery phrase</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mt-1 mb-3">
			Write these {created.words.length} words down in order. Anyone with them controls the wallet. They will not be shown again.
		</p>
		<div class="relative">
			<ol
				class="grid grid-cols-3 gap-1.5 p-3 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border-default)] m-0 list-none select-text {revealed ? '' : 'blur-[6px] select-none'}"
				data-testid="recovery-phrase"
				aria-hidden={!revealed}
			>
				{#each created.words as w, i (i)}
					<li class="flex items-baseline gap-1.5 px-2 py-1 rounded-[5px] bg-[var(--surface-1)] text-[12px] font-mono">
						<span class="text-[10px] text-[var(--text-tertiary)] w-4 text-right">{i + 1}</span><span class="text-[var(--text-primary)]">{w}</span>
					</li>
				{/each}
			</ol>
			{#if !revealed}
				<button type="button" class="absolute inset-0 m-auto h-[34px] w-fit px-4 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border-default)] text-[12px] font-medium cursor-pointer inline-flex items-center gap-1.5" onclick={() => (revealed = true)} data-testid="reveal-phrase">
					<Eye class="h-3.5 w-3.5" /> Reveal phrase
				</button>
			{/if}
		</div>
		<label class="flex items-start gap-2 mt-4 text-[12px] text-[var(--text-secondary)] cursor-pointer">
			<input type="checkbox" bind:checked={savedIt} class="mt-0.5 h-4 w-4 accent-[var(--accent-base)]" data-testid="saved-phrase" />
			I have written down my recovery phrase and stored it somewhere safe.
		</label>
		<button type="button" class="{primaryCls} mt-4" disabled={!revealed || !savedIt} onclick={() => go('confirm')} data-testid="backup-continue">Continue</button>
	{:else if step === 'confirm' && created}
		<button type="button" class="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] bg-transparent border-none cursor-pointer p-0 mb-3" onclick={() => go('backup')}>
			<ArrowLeft class="h-3.5 w-3.5" /> Show phrase again
		</button>
		<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">Confirm your backup</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mt-1 mb-3">Enter these words from your written copy.</p>
		<div class="grid gap-2">
			{#each created.confirm as i (i)}
				<label class="flex items-center gap-3">
					<span class="text-[12px] text-[var(--text-secondary)] w-16">Word #{i + 1}</span>
					<input
						class="{inputCls} h-[34px] font-mono"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						bind:value={answers[i]}
						data-testid="confirm-word-{i + 1}"
					/>
				</label>
			{/each}
		</div>
		<button type="button" class="{primaryCls} mt-4" onclick={confirmBackup} disabled={busy || created.confirm.some((i) => !(answers[i] ?? '').trim())} data-testid="confirm-backup">
			{#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if}Confirm and use wallet
		</button>
	{:else if step === 'import-phrase'}
		{@render back('menu')}
		<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">Import with recovery phrase</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mt-1 mb-3">Paste or type your 12 or 24 words, separated by spaces.</p>
		<textarea
			class="{inputCls} py-2 h-[96px] font-mono resize-none"
			placeholder="word1 word2 word3 …"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			bind:value={phraseText}
			data-testid="phrase-input"
		></textarea>
		<div class="flex items-center justify-between mt-1.5 text-[11px]">
			<span class={words.length && !lengthOk ? 'text-[var(--warning,var(--text-tertiary))]' : 'text-[var(--text-tertiary)]'}>{words.length} words</span>
			{#if preview.checking}
				<span class="text-[var(--text-tertiary)] inline-flex items-center gap-1"><Loader2 class="h-3 w-3 animate-spin" /> Checking…</span>
			{:else if preview.address}
				<span class="text-[var(--text-secondary)] inline-flex items-center gap-1" data-testid="phrase-preview"><CheckCircle2 class="h-3 w-3 text-[var(--success,var(--text-accent))]" /> <span class="font-mono">{preview.address}</span></span>
			{:else if preview.error}
				<span class="text-[var(--error)]" data-testid="phrase-error">{preview.error}</span>
			{/if}
		</div>
		<button type="button" class="mt-3 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer p-0" onclick={() => (showAdvanced = !showAdvanced)} data-testid="phrase-advanced">
			{showAdvanced ? '− Hide advanced' : '+ Advanced: account, passphrase'}
		</button>
		{#if showAdvanced}
			<div class="grid grid-cols-[1fr_1.4fr] gap-2 mt-2">
				<label class="text-[11px] text-[var(--text-tertiary)]">
					Account
					<select class="{inputCls} h-[34px] mt-1" bind:value={accountIndex} data-testid="account-index">
						{#each Array.from({ length: MAX_ACCOUNT_INDEX + 1 }, (_, i) => i) as i (i)}
							<option value={i}>Account {i + 1} (index {i})</option>
						{/each}
					</select>
				</label>
				<label class="text-[11px] text-[var(--text-tertiary)]">
					BIP-39 passphrase (optional)
					<input type="password" class="{inputCls} h-[34px] mt-1" autocomplete="off" bind:value={passphrase} />
				</label>
			</div>
			<p class="text-[11px] text-[var(--text-tertiary)] mt-1.5">Path m/44'/60'/0'/0/{accountIndex} — the standard Ethereum account path.</p>
		{/if}
		<button type="button" class="{primaryCls} mt-4" onclick={doImportPhrase} disabled={busy || !preview.address} data-testid="import-phrase-submit">
			{#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if}Import wallet
		</button>
	{:else if step === 'import-key'}
		{@render back('menu')}
		<h3 class="text-[14px] font-semibold text-[var(--text-primary)]">Import with private key</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mt-1 mb-3">Paste the account's private key (64 hexadecimal characters).</p>
		<div class="relative">
			<input
				type={showKey ? 'text' : 'password'}
				class="{inputCls} h-[38px] pr-10 font-mono"
				placeholder="0x…"
				autocomplete="off"
				spellcheck="false"
				bind:value={keyText}
				data-testid="key-input"
			/>
			<button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1" aria-label={showKey ? 'Hide key' : 'Show key'} onclick={() => (showKey = !showKey)}>
				{#if showKey}<EyeOff class="h-4 w-4 text-[var(--text-tertiary)]" />{:else}<Eye class="h-4 w-4 text-[var(--text-tertiary)]" />{/if}
			</button>
		</div>
		{#if keyText && !looksLikePrivateKey(keyText)}
			<p class="text-[11px] text-[var(--text-tertiary)] mt-1.5">A private key is 64 hexadecimal characters, optionally starting with 0x.</p>
		{/if}
		<button type="button" class="{primaryCls} mt-4" onclick={doImportKey} disabled={busy || !looksLikePrivateKey(keyText)} data-testid="import-key-submit">
			{#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if}Import wallet
		</button>
	{:else if step === 'done'}
		<div class="text-center py-4" data-testid="wallet-ready">
			<CheckCircle2 class="h-8 w-8 mx-auto text-[var(--text-accent)]" strokeWidth={1.6} />
			<p class="text-[14px] font-semibold text-[var(--text-primary)] mt-2">Wallet ready</p>
			<p class="text-[12px] font-mono text-[var(--text-secondary)] mt-1 break-all">{doneAddress}</p>
			<button type="button" class="{primaryCls} mt-4" onclick={useExisting} disabled={busy} data-testid="wallet-continue">Continue</button>
		</div>
	{/if}

	{#if error}
		<p class="mt-3 text-[12px] text-[var(--error)] flex items-start gap-1.5" role="alert"><ShieldAlert class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />{error}</p>
	{/if}
</div>
