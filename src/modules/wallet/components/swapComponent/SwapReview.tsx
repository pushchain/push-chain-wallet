import { FC, KeyboardEvent, ReactNode, useState } from 'react';
import {
  Back,
  Box,
  Button,
  CaretDown,
  CaretUp,
  InfoFilled,
  Text,
} from 'blocks';
import { getChainIcon, TokenLogoComponent } from 'common';
import { css } from 'styled-components';
import WalletHeader from '../dashboard/WalletHeader';
import { PUSH_CHAIN_ID, SWAP_TITLE } from './swap.constants';
import { SwapToken } from './swap.types';
import {
  getSwapChainDisplayName,
  getSwapTokenDisplaySymbol,
} from './swap.utils';

type SwapReviewProps = {
  walletAddress: string;
  amount: string;
  outputAmount: string;
  fromToken: SwapToken;
  toToken: SwapToken;
  gasCostDisplay: string | null;
  priceDisplay: string | null;
  slippage: string;
  onBack: () => void;
  onConfirm: () => void;
};

const ChainPill: FC<{ chain: string }> = ({ chain }) => {
  const label = getSwapChainDisplayName(chain, 'family');

  return (
    <Box
      display="flex"
      alignItems="center"
      gap="spacing-xxxs"
      padding="spacing-xxxs spacing-xxs"
      borderRadius="radius-round"
      backgroundColor="pw-int-bg-tertiary-color"
      title={label}
      css={css`
        flex-shrink: 0;
        max-width: 116px;
      `}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        css={css`
          flex-shrink: 0;
        `}
      >
        {getChainIcon(chain, 16)}
      </Box>
      <Text variant="bes-regular" ellipsis>
        {label}
      </Text>
    </Box>
  );
};

const ReviewTokenRow: FC<{
  amount: string;
  token: SwapToken;
}> = ({ amount, token }) => {
  const displaySymbol = getSwapTokenDisplaySymbol(token.symbol);
  const value = `${amount || '0'} ${displaySymbol}`;

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="spacing-xs"
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
        <Box
          display="flex"
          css={css`
            flex-shrink: 0;
          `}
        >
          <TokenLogoComponent
            tokenSymbol={displaySymbol}
            chainId={token.chain}
          />
        </Box>
        <Text variant="h4-semibold" ellipsis title={value}>
          {value}
        </Text>
      </Box>
      <ChainPill chain={token.chain} />
    </Box>
  );
};

const DetailRow: FC<{
  label: string;
  info?: string;
  children: ReactNode;
}> = ({ label, info, children }) => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="space-between"
    gap="spacing-xs"
    width="100%"
  >
    <Box
      display="flex"
      alignItems="center"
      gap="spacing-xxxs"
      title={info}
    >
      <Text variant="bs-regular" color="pw-int-text-secondary-color">
        {label}
      </Text>
      {info && (
        <InfoFilled size={14} color="pw-int-icon-tertiary-color" />
      )}
    </Box>
    {children}
  </Box>
);

const SwapReview: FC<SwapReviewProps> = ({
  walletAddress,
  amount,
  outputAmount,
  fromToken,
  toToken,
  gasCostDisplay,
  priceDisplay,
  slippage,
  onBack,
  onConfirm,
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(true);

  const toggleDetails = () => setDetailsExpanded((expanded) => !expanded);
  const handleDetailsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDetails();
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="spacing-md"
      width="100%"
      height={{ initial: '570px', ml: '100%' }}
      position="relative"
    >
      <WalletHeader
        walletAddress={walletAddress}
        handleBackButton={onBack}
      />

      <Text variant="h4-semibold">{SWAP_TITLE}</Text>

      <Box
        display="flex"
        flexDirection="column"
        gap="spacing-md"
        css={css`
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
        `}
      >
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          gap="spacing-sm"
          minHeight="176px"
          padding="spacing-sm"
          borderRadius="radius-sm"
          backgroundColor="pw-int-bg-primary-color"
          overflow="hidden"
          css={css`
            flex-shrink: 0;
          `}
        >
          <ReviewTokenRow amount={amount} token={fromToken} />

          <Box
            display="flex"
            alignItems="center"
            css={css`
              margin-left: 6px;
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

          <ReviewTokenRow amount={outputAmount} token={toToken} />
        </Box>

        <Box display="flex" flexDirection="column" gap="spacing-xs">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="spacing-xs"
            width="100%"
            cursor="pointer"
            role="button"
            tabIndex={0}
            aria-expanded={detailsExpanded}
            title="Estimated Push Chain swap-leg gas. Approval and cross-chain costs are not included."
            onClick={toggleDetails}
            onKeyDown={handleDetailsKeyDown}
          >
            <Box
              display="flex"
              alignItems="center"
              gap="spacing-xxxs"
            >
              <Text
                variant="bs-regular"
                color="pw-int-text-secondary-color"
              >
                Network cost
              </Text>
              <InfoFilled
                size={14}
                color="pw-int-icon-tertiary-color"
              />
            </Box>
            <Box
              display="flex"
              alignItems="center"
              gap="spacing-xxxs"
              css={css`
                flex-shrink: 0;
              `}
            >
              {getChainIcon(PUSH_CHAIN_ID, 16)}
              <Text variant="bs-regular">{gasCostDisplay ?? '—'}</Text>
              {detailsExpanded ? (
                <CaretUp
                  size={18}
                  color="pw-int-icon-secondary-color"
                />
              ) : (
                <CaretDown
                  size={18}
                  color="pw-int-icon-secondary-color"
                />
              )}
            </Box>
          </Box>

          {detailsExpanded && (
            <>
              {priceDisplay && (
                <DetailRow label="Price">
                  <Text
                    variant="bs-regular"
                    textAlign="right"
                    ellipsis
                    title={priceDisplay}
                    css={css`
                      max-width: 68%;
                    `}
                  >
                    {priceDisplay}
                  </Text>
                </DetailRow>
              )}

              <DetailRow label="Fee">
                <Text
                  variant="bs-regular"
                  color="pw-int-text-success-bold-color"
                  title="RamenFi adds no separate service fee. Pool pricing is included in the quote."
                >
                  Free
                </Text>
              </DetailRow>

              <DetailRow
                label="Slippage Tolerance"
                info="The maximum accepted price movement before the swap reverts."
              >
                <Text variant="bs-regular">{slippage}%</Text>
              </DetailRow>
            </>
          )}
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
        <Button block onClick={onConfirm}>
          Confirm Swap
        </Button>
      </Box>
    </Box>
  );
};

export { SwapReview };
