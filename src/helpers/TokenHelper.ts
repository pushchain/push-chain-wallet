import { EVM_CHAIN_CONFIGS } from "../modules/wallet/Wallet.utils";
import { WalletType } from "../types";
import { viemClient } from "../utils/viemClient";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js';

type fetchTokenBalanceProps = {
    walletAddress: string,
    tokenAddress?: string,
    decimals: number,
    walletDetails: WalletType | null,
}

const isZeroDataBalanceRead = (error: unknown) => {
    if (!(error instanceof Error)) return false;

    return (
        error.name === 'ContractFunctionZeroDataError' ||
        error.message.includes('returned no data') ||
        error.message.includes('Cannot decode zero data')
    );
};

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
            const nativeBalance = await viemClient.getBalance({
                address: walletAddress as `0x${string}`,
            });
            return formatUnits(nativeBalance, decimals);
        }

        if (!walletDetails) {
            const contractCode = await viemClient.getCode({
                address: tokenAddress as `0x${string}`,
            });

            if (!contractCode || contractCode === '0x') return '0';

            const balanceParams = {
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [walletAddress as `0x${string}`],
            };
            const balance = await viemClient.readContract(
                balanceParams as unknown as Parameters<
                    typeof viemClient.readContract
                >[0],
            );

            return formatUnits(balance as bigint, decimals);
        }

        if (walletDetails?.chain?.toLowerCase() === 'solana') {
            const conn = new Connection("https://api.devnet.solana.com");
            const ownerPk = new PublicKey(walletDetails.address);
            const mintPk = new PublicKey(tokenAddress);

            const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
                ownerPk,
                { mint: mintPk },
            );

            const rawBalance = tokenAccounts.value.reduce((total, item) => {
                const data = item.account.data as ParsedAccountData;
                const amount =
                    data.parsed?.info?.tokenAmount?.amount as
                        | string
                        | undefined;

                return amount ? total + BigInt(amount) : total;
            }, 0n);

            return formatUnits(rawBalance, decimals);
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

        const contractCode = await client.getCode({
            address: tokenAddress as `0x${string}`,
        });

        if (!contractCode || contractCode === '0x') return '0';

        const balanceParams = {
            address: tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletDetails.address as `0x${string}`],
        };
        const raw = await client.readContract(
            balanceParams as unknown as Parameters<typeof client.readContract>[0],
        );
    
        return formatUnits(raw as bigint, decimals);
    } catch (error) {
        if (isZeroDataBalanceRead(error)) return '0';

        console.error('Error fetching token balance:', error);
        throw new Error('Error fetching token balance:')
    }
}
