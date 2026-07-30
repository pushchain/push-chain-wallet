import { describe, expect, it } from 'vitest';
import {
  formatSwapGasCost,
  normalizePositiveNetworkCost,
} from './swap.gas';

describe('formatSwapGasCost', () => {
  it('formats RamenFi gas units using the Push Chain gas price', () => {
    expect(formatSwapGasCost(124_500, 1_000_000_000n)).toBe(
      '~0.000125 PC',
    );
  });

  it('keeps a positive sub-micro gas cost visible', () => {
    expect(formatSwapGasCost(1, 1_000_000_000n)).toBe('<0.000001 PC');
  });

  it.each([
    [undefined, 1_000_000_000n],
    [0, 1_000_000_000n],
    [-1, 1_000_000_000n],
    [1.5, 1_000_000_000n],
    [124_500, undefined],
    [124_500, 0n],
  ])('does not display an invalid estimate', (gasEstimate, gasPriceWei) => {
    expect(formatSwapGasCost(gasEstimate, gasPriceWei)).toBeNull();
  });
});

describe('normalizePositiveNetworkCost', () => {
  it('keeps a measured positive historical cost', () => {
    expect(normalizePositiveNetworkCost('0.000288454')).toBe(
      '0.000288454',
    );
  });

  it.each([
    undefined,
    '',
    '0',
    '0.000000',
    '-0.0001',
    '~0.0001',
    '<0.000001',
    'not-a-cost',
  ])('rejects a non-measured historical cost of %s', (networkCost) => {
    expect(normalizePositiveNetworkCost(networkCost)).toBeUndefined();
  });
});
