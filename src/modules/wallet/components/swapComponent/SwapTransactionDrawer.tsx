import { FC, useEffect, useId, useState } from 'react';
import {
  ArrowUpRight,
  Back,
  Box,
  CaretDown,
  CaretUp,
  Cross,
  Spinner,
  Text,
} from 'blocks';
import { TokenLogoComponent } from 'common';
import styled, { css } from 'styled-components';
import { useSwapTransaction } from '../../../../context/SwapTransactionContext';
import { formatTokenValue } from '../../Wallet.utils';
import { getSwapFailurePresentation } from './swap.failure';
import { getSwapTokenDisplaySymbol } from './swap.utils';
import { SWAP_DISPLAY_DECIMALS } from './swap.constants';

const openExternalLink = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const ErrorDetailsToggle = styled.button`
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xxs);
  width: 100%;

  &:focus-visible {
    border-radius: var(--radius-xs);
    outline: var(--border-sm) solid
      var(--pw-int-brand-primary-subtle-color);
    outline-offset: 2px;
  }
`;

const SwapTransactionDrawer: FC = () => {
  const {
    activeSwapExecution,
    dismissSwapDrawer,
    isSwapDrawerOpen,
  } = useSwapTransaction();
  const [failureDetailsExpanded, setFailureDetailsExpanded] =
    useState(false);
  const failureDetailsId = useId();

  useEffect(() => {
    setFailureDetailsExpanded(false);
  }, [activeSwapExecution?.executionId]);

  if (!isSwapDrawerOpen || !activeSwapExecution) return null;

  const input = activeSwapExecution.tokensIn[0];
  const output = activeSwapExecution.tokensOut[0];
  if (!input || !output) return null;

  const isPending = activeSwapExecution.status === 'pending';
  const isCompleted = activeSwapExecution.status === 'success';
  const isFailed = activeSwapExecution.status === 'failed';
  const failurePresentation = isFailed
    ? getSwapFailurePresentation(activeSwapExecution)
    : null;
  const title = isPending
    ? 'Swapping'
    : isCompleted
      ? 'Swap Completed'
      : 'Swap Failed';
  const actionUrl = isCompleted
    ? activeSwapExecution.explorerUrl
    : undefined;
  const actionLabel = 'View in Push Chain Explorer';

  return (
    <Box
      position="absolute"
      display="flex"
      flexDirection="column"
      gap="spacing-xs"
      width="100%"
      padding="spacing-xs spacing-md spacing-md spacing-md"
      borderRadius="radius-md radius-md radius-none radius-none"
      border="border-sm solid pw-int-border-secondary-color"
      backgroundColor="pw-int-bg-secondary-color"
      css={css`
        left: 0;
        bottom: 0;
        z-index: 12;
        border-bottom-left-radius: var(--radius-md);
        border-bottom-right-radius: var(--radius-md);
        box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.12);
        max-height: calc(100% - var(--spacing-xs));
        overflow-y: auto;
      `}
      role={isFailed ? 'alert' : 'status'}
      aria-live={isFailed ? 'assertive' : 'polite'}
    >
      <Box
        display="flex"
        alignItems="center"
        css={css`
          padding-right: 32px;
        `}
      >
        <Box display="flex" alignItems="center" gap="spacing-xxs">
          <Text variant="bm-regular" color="pw-int-text-secondary-color">
            {title}
          </Text>
          {isPending && <Spinner variant="primary" size="small" />}
        </Box>
        <Box
          display="flex"
          width="32px"
          height="32px"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          role="button"
          tabIndex={0}
          aria-label="Dismiss swap status"
          css={css`
            position: absolute;
            top: var(--spacing-xs);
            right: var(--spacing-xs);
          `}
          onClick={dismissSwapDrawer}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              dismissSwapDrawer();
            }
          }}
        >
          <Cross size={22} color="pw-int-icon-tertiary-color" />
        </Box>
      </Box>

      <Box display="flex" alignItems="center" gap="spacing-xs">
        <Box display="flex" alignItems="center" gap="spacing-xxs">
          <TokenLogoComponent
            tokenSymbol={input.symbol}
            chainId={input.chain ?? activeSwapExecution.sourceChain ?? null}
            size={26}
            badgeSize={13}
          />
          <Text variant="bm-regular">
            {formatTokenValue(input.amount, SWAP_DISPLAY_DECIMALS)}{' '}
            {getSwapTokenDisplaySymbol(input.symbol)}
          </Text>
        </Box>
        <Box
          display="flex"
          css={css`
            transform: rotate(180deg);
          `}
        >
          <Back size={20} color="pw-int-icon-tertiary-color" />
        </Box>
        <Box display="flex" alignItems="center" gap="spacing-xxs">
          <TokenLogoComponent
            tokenSymbol={output.symbol}
            chainId={
              output.chain ?? activeSwapExecution.destinationChain ?? null
            }
            size={26}
            badgeSize={13}
          />
          <Text variant="bm-regular">
            {formatTokenValue(output.amount, SWAP_DISPLAY_DECIMALS)}{' '}
            {getSwapTokenDisplaySymbol(output.symbol)}
          </Text>
        </Box>
      </Box>

      {isPending && activeSwapExecution.failure?.retryable && (
        <Box
          padding="spacing-xxs spacing-xs"
          borderRadius="radius-xs"
          backgroundColor="pw-int-bg-tertiary-color"
        >
          <Text variant="bes-regular" color="pw-int-text-secondary-color">
            Settlement is taking longer than expected. The transaction is
            still being tracked; submitting it again could create a duplicate.
          </Text>
        </Box>
      )}

      {failurePresentation && (
        <Box
          padding="spacing-xxs spacing-xs"
          borderRadius="radius-xs"
          backgroundColor="pw-int-bg-danger-subtle"
          css={css`
            overflow-wrap: anywhere;
          `}
        >
          <Box display="flex" flexDirection="column" gap="spacing-xxs">
            <Text
              variant="bes-regular"
              color="pw-int-text-danger-bold-color"
            >
              {failurePresentation.summary}
            </Text>

            <ErrorDetailsToggle
              type="button"
              aria-expanded={failureDetailsExpanded}
              aria-controls={failureDetailsId}
              onClick={() =>
                setFailureDetailsExpanded((expanded) => !expanded)
              }
            >
              <Text
                as="span"
                variant="bes-semibold"
                color="pw-int-text-danger-bold-color"
              >
                Error details
              </Text>
              {failureDetailsExpanded ? (
                <CaretUp
                  size={18}
                  color="pw-int-icon-danger-subtle-color"
                />
              ) : (
                <CaretDown
                  size={18}
                  color="pw-int-icon-danger-subtle-color"
                />
              )}
            </ErrorDetailsToggle>

            {failureDetailsExpanded && (
              <Box
                id={failureDetailsId}
                role="region"
                aria-label="Swap error details"
                display="flex"
                flexDirection="column"
                gap="spacing-xxs"
                padding="spacing-xxs spacing-none spacing-none spacing-none"
                customScrollbar
                css={css`
                  max-height: 230px;
                  overflow-y: auto;
                  padding-right: var(--spacing-xxs);
                  border-top: var(--border-sm) solid
                    var(--pw-int-stroke-secondary-color);
                `}
              >
                {failurePresentation.details.map((detail, index) => (
                  <Box
                    key={`${detail.label}-${index}`}
                    display="flex"
                    flexDirection="column"
                    gap="spacing-xxxs"
                  >
                    <Text
                      variant="bes-semibold"
                      color="pw-int-text-secondary-color"
                    >
                      {detail.label}
                    </Text>
                    <Text
                      variant="bes-regular"
                      color={
                        detail.kind === 'error'
                          ? 'pw-int-text-danger-bold-color'
                          : 'pw-int-text-primary-color'
                      }
                      css={css`
                        overflow-wrap: anywhere;
                        ${detail.kind === 'address' ||
                        detail.kind === 'transaction'
                          ? 'font-family: monospace;'
                          : ''}
                      `}
                    >
                      {detail.value}
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {actionUrl && (
        <Box
          display="flex"
          alignItems="center"
          gap="spacing-xxs"
          width="fit-content"
          cursor="pointer"
          role="link"
          tabIndex={0}
          aria-label={actionLabel}
          onClick={() => openExternalLink(actionUrl)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openExternalLink(actionUrl);
            }
          }}
        >
          <Text variant="bs-regular">{actionLabel}</Text>
          <ArrowUpRight size={18} color="pw-int-icon-tertiary-color" />
        </Box>
      )}
    </Box>
  );
};

export { SwapTransactionDrawer };
