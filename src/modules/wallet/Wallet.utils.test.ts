import { describe, expect, it } from 'vitest';
import { toPlainDecimalString } from './Wallet.utils';

describe('toPlainDecimalString', () => {
  it('keeps balances under 1000 unchanged', () => {
    expect(toPlainDecimalString(0, 6)).toBe('0');
    expect(toPlainDecimalString(0.5, 6)).toBe('0.5');
    expect(toPlainDecimalString(999.999999, 6)).toBe('999.999999');
  });

  it('does not insert thousands separators', () => {
    // The regression this guards: toLocaleString() produced "1,234.5" here,
    // and every caller parses this value with Number(), which yields NaN.
    expect(toPlainDecimalString(1234.5, 6)).toBe('1234.5');
    expect(toPlainDecimalString(999999.999999, 6)).toBe('999999.999999');
  });

  it('stays parseable by Number for every balance magnitude', () => {
    for (const value of [0.5, 999.999999, 1000, 1234.5, 999999.999999]) {
      const formatted = toPlainDecimalString(value, 6);
      expect(formatted).not.toContain(',');
      expect(Number.isNaN(Number(formatted))).toBe(false);
      expect(Number(formatted)).toBeCloseTo(value, 6);
    }
  });

  it('rounds to maxFractionDigits, matching the previous toLocaleString behavior', () => {
    expect(toPlainDecimalString(0.0000001234, 6)).toBe('0');
    expect(toPlainDecimalString(1.23456789, 6)).toBe('1.234568');
    expect(toPlainDecimalString(1e21, 6)).toBe('1e+21');
  });

  it('falls back to 0 for non-finite input', () => {
    expect(toPlainDecimalString(NaN, 6)).toBe('0');
    expect(toPlainDecimalString(Infinity, 6)).toBe('0');
  });
});
