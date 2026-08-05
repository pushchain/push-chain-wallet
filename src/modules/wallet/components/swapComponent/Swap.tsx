import {
  FC,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  Box,
  Button,
  CaretDown,
  Info,
  SwapDashboard as SwapIcon,
  Text,
} from 'blocks';
import { GasIcon, RamenTextIcon, TokenLogoComponent } from 'common';
import styled, { css } from 'styled-components';
import { isAddress } from 'viem';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePushChain } from '../../../../context/PushChainContext';
import { useSwapTransaction } from '../../../../context/SwapTransactionContext';
import { useWalletDashboard } from '../../../../context/WalletDashboardContext';
import { trackWalletEvent, WALLET_EVENTS } from '../../../../analytics/walletEvents';
import { viemClient } from '../../../../utils/viemClient';
import { fetchSwapQuote, fetchSwapSteps } from './swap.api';
import { SWAP_ACTIVITY_QUERY_ROOT } from '../../../../hooks/useGetSwapActivities';
import {
  SWAP_ACCOUNT_GC_TIME,
  SWAP_BALANCE_QUERY_ROOT,
  getSwapAccountQueryKey,
  resolveSwapAccount,
} from './swap.balances';
import {
  AUTO_SLIPPAGE_PERCENTAGE,
  PUSH_CHAIN_ID,
  SWAP_DISPLAY_DECIMALS,
  SWAP_TITLE,
} from './swap.constants';
import { executeSwapSteps } from './swap.executor';
import {
  getSwapFailureDetails,
  SwapFlowError,
} from './swap.errors';
import { formatSwapGasCost } from './swap.gas';
import { formatSwapReviewRate } from './swap.review';
import { SwapToken, SwapTransactionRef } from './swap.types';
import {
  buildPushTransactionExplorerUrl,
  buildSwapTrackingUrl,
} from './swap.activity';
import {
  doesSwapAmountExceedBalance,
  getDestinationTokens,
  getMaxSwapAmount,
  getSourceTokens,
  getSupportedSwapChains,
  getSwapTokenDisplaySymbol,
  isPushChain,
  isSameToken,
  isValidSwapAmount,
  normalizeAmountInput,
} from './swap.utils';
import { SwapReview } from './SwapReview';
import { SwapTokenSelector } from './SwapTokenSelector';
import { validateRamenSwapSteps } from './swap.step-validator';
import { useSwapTokenBalances } from './useSwapTokenBalances';
import WalletHeader from '../dashboard/WalletHeader';

const AmountInput = styled.input`
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--pw-int-text-primary-color);
  font-family: var(--pw-int-font-family);
  font-size: 30px;
  font-weight: 500;
  line-height: 40px;

  &::placeholder {
    color: var(--pw-int-text-disabled-color);
  }
`;

const MAX_AMOUNT_FONT_SIZE = 30;
const MIN_AMOUNT_FONT_SIZE = 12;

const ResponsiveAmountInput: FC<
  InputHTMLAttributes<HTMLInputElement>
