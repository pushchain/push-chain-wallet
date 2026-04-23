import { viemClient } from "../utils/viemClient";
import { pushTestnetChain } from "../utils/chainDetails";
import { Address, createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { CHAIN } from "@pushchain/core/src/lib/constants/enums";
import { EVM_CHAIN_CONFIGS } from "../modules/wallet/Wallet.utils";

type fetchTokenBalanceProps = {
    walletAddress: Address,
    tokenAddress?: Address,
    decimals: number,
    chain: CHAIN,
}

export const TOKEN_LISTS = {
    ETHEREUM: [
        { 
            name: 'Ethereum',
            symbol: 'SepoliaETH',
            address: '',
            decimals: 18
        },
    ],
    BASE: [
        { 
            name: 'Base', 
            symbol: 'SepoliaETH', 
            address: '', 
            decimals: 18 
        },
    ],
    ARBITRUM: [
        { 
            name: 'Arbitrum', 
            symbol: 'SepoliaETH', 
            address: '', 
            decimals: 18 
        },
    ],
    BINANCE: [
        { 
            name: 'Binance', 
            symbol: 'TBNB', 
            address: '', 
            decimals: 18 
        },
    ],
    SOLANA: [
        { 
            name: 'Solana', 
            symbol: 'SOL', 
            address: '', 
            decimals: 9 
        },
    ],
}

export const getChainIdFromChain = (
  chain: CHAIN
): number | null => {
  const [namespace, reference] = chain.split(":");

  // EVM chains → eip155:<chainId>
  if (namespace === "eip155") {
    const id = Number(reference);
    return Number.isFinite(id) ? id : null;
  }

  // Solana chains → no numeric chainId
  if (namespace === "solana") {
    return null;
  }

  return null;
};

export const fetchTokenBalance = async ({
    walletAddress,
    tokenAddress,
    decimals,
    chain
}: fetchTokenBalanceProps) => {
    const chainId = getChainIdFromChain(chain);
    const chainConfig = EVM_CHAIN_CONFIGS[chainId as keyof typeof EVM_CHAIN_CONFIGS];
    const publicClient = createPublicClient({
        chain: chainConfig,
        transport: http(),
    });

    try {

        if (!tokenAddress) {
            const nativeBalance = await publicClient.getBalance({ address: walletAddress });
            return formatUnits(nativeBalance, decimals);
        }

        const balance = await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [walletAddress],
        });

        return formatUnits(balance as bigint, decimals);
    } catch (error) {
        console.error('Error fetching token balance:', error);
        throw new Error('Error fetching token balance:')
    }
}
