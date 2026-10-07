/**
 * Sign-In with Ethereum (EIP-4361) for the Hub (`/v1/auth/nonce` → wallet `personal_sign` → `/v1/auth/siwe`).
 *
 * The Hub returns the exact message to sign. Before asking the wallet, the client parses it and checks every
 * field it can (domain, address, URI origin, chain id, statement, nonce, times) so a wrong or hostile Hub cannot
 * make the wallet sign a login for another site.
 */
import { getAddress } from 'viem';
import { parseSiweMessage } from 'viem/siwe';

export interface SiweFields {
	domain: string;
	address: string; // any case; rendered EIP-55
	statement: string;
	uri: string;
	version?: '1';
	chainId: number;
	nonce: string;
	issuedAt: number; // unix seconds
	expirationTime?: number | null; // unix seconds
}

/** RFC 3339 UTC without fractional seconds (`2026-10-07T12:00:00Z`), the Hub's format. */
export function siweTime(unix: number): string {
	return new Date(unix * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Builds the EIP-4361 message text exactly (used for vectors and the mock Hub). */
export function buildSiweMessage(f: SiweFields): string {
	const lines = [
		`${f.domain} wants you to sign in with your Ethereum account:`,
		getAddress(f.address.toLowerCase()),
		'',
		f.statement,
		'',
		`URI: ${f.uri}`,
		`Version: ${f.version ?? '1'}`,
		`Chain ID: ${f.chainId}`,
		`Nonce: ${f.nonce}`,
		`Issued At: ${siweTime(f.issuedAt)}`
	];
	if (f.expirationTime) lines.push(`Expiration Time: ${siweTime(f.expirationTime)}`);
	return lines.join('\n');
}

export interface SiweExpectation {
	domain: string;
	address: string;
	uri: string;
	chainId: number;
	statement: string;
	nonce?: string;
	now?: number; // unix seconds
	maxSkewSecs?: number; // default 300
	maxLifetimeSecs?: number; // default 24 h
}

export type SiweCheck = { ok: true; fields: SiweFields } | { ok: false; reason: string };

function originOf(u: string): string | null {
	try {
		return new URL(u).origin;
	} catch {
		return null;
	}
}

/** Strictly checks a Hub-provided SIWE message against what this client expects to sign. */
export function checkSiweMessage(message: string, exp: SiweExpectation): SiweCheck {
	if (typeof message !== 'string' || message.length > 4096) return { ok: false, reason: 'message too long' };
	const firstLine = message.split('\n', 1)[0];
	if (firstLine !== `${exp.domain} wants you to sign in with your Ethereum account:`)
		return { ok: false, reason: `domain mismatch (expected ${exp.domain})` };
	const p = parseSiweMessage(message);
	if (!p.address || p.address.toLowerCase() !== exp.address.toLowerCase()) return { ok: false, reason: 'address mismatch' };
	if (p.address !== getAddress(p.address)) return { ok: false, reason: 'address is not EIP-55 checksummed' };
	if (p.chainId !== exp.chainId) return { ok: false, reason: `chain id ${p.chainId} ≠ ${exp.chainId}` };
	if (p.statement !== exp.statement) return { ok: false, reason: 'unexpected statement' };
	if (p.version !== '1') return { ok: false, reason: 'unsupported version' };
	if (!p.uri || originOf(p.uri) !== originOf(exp.uri)) return { ok: false, reason: 'URI origin mismatch' };
	if (!p.nonce || !/^[A-Za-z0-9]{8,}$/.test(p.nonce)) return { ok: false, reason: 'invalid nonce' };
	if (exp.nonce && p.nonce !== exp.nonce) return { ok: false, reason: 'nonce mismatch' };
	if (!p.issuedAt) return { ok: false, reason: 'missing Issued At' };
	const now = exp.now ?? Math.floor(Date.now() / 1000);
	const issued = Math.floor(p.issuedAt.getTime() / 1000);
	const skew = exp.maxSkewSecs ?? 300;
	if (Math.abs(now - issued) > skew) return { ok: false, reason: 'Issued At is too far from now (check your clock)' };
	let expiration: number | null = null;
	if (p.expirationTime) {
		expiration = Math.floor(p.expirationTime.getTime() / 1000);
		if (expiration <= now) return { ok: false, reason: 'message already expired' };
		if (expiration - issued > (exp.maxLifetimeSecs ?? 86400)) return { ok: false, reason: 'expiration too far in the future' };
	}
	if (p.notBefore && p.notBefore.getTime() / 1000 > now + skew) return { ok: false, reason: 'not yet valid' };
	if (p.resources && p.resources.length) return { ok: false, reason: 'unexpected resources' };
	return {
		ok: true,
		fields: {
			domain: exp.domain,
			address: p.address,
			statement: p.statement,
			uri: p.uri,
			version: '1',
			chainId: p.chainId,
			nonce: p.nonce,
			issuedAt: issued,
			expirationTime: expiration
		}
	};
}
