import { useQuery } from '@tanstack/react-query';
import { fetchTokenBalance } from '../helpers/TokenHelper';
import { Address } from 'viem';

export const useTokenBalance = (tokenAddress: string, walletAddress: string, decimals: number = 18) => {
    const shouldFetch = !!walletAddress;
    const pollMs = 15_000;

    return useQuery({
        queryKey: ['tokenBalance', walletAddress, tokenAddress],
        queryFn: () => fetchTokenBalance({
            walletAddress: walletAddress as Address,
            tokenAddress: tokenAddress as Address,
            decimals
        }),
        enabled: shouldFetch,
        refetchInterval: pollMs,
        refetchIntervalInBackground: true,
        staleTime: pollMs - 1000,
    });
};