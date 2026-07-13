import { FC, useCallback, useEffect, useMemo, useRef } from "react";

import { Box, Text, Spinner } from "../../../../blocks";
import { useGetWalletActivities } from "../../../../hooks/useGetWalletActivities";
import { WalletActivityListItem } from "./WalletActivityListItem";
import { WalletActivitiesResponse } from "src/types/walletactivities.types";
import { EXPLORER_URL } from "common";
import { css } from "styled-components";

export type WalletActivityListProps = {
  address: string | null;
  walletAliases?: string[];
};

const WalletActivityList: FC<WalletActivityListProps> = ({
  address,
  walletAliases = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const activityAddress = address ?? '';

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
  } = useGetWalletActivities({ address: activityAddress });

  const trackedAddresses = useMemo(
    () => [activityAddress, ...walletAliases].filter(Boolean),
    [activityAddress, walletAliases],
  );

  const allTransactions = useMemo(() => {
    return data?.pages.flatMap(page => page.items) || [];
  }, [data]);


  const lastTransactionElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isFetchingNextPage) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        {
          threshold: 1.0,
          rootMargin: '100px',
        }
      );

      if (node) observer.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );


  const handleScroll = useCallback(() => {
    if (!containerRef.current || isLoading || isFetchingNextPage || !hasNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    if (scrollTop + clientHeight >= scrollHeight - 20) {
      fetchNextPage();
    }
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  useEffect(() => {
    if (activityAddress) {
      refetch();
    }
  }, [activityAddress, refetch]);

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        height="292px"
        padding="spacing-none spacing-xs spacing-none spacing-none"
        justifyContent="center"
        alignItems="center"
      >
        <Text variant="bes-semibold" color="pw-int-text-danger-bold-color">
          Error loading transactions
        </Text>
        <Box margin="spacing-xs">
          <button onClick={() => refetch()}>
            <Text variant="bes-regular" color="pw-int-text-primary-color">
              Retry
            </Text>
          </button>
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
        margin-right: -8px;
      `}
    >
      {/* Render all transactions */}
      {allTransactions.map((transaction: WalletActivitiesResponse, index: number) => {
        const isLast = index === allTransactions.length - 1;

        return (
          <Box
            key={`${transaction.hash}-${index}`}
            ref={isLast ? lastTransactionElementRef : null}
            onClick={() => window.open(`${EXPLORER_URL}/tx/${transaction.hash}`, "_blank")}
            cursor="pointer"
            css={css`
                &:hover {
                  background-color: var(--pw-int-bg-primary-color);
                }
            `}
          >
            <WalletActivityListItem
              transaction={transaction}
              addresses={trackedAddresses}
            />
          </Box>
        );
      })}

      {/* Loading indicator for initial load */}
      {isLoading && allTransactions.length === 0 && (
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

      {/* Loading indicator for fetching next page */}
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

      {/* Empty state */}
      {!isLoading && allTransactions.length === 0 && !error && (
        <Box
          margin="spacing-xxxl spacing-none spacing-none spacing-none"
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <Text variant="bes-semibold" color="pw-int-text-primary-color">
            Your activity will appear here
          </Text>
        </Box>
      )}

      {/* End of results indicator */}
      {!hasNextPage && allTransactions.length > 0 && !isLoading && (
        <Box
          margin="spacing-xs"
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
          <Text variant="bes-regular" color="pw-int-text-secondary-color">
            No more transactions to load
          </Text>
        </Box>
      )}
    </Box>
  );
};

export { WalletActivityList };
