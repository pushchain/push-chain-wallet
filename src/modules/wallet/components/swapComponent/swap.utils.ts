import { PushChain } from '@pushchain/core';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { formatUnits, parseUnits } from 'viem';
import {
  PUSH_CHAIN_ID,
  PUSH_SWAP_TOKENS,
  ZERO_ADDRESS,
} from './swap.constants';
import { SwapChain, SwapToken } from './swap.types';

export const isPushChain = (chain?: string | null) =>
  chain === PUSH_CHAIN_ID || chain === CHAIN.PUSH_TESTNET_DONUT;

export const getChainName = (chain: SwapChain) => {
  const name = PushChain.utils.chains.getChainName(chain as CHAIN);
  return (name || chain)
    .replace(':', ' ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

export const getSwapChainDisplayName = (
  chain: SwapChain,
  mode: 'network' | 'family' = 'network',
) => {
  const separatorIndex = chain.indexOf(':');
  const reference =
    separatorIndex >= 0 ? chain.slice(separatorIndex + 1) : chain;

  if (isPushChain(chain) || reference === '42101') return 'Push Chain';
  if (chain.startsWith('solana:')) return 'Solana';
  if (reference === '11155111') {
    return mode === 'family' ? 'Ethereum' : 'Ethereum Sepolia';
  }
  if (reference === '421614') return 'Arbitrum';
  if (reference === '84532') return 'Base';
  if (reference === '97') return 'BNB Chain';

  return getChainName(chain);
};

export const getSwapTokenDisplaySymbol = (symbol: string) =>
  symbol.replace(/[._](?:arb|base|bnb|bsc|eth|sol)$/i, '');

export const getSupportedSwapChains = (): SwapChain[] => {
  const result = PushChain.utils.chains.getSupportedChains(
    PushChain.CONSTANTS.PUSH_NETWORK.TESTNET_DONUT,
  );
  return (result.chains ?? []) as SwapChain[];
};

const toSwapToken = (
  token: {
    address: string;
    symbol: string;
    decimals: number;
    mechanism?: 'native' | 'approve' | 'permit2';
  },
  chain: SwapChain,
): SwapToken => ({
  chain,
  address: token.address,
  symbol: token.symbol,
  name: token.symbol,
  decimals: token.decimals,
  mechanism: token.mechanism ?? 'approve',
});

const hasPrc20Mapping = (
  chain: SwapChain,
  token: { address: string },
) => {
  try {
    return !!PushChain.utils.tokens.getPRC20Address({
      chain,
      address: token.address,
    }).address;
  } catch {
    return false;
  }
};

export const getSourceTokens = (chain: SwapChain): SwapToken[] => {
  if (isPushChain(chain)) return PUSH_SWAP_TOKENS;

  try {
    const { tokens } = PushChain.utils.tokens.getPayableTokens(chain as CHAIN);
    return (tokens ?? [])
      .filter((token) => hasPrc20Mapping(chain, token))
      .map((token) => toSwapToken(token, chain));
  } catch {
    return [];
  }
};

export const getDestinationTokens = (chain: SwapChain): SwapToken[] => {
  if (isPushChain(chain)) return PUSH_SWAP_TOKENS;

  try {
    const { tokens } = PushChain.utils.tokens.getMoveableTokens(chain as CHAIN);
    return (tokens ?? [])
      .filter((token) => hasPrc20Mapping(chain, token))
      .map((token) => toSwapToken(token, chain));
  } catch {
    return [];
  }
};

export const isSameToken = (
  first: SwapToken | null,
  second: SwapToken | null,
) =>
  !!first &&
  !!second &&
  first.chain === second.chain &&
  first.address.toLowerCase() === second.address.toLowerCase();

export const isValidSwapAmount = (value: string) =>
  /^(?:\d+\.?\d*|\.\d+)$/.test(value) && Number(value) > 0;

export const normalizeAmountInput = (value: string, decimals: number) => {
  if (value === '') return '';
  if (!/^\d*\.?\d*$/.test(value)) return null;
  const [, fraction = ''] = value.split('.');
  if (fraction.length > decimals) return null;
  return value.startsWith('.') ? `0${value}` : value;
};

export const getTokenBalanceAddress = (token: SwapToken) =>
  token.address === ZERO_ADDRESS ? '' : token.address;

const NATIVE_GAS_RESERVE_BY_CHAIN: Record<string, string> = {
  [PUSH_CHAIN_ID]: '0.01',
  'eip155:11155111': '0.001',
  'eip155:421614': '0.001',
  'eip155:84532': '0.001',
  'eip155:97': '0.01',
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': '0.01',
};

/**
 * Native-token MAX must retain source-chain gas (and the SDK's inbound relay
 * deposit). ERC-20/PRC-20 inputs can use their full token balance because gas
 * is paid separately.
 */
export const getMaxSwapAmount = (
  token: Pick<SwapToken, 'chain' | 'decimals' | 'mechanism' | 'address'>,
  balance: string,
) => {
  let balanceRaw: bigint;
  try {
    balanceRaw = parseUnits(balance, token.decimals);
  } catch {
    return '0';
  }

  const isNative =
    token.mechanism === 'native' ||
    token.address.toLowerCase() === ZERO_ADDRESS;
  if (!isNative) return formatUnits(balanceRaw, token.decimals);

  const reserve = NATIVE_GAS_RESERVE_BY_CHAIN[token.chain] ?? '0.001';
  const reserveRaw = parseUnits(reserve, token.decimals);
  return formatUnits(
    balanceRaw > reserveRaw ? balanceRaw - reserveRaw : 0n,
    token.decimals,
  );
};

export const doesSwapAmountExceedBalance = (
  amount: string,
  balance: string,
  decimals: number,
) => {
  try {
    return parseUnits(amount, decimals) > parseUnits(balance, decimals);
  } catch {
    return true;
  }
};
