import { ChainType, WalletType } from "../../types/wallet.types";
import { PushChain } from "@pushchain/core";
import { createPublicClient, http } from 'viem';
import { mainnet, sepolia, baseSepolia, arbitrumSepolia, bscTestnet } from 'viem/chains';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Wallet } from "../../context/GlobalContext";
import { pushTestnetChain } from "../../utils/chainDetails";

export const getWalletlist = (wallet: Wallet) => {
  const walletList = [];
  if (wallet) {
    const account = PushChain.utils.account.toChainAgnostic(wallet.universalSigner.account.address, { chain: wallet.universalSigner.account.chain });
    const walletObj = {
      name: "Push Account",
      address: wallet.universalSigner.account.address,
      fullAddress: account,
      isSelected: false,
      type: "push",
    };
    walletList.push(walletObj);
  }

  walletList.reverse();
  return walletList; // Return the wallet list instead of null
};

export function formatWalletCategory(input: string): string {
  // Match the string after the first ':' if it exists
  const match = input.match(/^CUSTOM:(.+)$/);
  if (match && match[1]) {
    // Extract the part after 'CUSTOM:'
    const coreString = match[1];
    // Replace underscores with spaces and capitalize each word
    let formattedString = coreString
      .toLowerCase()
      .replace(/_/g, " ") // Replace underscores with spaces
      .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
    // Trim and add '...' if length exceeds 15
    if (formattedString.length > 15) {
      formattedString = formattedString.slice(0, 15).trim() + "...";
    }
    return formattedString;
  }
}

export const getFixedTime = (timestamp: number | string): string => {
  let timeValue: number;

  if (typeof timestamp === 'string') {
    // Parse ISO string to milliseconds
    timeValue = Date.parse(timestamp);
    if (isNaN(timeValue)) {
      return 'Invalid date';
    }
  } else {
    timeValue = timestamp;
  }

  const now = Date.now();
  const diffInSeconds = Math.floor((now - timeValue) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  const diffInMonths = Math.floor(diffInWeeks / 4);
  if (diffInMonths < 12) {
    return `${diffInMonths}M ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
};

export const convertCaipToObject = (
  addressinCAIP: string
): {
  result: WalletType
} => {
  const addressComponent = addressinCAIP.split(':');

  // Handle cases where there are exactly three components (chain, chainId, address)
  if (addressComponent.length === 3) {
    return {
      result: {
        chain: addressComponent[0],
        chainId: addressComponent[1],
        address: addressComponent[2],
      },
    };
  }
  // Handle cases where there are exactly two components (chain, address)
  else if (addressComponent.length === 2) {
    return {
      result: {
        chain: addressComponent[0],
        chainId: null,
        address: addressComponent[1],
      },
    };
  }
  // If the input doesn't match the expected format, return the address only
  else {
    return {
      result: {
        chain: null,
        chainId: null,
        address: addressinCAIP,
      },
    };
  }
};


export function toCAIPFormat(
  rawAddress: string,
  chain: ChainType,
  chainId: number | string
) {
  const formattedAddress = rawAddress;
  let formattedChainId = chainId;
  let namespace = '';

  if (
    chain.toLowerCase() === ChainType.ETHEREUM ||
    chain.toLowerCase() === ChainType.BINANCE ||
    chain.toLowerCase() === ChainType.ARBITRUM ||
    chain.toLowerCase() === ChainType.AVALANCHE
  ) {
    namespace = 'eip155';

    if (typeof chainId === 'string' && chainId.startsWith('0x')) {
      formattedChainId = parseInt(chainId, 16);
    }
  } else if (chain.toLowerCase() === ChainType.SOLANA) {
    namespace = 'solana';

    // TODO: Find a method to get the solana chain id in caip format
    formattedChainId = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1'; //devnet
  } else {
    throw new Error("Unsupported chain. Use 'ethereum' or 'solana'.");
  }

  return `${namespace}:${formattedChainId}:${formattedAddress}`;
}

export const EVM_CHAIN_CONFIGS = {
  1: mainnet,
  11155111: sepolia,
  84532: baseSepolia,
  421614: arbitrumSepolia,
  97: bscTestnet,
  42101: pushTestnetChain,
};

export async function getNativeTokenBalance(token, walletDetail): Promise<{ balance: string, loading: boolean }> {
  if (!token || !walletDetail || token.address !== '') {
    return { balance: '0', loading: false };
  }

  try {
    if (walletDetail.chain?.toLowerCase() === 'solana') {
      // Solana
      const network = 'devnet'; // or 'devnet', 'testnet' as needed
      const connection = new Connection(clusterApiUrl(network));
      const publicKey = new PublicKey(walletDetail.address);
      const lamports = await connection.getBalance(publicKey);
      const sol = lamports / 1e9;
      return {
        balance: sol.toLocaleString(undefined, { maximumFractionDigits: 6 }),
        loading: false
      };
    } else {
      // EVM
      const chainId = Number(walletDetail.chainId) || 1;
      const chain = EVM_CHAIN_CONFIGS[chainId] || mainnet;
      const rpcUrl = chain?.rpcUrls?.public?.http?.[0] ?? chain?.rpcUrls?.default?.http?.[0];
      const client = createPublicClient({
        chain,
        transport: !rpcUrl ? http() : http(rpcUrl, {
          retryCount: 3,
          retryDelay: 30_000,
        })
      });
      const wei = await client.getBalance({ address: walletDetail.address });
      const eth = Number(wei) / 1e18;
      return {
        balance: eth.toLocaleString(undefined, { maximumFractionDigits: 6 }),
        loading: false
      };
    }
  } catch (err) {
    return { balance: '0', loading: false };
  }
}

export function formatTokenValue(
  value: string | number | bigint,
  decimalPlaces: number = 3
): string {
  const num = typeof value === 'bigint' ? Number(value) : Number(value);

  if (isNaN(num)) return String(value);
  if (num === 0) return '0';

  let maxFractionDigits = decimalPlaces;

  // If rounded value becomes 0, increase decimals until first non-zero digit
  while (
    maxFractionDigits < 18 &&
    Number(num.toFixed(maxFractionDigits)) === 0
  ) {
    maxFractionDigits++;
  }

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}