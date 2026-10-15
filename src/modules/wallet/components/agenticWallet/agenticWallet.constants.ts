import { PushChain } from '@pushchain/core';
import { AgenticApp, AgenticNetwork } from './agenticWallet.types';

const CHAIN = PushChain.CONSTANTS.CHAIN;

/*
 * Networks an agentic wallet can act on. The wallet runs on Push Testnet Donut, so these
 * are the matching testnets the AGW SDK supports. Solana needs an Anchor IDL per rule,
 * which the rule screens cannot collect yet, so it is not offered.
 *
 * defaultGasPerCall prefills "Max gas per call" (PC per outbound). TODO: placeholder
 * values until product confirms a per-chain default.
 */
export const AGENTIC_NETWORKS: AgenticNetwork[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chain: CHAIN.ETHEREUM_SEPOLIA,
    chainId: 11155111,
    explorerApi: 'https://eth-sepolia.blockscout.com',
    defaultGasPerCall: '0.1',
  },
  {
    id: 'base',
    name: 'Base',
    chain: CHAIN.BASE_SEPOLIA,
    chainId: 84532,
    explorerApi: 'https://base-sepolia.blockscout.com',
    defaultGasPerCall: '0.1',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    chain: CHAIN.ARBITRUM_SEPOLIA,
    chainId: 421614,
    explorerApi: 'https://arbitrum-sepolia.blockscout.com',
    defaultGasPerCall: '0.1',
  },
  {
    id: 'bnb',
    name: 'BNB Chain',
    chain: CHAIN.BNB_TESTNET,
    chainId: 97,
    defaultGasPerCall: '0.1',
  },
];

/*
 * Trusted app catalog. TODO: placeholder names and functions until the real list
 * arrives; entries need `contracts` (per network) and function `signature`s before a
 * rule using them can be granted. Custom contracts and functions work without them.
 */
const EVM_NETWORKS = ['ethereum', 'base', 'arbitrum', 'bnb'];

export const AGENTIC_APPS: AgenticApp[] = [
  {
    id: 'uniswap',
    name: 'Uniswap',
    networks: EVM_NETWORKS,
    functions: [
      { id: 'swapTokens', label: 'Swap tokens' },
      { id: 'buyTokens', label: 'Buy tokens' },
      { id: 'v2ExactOutputSwap', label: 'V2-compatible exact-output swap' },
      { id: 'v2Swap', label: 'V2-compatible swap' },
    ],
  },
  {
    id: 'curve',
    name: 'Curve',
    networks: ['ethereum', 'base', 'arbitrum'],
    functions: [
      { id: 'exchange', label: 'Exchange' },
      { id: 'addLiquidity', label: 'Add liquidity' },
      { id: 'removeLiquidity', label: 'Remove liquidity' },
    ],
  },
  {
    id: 'lido',
    name: 'Lido',
    networks: ['ethereum'],
    functions: [
      { id: 'stake', label: 'Stake ETH' },
      { id: 'requestWithdrawal', label: 'Request withdrawal' },
      { id: 'claimWithdrawal', label: 'Claim withdrawal' },
    ],
  },
  {
    id: 'pancakeswap',
    name: 'PancakeSwap',
    networks: ['ethereum', 'bnb', 'base', 'arbitrum'],
    functions: [
      { id: 'swapTokens', label: 'Swap tokens' },
      { id: 'addLiquidity', label: 'Add liquidity' },
    ],
  },
  {
    id: 'instadapp',
    name: 'Instadapp',
    networks: ['ethereum', 'arbitrum', 'base'],
    functions: [
      { id: 'cast', label: 'Cast spells' },
      { id: 'deposit', label: 'Deposit' },
      { id: 'withdraw', label: 'Withdraw' },
    ],
  },
  {
    id: 'sushiswap',
    name: 'SushiSwap',
    networks: EVM_NETWORKS,
    functions: [
      { id: 'swapTokens', label: 'Swap tokens' },
      { id: 'addLiquidity', label: 'Add liquidity' },
    ],
  },
  {
    id: 'aerodrome',
    name: 'Aerodrome',
    networks: ['base', 'ethereum'],
    functions: [
      { id: 'swapTokens', label: 'Swap tokens' },
      { id: 'addLiquidity', label: 'Add liquidity' },
      { id: 'removeLiquidity', label: 'Remove liquidity' },
    ],
  },
  {
    id: 'aave',
    name: 'Aave',
    networks: EVM_NETWORKS,
    functions: [
      { id: 'supply', label: 'Supply' },
      { id: 'withdraw', label: 'Withdraw' },
      { id: 'borrow', label: 'Borrow' },
      { id: 'repay', label: 'Repay' },
    ],
  },
  {
    id: 'morpho',
    name: 'Morpho',
    networks: ['ethereum', 'base'],
    functions: [
      { id: 'supply', label: 'Supply' },
      { id: 'withdraw', label: 'Withdraw' },
    ],
  },
  {
    id: 'polymarket',
    name: 'Polymarket',
    networks: ['ethereum', 'base', 'arbitrum'],
    functions: [
      { id: 'buyShares', label: 'Buy shares' },
      { id: 'sellShares', label: 'Sell shares' },
      { id: 'redeem', label: 'Redeem positions' },
    ],
  },
];

export const WALLET_NAME_MAX_LENGTH = 30;

/* uint48 max: the contracts' validUntil for a rule that never expires. */
export const NO_EXPIRY = 2 ** 48 - 1;

/* The AGW contracts cap a rule at 8 token limits, each token at most once. */
export const MAX_TOKENS_PER_RULE = 8;
