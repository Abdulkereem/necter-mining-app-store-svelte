/**
 * Local-mode wallet setup (desktop app / store served by necter-miner): create the miner's embedded wallet from a
 * fresh recovery phrase, import a recovery phrase or a private key, unlock, export. Browser wallets (injected,
 * EIP-6963) are never offered in local mode, and WalletConnect cannot load under the miner's CSP (errata E8).
 *
 * The miner does the cryptography (BIP-39 checksum, m/44'/60'/0'/0/i derivation, encrypted keystore); this module
 * only shapes input, drives the steps and keeps secrets out of long-lived state.
 */
import { minerApi, MinerApiError, type MinerWallet } from '$lib/local/miner';

/** Word counts BIP-39 allows; the UI creates 12 or 24. */
export const PHRASE_LENGTHS = [12, 15, 18, 21, 24] as const;
export const MAX_ACCOUNT_INDEX = 9;

/**
 * Splits pasted text into words: any case, whitespace, line breaks or commas, and the `1.` / `1)` numbering many
 * wallets print on their backup screens.
 */
export function phraseWords(text: string): string[] {
	return text
		.split(/[\s,]+/)
		.filter((w) => w !== '' && !/^\d+[.)]?$/.test(w))
		.map((w) => w.toLowerCase());
}

export function normalizePhrase(text: string): string {
	return phraseWords(text).join(' ');
}

export function phraseLengthOk(words: string[]): boolean {
	return (PHRASE_LENGTHS as readonly number[]).includes(words.length);
}

/** `0x` + 64 hex (or bare 64 hex). */
export function looksLikePrivateKey(s: string): boolean {
	return /^(0x)?[0-9a-fA-F]{64}$/.test(s.trim());
}

export function normalizePrivateKey(s: string): string {
	const t = s.trim();
	return (t.startsWith('0x') || t.startsWith('0X') ? '0x' + t.slice(2) : '0x' + t).toLowerCase();
}

export function accountIndexOk(i: number): boolean {
	return Number.isInteger(i) && i >= 0 && i <= MAX_ACCOUNT_INDEX;
}

/** `count` distinct word positions (0-based, sorted) the user must re-enter to confirm the backup. */
export function pickConfirmIndices(n: number, count = 3, rand: () => number = secureRandom): number[] {
	const all = Array.from({ length: n }, (_, i) => i);
	for (let i = all.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[all[i], all[j]] = [all[j], all[i]];
	}
	return all.slice(0, Math.min(count, n)).sort((a, b) => a - b);
}

function secureRandom(): number {
	const a = new Uint32Array(1);
	globalThis.crypto.getRandomValues(a);
	return a[0] / 2 ** 32;
}

/** True when every asked position was answered with the right word (case/space-insensitive). */
export function confirmationOk(words: string[], indices: number[], answers: Record<number, string>): boolean {
	return indices.length > 0 && indices.every((i) => (answers[i] ?? '').trim().toLowerCase() === words[i]);
}

/** What the connect dialog offers for the miner's current wallet state. */
export type LocalWalletState =
	| { kind: 'none' } // no wallet: create / import
	| { kind: 'locked'; address: string } // exists, data key not loaded: unlock
	| { kind: 'ready'; address: string } // use it
	| { kind: 'external'; address: string | null }; // wallet.mode = external

export function walletState(w: MinerWallet): LocalWalletState {
	if (w.mode === 'external') return { kind: 'external', address: w.address };
	if (!w.address) return { kind: 'none' };
	return w.locked ? { kind: 'locked', address: w.address } : { kind: 'ready', address: w.address };
}

/** Friendly text for miner wallet errors (messages from the miner are already user-facing). */
export function walletErrorMessage(e: unknown): string {
	if (e instanceof MinerApiError) {
		if (e.status === 0) return 'The miner is not reachable. Is Necter Miner running?';
		if (e.status === 409 || e.code === 'state') return 'This miner already has a wallet. Reload to use it.';
		if (e.status === 403) return 'For your security this is only available in the app on this computer.';
		return e.message;
	}
	return e instanceof Error ? e.message : String(e);
}

// ─────────────────────────────── flows ───────────────────────────────

export interface CreatedWallet {
	address: string;
	words: string[];
	confirm: number[];
}

/** Creates the miner wallet from a fresh phrase. The caller shows `words` once, then asks for `confirm`. */
export async function createWithPhrase(length: 12 | 24 = 12): Promise<CreatedWallet> {
	const r = await minerApi.createWallet(length);
	if (!r.recovery_phrase) throw new Error('The miner did not return a recovery phrase; update Necter Miner.');
	const words = r.recovery_phrase.split(' ');
	return { address: r.address.toLowerCase(), words, confirm: pickConfirmIndices(words.length) };
}

export interface PhraseInput {
	text: string;
	passphrase?: string;
	accountIndex?: number;
}

function phraseBody(p: PhraseInput) {
	const words = phraseWords(p.text);
	if (!phraseLengthOk(words)) throw new Error(`A recovery phrase has 12 or 24 words (you entered ${words.length}).`);
	const index = p.accountIndex ?? 0;
	if (!accountIndexOk(index)) throw new Error(`Account index must be 0–${MAX_ACCOUNT_INDEX}.`);
	return {
		recovery_phrase: words.join(' '),
		...(p.passphrase ? { passphrase: p.passphrase } : {}),
		account_index: index
	};
}

/** Validates the phrase (miner-side checksum) and returns the address it would import; stores nothing. */
export async function previewPhrase(p: PhraseInput): Promise<string> {
	const r = await minerApi.deriveWalletAddress(phraseBody(p));
	return r.address.toLowerCase();
}

export async function importPhrase(p: PhraseInput): Promise<string> {
	const r = await minerApi.importWalletPhrase(phraseBody(p));
	return r.address.toLowerCase();
}

export async function importPrivateKey(key: string): Promise<string> {
	if (!looksLikePrivateKey(key)) throw new Error('A private key is 64 hexadecimal characters, optionally starting with 0x.');
	const r = await minerApi.importWalletKey(normalizePrivateKey(key));
	return r.address.toLowerCase();
}

export async function unlockWallet(): Promise<MinerWallet> {
	return minerApi.unlockWallet();
}

/** Re-confirmation text the user types before the private key is revealed. */
export const EXPORT_CONFIRM_TEXT = 'show my key';

export async function exportPrivateKey(confirmText: string): Promise<string> {
	if (confirmText.trim().toLowerCase() !== EXPORT_CONFIRM_TEXT) throw new Error(`Type "${EXPORT_CONFIRM_TEXT}" to continue.`);
	const r = await minerApi.exportWalletKey();
	return r.private_key;
}
