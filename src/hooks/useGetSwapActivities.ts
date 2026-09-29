import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchSwapActivities } from '../modules/wallet/components/swapComponent/swap.api';
import { SwapActivitiesSuccessResponse } from '../modules/wallet/components/swapComponent/swap.activity-api.types';

export const SWAP_ACTIVITY_QUERY_ROOT = ['wallet-swap-activities'] as const;

export type GetSwapActivitiesParams = {
  address: string;
  limit?: number;
};

export const getSwapActivitiesQueryKey = ({
  address,
  limit = 20,
}: GetSwapActivitiesParams) =>
  [...SWAP_ACTIVITY_QUERY_ROOT, address.trim().toLowerCase(), limit] as const;

export const getNextSwapActivitiesPage = (
  lastPage: SwapActivitiesSuccessResponse,
) => (lastPage.hasMore ? lastPage.page + 1 : undefined);

export const useGetSwapActivities = ({
  address,
  limit = 20,
}: GetSwapActivitiesParams) => {
  const activityAddress = address.trim();
  const refetchInterval = 15_000;

  return useInfiniteQuery({
    queryKey: getSwapActivitiesQueryKey({
      address: activityAddress,
      limit,
    }),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: number;
      signal: AbortSignal;
    }) =>
      fetchSwapActivities(
        {
          walletAddress: activityAddress,
          page: pageParam,
          limit,
        },
        { signal },
      ),
    enabled: !!activityAddress,
    initialPageParam: 1,
    getNextPageParam: getNextSwapActivitiesPage,
    refetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: refetchInterval,
  });
};
