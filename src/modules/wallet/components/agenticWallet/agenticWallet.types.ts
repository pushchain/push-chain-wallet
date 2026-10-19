import type { Pin, PresetCategory } from '@pushchain/core';

export type AgenticNetwork = {
  id: string;
  name: string;
  /* CAIP-2 chain the SDK uses for the rule, e.g. 'eip155:11155111' */
  chain: string;
  /* Key into CHAIN_LOGO / CHAIN_MONOTONE_LOGO */
  chainId: string | number;
  /* Blockscout instance used to resolve contract names, ABIs and token metadata */
  explorerApi?: string;
  /* Prefilled "Max gas per call", in PC */
  defaultGasPerCall: string;
  /* Solana: programs, instruction signatures and account pins instead of EVM contracts and ABIs */
  vm?: 'svm';
};

export type AgenticAppFunction = {
  id: string;
  label: string;
  /* Canonical signature, e.g. 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))' */
  signature?: string;
  /* Argument pins the SDK's reviewed catalog attaches, e.g. the wallet as the beneficiary */
  pins?: Pin[];
  /* SDK preset the function comes from; its token and amount pins are generated from the rule's tokens */
  preset?: PresetCategory;
  /* Solana: the argument holding the SOL amount, capped at the rule's SOL per transaction limit */
  amountArg?: number;
};

export type AgenticApp = {
  id: string;
  name: string;
  networks: string[];
  /* Contract (EVM) or program ID (Solana) the agent calls, per network id */
  contracts?: Partial<Record<string, string>>;
  functions: AgenticAppFunction[];
};

export type RuleApp = {
  /* A catalog app, or null when the owner picked a custom contract instead */
  appId: string | null;
  /* Catalog function ids */
  functionIds: string[];
  /* Contract address of a custom app */
  customContract?: string;
  /* Canonical signatures of custom functions picked for this app */
  customFunctions?: string[];
  /*
   * Argument pins per function, keyed by lowercase 4-byte selector. They come from a granted
   * rule or a preset and are sent back unchanged, so an edit never loosens a call.
   */
  pins?: Record<string, Pin[]>;
};

export type RuleTokenRef = {
  /* Token address on the destination chain (the SDK's MoveableToken address) */
  address: string;
  symbol: string;
  decimals: number;
};

export type RuleToken = {
  token: RuleTokenRef | null;
  /* Empty string means unlimited */
  totalLimit: string;
  perTxLimit: string;
};

export type AgenticRule = {
  /* Local key for React lists and drafts */
  id: string;
  /* On-chain id once granted */
  rulesId?: `0x${string}`;
  networkId: string;
  apps: RuleApp[];
  tokens: RuleToken[];
  maxGasPerCall: string;
  agentAddress: string;
  /* Empty string means no expiry */
  durationDays: string;
  /* On-chain expiry (unix seconds) for granted rules */
  validUntil?: number;
};

export type AgenticWallet = {
  address: `0x${string}`;
  name: string;
  /* Factory slot; newer wallets have higher indexes */
  index: number;
  pinned: boolean;
  /* Position in the pin history; higher was pinned more recently. -1 when not pinned. */
  pinOrder: number;
  rules: AgenticRule[];
  /* Rules the UI cannot show yet (Push-native or Solana), counted so nothing is hidden silently */
  unsupportedRules: number;
};

export type AgenticSortOption = 'recent' | 'alphabetical';

export type CustomApp = { address: string; name: string };

export type CustomToken = RuleTokenRef;
