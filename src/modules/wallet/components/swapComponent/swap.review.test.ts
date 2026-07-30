import { describe, expect, it } from 'vitest';
import { formatSwapReviewRate } from './swap.review';

describe('formatSwapReviewRate', () => {
  it('formats the quoted rate without unnecessary trailing zeroes', () => {
    expect(
      formatSwapReviewRate({
        exchangeRate: 18432.850228,
        fromSymbol: 'ETH',
        toSymbol: 'WPC',
      }),
    ).toBe('1 ETH ≈ 18432.850228 WPC');
  });

  it('keeps small positive rates visible', () => {
    expect(
      formatSwapReviewRate({
        exchangeRate: 0.000000123456,
        fromSymbol: 'WPC',
        toSymbol: 'ETH',
      }),
    ).toBe('1 WPC ≈ 0.000000123456 ETH');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not format an invalid rate',
    (exchangeRate) => {
      expect(
        formatSwapReviewRate({
          exchangeRate,
          fromSymbol: 'ETH',
          toSymbol: 'WPC',
        }),
      ).toBeNull();
    },
  );
});
