import { FC, useEffect } from 'react';
import {
  ArrowUpRight,
  Back,
  Box,
  Button,
  CaretUp,
  Text,
} from 'blocks';
import {
  getChainIcon,
  RamenTextIcon,
  TokenLogoComponent,
} from 'common';
import { css } from 'styled-components';
import { usePushChain } from '../../../../context/PushChainContext';
import { useSwapTransaction } from '../../../../context/SwapTransactionContext';
import { useWalletDashboard } from '../../../../context/WalletDashboardContext';
import WalletHeader from '../dashboard/WalletHeader';
import { formatTokenValue } from '../../Wallet.utils';
import {
  buildPushTransactionExplorerUrl,
  shortenTransactionHash,
  SwapActivityToken,
} from './swap.activity';
import { PUSH_CHAIN_ID, SWAP_DISPLAY_DECIMALS } from './swap.constants';
import { normalizePositiveNetworkCost } from './swap.gas';
import {
  getSwapChainDisplayName,
  getSwapTokenDisplaySymbol,
  shortenSwapAddress,
} from './swap.utils';

const formatSwapDetailsDate = (timestamp: number) => {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '—';

  const datePart = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${datePart} ${timePart}`;
};

const ChainPill: FC<{ chain?: string; fallback?: string }> = ({
  chain,
  fallback = PUSH_CHAIN_ID,
}) => {
  const resolvedChain = chain || fallback;
  const label = getSwapChainDisplayName(resolvedChain, 'family');

  return (
    <Box
      display="flex"
      alignItems="center"
      gap="spacing-xxxs"
      padding="spacing-xxxs spacing-xxs"
      borderRadius="radius-round"
      backgroundColor="pw-int-bg-tertiary-color"
      css={css`
        flex-shrink: 0;
        max-width: 124px;
      `}
    >
      {getChainIcon(resolvedChain, 16)}
      <Text variant="bes-regular" ellipsis title={label}>
        {label}
      </Text>
    </Box>
  );
};

const TokenRouteRow: FC<{
  token: SwapActivityToken;
  fallbackChain?: string;
}> = ({ token, fallbackChain }) => {
  const chain = token.chain || fallbackChain || PUSH_CHAIN_ID;
  const symbol = getSwapTokenDisplaySymbol(token.symbol);
  const amount = formatTokenValue(token.amount, SWAP_DISPLAY_DECIMALS);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="spacing-sm"
      width="100%"
    >
      <Box
        display="flex"
        alignItems="center"
        gap="spacing-xs"
        css={css`
          flex: 1;
          min-width: 0;
        `}
      >
        <TokenLogoComponent
          tokenSymbol={token.symbol}
          chainId={chain}
          size={42}
          badgeSize={18}
        />
        <Box
          display="flex"
          flexDirection="column"
          css={css`
            min-width: 0;
          `}
        >
          <Text
            variant="h4-semibold"
            ellipsis
            title={`${amount} ${symbol}`}
          >
            {amount} {symbol}
          </Text>
        </Box>
      </Box>
      <ChainPill chain={chain} />
    </Box>
  );
};

const SwapDetails: FC = () => {
  const { executorAddress } = usePushChain();
  const { selectedSwapActivity, selectSwapActivity } =
    useSwapTransaction();
  const { setActiveDashboardTab, setActiveState } = useWalletDashboard();

  const closeDetails = () => {
    selectSwapActivity(null);
    setActiveDashboardTab('activity');
    setActiveState('walletDashboard');
  };

  useEffect(() => {
    if (!selectedSwapActivity) closeDetails();
    // This guard only runs when a stale/direct details state is encountered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSwapActivity]);

  if (!selectedSwapActivity) return null;

  const input = selectedSwapActivity.tokensIn[0];
  const output = selectedSwapActivity.tokensOut[0];
  if (!input || !output) return null;

  const transactionHash =
    selectedSwapActivity.explorerHash || selectedSwapActivity.hash;
  const explorerUrl =
    selectedSwapActivity.explorerUrl ||
    buildPushTransactionExplorerUrl(transactionHash);
  const networkCost = normalizePositiveNetworkCost(
    selectedSwapActivity.networkCost,
  );

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="spacing-md"
      width="100%"
      height={{ initial: '570px', ml: '100%' }}
    >
      <WalletHeader
        walletAddress={executorAddress ?? ''}
        handleBackButton={closeDetails}
      />

      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Text variant="h4-semibold">Swap Details</Text>
        <Box display="flex" alignItems="center" gap="spacing-xxxs">
          <Text variant="c-regular" color="pw-int-text-tertiary-color">
            powered by
          </Text>
          <RamenTextIcon
            width={58}
            color="var(--pw-int-text-tertiary-color)"
          />
        </Box>
      </Box>

      <Box
        display="flex"
        flexDirection="column"
        gap="spacing-md"
        css={css`
          min-height: 0;
          overflow-y: auto;
        `}
      >
        <Box
          display="flex"
          flexDirection="column"
          gap="spacing-md"
          padding="spacing-sm spacing-xs"
        >
          <TokenRouteRow
            token={input}
            fallbackChain={selectedSwapActivity.sourceChain}
          />
          <Box
            display="flex"
            alignItems="center"
            css={css`
              margin-left: 10px;
            `}
          >
            <Box
              display="flex"
              css={css`
                transform: rotate(-90deg);
              `}
            >
              <Back size={24} color="pw-int-icon-tertiary-color" />
            </Box>
          </Box>
          <TokenRouteRow
            token={output}
            fallbackChain={selectedSwapActivity.destinationChain}
          />
        </Box>

        <Box
          display="flex"
          flexDirection="column"
          gap="spacing-xs"
          padding="spacing-xs"
        >
          {networkCost && (
            <Box
              display="flex"
              justifyContent="space-between"
              gap="spacing-xs"
            >
              <Text
                variant="bs-regular"
                color="pw-int-text-secondary-color"
              >
                Network cost
              </Text>
              <Box
                display="flex"
                alignItems="center"
                gap="spacing-xxxs"
              >
                {getChainIcon(PUSH_CHAIN_ID, 16)}
                <Text variant="bs-regular">
                  {formatTokenValue(networkCost, 9)} PC
                </Text>
                <CaretUp
                  size={20}
                  color="pw-int-icon-tertiary-color"
                />
              </Box>
            </Box>
          )}

          {selectedSwapActivity.destinationAddress && (
            <Box display="flex" justifyContent="space-between" gap="spacing-xs">
              <Text variant="bs-regular" color="pw-int-text-secondary-color">
                Receiver
              </Text>
              <Text
                variant="bs-regular"
                textAlign="right"
                ellipsis
                title={selectedSwapActivity.destinationAddress}
                css={css`
                  max-width: 68%;
                `}
              >
                {shortenSwapAddress(
                  selectedSwapActivity.destinationAddress,
                )}
              </Text>
            </Box>
          )}

          <Box display="flex" justifyContent="space-between" gap="spacing-xs">
            <Text variant="bs-regular" color="pw-int-text-secondary-color">
              Transaction
            </Text>
            <Box
              display="flex"
              alignItems="center"
              gap="spacing-xxxs"
              cursor={explorerUrl ? 'pointer' : 'default'}
              role={explorerUrl ? 'link' : undefined}
              tabIndex={explorerUrl ? 0 : undefined}
              onClick={
                explorerUrl
                  ? () =>
                      window.open(
                        explorerUrl,
                        '_blank',
                        'noopener,noreferrer',
                      )
                  : undefined
              }
              onKeyDown={(event) => {
                if (
                  explorerUrl &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  window.open(
                    explorerUrl,
                    '_blank',
                    'noopener,noreferrer',
                  );
                }
              }}
            >
              <Text variant="bs-regular">
                {shortenTransactionHash(transactionHash)}
              </Text>
              {explorerUrl && (
                <ArrowUpRight
                  size={18}
                  color="pw-int-icon-tertiary-color"
                />
              )}
            </Box>
          </Box>

          <Box display="flex" justifyContent="space-between" gap="spacing-xs">
            <Text variant="bs-regular" color="pw-int-text-secondary-color">
              Date
            </Text>
            <Text variant="bs-regular" textAlign="right">
              {formatSwapDetailsDate(selectedSwapActivity.timestamp)}
            </Text>
          </Box>
        </Box>
      </Box>

      <Box
        display="flex"
        alignItems="flex-end"
        css={css`
          flex: 1;
          min-height: 48px;
        `}
      >
        <Button block onClick={closeDetails}>
          Close
        </Button>
      </Box>
    </Box>
  );
};

export { SwapDetails };
