/**
 * Test wallet: injects an EIP-1193 provider (announced via EIP-6963) whose signatures are produced in Node by
 * viem with a fixed test key (vectors-plan.md `owner`, 0x…02). Nothing here is a real key.
 */
import type { Page } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';

export const TEST_KEY = ('0x' + '00'.repeat(31) + '02') as `0x${string}`;
export const testAccount = privateKeyToAccount(TEST_KEY);
export const TEST_ADDRESS = testAccount.address.toLowerCase();

export async function installTestWallet(page: Page) {
	await page.exposeFunction('__pwPersonalSign', async (hex: string) => testAccount.signMessage({ message: { raw: hex as `0x${string}` } }));
	await page.exposeFunction('__pwSignTypedData', async (json: string) => {
		const td = JSON.parse(json);
		delete td.types.EIP712Domain;
		return testAccount.signTypedData(td);
	});
	await page.exposeFunction('__pwSendTransaction', async () => '0x' + 'ab'.repeat(32));
	await page.addInitScript((address: string) => {
		const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
		const w = window as unknown as Record<string, (...a: unknown[]) => Promise<string>>;
		const provider = {
			async request({ method, params }: { method: string; params?: unknown[] }) {
				switch (method) {
					case 'eth_requestAccounts':
					case 'eth_accounts':
						return [address];
					case 'eth_chainId':
						return '0xaa36a7';
					case 'wallet_switchEthereumChain':
					case 'wallet_addEthereumChain':
						return null;
					case 'personal_sign':
						return w.__pwPersonalSign((params as string[])[0]);
					case 'eth_signTypedData_v4':
						return w.__pwSignTypedData((params as string[])[1]);
					case 'eth_sendTransaction':
						return w.__pwSendTransaction();
					default:
						throw Object.assign(new Error(`unsupported ${method}`), { code: 4200 });
				}
			},
			on(ev: string, fn: (...a: unknown[]) => void) {
				(listeners[ev] ??= []).push(fn);
			},
			removeListener(ev: string, fn: (...a: unknown[]) => void) {
				listeners[ev] = (listeners[ev] ?? []).filter((f) => f !== fn);
			}
		};
		const icon =
			'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#FFC933"/></svg>');
		const announce = () =>
			window.dispatchEvent(
				new CustomEvent('eip6963:announceProvider', {
					detail: Object.freeze({ info: { uuid: '00000000-0000-4000-8000-000000000000', name: 'Test Wallet', icon, rdns: 'network.necter.testwallet' }, provider })
				})
			);
		window.addEventListener('eip6963:requestProvider', announce);
		announce();
	}, TEST_ADDRESS);
}
