import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchSwapActivitiesMock, useInfiniteQueryMock } = vi.hoisted(() => ({
  fetchSwapActivitiesMock: vi.fn(),
  useInfiniteQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: useInfiniteQueryMock,
}));

vi.mock('../modules/wallet/components/swapComponent/swap.api', () => ({
  fetchSwapActivities: fetchSwapActivitiesMock,
}));

import {
  getNextSwapActivitiesPage,
  getSwapActivitiesQueryKey,
  SWAP_ACTIVITY_QUERY_ROOT,
  useGetSwapActivities,
} from './useGetSwapActivities';

const activityPage = {
  success: true as const,
  address: '0x2222222222222222222222222222222222222222',
  page: 2,
  limit: 25,
  hasMore: true,
  totalItems: 25,
  totalPages: 3,
  activities: [],
};

describe('useGetSwapActivities', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('builds a stable, normalized activity query key', () => {
    expect(
      getSwapActivitiesQueryKey({
        address: ' 0xAbCd ',
        limit: 25,
      }),
    ).toEqual([...SWAP_ACTIVITY_QUERY_ROOT, '0xabcd', 25]);
  });

  it('configures numeric pagination and polling', async () => {
    useInfiniteQueryMock.mockReturnValue({ data: undefined });
    fetchSwapActivitiesMock.mockResolvedValue(activityPage);

    useGetSwapActivities({
      address: ' 0x2222222222222222222222222222222222222222 ',
      limit: 25,
    });

    const options = useInfiniteQueryMock.mock.calls[0][0];
    expect(options).toEqual(
      expect.objectContaining({
        queryKey: [
          ...SWAP_ACTIVITY_QUERY_ROOT,
          '0x2222222222222222222222222222222222222222',
          25,
        ],
        enabled: true,
        initialPageParam: 1,
        refetchInterval: 15_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        staleTime: 15_000,
      }),
    );

    const signal = new AbortController().signal;
    await options.queryFn({ pageParam: 3, signal });

    expect(fetchSwapActivitiesMock).toHaveBeenCalledWith(
      {
        walletAddress: '0x2222222222222222222222222222222222222222',
        page: 3,
        limit: 25,
      },
      { signal },
    );
  });

  it('disables the query without an address', () => {
    useInfiniteQueryMock.mockReturnValue({ data: undefined });

    useGetSwapActivities({ address: ' ' });

    expect(useInfiniteQueryMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('advances numeric pages only while the API reports more results', () => {
    expect(getNextSwapActivitiesPage(activityPage)).toBe(3);
    expect(
      getNextSwapActivitiesPage({
        ...activityPage,
        hasMore: false,
      }),
    ).toBeUndefined();
  });
});
