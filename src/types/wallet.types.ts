import { CHAIN } from "@pushchain/core/src/lib/constants/enums";
import { ReactNode } from "react";
import { TypedData, TypedDataDomain } from 'viem';

export enum ChainType {
  ETHEREUM = "sepolia",
  SOLANA = "solana",
  BINANCE = "bscTestnet",
  ARBITRUM = "arbitrumSepolia",
  BASE = "baseSepolia",
  AVALANCHE = "avalancheFuji",
  WALLET_CONNECT = "walletConnect",
  PUSH_WALLET = 'pushWalletDonut',
}

export type WalletType = {
  chainId: string | null;
  chain: string | null;
  address: string;
}

export interface ExternalWalletType {
  originAddress: string;
  chainType: ChainType;
  providerName: string;
}

export interface ITypedData {
  domain: TypedDataDomain;
  types: TypedData;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface IWalletProvider {
  name: string;
  icon: string;
  supportedChains: ChainType[];
  isInstalled(): Promise<boolean>;
  connect(chainType?: ChainType): Promise<{ caipAddress: string }>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signAndSendTransaction(txn: Uint8Array): Promise<Uint8Array>;
  signTypedData(typedData: ITypedData): Promise<Uint8Array>;
  disconnect(): Promise<void>;
  getChainId(): Promise<unknown>;
  switchNetwork?(chainName: ChainType): Promise<void>;
}

export type UniversalAccount = {
  chain: CHAIN;
  address: string;
};

export type WalletCategoriesType = {
  chain: ChainType;
  wallet: string;
  label: string;
  icon: ReactNode;
  isMobile: boolean;
};

export const CONSTANTS = {
  CHAIN: {
    PUSH: 'pushWallet',
    ETHEREUM: 'ethereum',
    SOLANA: 'solana',
    BASE: 'base',
    ARBITRUM: 'arbitrum',
    BINANCE: 'binance',
    WALLET_CONNECT: 'walletConnect'
  },
  THEME: { LIGHT: 'light', DARK: 'dark' },
}

export type LoginMethodConfig = {
  email: boolean;
  google: boolean;
  phone?: boolean;
  socials?: {
    discord?: boolean;
    github?: boolean;
    x?: boolean;
    bluesky?: boolean;
  };
  wallet: {
    enabled: boolean;
    chains?: (typeof CONSTANTS.CHAIN)[keyof typeof CONSTANTS.CHAIN][];
    excludedChains?: (typeof CONSTANTS.CHAIN)[keyof typeof CONSTANTS.CHAIN][];
  };
  appPreview?: boolean;
}

export type AppMetadata = {
  title: string;
  logoURL?: string;
  description?: string;
}

export interface WalletConfig {
  loginDefaults: LoginMethodConfig,
  appMetadata: AppMetadata,
}

export interface EthereumLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}

export interface EthereumTransactionReceipt {
  blockHash: string;
  blockNumber: string;
  contractAddress: string | null;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  from: string;
  gasUsed: string;
  logs: EthereumLog[];
  logsBloom: string;
  status: string;
  to: string;
  transactionHash: string;
  transactionIndex: string;
  type: string;
}
