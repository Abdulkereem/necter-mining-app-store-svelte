import { describe, expect, it } from 'vitest';
import { deviceClassLabel, POW_ICONS } from './pow';

describe('proof-of-work apps', () => {
	it('labels device classes (Android only for phones/tablets)', () => {
		expect(deviceClassLabel(['desktop', 'laptop', 'server'])).toBe('Desktop · Laptop · Server');
		expect(deviceClassLabel(['phone', 'tablet'])).toBe('Android phone · Android tablet');
	});
	it('ships the official Monero symbol locally with its CC BY-SA credit', () => {
		expect(POW_ICONS.monero.src).toBe('/apps/monero/monero-symbol.png');
		expect(POW_ICONS.monero.license).toContain('by-sa/4.0');
	});
});
