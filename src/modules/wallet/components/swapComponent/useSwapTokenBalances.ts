import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  SWAP_ACCOUNT_GC_TIME,
  SWAP_BALANCE_GC_TIME,
  SWAP_BALANCE_STALE_TIME,
  SwapOriginAccount,
  SwapTokenBalanceMap,
  fetchSwapChainBalances,
  getSwapAccountQueryKey,
  getSwapBalanceQueryKey,
  getSwapTokenKey,
  getSwapTokensForChain,
  resolveSwapAccount,
} from './swap.balances';
import { SwapChain, SwapToken } from './swap.types';

export type SwapChainBalanceState = {
  account?: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
};

export type SwapTokenBalanceState = {
  balance?: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
};

export type UseSwapTokenBalancesParams = {
  chains: SwapChain[];
  executorAddress?: string | null;
  origin?: SwapOriginAccount | null;
  enabled?: boolean;
  refetchInterval?: number | false;
};

export type UseSwapTokenBalancesResult = {
  balances: SwapTokenBalanceMap;
  accounts: Partial<Record<SwapChain, string>>;
  chainStates: Record<SwapChain, SwapChainBalanceState>;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  getTokenState: (token: SwapToken) => SwapTokenBalanceState;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error('Unable to fetch balances');

export const useSwapTokenBalances = ({
  chains,
  executorAddress,
  origin,
  enabled = true,
  refetchInterval = SWAP_BALANCE_STALE_TIME,
}: UseSwapTokenBalancesParams): UseSwapTokenBalancesResult => {
  const uniqueChains = useMemo(
    () => Array.from(new Set(chains)),
    [chains],
  );
  const tokensByChain = useMemo(
    () =>
      Object.fromEntries(
        uniqueChains.map((chain) => [
          chain,
          getSwapTokensForChain(chain),
        ]),
      ) as Record<SwapChain, SwapToken[]>,
    [uniqueChains],
  );

  const canResolveAccounts =
    enabled && !!executorAddress && !!origin;
  const accountQueries = useQueries({
    queries: uniqueChains.map((chain) => ({
      queryKey:
        executorAddress && origin
          ? getSwapAccountQueryKey({
              chain,
              executorAddress,
              origin,
            })
          : [
              'wallet-swap-account',
              executorAddress ?? '',
              origin?.chain ?? '',
              origin?.address ?? '',
              chain,
            ],
      queryFn: () =>
        resolveSwapAccount({
          chain,
          executorAddress: executorAddress as string,
          origin: origin as SwapOriginAccount,
        }),
      enabled: canResolveAccounts,
      staleTime: Infinity,
      gcTime: SWAP_ACCOUNT_GC_TIME,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  });

  const balanceQueries = useQueries({
    queries: uniqueChains.map((chain, index) => {
      const account = accountQueries[index]?.data;
      const tokens = tokensByChain[chain] ?? [];

      return {
        queryKey: getSwapBalanceQueryKey({
          chain,
          account: account ?? '',
          tokens,
        }),
        queryFn: () =>
          fetchSwapChainBalances({
            chain,
            account: account as string,
            tokens,
          }),
        enabled:
          enabled &&
          !!account &&
          tokens.length > 0 &&
          !accountQueries[index]?.isError,
        staleTime: SWAP_BALANCE_STALE_TIME,
        gcTime: SWAP_BALANCE_GC_TIME,
        refetchInterval,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        retry: 1,
      };
    }),
  });

  const accounts: Partial<Record<SwapChain, string>> = {};
  const balances: SwapTokenBalanceMap = {};
  const chainStates: Record<SwapChain, SwapChainBalanceState> = {};

  uniqueChains.forEach((chain, index) => {
    const accountQuery = accountQueries[index];
    const balanceQuery = balanceQueries[index];
    if (accountQuery?.data) accounts[chain] = accountQuery.data;
    if (balanceQuery?.data) Object.assign(balances, balanceQuery.data);

    const accountLoading =
      canResolveAccounts &&
      !accountQuery?.data &&
      !accountQuery?.isError;
    const balanceLoading =
      !!accountQuery?.data &&
      (balanceQuery?.isLoading ?? false);
    const error = accountQuery?.error ?? balanceQuery?.error ?? null;
    chainStates[chain] = {
      account: accountQuery?.data,
      isLoading: accountLoading || balanceLoading,
      isFetching:
        (accountQuery?.isFetching ?? false) ||
        (balanceQuery?.isFetching ?? false),
      isError:
        (accountQuery?.isError ?? false) ||
        (balanceQuery?.isError ?? false),
      error: error ? toError(error) : null,
    };
  });

  const getTokenState = (token: SwapToken): SwapTokenBalanceState => {
    const chainState = chainStates[token.chain] ?? {
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };

    return {
      balance: balances[getSwapTokenKey(token)],
      isLoading: chainState.isLoading,
      isFetching: chainState.isFetching,
      isError: chainState.isError,
      error: chainState.error,
    };
  };

  return {
    balances,
    accounts,
    chainStates,
    isLoading: Object.values(chainStates).some(
      (state) => state.isLoading,
    ),
    isFetching: Object.values(chainStates).some(
      (state) => state.isFetching,
    ),
    isError: Object.values(chainStates).some((state) => state.isError),
    getTokenState,
  };
};
