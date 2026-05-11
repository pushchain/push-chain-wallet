import { EVM_CHAIN_CONFIGS } from "../modules/wallet/Wallet.utils";
import { WalletType } from "../types";
import { viemClient } from "../utils/viemClient";
import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from "viem";
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from "@solana/spl-token";

type fetchTokenBalanceProps = {
    walletAddress: `0x${string}`,
    tokenAddress?: `0x${string}`,
    decimals: number,
    walletDetails: WalletType | null,
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

export const fetchTokenBalance = async ({
    walletAddress,
    tokenAddress,
    decimals,
    walletDetails,
}: fetchTokenBalanceProps) => {
    
    // if (tokenAddress && !isAddress(tokenAddress)) {
    //     return "0";
    // }

    try {

        if (!tokenAddress) {
            const nativeBalance = await viemClient.getBalance({ address: walletAddress });
            return formatUnits(nativeBalance, decimals);
        }

        if (!walletDetails) {
            const balance = await viemClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [walletAddress],
                authorizationList: []
            });

            return formatUnits(balance as bigint, decimals);
        }

        if (walletDetails?.chain?.toLowerCase() === 'solana') {
            const conn = new Connection("https://api.devnet.solana.com");
            const ownerPk = new PublicKey(walletDetails.address);
            const mintPk = new PublicKey(tokenAddress);

            const ata = await getAssociatedTokenAddress(mintPk, ownerPk);
            const res = await conn.getTokenAccountBalance(ata).catch(() => null);

            return res?.value?.uiAmountString ?? "0";
        }

        const chainId = Number(walletDetails?.chainId) || 42101;
        const chain = EVM_CHAIN_CONFIGS[chainId];

        const rpcUrl = chain?.rpcUrls?.public?.http?.[0] ?? chain?.rpcUrls?.default?.http?.[0];
        const client = createPublicClient({
            chain,
            transport: !rpcUrl ? http() : http(rpcUrl, {
                retryCount: 3,
                retryDelay: 30_000,
            })
        });

        const [raw, dec] = await Promise.all([
        client.readContract({
            address: tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletDetails.address as `0x${string}`],
            authorizationList: []
        }),
        decimals ??
            client.readContract({
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                functionName: "decimals",
                authorizationList: []
            }),
        ]);
    
        return formatUnits(raw, Number(dec));
    } catch (error) {
        console.error('Error fetching token balance:', error);
        throw new Error('Error fetching token balance:')
    }
}
