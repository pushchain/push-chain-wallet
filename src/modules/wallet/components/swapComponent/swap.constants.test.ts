import { describe, expect, it } from 'vitest';
import { formatUnits } from 'viem';
import { PUSH_SWAP_TOKENS } from './swap.constants';

// Decimals read from each PRC-20 on https://evm.donut.rpc.push.org via
// `decimals()` (0x313ce567) on 2026-09-30. The wallet's own SYMBOL_DECIMALS
// table used to omit DAI.sol, so it silently fell through to the 18 default
// and every DAI.sol balance rendered 1e12x too small.
const ON_CHAIN_DECIMALS: Record<string, number> = {
  pETH: 18,
  'WETH.eth': 18,
  'USDT.eth': 6,
  'USDC.eth': 6,
  pSOL: 9,
  'USDC.sol': 6,
  'USDT.sol': 6,
  'DAI.sol': 6,
  'pETH.base': 18,
  'USDT.base': 6,
  'USDC.base': 6,
  'pETH.arb': 18,
  'USDC.arb': 6,
  'USDT.arb': 6,
  'USDT.bnb': 6,
  pBNB: 18,
  'USDC.bsc': 6,
  PUSD: 6,
  'PUSD+': 6,
};

describe('PUSH_SWAP_TOKENS decimals', () => {
  it('matches the on-chain decimals() of every PRC-20 it lists', () => {
    const prc20 = PUSH_SWAP_TOKENS.filter(
      (token) => token.symbol !== 'PC' && token.symbol !== 'WPC',
    );

    expect(prc20.length).toBeGreaterThan(0);

    const mismatches = prc20
      .filter(
        (token) =>
          ON_CHAIN_DECIMALS[token.symbol] !== undefined &&
          token.decimals !== ON_CHAIN_DECIMALS[token.symbol],
      )
      .map(
        (token) =>
          `${token.symbol}: table=${token.decimals} onchain=${
            ON_CHAIN_DECIMALS[token.symbol]
          }`,
      );

    expect(mismatches).toEqual([]);
  });

  it('gives DAI.sol 6 decimals so a 1e6 raw balance reads as 1', () => {
    const dai = PUSH_SWAP_TOKENS.find(
      (token) => token.symbol === 'DAI.sol',
    );

    expect(dai).toBeDefined();
    expect(dai!.decimals).toBe(6);
    expect(formatUnits(1_000_000n, dai!.decimals)).toBe('1');
  });

  it('keeps 18- and 9-decimal PRC-20s as they are, so the fix is not a blanket change', () => {
    const peth = PUSH_SWAP_TOKENS.find((token) => token.symbol === 'pETH');
    expect(peth?.decimals).toBe(18);
    expect(formatUnits(10n ** 18n, peth!.decimals)).toBe('1');

    const psol = PUSH_SWAP_TOKENS.find((token) => token.symbol === 'pSOL');
    expect(psol?.decimals).toBe(9);
    expect(formatUnits(1_000_000_000n, psol!.decimals)).toBe('1');

    const pbusd = PUSH_SWAP_TOKENS.find((token) => token.symbol === 'PUSD');
    expect(pbusd?.decimals).toBe(6);
  });
});