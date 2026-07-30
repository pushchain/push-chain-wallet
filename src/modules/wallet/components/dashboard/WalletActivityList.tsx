import { FC, useCallback, useMemo, useRef } from 'react';
import { Box, Spinner, Text } from '../../../../blocks';
import { EXPLORER_URL } from 'common';
import { css } from 'styled-components';
import { useGetWalletActivities } from '../../../../hooks/useGetWalletActivities';
import { useGetSwapActivities } from '../../../../hooks/useGetSwapActivities';
import { useSwapTransaction } from '../../../../context/SwapTransactionContext';
import { useWalletDashboard } from '../../../../context/WalletDashboardContext';
import { WalletActivitiesResponse } from '../../../../types/walletactivities.types';
import { WalletActivityListItem } from './WalletActivityListItem';
import { SwapActivityListItem } from './SwapActivityListItem';
import {
  formatSwapActivityDateLabel,
  getSwapActivityIdentityHashes,
  getSwapActivityDateKey,
  mergeSwapActivityRecords,
  normalizeActivityTimestamp,
  normalizeRamenSwapActivity,
  SwapActivityRecord,
} from '../swapComponent/swap.activity';
import { normalizeExplorerSwapActivity } from '../swapComponent/swap.explorer-activity';

export type WalletActivityListProps = {
  address: string | null;
  walletAliases?: string[];
};

type UnifiedActivity =
  | {
      kind: 'swap';
      key: string;
      timestamp: number;
      activity: SwapActivityRecord;
    }
  | {
      kind: 'transaction';
      key: string;
      timestamp: number;
      transaction: WalletActivitiesResponse;
    };

type UnifiedActivityGroup = {
  key: string;
  label: string;
  activities: UnifiedActivity[];
};

const normalizeWalletAddress = (value: string) =>
  (value.match(/0x[0-9a-fA-F]{40}$/)?.[0] ?? value).toLowerCase();

const groupActivitiesByDate = (
  activities: UnifiedActivity[],
): UnifiedActivityGroup[] => {
  const groups = new Map<string, UnifiedActivityGroup>();

  activities.forEach((activity) => {
    const key = getSwapActivityDateKey(activity.timestamp);
    if (!key) return;

    const existing = groups.get(key);
    if (existing) {
      existing.activities.push(activity);
      return;
    }

    groups.set(key, {
      key,
      label: formatSwapActivityDateLabel(activity.timestamp),
      activities: [activity],
    });
  });

  return Array.from(groups.values());
};

