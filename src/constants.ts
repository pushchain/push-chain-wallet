/**
 * SUPPORTED ENVIRONEMENTS
 */

import { CHAIN } from "@pushchain/core/src/lib/constants/enums";

export enum ENV {
  PROD = "prod",
  STAGING = "staging",
  DEV = "dev",
  /**
   * **This is for local development only**
   */
  LOCAL = "local",
}

/**
 * WALLET STATES
 */
export enum WALLET_STATE {
  UNINITIALIZED,
  SIGNUP,
  LOGIN,
  INITIALIZED,
}

// CAIP Namespaces
export const chainToNamespace = {
  EVM: "eip155",
  SOL: "solana",
};

// SOLANA ChainIds
export const networkToSolChainId = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
};

export const APP_ROUTES = {
  AUTH: "/auth",
  WALLET: "/wallet",
  VERIFY_EMAIL_OTP: "/verify-email-otp",
  REVERIFY_EMAIL_OTP: "/reverify-email-otp",
  OAUTH_REDIRECT: "/oauth-redirect",
};

export const PRC20_TOKENS = [
  { symbol: 'pETH',   sourceChain: CHAIN.ETHEREUM_SEPOLIA,  prc20Address: '0x2971824Db68229D087931155C2b8bB820B275809' },
  { symbol: 'WETH.eth',   sourceChain: CHAIN.ETHEREUM_SEPOLIA,  prc20Address: '0x0d0dF7E8807430A81104EA84d926139816eC7586' },
  { symbol: 'USDT.eth',   sourceChain: CHAIN.ETHEREUM_SEPOLIA,  prc20Address: '	0x0f97A213207703923F5f0C613C9827f7C9A0f96B' },
  { symbol: 'USDC.eth',   sourceChain: CHAIN.ETHEREUM_SEPOLIA,  prc20Address: '0x7A58048036206bB898008b5bBDA85697DB1e5d66' },
  { symbol: 'pSOL',    sourceChain: CHAIN.SOLANA_DEVNET,     prc20Address: '0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed' },
  { symbol: 'USDC.sol',   sourceChain: CHAIN.SOLANA_DEVNET,     prc20Address: '0x04B8F634ABC7C879763F623e0f0550a4b5c4426F' },
  { symbol: 'USDT.sol',   sourceChain: CHAIN.SOLANA_DEVNET,     prc20Address: '0x4f1A3D22d170a2F4Bddb37845a962322e24f4e34' },
  { symbol: 'DAI.sol',    sourceChain: CHAIN.SOLANA_DEVNET,     prc20Address: '0x5861f56A556c990358cc9cccd8B5baa3767982A8' },
  { symbol: 'pETH.base',    sourceChain: CHAIN.BASE_SEPOLIA,      prc20Address: '0xc7007af2B24D4eb963fc9633B0c66e1d2D90Fc21' },
  { symbol: 'USDT.base',   sourceChain: CHAIN.BASE_SEPOLIA,      prc20Address: '0x148823809B853e1db187BC09A9ac909BC42F971a' },
  { symbol: 'USDC.base',   sourceChain: CHAIN.BASE_SEPOLIA,      prc20Address: '0xD7C6cA1e2c0CE260BE0c0AD39C1540de460e3Be1' },
  { symbol: 'pETH.arb',    sourceChain: CHAIN.ARBITRUM_SEPOLIA,  prc20Address: '0xc0a821a1AfEd1322c5e15f1F4586C0B8cE65400e' },
  { symbol: 'USDC.arb',   sourceChain: CHAIN.ARBITRUM_SEPOLIA,  prc20Address: '0x1091cCBA2FF8d2A131AE4B35e34cf3308C48572C' },
  { symbol: 'USDT.arb',   sourceChain: CHAIN.ARBITRUM_SEPOLIA,  prc20Address: '0xFE6E9DF2BbC9ce05D98b83B1365df6DcA9951891' },
  { symbol: 'USDT.bnb',   sourceChain: CHAIN.BNB_TESTNET,       prc20Address: '0x2f98B4235FD2BA0173a2B056D722879360B12E7b' },
  { symbol: 'pBNB',    sourceChain: CHAIN.BNB_TESTNET,       prc20Address: '0x7a9082dA308f3fa005beA7dB0d203b3b86664E36' },
  { symbol: 'USDC.bsc',    sourceChain: CHAIN.BNB_TESTNET,       prc20Address: '0x120EBf25Dad7D6a09Ad2316f23f9Be95DBb90639' },
  { symbol: 'USDT.bnb',    sourceChain: CHAIN.BNB_TESTNET,       prc20Address: '0x731aF1Da5365259d27528557EE4aFBA4baC90ef2' },
  { symbol: 'PUSD',    sourceChain: CHAIN.PUSH_TESTNET_DONUT,       prc20Address: '0x774c799646bB60103e38Fd65b18D81bbDD1Aa760' },
  { symbol: 'PUSD+',    sourceChain: CHAIN.PUSH_TESTNET_DONUT,       prc20Address: '0x9C7A8Bae46d4dd0496bD3016d1D8FB9e83E68F16' },
];