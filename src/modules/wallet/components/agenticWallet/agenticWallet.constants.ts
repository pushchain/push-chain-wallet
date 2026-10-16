import { PushChain } from '@pushchain/core';
import type { ForeignChainNamespace } from '@pushchain/core';
import { getAddress } from 'viem';
import { formatFunctionSignature } from './agenticWallet.functions';
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

/* Placeholder catalog (names and labels only) until the real app and function list arrives. */
const PLACEHOLDER_APPS: AgenticApp[] = [
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

/* SDK preset app names that are the same app as a placeholder entry */
const SDK_APP_ALIASES: Record<string, string> = {
  'Uniswap V3': 'uniswap',
  'PancakeSwap V3': 'pancakeswap',
  'Aave V3': 'aave',
};

const appId = (name: string) =>
  SDK_APP_ALIASES[name] ??
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/*
 * Fills contracts and functions from the SDK's reviewed preset catalog
 * (PushChain.utils.agentic.presets) for the networks this wallet supports: Uniswap,
 * PancakeSwap and Aave get their testnet contracts, and SDK-only apps (EigenLayer,
 * Moonwell, Venus) are added. Functions come with their signature, label and pins. Apps
 * the SDK does not cover keep their placeholder entry with no contract.
 */
const withSdkCatalog = (apps: AgenticApp[]): AgenticApp[] => {
  const byId = new Map(apps.map((app) => [app.id, { ...app, networks: [...app.networks], contracts: { ...app.contracts } }]));
  const fromSdk = new Set<string>();
  let presets: typeof PushChain.utils.agentic.presets;
  try {
    presets = PushChain.utils.agentic.presets;
  } catch {
    return apps;
  }

  presets.list().presets.forEach((preset) => {
    AGENTIC_NETWORKS.filter((network) => preset.chains.some((chain) => chain === network.chain)).forEach((network) => {
      let rules;
      try {
        rules = presets.get(preset.constant, { chainNamespace: network.chain as ForeignChainNamespace }).rules;
      } catch {
        return;
      }
      rules
        .flatMap((rule) => rule.allowedCalls)
        .forEach((call) => {
          if (!call.app || !call.selector.includes('(')) return;
          const id = appId(call.app);
          let app = byId.get(id);
          if (!app) {
            app = { id, name: call.app, networks: [], contracts: {}, functions: [] };
            byId.set(id, app);
          }
          // One contract per app and network; a second target under the same name is left out.
          const existing = app.contracts[network.id];
          if (existing && existing.toLowerCase() !== call.target.toLowerCase()) return;
          app.contracts[network.id] = getAddress(call.target);
          if (!app.networks.includes(network.id)) app.networks.push(network.id);
          // The SDK's functions replace the placeholder ones, which have no signatures.
          if (!fromSdk.has(id)) {
            app.functions = [];
            fromSdk.add(id);
          }
          if (!app.functions.some((fn) => fn.id === call.selector)) {
            app.functions.push({
              id: call.selector,
              // Labels of zero-cap review calls carry a hint, e.g. "Swap exact input (select two tokens to enable)".
              label: call.label?.replace(/\s*\(select [^)]*\)$/, '') ?? formatFunctionSignature(call.selector),
              signature: call.selector,
              ...(call.pins?.length ? { pins: call.pins } : {}),
              preset: preset.constant,
            });
          }
        });
    });
  });
  return [...byId.values()];
};

export const AGENTIC_APPS: AgenticApp[] = withSdkCatalog(PLACEHOLDER_APPS);

export const WALLET_NAME_MAX_LENGTH = 30;

/* uint48 max: the contracts' validUntil for a rule that never expires. */
export const NO_EXPIRY = 2 ** 48 - 1;

/* The AGW contracts cap a rule at 8 token limits, each token at most once. */
export const MAX_TOKENS_PER_RULE = 8;
