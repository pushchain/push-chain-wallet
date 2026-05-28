import { useQuery } from '@tanstack/react-query';
import { fetchTokenBalance } from '../helpers/TokenHelper';
import { Address } from 'viem';
import { WalletType } from '../types';

export const useTokenBalance = (
    tokenAddress: string,
    walletAddress: string,
    decimals: number = 18,
    walletDetails: WalletType | null = null,
    enabled: boolean = true,
) => {
    // const hasValidTokenAddress = !tokenAddress || isAddress(tokenAddress);
    // const shouldFetch = !!walletAddress && hasValidTokenAddress;
    const pollMs = 15_000;

    return useQuery({
        queryKey: [
            'tokenBalance',
            walletAddress,
            tokenAddress,
            decimals,
            walletDetails?.chain,
            walletDetails?.chainId,
            walletDetails?.address,
        ],
        queryFn: () => fetchTokenBalance({
            walletAddress: walletAddress as Address,
            tokenAddress: tokenAddress as Address,
            decimals,
            walletDetails
        }),
        enabled: enabled && !!walletAddress,
        refetchInterval: pollMs,
        refetchIntervalInBackground: true,
        staleTime: pollMs - 1000,
    });
};