> = ({ value, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const fitValue = useCallback(() => {
    const input = inputRef.current;
    if (!input || input.clientWidth <= 0) return;

    let fontSize = MAX_AMOUNT_FONT_SIZE;
    input.style.fontSize = `${fontSize}px`;

    while (
      input.scrollWidth > input.clientWidth &&
      fontSize > MIN_AMOUNT_FONT_SIZE
    ) {
      fontSize -= 1;
      input.style.fontSize = `${fontSize}px`;
    }

    if (input.scrollWidth <= input.clientWidth) {
      input.scrollLeft = 0;
    }
  }, []);

  useLayoutEffect(() => {
    fitValue();
  }, [fitValue, value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(fitValue);
    resizeObserver?.observe(input);
    window.addEventListener('resize', fitValue);

    let isActive = true;
    void document.fonts?.ready.then(() => {
      if (isActive) fitValue();
    });

    return () => {
      isActive = false;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', fitValue);
    };
  }, [fitValue]);

  return <AmountInput ref={inputRef} value={value} {...props} />;
};

type SelectorSide = 'from' | 'to' | null;
type SwapView = 'form' | 'review';
type RecipientResolution = 'idle' | 'resolving' | 'resolved' | 'error';

const isValidRecipient = (address: string, chain: string) => {
  if (!address.trim()) return false;
  if (chain.startsWith('solana:')) {
    try {
      return new PublicKey(address).toBase58() === address;
    } catch {
      return false;
    }
  }
  return isAddress(address);
};

const hexToBytes = (value: string) => {
  const hex = value.replace(/^0x/, '');
  if (!hex || hex.length % 2 || !/^[\da-f]+$/i.test(hex)) return null;

  return new Uint8Array(
    Array.from({ length: hex.length / 2 }, (_, index) =>
      Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
    ),
  );
};

const formatAccountAddress = (chain: string, address: string) => {
  if (!chain.startsWith('solana:') || !address.startsWith('0x')) return address;

  const bytes = hexToBytes(address);
  if (!bytes || bytes.length !== 32) return address;

  try {
    return new PublicKey(bytes).toBase58();
  } catch {
    return address;
  }
};

const Swap: FC = () => {
  const { pushChainClient, executorAddress } = usePushChain();
  const {
    setActiveDashboardTab,
    setActiveState,
  } = useWalletDashboard();
  const { beginSwapExecution, updateSwapExecution } =
    useSwapTransaction();
  const queryClient = useQueryClient();
  const walletAddress =
    executorAddress ?? pushChainClient?.universal.account ?? '';
  const universalOrigin = pushChainClient?.universal.origin;
  const universalOriginChain = universalOrigin?.chain as string | undefined;
  const universalOriginAddress = universalOrigin?.address;
  // Some SDK clients expose `origin` through a getter that can return a new
  // object on each read. Keep its identity stable so outbound recipient
  // derivation is not restarted (and cleared) on every query render.
  const origin = useMemo(
    () =>
      universalOriginChain && universalOriginAddress
        ? {
            chain: universalOriginChain,
            address: universalOriginAddress,
          }
        : undefined,
    [universalOriginAddress, universalOriginChain],
  );
  const originChain = universalOriginChain ?? PUSH_CHAIN_ID;
  const supportedChains = useMemo(getSupportedSwapChains, []);
  const destinationChains = useMemo(
    () =>
      supportedChains.includes(PUSH_CHAIN_ID)
        ? supportedChains
        : [PUSH_CHAIN_ID, ...supportedChains],
    [supportedChains],
  );

  const initialSourceTokens = useMemo(
    () => getSourceTokens(originChain),
    [originChain],
  );
  const initialDestinationChain = isPushChain(originChain)
    ? PUSH_CHAIN_ID
    : PUSH_CHAIN_ID;
  const initialDestinationTokens = useMemo(
    () => getDestinationTokens(initialDestinationChain),
    [initialDestinationChain],
  );

  const [view, setView] = useState<SwapView>('form');
  const [selector, setSelector] = useState<SelectorSide>(null);
  const [fromToken, setFromToken] = useState<SwapToken | null>(
    initialSourceTokens[0] ?? null,
  );
  const [toToken, setToToken] = useState<SwapToken | null>(
    initialDestinationTokens.find(
      (token) =>
        token.address.toLowerCase() !==
        initialSourceTokens[0]?.address.toLowerCase(),
    ) ??
      initialDestinationTokens[0] ??
      null,
  );
  const [amount, setAmount] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientResolution, setRecipientResolution] =
    useState<RecipientResolution>('idle');
  const previousOriginChain = useRef(originChain);
  const confirmationStarted = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedAmount(amount), 500);
    return () => window.clearTimeout(timeout);
  }, [amount]);

  useEffect(() => {
    if (previousOriginChain.current !== originChain) {
      previousOriginChain.current = originChain;
      setFromToken(initialSourceTokens[0]);
      setAmount('');
      setDebouncedAmount('');
    }
  }, [initialSourceTokens, originChain]);

  const balanceChains = useMemo(
    () => (fromToken ? [fromToken.chain] : []),
    [fromToken],
  );
  const sourceBalances = useSwapTokenBalances({
    chains: balanceChains,
    executorAddress,
    origin,
    enabled: !!fromToken,
    refetchInterval: 60_000,
  });
  const selectedBalance = fromToken
    ? sourceBalances.getTokenState(fromToken)
    : {
        balance: undefined,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
      };
  const sourceAccountAddress = fromToken
    ? sourceBalances.accounts[fromToken.chain] ?? ''
    : '';

  const isOutbound = !!toToken && !isPushChain(toToken.chain);

  useEffect(() => {
    let cancelled = false;
    const deriveRecipient = async () => {
      if (!isOutbound || !toToken || !origin || !executorAddress) {
        if (!cancelled) {
          setRecipient('');
          setRecipientResolution('idle');
        }
        return;
      }

      setRecipient('');
      setRecipientResolution('resolving');

      try {
        const address = await queryClient.ensureQueryData({
          queryKey: getSwapAccountQueryKey({
            chain: toToken.chain,
            executorAddress,
            origin,
          }),
          queryFn: () =>
            resolveSwapAccount({
              chain: toToken.chain,
              executorAddress,
              origin,
            }),
          staleTime: Infinity,
          gcTime: SWAP_ACCOUNT_GC_TIME,
          retry: 1,
        });
        if (!cancelled) {
          setRecipient(address);
          setRecipientResolution(
            isValidRecipient(address, toToken.chain) ? 'resolved' : 'error',
          );
        }
      } catch {
        if (!cancelled) {
          const fallbackAddress =
            origin.chain === toToken.chain
              ? formatAccountAddress(toToken.chain, origin.address)
              : '';
          setRecipient(fallbackAddress);
          setRecipientResolution(
            fallbackAddress &&
              isValidRecipient(fallbackAddress, toToken.chain)
              ? 'resolved'
              : 'error',
          );
        }
      }
    };
    deriveRecipient();
    return () => {
      cancelled = true;
    };
  }, [executorAddress, isOutbound, origin, queryClient, toToken]);

  const quoteRequest = useMemo(
    () => ({
      sourceChain: fromToken?.chain ?? '',
      destinationChain: toToken?.chain ?? '',
      fromToken: fromToken?.address ?? '',
      toToken: toToken?.address ?? '',
      amountIn: debouncedAmount,
    }),
    [debouncedAmount, fromToken, toToken],
  );

  const isDebouncing = amount !== debouncedAmount;
  const quoteEnabled =
    !!fromToken &&
    !!toToken &&
    !isSameToken(fromToken, toToken) &&
    isValidSwapAmount(debouncedAmount);

  const quote = useQuery({
    queryKey: ['wallet-swap-quote', quoteRequest],
    queryFn: () => fetchSwapQuote(quoteRequest),
    enabled: quoteEnabled,
    retry: false,
  });
  const quotePending =
    !!fromToken &&
    !!toToken &&
    !isSameToken(fromToken, toToken) &&
    isValidSwapAmount(amount) &&
    (isDebouncing || quote.isFetching);
  const recipientPending =
    isOutbound && recipientResolution === 'resolving';
  const gasPrice = useQuery({
    queryKey: ['push-chain-gas-price', viemClient.chain.id],
    queryFn: () => viemClient.getGasPrice(),
    enabled:
      quoteEnabled &&
      !isDebouncing &&
      Number.isSafeInteger(quote.data?.gasEstimate) &&
      Number(quote.data?.gasEstimate) > 0,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const slippage = AUTO_SLIPPAGE_PERCENTAGE;
  const recipientError =
    isOutbound && toToken && recipientResolution === 'error'
      ? `Unable to derive a valid ${toToken.chain.startsWith('solana:') ? 'Solana' : 'EVM'} destination account`
      : '';
  const amountExceedsBalance =
    !!amount &&
    selectedBalance.balance !== undefined &&
    !!fromToken &&
    doesSwapAmountExceedBalance(
      amount,
      selectedBalance.balance,
      fromToken.decimals,
    );
  const lowLiquidity =
    quote.data?.liquidity?.hasSufficientLiquidity === false;
  const hasBlockingSwapError =
    amountExceedsBalance ||
    selectedBalance.isError ||
    !!recipientError ||
    !!quote.error;
  const outputAmount =
    quote.data?.amountOut && !isDebouncing
      ? Number(quote.data.amountOut).toLocaleString(undefined, {
          maximumFractionDigits: SWAP_DISPLAY_DECIMALS,
        })
      : '';
  const exchangeRate =
    Number(amount) > 0 && Number(quote.data?.amountOut) > 0 && !isDebouncing
      ? Number(quote.data?.amountOut) / Number(amount)
      : 0;
  const gasCostDisplay =
    quoteEnabled && !isDebouncing && !quote.isFetching
      ? formatSwapGasCost(quote.data?.gasEstimate, gasPrice.data)
      : null;
  const priceDisplay =
    fromToken && toToken
      ? formatSwapReviewRate({
          exchangeRate,
          fromSymbol: getSwapTokenDisplaySymbol(fromToken.symbol),
          toSymbol: getSwapTokenDisplaySymbol(toToken.symbol),
        })
      : null;
  const formattedBalance =
    !executorAddress || !origin
      ? '—'
      : selectedBalance.isLoading
        ? '…'
        : selectedBalance.isError
          ? '—'
          : Number(selectedBalance.balance ?? 0).toLocaleString(undefined, {
              maximumFractionDigits: SWAP_DISPLAY_DECIMALS,
            });
  const canSetMax =
    !!fromToken &&
    !selectedBalance.isLoading &&
    !selectedBalance.isError &&
    selectedBalance.balance !== undefined;
  const canReverse =
    !!fromToken &&
    !!toToken &&
    getSourceTokens(toToken.chain).some(
      (token) =>
        token.address.toLowerCase() === toToken.address.toLowerCase(),
    ) &&
    getDestinationTokens(fromToken.chain).some(
      (token) =>
        token.address.toLowerCase() === fromToken.address.toLowerCase(),
    );
  const canReview =
    !!pushChainClient &&
    !!executorAddress &&
    !!sourceAccountAddress &&
    !selectedBalance.isLoading &&
    !selectedBalance.isError &&
    selectedBalance.balance !== undefined &&
    !!fromToken &&
    !!toToken &&
    isValidSwapAmount(amount) &&
    !amountExceedsBalance &&
    !isSameToken(fromToken, toToken) &&
    !isDebouncing &&
    !quote.isFetching &&
    !!quote.data &&
    (!isOutbound || (!!recipient.trim() && !recipientError));

  useEffect(() => {
    if (isSameToken(fromToken, toToken)) setToToken(null);
  }, [fromToken, toToken]);

  const selectToken = (token: SwapToken) => {
    if (selector === 'from') {
      setFromToken(token);
      if (isSameToken(token, toToken)) setToToken(null);
    }
    if (selector === 'to') setToToken(token);
    setAmount('');
    setDebouncedAmount('');
    setSelector(null);
  };

  const reverseTokens = () => {
    if (!fromToken || !toToken) return;
    const nextFromToken = getSourceTokens(toToken.chain).find(
      (token) =>
        token.address.toLowerCase() === toToken.address.toLowerCase(),
    );
    const nextToToken = getDestinationTokens(fromToken.chain).find(
      (token) =>
        token.address.toLowerCase() === fromToken.address.toLowerCase(),
    );
    if (!nextFromToken || !nextToToken) return;

    setFromToken(nextFromToken);
    setToToken(nextToToken);
    setAmount('');
    setDebouncedAmount('');
  };

  const setMaxAmount = () => {
    if (selectedBalance.balance === undefined || !fromToken) return;
    setAmount(getMaxSwapAmount(fromToken, selectedBalance.balance));
  };

  const handleAmountChange = (value: string) => {
    if (!fromToken) return;
    const normalized = normalizeAmountInput(value, fromToken.decimals);
    if (normalized !== null) setAmount(normalized);
  };

  const confirmSwap = useCallback(async () => {
    if (
      confirmationStarted.current ||
      !pushChainClient ||
      !executorAddress ||
      !fromToken ||
      !toToken ||
      !quote.data
    ) {
      return;
    }

    confirmationStarted.current = true;
    const executionId = `swap${Date.now()}${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    const startedAt = Date.now();
    const quotedOutputAmount = quote.data.amountOut || outputAmount || '0';

    beginSwapExecution({
      executionId,
      executorAddress,
      hash: executionId,
      type: 'swap',
      status: 'pending',
      timestamp: startedAt,
      tokensIn: [
        {
          address: fromToken.address,
          symbol: fromToken.symbol,
          name: fromToken.name,
          amount,
          chain: fromToken.chain,
          decimals: fromToken.decimals,
        },
      ],
      tokensOut: [
        {
          address: toToken.address,
          symbol: toToken.symbol,
          name: toToken.name,
          amount: quotedOutputAmount,
          chain: toToken.chain,
          decimals: toToken.decimals,
        },
      ],
      sourceChain: fromToken.chain,
      destinationChain: toToken.chain,
      sourceAddress: sourceAccountAddress || executorAddress,
      destinationAddress: isOutbound
        ? recipient.trim()
        : executorAddress,
      recordSource: 'local',
      transactionRefs: [],
    });
    setActiveDashboardTab('activity');
    setActiveState('walletDashboard');
    let transactionWasSubmitted = false;

    try {
      const prepared = await fetchSwapSteps({
        sourceChain: fromToken.chain,
        destinationChain: toToken.chain,
        fromToken: fromToken.address,
        toToken: toToken.address,
        amountIn: amount,
        userAddress: executorAddress,
        outboundRecipient: isOutbound ? recipient.trim() : undefined,
        poolResult: quote.data.poolResult,
        maxSlippage: slippage,
      });
      const routeValidation = validateRamenSwapSteps({
        originChain,
        sourceChain: fromToken.chain,
        destinationChain: toToken.chain,
        fromToken,
        toToken,
        expectedOutboundRecipient: isOutbound
          ? recipient.trim()
          : undefined,
        amountIn: amount,
        steps: prepared.steps,
      });
      if (routeValidation.success === false) {
        throw new SwapFlowError({
          stage: 'route-validation',
          code: routeValidation.error.code,
          message: routeValidation.error.message,
          context: routeValidation.error.context,
        });
      }

      const result = await executeSwapSteps({
        pushChainClient,
        userAddress: executorAddress as `0x${string}`,
        originChain,
        sourceChain: fromToken.chain,
        steps: prepared.steps,
        onTransactionSubmitted: (hash) => {
          transactionWasSubmitted = true;
          updateSwapExecution(executionId, (current) => {
            if (current.submittedHash) return current;
            const trackUrl = buildSwapTrackingUrl(PUSH_CHAIN_ID, hash);
            return {
              ...current,
              submittedHash: hash,
              submittedChain: PUSH_CHAIN_ID,
              ...(trackUrl ? { trackUrl } : {}),
            };
          });
          trackWalletEvent(WALLET_EVENTS.SWAP_TRANSACTION_SUBMITTED, {
            walletAddress: executorAddress,
            tokenSymbol: fromToken.symbol,
            tokenAddress: fromToken.address,
            sourceChainId: fromToken.chain,
            destinationChainId: toToken.chain,
            amount,
            txHash: hash,
            sourceScreen: 'wallet_swap',
            step: 'transaction_submitted',
          });
        },
        onTransactionProgress: (transaction: SwapTransactionRef) => {
          updateSwapExecution(executionId, (current) => {
            const hasTransaction = current.transactionRefs.some(
              (candidate) =>
                candidate.phase === transaction.phase &&
                candidate.chainId === transaction.chainId &&
                candidate.hash === transaction.hash,
            );
            const transactionRefs = hasTransaction
              ? current.transactionRefs
              : [...current.transactionRefs, transaction];
            const hasSourceTracker = current.transactionRefs.some(
              (candidate) => candidate.phase === 'source',
            );
            const shouldUseTracker =
              !current.trackUrl ||
              (transaction.phase === 'source' && !hasSourceTracker);
            const trackUrl = shouldUseTracker
              ? buildSwapTrackingUrl(
                  transaction.chainId,
                  transaction.hash,
                )
              : current.trackUrl;
            const isPushTransaction = transaction.phase === 'push';
            const pushExplorerUrl = isPushTransaction
              ? buildPushTransactionExplorerUrl(transaction.hash)
              : current.explorerUrl;

            return {
              ...current,
              transactionRefs,
              ...(shouldUseTracker
                ? {
                    submittedHash: transaction.hash,
                    submittedChain: transaction.chainId,
                  }
                : {}),
              ...(trackUrl ? { trackUrl } : {}),
              ...(isPushTransaction
                ? {
                    explorerHash: transaction.hash,
                    ...(pushExplorerUrl
                      ? { explorerUrl: pushExplorerUrl }
                      : {}),
                  }
                : {}),
            };
          });
        },
      });

      if (result.success === false) {
        if (result.pending) {
          updateSwapExecution(executionId, {
            status: 'pending',
            timestamp: Date.now(),
            error: result.error,
            failure: result.failure,
          });
          void queryClient.invalidateQueries({
            queryKey: SWAP_BALANCE_QUERY_ROOT,
          });
          void queryClient.invalidateQueries({
            queryKey: ['transactions'],
          });
          void queryClient.invalidateQueries({
            queryKey: SWAP_ACTIVITY_QUERY_ROOT,
          });
          return;
        }

        throw new SwapFlowError(
          result.failure ?? {
            stage: 'unknown',
            message: result.error,
          },
        );
      }

      const pushTxHash = result.pushTxHash ?? result.txHash;
      const pushExplorerUrl =
        buildPushTransactionExplorerUrl(pushTxHash);
      updateSwapExecution(executionId, (current) => ({
        ...current,
        hash: pushTxHash,
        status: 'success',
        timestamp: Date.now(),
        explorerHash: pushTxHash,
        ...(pushExplorerUrl ? { explorerUrl: pushExplorerUrl } : {}),
      }));
      void queryClient.invalidateQueries({
        queryKey: SWAP_BALANCE_QUERY_ROOT,
      });
      void queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
      void queryClient.invalidateQueries({
        queryKey: SWAP_ACTIVITY_QUERY_ROOT,
      });
      trackWalletEvent(WALLET_EVENTS.SWAP_SUCCESSFUL, {
        walletAddress: executorAddress,
        tokenSymbol: fromToken.symbol,
        tokenAddress: fromToken.address,
        sourceChainId: fromToken.chain,
        destinationChainId: toToken.chain,
        amount,
        txHash: pushTxHash,
        sourceScreen: 'wallet_swap',
        step: 'success',
      });
    } catch (error) {
      const failure = getSwapFailureDetails(error);
      const message = failure.message;
      updateSwapExecution(executionId, {
        status: 'failed',
        timestamp: Date.now(),
        error: message,
        failure,
      });
      if (transactionWasSubmitted) {
        void queryClient.invalidateQueries({
          queryKey: SWAP_BALANCE_QUERY_ROOT,
        });
        void queryClient.invalidateQueries({
          queryKey: ['transactions'],
        });
        void queryClient.invalidateQueries({
          queryKey: SWAP_ACTIVITY_QUERY_ROOT,
        });
      }
      trackWalletEvent(WALLET_EVENTS.SWAP_FAILED, {
        walletAddress: executorAddress,
        tokenSymbol: fromToken.symbol,
        tokenAddress: fromToken.address,
        sourceChainId: fromToken.chain,
        destinationChainId: toToken.chain,
        amount,
        errorMessage:
          error instanceof Error ? error.message.slice(0, 250) : 'Swap failed',
        sourceScreen: 'wallet_swap',
        step: 'failed',
      });
    }
  }, [
    amount,
    beginSwapExecution,
    executorAddress,
    fromToken,
    isOutbound,
    originChain,
    outputAmount,
    pushChainClient,
    queryClient,
    quote.data,
    recipient,
    setActiveDashboardTab,
    setActiveState,
    slippage,
    sourceAccountAddress,
    toToken,
    updateSwapExecution,
  ]);

  const renderTokenButton = (token: SwapToken | null, side: 'from' | 'to') => (
    <Box
      display="flex"
      alignItems="center"
      gap="spacing-xxs"
      padding="spacing-xxs spacing-xs"
      borderRadius="radius-xs"
      backgroundColor="pw-int-bg-tertiary-color"
      cursor="pointer"
      role="button"
      tabIndex={0}
      aria-label={`Select ${side === 'from' ? 'source' : 'destination'} token`}
      onClick={() => setSelector(side)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelector(side);
        }
      }}
      css={css`
        flex-shrink: 0;
      `}
    >
      {token ? (
        <>
          <TokenLogoComponent tokenSymbol={token.symbol} chainId={token.chain} />
          <Text variant="bm-semibold">{token.symbol}</Text>
        </>
      ) : (
        <Text variant="bm-regular" color="pw-int-text-secondary-color">
          Select token
        </Text>
      )}
      <CaretDown size={18} color="pw-int-icon-primary-color" />
    </Box>
  );

  if (selector) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        gap="spacing-sm"
        width="100%"
        height={{ initial: '570px', ml: '100%' }}
        position="relative"
      >
        <WalletHeader
          walletAddress={walletAddress}
          handleBackButton={() => setActiveState('walletDashboard')}
        />
        <SwapTokenSelector
          title="Select a token"
          chains={destinationChains}
          selectedToken={selector === 'from' ? fromToken : toToken}
          getTokens={
            selector === 'from' ? getSourceTokens : getDestinationTokens
          }
          isTokenDisabled={
            selector === 'to'
              ? (token) => isSameToken(token, fromToken)
              : undefined
          }
          onSelect={selectToken}
          onClose={() => setSelector(null)}
        />
      </Box>
    );
  }

  if (view === 'review' && fromToken && toToken) {
    return (
      <SwapReview
        walletAddress={walletAddress}
        amount={amount}
        outputAmount={outputAmount}
        fromToken={fromToken}
        toToken={toToken}
        gasCostDisplay={gasCostDisplay}
        priceDisplay={priceDisplay}
        slippage={slippage}
        onBack={() => setView('form')}
        onConfirm={confirmSwap}
      />
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="spacing-sm"
      width="100%"
      height={{ initial: '570px', ml: '100%' }}
      position="relative"
    >
      <WalletHeader
        walletAddress={walletAddress}
        handleBackButton={() => setActiveState('walletDashboard')}
      />
      <Box display="flex" alignItems="center">
        <Text variant="h4-semibold">{SWAP_TITLE}</Text>
      </Box>

      <Box
        display="flex"
        flexDirection="column"
        gap="spacing-xs"
        position="relative"
      >
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          gap="spacing-xs"
          minHeight="120px"
          padding="spacing-sm"
          borderRadius="radius-sm"
          border="border-sm solid pw-int-border-secondary-color"
          backgroundColor="pw-int-bg-secondary-color"
        >
          <Box display="flex" alignItems="center" gap="spacing-xs">
            <ResponsiveAmountInput
              inputMode="decimal"
              value={amount}
              placeholder="0"
              aria-label="Swap amount"
              onChange={(event) => handleAmountChange(event.target.value)}
            />
            {renderTokenButton(fromToken, 'from')}
          </Box>
          <Box
            display="flex"
            justifyContent="flex-end"
            alignItems="center"
            gap="spacing-xxs"
          >
            <Text variant="bs-regular" color="pw-int-text-secondary-color">
              {formattedBalance} {fromToken?.symbol ?? ''}
            </Text>
            <Box
              cursor={canSetMax ? 'pointer' : 'not-allowed'}
              display="flex"
              alignItems="center"
              padding="spacing-xxxs spacing-xxs"
              borderRadius="radius-round"
              border="border-sm solid pw-int-border-tertiary-color"
              role="button"
              tabIndex={canSetMax ? 0 : -1}
              aria-label="Use maximum token balance"
              aria-disabled={!canSetMax}
              onClick={canSetMax ? setMaxAmount : undefined}
              onKeyDown={(event) => {
                if (
                  canSetMax &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  setMaxAmount();
                }
              }}
            >
              <Text variant="bes-regular" color="pw-int-text-secondary-color">
                MAX
              </Text>
            </Box>
          </Box>
        </Box>

        <Box
          display="flex"
          minHeight="120px"
          alignItems="center"
          padding="spacing-sm"
          borderRadius="radius-sm"
          backgroundColor="pw-int-bg-primary-color"
        >
          <Box display="flex" alignItems="center" gap="spacing-xs" width="100%">
            <ResponsiveAmountInput
              readOnly
              value={quote.isFetching || isDebouncing ? '' : outputAmount}
              placeholder="0"
              aria-label="Estimated swap output"
            />
            {renderTokenButton(toToken, 'to')}
          </Box>
        </Box>

        <Box
          display="flex"
          width="44px"
          height="44px"
          alignItems="center"
          justifyContent="center"
          borderRadius="radius-xs"
          border="border-md solid pw-int-border-secondary-color"
          backgroundColor="pw-int-bg-primary-color"
          cursor={canReverse ? 'pointer' : 'not-allowed'}
          role="button"
          tabIndex={canReverse ? 0 : -1}
          aria-label="Reverse swap tokens"
          aria-disabled={!canReverse}
          position="absolute"
          css={css`
            top: 50%;
            left: 50%;
            z-index: 2;
            transform: translate(-50%, -50%);
          `}
          onClick={canReverse ? reverseTokens : undefined}
          onKeyDown={(event) => {
            if (
              canReverse &&
              (event.key === 'Enter' || event.key === ' ')
            ) {
              event.preventDefault();
              reverseTokens();
            }
          }}
        >
          <SwapIcon
            size={20}
            color="pw-int-icon-primary-color"
            style={{ transform: 'rotate(90deg)' }}
          />
        </Box>
      </Box>

      <Box
        display="flex"
        alignItems="center"
        justifyContent="flex-end"
        gap="spacing-xxxs"
        css={css`
          padding-right: var(--spacing-xxxs);
        `}
      >
        <Text variant="c-regular" color="pw-int-text-tertiary-color">
          powered by
        </Text>
        <RamenTextIcon
          width={58}
          color="var(--pw-int-text-tertiary-color)"
        />
      </Box>

      <Box
        display="flex"
        flexDirection="column"
        justifyContent="flex-end"
        gap="spacing-xs"
        css={css`
          flex: 1;
          min-height: 0;
        `}
      >
        {(amountExceedsBalance ||
          selectedBalance.isError ||
          lowLiquidity ||
          recipientError ||
          quote.error) && (
          <Box
            display="flex"
            alignItems="flex-start"
            gap="spacing-xxs"
            padding="spacing-xs"
            borderRadius="radius-xs"
            backgroundColor="pw-int-bg-primary-color"
          >
            <Info
              size={20}
              color={
                lowLiquidity && !hasBlockingSwapError
                  ? 'pw-int-icon-secondary-color'
                  : 'pw-int-icon-danger-bold-color'
              }
            />
            <Text
              variant="bes-regular"
              color={
                lowLiquidity && !hasBlockingSwapError
                  ? 'pw-int-text-secondary-color'
                  : 'pw-int-text-danger-bold-color'
              }
            >
              {amountExceedsBalance
                ? 'Insufficient balance'
                : selectedBalance.isError
                  ? 'Unable to load the selected account balance'
                  : recipientError ||
                    (quote.error instanceof Error
                      ? quote.error.message
                      : lowLiquidity
                        ? 'Pool liquidity for this pair is low. You may get a worse price or higher slippage'
                        : 'Unable to fetch a quote')}
            </Text>
          </Box>
        )}

        {((exchangeRate > 0 && fromToken && toToken) || gasCostDisplay) && (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="spacing-xs"
          >
            {exchangeRate > 0 && fromToken && toToken ? (
              <Box
                title={`1 ${fromToken.symbol} = ${exchangeRate.toLocaleString(
                  undefined,
                  { maximumFractionDigits: SWAP_DISPLAY_DECIMALS },
                )} ${toToken.symbol}`}
                css={css`
                  flex: 1;
                  min-width: 0;
                `}
              >
                <Text
                  variant="bs-regular"
                  color="pw-int-text-secondary-color"
                  ellipsis
                >
                  1 {fromToken.symbol} ={' '}
                  {exchangeRate.toLocaleString(undefined, {
                    maximumFractionDigits: SWAP_DISPLAY_DECIMALS,
                  })}{' '}
                  {toToken.symbol}
                </Text>
              </Box>
            ) : (
              <Box />
            )}
            {gasCostDisplay && (
              <Box
                display="flex"
                alignItems="center"
                gap="spacing-xxxs"
                role="group"
                title="Estimated Push Chain swap-leg gas. Approval and cross-chain costs are not included."
                aria-label={`Estimated Push Chain swap gas ${gasCostDisplay}`}
                css={css`
                  flex-shrink: 0;
                `}
              >
                <GasIcon
                  size={18}
                  color="var(--pw-int-icon-secondary-color)"
                />
                <Text
                  variant="bs-regular"
                  color="pw-int-text-secondary-color"
                >
                  {gasCostDisplay}
                </Text>
              </Box>
            )}
          </Box>
        )}

        <Button
          block
          disabled={!canReview}
          loading={quotePending || recipientPending}
          onClick={() => {
            if (!canReview || !fromToken || !toToken) return;
            trackWalletEvent(WALLET_EVENTS.SWAP_REVIEW_CLICKED, {
              walletAddress: executorAddress ?? undefined,
              tokenSymbol: fromToken.symbol,
              tokenAddress: fromToken.address,
              sourceChainId: fromToken.chain,
              destinationChainId: toToken.chain,
              amount,
              sourceScreen: 'wallet_swap',
              step: 'review',
            });
            setView('review');
          }}
        >
          Swap
        </Button>
      </Box>
    </Box>
  );
};

export { Swap };
