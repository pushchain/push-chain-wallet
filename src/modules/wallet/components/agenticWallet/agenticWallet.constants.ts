import { PushChain } from '@pushchain/core';
import type { ForeignChainNamespace } from '@pushchain/core';
import { getAddress } from 'viem';
import { AgenticApp, AgenticNetwork } from './agenticWallet.types';

const CHAIN = PushChain.CONSTANTS.CHAIN;

/*
 * Networks an agentic wallet can act on. The wallet runs on Push Testnet Donut, so these
 * are the matching testnets the AGW SDK supports. Solana (devnet) only offers listed
 * programs, since each instruction needs the wallet's account position (an account pin).
 *
 * defaultGasPerCall prefills "Max gas per call": the most PC an agent send may attach
 * for destination gas (unused gas is refunded). The SDK attaches about $1 of PC per send
 * (~10 PC on Donut today), so 20 PC is the backend's recommended prefill for every chain,
 * Solana included; Solana rules must be above 0. BNB testnet can briefly need ~28 PC.
 */
export const AGENTIC_NETWORKS: AgenticNetwork[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chain: CHAIN.ETHEREUM_SEPOLIA,
    chainId: 11155111,
    explorerApi: 'https://eth-sepolia.blockscout.com',
    defaultGasPerCall: '20',
  },
  {
    id: 'base',
    name: 'Base',
    chain: CHAIN.BASE_SEPOLIA,
    chainId: 84532,
    explorerApi: 'https://base-sepolia.blockscout.com',
    defaultGasPerCall: '20',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    chain: CHAIN.ARBITRUM_SEPOLIA,
    chainId: 421614,
    explorerApi: 'https://arbitrum-sepolia.blockscout.com',
    defaultGasPerCall: '20',
  },
  {
    id: 'bnb',
    name: 'BNB Chain',
    chain: CHAIN.BNB_TESTNET,
    chainId: 97,
    defaultGasPerCall: '20',
  },
  {
    id: 'solana',
    name: 'Solana',
    chain: CHAIN.SOLANA_DEVNET,
    chainId: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    defaultGasPerCall: '20',
    vm: 'svm',
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
          // The SDK's name and functions replace the placeholder ones (which have no signatures).
          if (!fromSdk.has(id)) {
            app.name = call.app;
            app.functions = [];
            fromSdk.add(id);
          }
          if (!app.functions.some((fn) => fn.id === call.selector)) {
            app.functions.push({
              id: call.selector,
              // Labels of zero-cap review calls carry a hint, e.g. "Swap exact input (select two tokens to enable)".
              label: call.label?.replace(/\s*\(select [^)]*\)$/, '') ?? call.selector.split('(')[0],
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

/*
 * Solana programs. TODO: temporary until the real Solana app list arrives. Push's test
 * counter program on devnet (the SDK's own Solana test program), with the account
 * position of the wallet in each instruction and the argument holding the SOL amount.
 */
const SOLANA_APPS: AgenticApp[] = [
  {
    id: 'push-test-counter',
    name: 'Push Test Counter',
    networks: ['solana'],
    contracts: { solana: '8yNqjrMnFiFbVTVQcKij8tNWWTMdFkrDf9abCGgc2sgx' },
    functions: [
      // accounts: counter, authority
      { id: 'increment(u64)', label: 'Increment', signature: 'increment(u64)', pins: [{ account: 1, expected: 'agentic:wallet' }] },
      { id: 'decrement(u64)', label: 'Decrement', signature: 'decrement(u64)', pins: [{ account: 1, expected: 'agentic:wallet' }] },
      // accounts: counter, recipient, cea_authority, system_program
      {
        id: 'receive_sol(u64)',
        label: 'Send SOL',
        signature: 'receive_sol(u64)',
        pins: [{ account: 2, expected: 'agentic:wallet' }],
        amountArg: 0,
      },
      // accounts: counter, authority, stake, stake_vault, system_program
      {
        id: 'stake_sol(u64)',
        label: 'Stake SOL',
        signature: 'stake_sol(u64)',
        pins: [{ account: 1, expected: 'agentic:wallet' }],
        amountArg: 0,
      },
      { id: 'unstake_sol(u64)', label: 'Unstake SOL', signature: 'unstake_sol(u64)', pins: [{ account: 1, expected: 'agentic:wallet' }] },
    ],
  },
  /*
   * SPL Memo v2, the backend's devnet test program: it has no Anchor IDL, so the rule allows
   * memos starting with the fixed 8-byte prefix "PUSHAGW:" (a raw discriminator) and pins
   * the wallet as the signing account. It tests a program call only; it moves no SOL or tokens.
   * Agents sending to it first register a small IDL (PushChain.utils.svm.registerIdl).
   */
  {
    id: 'spl-memo',
    name: 'SPL Memo',
    networks: ['solana'],
    contracts: { solana: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' },
    functions: [
      // accounts: cea_authority (signer)
      { id: 'memo:PUSHAGW', label: 'Write memo (PUSHAGW: prefix)', signature: '0x505553484147573a', pins: [{ account: 0, expected: 'agentic:wallet' }] },
    ],
  },
];

export const AGENTIC_APPS: AgenticApp[] = [...withSdkCatalog(PLACEHOLDER_APPS), ...SOLANA_APPS];

export const WALLET_NAME_MAX_LENGTH = 30;

/* uint48 max: the contracts' validUntil for a rule that never expires. */
export const NO_EXPIRY = 2 ** 48 - 1;

/* The AGW contracts cap a rule at 8 token limits, each token at most once. */
export const MAX_TOKENS_PER_RULE = 8;
