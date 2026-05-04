import { viemClient } from "../utils/viemClient";
import { decodeFunctionResult, encodeFunctionData, erc20Abi, formatUnits, isAddress } from "viem";

type fetchTokenBalanceProps = {
    walletAddress: `0x${string}`,
    tokenAddress?: `0x${string}`,
    decimals: number,
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
}: fetchTokenBalanceProps) => {
    if (tokenAddress && !isAddress(tokenAddress)) {
        return "0";
    }

    try {

        if (!tokenAddress) {
            const nativeBalance = await viemClient.getBalance({ address: walletAddress });
            return formatUnits(nativeBalance, decimals);
        }

        const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [walletAddress],
        });

        const response = await viemClient.call({
            to: tokenAddress,
            data,
        });

        const balance = decodeFunctionResult({
            abi: erc20Abi,
            functionName: 'balanceOf',
            data: response.data ?? '0x',
        });

        return formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error fetching token balance:', error);
        throw new Error('Error fetching token balance:')
    }
}