const WalletActivityList: FC<WalletActivityListProps> = ({
  address,
  walletAliases = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activityAddress = address ?? '';
  const {
    swapExecutions,
    activeSwapExecution,
    dismissSwapDrawer,
    isSwapDrawerOpen,
    selectSwapActivity,
  } = useSwapTransaction();
  const { setActiveDashboardTab, setActiveState } = useWalletDashboard();

  const walletActivities = useGetWalletActivities({
    address: activityAddress,
  });
  const swapActivities = useGetSwapActivities({
    address: activityAddress,
  });

  const trackedAddresses = useMemo(
    () => [activityAddress, ...walletAliases].filter(Boolean),
    [activityAddress, walletAliases],
  );

  const rawTransactions = useMemo(
    () => {
      const transactions =
        walletActivities.data?.pages.flatMap((page) => page.items) ?? [];
      const seenHashes = new Set<string>();

      return transactions.filter((transaction) => {
        const hash = transaction.hash.toLowerCase();
        if (seenHashes.has(hash)) return false;
        seenHashes.add(hash);
        return true;
      });
    },
    [walletActivities.data],
  );

  const remoteSwaps = useMemo(
    () =>
      (swapActivities.data?.pages ?? [])
        .flatMap((page) => page.activities)
        .map(normalizeRamenSwapActivity)
        .filter(
          (activity): activity is SwapActivityRecord =>
            activity?.status === 'success',
        ),
    [swapActivities.data],
  );

  const localCompletedSwaps = useMemo(
    () =>
      swapExecutions.filter(
        (activity) =>
          activity.status === 'success' &&
          trackedAddresses.some(
            (trackedAddress) =>
              normalizeWalletAddress(trackedAddress) ===
              normalizeWalletAddress(activity.executorAddress),
          ),
      ),
    [swapExecutions, trackedAddresses],
  );

  const explorerSwaps = useMemo(
    () =>
      rawTransactions
        .map((transaction) =>
          normalizeExplorerSwapActivity(
            transaction,
            trackedAddresses,
          ),
        )
        .filter(
          (activity): activity is SwapActivityRecord => !!activity,
        ),
    [rawTransactions, trackedAddresses],
  );

  const decodedSwaps = useMemo(
    () =>
      mergeSwapActivityRecords(remoteSwaps, [
        ...explorerSwaps,
        ...localCompletedSwaps,
      ]),
    [explorerSwaps, localCompletedSwaps, remoteSwaps],
  );

  const unifiedActivities = useMemo(() => {
    const swapHashes = new Set(
      decodedSwaps.flatMap(getSwapActivityIdentityHashes),
    );
    const swaps: UnifiedActivity[] = decodedSwaps.map((activity) => ({
      kind: 'swap',
      key: `swap:${activity.hash.toLowerCase()}`,
      timestamp: activity.timestamp,
      activity,
    }));
    const transactions: UnifiedActivity[] = rawTransactions
      .filter(
        (transaction) =>
          !swapHashes.has(transaction.hash.toLowerCase()),
      )
      .map((transaction) => ({
        kind: 'transaction',
        key: `transaction:${transaction.hash.toLowerCase()}`,
        timestamp: normalizeActivityTimestamp(transaction.timestamp) ?? 0,
        transaction,
      }));

    return [...swaps, ...transactions].sort(
      (first, second) => second.timestamp - first.timestamp,
    );
  }, [decodedSwaps, rawTransactions]);

  const groupedActivities = useMemo(
    () => groupActivitiesByDate(unifiedActivities),
    [unifiedActivities],
  );

  const fetchMore = useCallback(() => {
    if (
      walletActivities.hasNextPage &&
      !walletActivities.isFetchingNextPage
    ) {
      void walletActivities.fetchNextPage();
    }
    if (
      swapActivities.hasNextPage &&
      !swapActivities.isFetchingNextPage
    ) {
      void swapActivities.fetchNextPage();
    }
  }, [swapActivities, walletActivities]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 28) fetchMore();
  }, [fetchMore]);

  const retry = () => {
    void walletActivities.refetch();
    void swapActivities.refetch();
  };

  const isInitiallyLoading =
    unifiedActivities.length === 0 &&
    (walletActivities.isLoading || swapActivities.isLoading);
  const isFetchingNextPage =
    walletActivities.isFetchingNextPage ||
    swapActivities.isFetchingNextPage;
  const hasError =
    unifiedActivities.length === 0 &&
    !!walletActivities.error &&
    !!swapActivities.error;
  const drawerBottomPadding =
    isSwapDrawerOpen && activeSwapExecution
      ? activeSwapExecution.status === 'pending'
        ? '132px'
        : activeSwapExecution.status === 'failed'
          ? '196px'
          : '168px'
      : '0';

  if (hasError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        height="292px"
        justifyContent="center"
        alignItems="center"
      >
        <Text variant="bes-semibold" color="pw-int-text-danger-bold-color">
          Error loading transactions
        </Text>
        <Box
          margin="spacing-xs"
          cursor="pointer"
          role="button"
          tabIndex={0}
          onClick={retry}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') retry();
          }}
        >
          <Text variant="bes-regular">Retry</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="292px"
      overflow="hidden scroll"
      onScroll={handleScroll}
      ref={containerRef}
      customScrollbar
      css={css`
        padding-right: 6px;
        padding-bottom: ${drawerBottomPadding};
        margin-right: -8px;
        scroll-padding-bottom: ${drawerBottomPadding};
      `}
    >
      {groupedActivities.map((group) => (
        <Box key={group.key} display="flex" flexDirection="column">
          <Box padding="spacing-xxs spacing-xxxs">
            <Text variant="bes-regular" color="pw-int-text-tertiary-color">
              {group.label}
            </Text>
          </Box>

          {group.activities.map((item) => {
            if (item.kind === 'swap') {
              return (
                <Box
                  key={item.key}
                  cursor="pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`View swap details for ${item.activity.tokensIn[0]?.symbol ?? 'token'}`}
                  onClick={() => {
                    dismissSwapDrawer();
                    selectSwapActivity(item.activity);
                    setActiveDashboardTab('activity');
                    setActiveState('swapDetails');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      dismissSwapDrawer();
                      selectSwapActivity(item.activity);
                      setActiveDashboardTab('activity');
                      setActiveState('swapDetails');
                    }
                  }}
                  css={css`
                    &:hover {
                      filter: brightness(0.98);
                    }
                  `}
                >
                  <SwapActivityListItem activity={item.activity} />
                </Box>
              );
            }

            return (
              <Box
                key={item.key}
                cursor="pointer"
                role="link"
                tabIndex={0}
                onClick={() =>
                  window.open(
                    `${EXPLORER_URL}/tx/${item.transaction.hash}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    window.open(
                      `${EXPLORER_URL}/tx/${item.transaction.hash}`,
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }
                }}
                css={css`
                  &:hover {
                    background-color: var(--pw-int-bg-primary-color);
                  }
                `}
              >
                <WalletActivityListItem
                  transaction={item.transaction}
                  addresses={trackedAddresses}
                />
              </Box>
            );
          })}
        </Box>
      ))}

      {isInitiallyLoading && (
        <Box
          margin="spacing-xs"
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <Spinner variant="primary" />
        </Box>
      )}

      {isFetchingNextPage && (
        <Box
          margin="spacing-xs"
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
          <Spinner variant="primary" />
        </Box>
      )}

      {!isInitiallyLoading && unifiedActivities.length === 0 && (
        <Box
          margin="spacing-xxxl spacing-none spacing-none spacing-none"
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <Text variant="bes-semibold">Your activity will appear here</Text>
        </Box>
      )}
    </Box>
  );
};

export { WalletActivityList };
