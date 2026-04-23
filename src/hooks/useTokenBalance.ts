import { useQuery } from '@tanstack/react-query';
import { fetchTokenBalance } from '../helpers/TokenHelper';
import { Address } from 'viem';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';

export const useTokenBalance = (tokenAddress: string, walletAddress: string, chain: CHAIN, decimals: number = 18) => {
    const shouldFetch = !!walletAddress;
    const pollMs = 15_000;

    return useQuery({
        queryKey: ['tokenBalance', walletAddress, tokenAddress],
        queryFn: () => fetchTokenBalance({
            walletAddress: walletAddress as Address,
            tokenAddress: tokenAddress as Address,
            chain,
            decimals
        }),
        enabled: shouldFetch,
        refetchInterval: pollMs,
        refetchIntervalInBackground: true,
        staleTime: pollMs - 1000,
    });
};