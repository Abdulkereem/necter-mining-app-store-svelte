import { describe, expect, it } from 'vitest';
import { formatAmount, formatUnitsExact, parseUnits, bpToPercent, bpDelta, timeAgo, listingStatusLabel, categoryName } from './format';

describe('amount formatting (bigint, no floats in logic)', () => {
	it('formats wei with grouping and trimmed fractions', () => {
		expect(formatAmount('1500000000000000000000', 18)).toBe('1,500');
		expect(formatAmount('1234567890000000000', 18)).toBe('1.2345');
		expect(formatAmount('1', 18)).toBe('<0.0001');
		expect(formatAmount('0', 18)).toBe('0');
		expect(formatAmount('12345000000', 6, { maxFrac: 2 })).toBe('12,345');
		expect(formatAmount('2500000000000000000000000', 18, { compact: true })).toBe('2.5M');
		expect(formatAmount('not-a-number', 18)).toBe('—');
	});
	it('round-trips parseUnits / formatUnitsExact at full precision', () => {
		const big = '115792089237316195423570985008687907853269984665640564039457.584007913129639935';
		expect(formatUnitsExact(parseUnits(big, 18), 18)).toBe(big);
		expect(parseUnits('10', 18)).toBe('10000000000000000000');
		expect(parseUnits('0.000000000000000001', 18)).toBe('1');
		expect(() => parseUnits('1.0000000000000000001', 18)).toThrow(/decimal/);
		expect(() => parseUnits('-1', 18)).toThrow();
		expect(() => parseUnits('1e18', 18)).toThrow();
	});
	it('basis points', () => {
		expect(bpToPercent(8500)).toBe('85%');
		expect(bpToPercent(1250)).toBe('12.5%');
		expect(bpDelta(-420)).toBe('-4.2%');
	});
	it('labels', () => {
		expect(listingStatusLabel('listed')).toEqual({ label: 'Active', variant: 'success' });
		expect(listingStatusLabel('delisted').label).toBe('Deprecated');
		expect(categoryName('machine-learning')).toBe('AI / Machine Learning');
		expect(timeAgo(1000, 1000 + 7200)).toBe('2h ago');
	});
});
