import { FC } from "react";
import {
  BackpackIcon,
  BitGetWalletIcon,
  BnbIcon,
  BraveIcon,
  Coin98Icon,
  CoinbaseIcon,
  ExodusIcon,
  FlowIcon,
  GlowIcon,
  MagicEdenIcon,
  MathWalletIcon,
  MetaMaskIcon,
  NightlyIcon,
  OkxIcon,
  OneKeyIcon,
  PhantomIcon,
  RainbowIcon,
  SafeIcon,
  SequenceIcon,
  SolflareIcon,
  TrustIcon,
  UnisatIcon,
  UnstoppableIcon,
  WalletConnectIcon,
} from "@dynamic-labs/iconic";
import {
  Arbitrum,
  ArbitrumMonotone,
  Avalanche,
  AvalancheMonotone,
  Base,
  BNB,
  BnbMonotone,
  Ethereum,
  EthereumMonotone,
  IconProps,
  Optimisim,
  OptimismMonotone,
  Polygon,
  PolygonMonotone,
  PushChainLogo,
  Solana,
  SolanaMonotone,
  PushLogoNew,
  Zerion,
  Rabby,
  USDT,
  WEthereum,
  PushMonotone,
  BaseMonotone,
  USDC,
  StEthereum,
} from "../blocks";
import { ChainType, WalletCategoriesType } from "../types/wallet.types";

export const walletCategories: WalletCategoriesType[] = [
  {
    chain: ChainType.PUSH_WALLET,
    wallet: "pushWallet",
    label: "Connect Push Wallet",
    icon: <PushLogoNew width={24} height={24} />,
    isMobile: false,
  },
  {
    chain: ChainType.ETHEREUM,
    wallet: "ethereum",
    label: "Connect Ethereum Wallet",
    icon: <Ethereum width={24} height={24} />,
    isMobile: true,
  },
  {
    chain: ChainType.SOLANA,
    wallet: "solana",
    label: "Connect Solana Wallet",
    icon: <Solana width={24} height={24} />,
    isMobile: false,
  },
  {
    chain: ChainType.BASE,
    wallet: "base",
    label: "Connect Base Wallet",
    icon: <Base width={24} height={24} />,
    isMobile: false,
  },
  {
    chain: ChainType.ARBITRUM,
    wallet: "arbitrum",
    label: "Connect Arbitrum Wallet",
    icon: <Arbitrum width={24} height={24} />,
    isMobile: false,
  },
  {
    chain: ChainType.BINANCE,
    wallet: "binance",
    label: "Connect Binance Wallet",
    icon: <BNB width={24} height={24} />,
    isMobile: false,
  },
  {
    chain: ChainType.WALLET_CONNECT,
    wallet: "walletConnect",
    label: "Connect using Wallet Connect",
    icon: <WalletConnectIcon width={24} height={24} />,
    isMobile: true,
  },
  // {
  //   chain: ChainType.AVALANCHE,
  //   wallet: "ethereum",
  //   label: "Connect Avalanche Wallet",
  //   icon: <Avalanche width={24} height={24} />,
  //   isMobile: false,
  // },
];

export const CHAIN_MONOTONE_LOGO: {
  [x: number | string]: FC<IconProps>;
} = {
  1: EthereumMonotone,
  11155111: EthereumMonotone,
  137: PolygonMonotone,
  80002: PolygonMonotone,
  97: BnbMonotone,
  56: BnbMonotone,
  42161: ArbitrumMonotone,
  421614: ArbitrumMonotone,
  84532: BaseMonotone,
  11155420: OptimismMonotone,
  10: OptimismMonotone,
  2442: PolygonMonotone,
  1101: PolygonMonotone,
  43114: AvalancheMonotone,
  43113: AvalancheMonotone,
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": SolanaMonotone, // mainnet
  "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z": SolanaMonotone, // testnet
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1: SolanaMonotone, // devnet
  devnet: PushMonotone,
  42101: PushMonotone,
};

export const CHAIN_LOGO: {
  [x: number | string]: FC<IconProps>;
} = {
  1: Ethereum,
  11155111: Ethereum,
  137: Polygon,
  80002: Polygon,
  97: BNB,
  56: BNB,
  42161: Arbitrum,
  421614: Arbitrum,
  84532: Base,
  11155420: Optimisim,
  10: Optimisim,
  2442: Polygon,
  1101: Polygon,
  43114: Avalanche,
  43113: Avalanche,
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": Solana, // mainnet
  "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z": Solana, // testnet
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1: Solana, // devnet
};

export const TOKEN_LOGO = {
  pETH: Ethereum,
  pPOL: Polygon,
  PC: PushChainLogo,
  USDT: USDT,
  WETH: WEthereum,
  USDC: USDC,
  stETH: StEthereum,
};

export const WALLETS_LOGO = {
  coinbasesolana: <CoinbaseIcon />,
  backpacksol: <BackpackIcon />,
  solflare: <SolflareIcon />,
  bitgetwalletsol: <BitGetWalletIcon />,
  brave: <BraveIcon />,
  coin98sol: <Coin98Icon />,
  coin98: <Coin98Icon />,
  exodussol: <ExodusIcon />,
  glow: <GlowIcon />,
  magicedensol: <MagicEdenIcon />,
  mathwalletsol: <MathWalletIcon />,
  mathwallet: <MathWalletIcon />,
  nightlysol: <NightlyIcon />,
  okxsolana: <OkxIcon />,
  onekeysol: <OneKeyIcon />,
  onekey: <OneKeyIcon />,
  phantom: <PhantomIcon />,
  exodus: <ExodusIcon />,
  metamask: <MetaMaskIcon />,
  okxwallet: <OkxIcon />,
  bitgetwallet: <BitGetWalletIcon />,
  trust: <TrustIcon />,
  binance: <BnbIcon />,
  uniswap: <UnisatIcon />,
  safepal: <SafeIcon />,
  rainbow: <RainbowIcon />,
  bravesol: <BraveIcon />,
  coinbase: <CoinbaseIcon />,
  zerion: <Zerion />,
  rabby: <Rabby />,
  walletconnect: <WalletConnectIcon />,
  magiceden: <MagicEdenIcon />,
  flowwallet: <FlowIcon />,
  unstoppable: <UnstoppableIcon />,
  backpack: <BackpackIcon />,
  sequence: <SequenceIcon />,
};

export const ERC20ABI = [
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "allowance", type: "uint256" },
      { internalType: "uint256", name: "needed", type: "uint256" },
    ],
    name: "ERC20InsufficientAllowance",
    type: "error",
  },
  {
    inputs: [
      { internalType: "address", name: "sender", type: "address" },
      { internalType: "uint256", name: "balance", type: "uint256" },
      { internalType: "uint256", name: "needed", type: "uint256" },
    ],
    name: "ERC20InsufficientBalance",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "approver", type: "address" }],
    name: "ERC20InvalidApprover",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "receiver", type: "address" }],
    name: "ERC20InvalidReceiver",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "sender", type: "address" }],
    name: "ERC20InvalidSender",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "spender", type: "address" }],
    name: "ERC20InvalidSpender",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export const EXPLORER_URL = `https://donut.push.network`;
export const FAUCET_URL = "https://faucet.push.org";
