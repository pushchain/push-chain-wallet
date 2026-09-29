import { PushChain } from '@pushchain/core';
import { PRC20_TOKENS } from '../../../../constants';
import { SwapToken } from './swap.types';

export const PUSH_CHAIN_ID =
  PushChain.CONSTANTS.CHAIN.PUSH_TESTNET_DONUT as string;

export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as const;

export const AUTO_SLIPPAGE_PERCENTAGE = '0.50';
export const SWAP_TITLE = 'Swap';
export const SWAP_DISPLAY_DECIMALS = 5;

const SYMBOL_DECIMALS: Record<string, number> = {
  PUSD: 6,
  'PUSD+': 6,
  'USDC.eth': 6,
  'USDT.eth': 6,
  'USDC.sol': 6,
  'USDT.sol': 6,
  'USDC.base': 6,
  'USDT.base': 6,
  'USDC.arb': 6,
  'USDT.arb': 6,
  'USDC.bsc': 6,
  'USDT.bnb': 6,
  pSOL: 9,
};

export const PUSH_SWAP_TOKENS: SwapToken[] = [
  {
    chain: PUSH_CHAIN_ID,
    address: ZERO_ADDRESS,
    symbol: 'PC',
    name: 'Push Chain',
    decimals: 18,
    mechanism: 'native',
  },
  {
    chain: PUSH_CHAIN_ID,
    address: '0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9',
    symbol: 'WPC',
    name: 'Wrapped PC',
    decimals: 18,
    mechanism: 'approve',
  },
  ...PRC20_TOKENS.map((token) => ({
    chain: PUSH_CHAIN_ID,
    address: token.prc20Address.trim(),
    symbol: token.symbol,
    name: token.symbol,
    decimals: SYMBOL_DECIMALS[token.symbol] ?? 18,
    mechanism: 'approve' as const,
  })).filter(
    (token, index, tokens) =>
      token.address &&
      tokens.findIndex(
        (candidate) =>
          candidate.address.toLowerCase() === token.address.toLowerCase(),
      ) === index &&
      !tokens
        .slice(index + 1)
        .some((candidate) => candidate.symbol === token.symbol),
  ),
];
