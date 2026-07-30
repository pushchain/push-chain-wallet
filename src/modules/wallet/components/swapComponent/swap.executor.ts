import { PushChain } from '@pushchain/core';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { Address } from 'viem';
import { viemClient } from '../../../../utils/viemClient';
import { PUSH_CHAIN_ID, ZERO_ADDRESS } from './swap.constants';
import {
  MoveableToken,
  SwapExecutionResult,
  SwapFailureDetails,
  SwapOutboundStep,
  SwapStep,
  SwapTransactionRef,
  SwapTransactionStep,
} from './swap.types';
import { isPushChain } from './swap.utils';
import {
  getDetailedSwapErrorMessage,
  getSwapFailureDetails,
  isTimeoutFailure,
} from './swap.errors';

type SdkProgressEvent = {
  id: string;
  title?: string;
  message?: string;
  level?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  response: object | null;
};

type TransactionResponse = {
  hash?: string;
  transactionHash?: string;
  wait?: (options?: {
    outboundTimeoutMs?: number;
    inboundTimeoutMs?: number;
  }) => Promise<{
    status?: 0 | 1;
    externalStatus?: 'success' | 'failed' | 'timeout';
    externalError?: string;
    finalTxHash?: string;
    externalTxHash?: string;
    externalExplorerUrl?: string;
    pushInboundTxHash?: string;
  }>;
};

const getTransactionHash = (response: unknown): `0x${string}` => {
  const transaction = response as TransactionResponse;
  const hash = transaction.transactionHash || transaction.hash;
  if (hash?.startsWith('0x')) return hash as `0x${string}`;
  throw new Error('The wallet did not return a transaction hash');
};

const isSwapStep = (step: SwapStep): step is SwapTransactionStep =>
  step.type === 'swap';

const isOutboundStep = (step: SwapStep): step is SwapOutboundStep =>
  step.type === 'outbound';

const parsePositiveAmount = (value: string, label: string) => {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive integer`);
  }
  return BigInt(value);
};

const parseValue = (value: string) => {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error('Swap value must be a non-negative integer');
  }
  return BigInt(value);
};

const EVM_TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;
const SOLANA_TRANSACTION_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{80,95}$/;

const isValidTransactionHash = (hash: string) =>
  EVM_TRANSACTION_HASH.test(hash) ||
  SOLANA_TRANSACTION_SIGNATURE.test(hash);

const asProgressResponse = (
  response: SdkProgressEvent['response'],
): Record<string, unknown> | null =>
  response && typeof response === 'object'
    ? (response as Record<string, unknown>)
    : null;

const getString = (
  response: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = response[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const getNumber = (
  response: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = response[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const getFailureStageForProgress = (
  event: SdkProgressEvent,
  response: Record<string, unknown>,
): SwapFailureDetails['stage'] => {
  if (event.id.startsWith('SEND-TX-999') || event.id.startsWith('SEND-TX-003')) {
    return 'cascade';
  }
  if (event.id.startsWith('SEND-TX-299')) return 'destination';
  if (event.id.startsWith('SEND-TX-399')) {
    const phase = getString(response, 'phase');
    if (phase === 'outbound') return 'source';
    return 'push';
  }
  if (event.id.startsWith('SEND-TX-3')) return 'source';
  if (event.id.startsWith('SEND-TX-1')) return 'push';
  if (event.id.startsWith('SEND-TX-2')) return 'destination';
  return 'unknown';
};

const getProgressFailure = (
  event: SdkProgressEvent,
  response: Record<string, unknown>,
): SwapFailureDetails | null => {
  if (event.level !== 'ERROR') return null;

  const decodedError = response.decodedError;
  const decodedErrorMessage =
    decodedError === undefined
      ? undefined
      : getDetailedSwapErrorMessage(decodedError, '');
  const message =
    getString(response, 'error') ??
    decodedErrorMessage ??
    event.message ??
    event.title ??
    'Swap execution failed';
  const failedAt =
    getNumber(response, 'failedAt') ?? getString(response, 'failedAt');
  const total = getNumber(response, 'total');
  const context: Record<string, string | number | boolean> = {};

  [
    'phase',
    'chain',
    'txHash',
    'pushTxHash',
    'externalTxHash',
    'elapsedMs',
  ].forEach((key) => {
    const value = response[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      context[key] = value;
    }
  });

  const failure: SwapFailureDetails = {
    stage: getFailureStageForProgress(event, response),
    code: event.id,
    eventId: event.id,
    ...(event.title ? { title: event.title } : {}),
    message,
    ...(decodedErrorMessage
      ? { decodedError: decodedErrorMessage }
      : {}),
    ...(failedAt !== undefined ? { failedAt } : {}),
    ...(total !== undefined ? { total } : {}),
    ...(Object.keys(context).length ? { context } : {}),
  };
  return {
    ...failure,
    retryable: isTimeoutFailure(failure),
  };
};

const reportHash = (
  report: (transaction: SwapTransactionRef) => void,
  phase: SwapTransactionRef['phase'],
  chainId: string | null | undefined,
  hash: string | null | undefined,
  explorerUrl?: string,
) => {
  if (!chainId || !hash) return;
  report({
    phase,
    chainId,
    hash,
    ...(explorerUrl ? { explorerUrl } : {}),
  });
};

const resolveOutboundToken = (
  step: SwapOutboundStep,
): MoveableToken | null => {
  if (step.token) return step.token;
  const { tokens } = PushChain.utils.tokens.getMoveableTokens(
    step.destinationChain as CHAIN,
  );
  return (
    (tokens?.find((token) => token.symbol === step.tokenSymbol) as
      | MoveableToken
      | undefined) ?? null
  );
};

export type ExecuteSwapParams = {
  pushChainClient: PushChain;
  userAddress: Address;
  originChain?: string | null;
  sourceChain?: string | null;
  steps: SwapStep[];
  onTransactionSubmitted?: (hash: string) => void;
  onTransactionProgress?: (transaction: SwapTransactionRef) => void;
};

export const executeSwapSteps = async ({
  pushChainClient,
  userAddress,
  originChain,
  sourceChain,
  steps,
  onTransactionSubmitted,
  onTransactionProgress,
}: ExecuteSwapParams): Promise<SwapExecutionResult> => {
  if (!steps.length) {
    return {
      success: false,
      error: 'No swap steps to execute',
      failure: {
        stage: 'route-validation',
        code: 'NO_STEPS',
        message: 'No swap steps to execute',
      },
    };
  }

  const outboundStep = steps.find(isOutboundStep);
  const pushSteps = steps.filter((step) => !isOutboundStep(step));
  const bridgeStep = pushSteps.find((step) => step.type === 'bridge');
  const swapSteps = pushSteps.filter(isSwapStep);
  const hasExternalSource = !!sourceChain && !isPushChain(sourceChain);
  const isCeaSource =
    hasExternalSource &&
    !!originChain &&
    sourceChain !== originChain;
  const canRelayMulticall =
    hasExternalSource || (!!originChain && !isPushChain(originChain));
  let lastHash: string | null = null;
  let lastFinalHash: string | null = null;
  let lastPushHash: string | null = null;
  let lastFailure: SwapFailureDetails | null = null;
  let submissionReported = false;
  const reportedTransactionRefs = new Set<string>();

  const reportSubmitted = (hash: string) => {
    if (submissionReported) return;
    submissionReported = true;
    onTransactionSubmitted?.(hash);
  };

  const reportTransactionProgress = (transaction: SwapTransactionRef) => {
    if (!isValidTransactionHash(transaction.hash) || !transaction.chainId) {
      return;
    }

    const normalizedHash = transaction.hash.startsWith('0x')
      ? transaction.hash.toLowerCase()
      : transaction.hash;
    const key = `${transaction.phase}:${transaction.chainId.toLowerCase()}:${normalizedHash}`;
    if (reportedTransactionRefs.has(key)) return;

    reportedTransactionRefs.add(key);
    onTransactionProgress?.(transaction);
  };

  const reportPushTransaction = (hash: string) => {
    if (isValidTransactionHash(hash)) lastPushHash = hash;
    reportTransactionProgress({
      phase: 'push',
      chainId: PUSH_CHAIN_ID,
      hash,
    });
  };

  const progressHook = (event: SdkProgressEvent) => {
    const response = asProgressResponse(event.response);
    if (!response) return;

    const progressFailure = getProgressFailure(event, response);
    if (progressFailure) lastFailure = progressFailure;

    const transactionHash = getString(response, 'txHash');
    const externalHash =
      getString(response, 'externalTxHash') ?? transactionHash;
    const reportedPushHash = getString(response, 'pushTxHash');
    const eventChain =
      getString(response, 'destinationChain') ??
      getString(response, 'chain');
    const destinationChain = eventChain ?? outboundStep?.destinationChain;
    const selectedSourceChain = sourceChain ?? originChain ?? undefined;

    switch (event.id) {
      case 'SEND-TX-106-02':
      case 'SEND-TX-106-03':
      case 'SEND-TX-106-03-01':
      case 'SEND-TX-106-03-02':
      case 'SEND-TX-106-04':
        reportHash(
          reportTransactionProgress,
          'source',
          selectedSourceChain,
          transactionHash,
        );
        return;

      case 'SEND-TX-199-01':
      case 'SEND-TX-199-02':
      case 'SEND-TX-199-99':
      case 'SEND-TX-399-01':
      case 'SEND-TX-399-99':
        if (transactionHash) reportPushTransaction(transactionHash);
        return;

      case 'SEND-TX-209-01':
      case 'SEND-TX-209-02':
      case 'SEND-TX-299-03':
      case 'SEND-TX-309-01':
      case 'SEND-TX-309-02':
      case 'SEND-TX-310-01':
      case 'SEND-TX-310-02':
      case 'SEND-TX-399-03':
        if (reportedPushHash) reportPushTransaction(reportedPushHash);
        return;

      case 'SEND-TX-299-01':
        reportHash(
          reportTransactionProgress,
          'destination',
          destinationChain,
          externalHash,
          getString(response, 'explorerUrl') ??
            getString(response, 'externalExplorerUrl'),
        );
        return;

      case 'SEND-TX-299-02':
        if (reportedPushHash) reportPushTransaction(reportedPushHash);
        reportHash(
          reportTransactionProgress,
          'destination',
          destinationChain,
          transactionHash,
        );
        return;

      case 'SEND-TX-299-99':
        reportHash(
          reportTransactionProgress,
          'destination',
          destinationChain,
          transactionHash,
        );
        return;

      case 'SEND-TX-309-03':
        reportHash(
          reportTransactionProgress,
          'source',
          eventChain ?? selectedSourceChain,
          transactionHash,
        );
        return;

      case 'SEND-TX-399-02': {
        if (reportedPushHash) reportPushTransaction(reportedPushHash);
        const phase = getString(response, 'phase');
        reportHash(
          reportTransactionProgress,
          phase === 'outbound' ? 'source' : 'push',
          phase === 'outbound'
            ? eventChain ?? selectedSourceChain
            : PUSH_CHAIN_ID,
          transactionHash,
        );
        return;
      }

      case 'SEND-TX-999-02':
      case 'SEND-TX-999-03':
        if (reportedPushHash) reportPushTransaction(reportedPushHash);
        return;

      default:
        return;
    }
  };

  const createFailureResult = (
    error: unknown,
    stage: SwapFailureDetails['stage'] = 'unknown',
  ): SwapExecutionResult => {
    const fallbackFailure = getSwapFailureDetails(error, stage);
    const caughtMessage = getDetailedSwapErrorMessage(error, '');
    const combinedMessage = lastFailure
      ? [
          lastFailure.message,
          caughtMessage &&
          caughtMessage.toLowerCase() !==
            lastFailure.message.toLowerCase()
            ? caughtMessage
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      : fallbackFailure.message;
    const failure = lastFailure
      ? {
          ...lastFailure,
          message: combinedMessage,
        }
      : fallbackFailure;
    const pending = isTimeoutFailure(failure);
    const normalizedFailure =
      pending && !failure.retryable
        ? { ...failure, retryable: true }
        : failure;

    return {
      success: false,
      error: normalizedFailure.message,
      ...(pending ? { pending: true as const } : {}),
      ...(lastHash ? { txHash: lastHash } : {}),
      ...(lastPushHash ? { pushTxHash: lastPushHash } : {}),
      failure: normalizedFailure,
    };
  };

  try {
    if (outboundStep && pushSteps.length && canRelayMulticall) {
      const token = resolveOutboundToken(outboundStep);
      if (!token) {
        return createFailureResult(
          `No outbound ${outboundStep.tokenSymbol} token is available`,
          'route-validation',
        );
      }

      const calls = swapSteps.map((step) => ({
        to: step.to,
        value: parseValue(step.value),
        data: step.data,
      }));
      const pushTransaction =
        await pushChainClient.universal.prepareTransaction({
          ...(isCeaSource
            ? { from: { chain: sourceChain as CHAIN } }
            : {}),
          to: calls.length ? ZERO_ADDRESS : userAddress,
          ...(bridgeStep
            ? {
                funds: {
                  amount: parsePositiveAmount(
                    bridgeStep.amountRaw,
                    'Bridge amount',
                  ),
                  token: bridgeStep.token,
                },
              }
            : {}),
          ...(calls.length ? { data: calls } : {}),
        });
      const outboundTransaction =
        await pushChainClient.universal.prepareTransaction({
          to: {
            address: outboundStep.recipientAddress as Address,
            chain: outboundStep.destinationChain as CHAIN,
          },
          funds: {
            amount: parsePositiveAmount(
              outboundStep.amountRaw,
              'Outbound amount',
            ),
            token,
          },
        });
      const cascade = await pushChainClient.universal.executeTransactions(
        [pushTransaction, outboundTransaction],
        { progressHook },
      );
      lastHash = cascade.initialTxHash;
      reportPushTransaction(lastHash);
      reportSubmitted(lastHash);

      const completion = await cascade.waitForAll();
      if (completion.success === false) {
        return createFailureResult(
          `Swap failed at transaction ${completion.failedAt ?? ''}`.trim(),
          'cascade',
        );
      }

      const finalTxHash =
        completion.finalTxHash ?? cascade.finalTxHash ?? lastHash;
      const finalTxExplorerUrl =
        pushChainClient.explorer.getTransactionUrl(finalTxHash, {
          chain: outboundStep.destinationChain as CHAIN,
        });
      if (completion.finalTxHash ?? cascade.finalTxHash) {
        reportTransactionProgress({
          phase: 'destination',
          chainId: outboundStep.destinationChain,
          hash: finalTxHash,
          explorerUrl: finalTxExplorerUrl,
        });
      }

      return {
        success: true,
        txHash: lastHash,
        pushTxHash: lastPushHash ?? lastHash,
        finalTxHash,
        finalTxExplorerUrl,
      };
    }

    if (pushSteps.length) {
      if (canRelayMulticall) {
        const calls = swapSteps.map((step) => ({
          to: step.to,
          value: parseValue(step.value),
          data: step.data,
        }));
        const response = await pushChainClient.universal.sendTransaction(
          {
            ...(isCeaSource
              ? { from: { chain: sourceChain as CHAIN } }
              : {}),
            to: calls.length ? ZERO_ADDRESS : userAddress,
            ...(bridgeStep
              ? {
                  funds: {
                    amount: parsePositiveAmount(
                      bridgeStep.amountRaw,
                      'Bridge amount',
                    ),
                    token: bridgeStep.token,
                  },
                }
              : {}),
            ...(calls.length ? { data: calls } : {}),
          },
          { progressHook },
        );
        lastHash = getTransactionHash(response);
        reportPushTransaction(lastHash);
        reportSubmitted(lastHash);
        if (response.wait) {
          const receipt = await response.wait();
          if (receipt.externalStatus === 'timeout') {
            return createFailureResult(
              receipt.externalError ||
                'Cross-chain settlement timed out and is still being tracked',
              lastFailure?.stage ?? 'source',
            );
          }
          if (
            receipt.status === 0 ||
            receipt.externalStatus === 'failed'
          ) {
            return createFailureResult(
              receipt.externalError ||
                'The cross-chain source transaction did not complete',
              lastFailure?.stage ?? 'source',
            );
          }
          lastFinalHash =
            receipt.finalTxHash ?? receipt.externalTxHash ?? lastHash;
          if (receipt.pushInboundTxHash) {
            reportPushTransaction(receipt.pushInboundTxHash);
          }
        } else {
          const receipt = await viemClient.waitForTransactionReceipt({
            hash: lastHash as `0x${string}`,
            timeout: 60_000,
          });
          if (
            receipt.status === 'reverted' ||
            (receipt.status as unknown) === 0
          ) {
            return createFailureResult(
              `Push Chain transaction reverted: ${lastHash}`,
              'push',
            );
          }
        }
      } else {
        // Native Push EOAs do not have the relay-managed multicall wrapper.
        // Execute the encoded calls in order, waiting before dependent calls.
        for (const step of swapSteps) {
          const response = await pushChainClient.universal.sendTransaction(
            {
              to: step.to,
              value: parseValue(step.value),
              data: step.data,
            },
            { progressHook },
          );
          lastHash = getTransactionHash(response);
          reportPushTransaction(lastHash);
          reportSubmitted(lastHash);
          const receipt = await viemClient.waitForTransactionReceipt({
            hash: lastHash as `0x${string}`,
            timeout: 60_000,
          });
          if (
            receipt.status === 'reverted' ||
            (receipt.status as unknown) === 0
          ) {
            return createFailureResult(
              `Push Chain transaction reverted: ${lastHash}`,
              'push',
            );
          }
        }
      }
    }

    if (outboundStep) {
      const token = resolveOutboundToken(outboundStep);
      if (!token) {
        return createFailureResult(
          `No outbound ${outboundStep.tokenSymbol} token is available`,
          'route-validation',
        );
      }

      const response = (await pushChainClient.universal.sendTransaction(
        {
          to: {
            address: outboundStep.recipientAddress as Address,
            chain: outboundStep.destinationChain as CHAIN,
          },
          funds: {
            amount: parsePositiveAmount(
              outboundStep.amountRaw,
              'Outbound amount',
            ),
            token,
          },
        },
        { progressHook },
      )) as TransactionResponse;

      const outboundHash = getTransactionHash(response);
      reportPushTransaction(outboundHash);
      reportSubmitted(outboundHash);
      if (!response.wait) {
        throw new Error('The outbound transaction cannot be tracked');
      }
      const receipt = await response.wait();
      if (receipt.externalStatus === 'timeout') {
        return createFailureResult(
          receipt.externalError ||
            'Destination settlement timed out and is still being tracked',
          'destination',
        );
      }
      if (
        receipt.status === 0 ||
        receipt.externalStatus === 'failed'
      ) {
        return createFailureResult(
          receipt.externalError ||
            'The destination transaction did not complete',
          'destination',
        );
      }
      const finalTxHash = receipt.finalTxHash ?? receipt.externalTxHash;
      if (!finalTxHash) {
        throw new Error('The destination transaction hash was not returned');
      }
      const finalTxExplorerUrl =
        receipt.externalExplorerUrl ||
        pushChainClient.explorer.getTransactionUrl(finalTxHash, {
          chain: outboundStep.destinationChain as CHAIN,
        });
      reportTransactionProgress({
        phase: 'destination',
        chainId: outboundStep.destinationChain,
        hash: finalTxHash,
        explorerUrl: finalTxExplorerUrl,
      });

      return {
        success: true,
        txHash: lastHash ?? outboundHash,
        pushTxHash: lastPushHash ?? outboundHash,
        finalTxHash,
        finalTxExplorerUrl,
      };
    }

    return lastHash
      ? {
          success: true,
          txHash: lastHash,
          pushTxHash: lastPushHash ?? lastHash,
          ...(lastFinalHash ? { finalTxHash: lastFinalHash } : {}),
        }
      : createFailureResult(
          'No transaction was executed',
          'route-validation',
        );
  } catch (error) {
    return createFailureResult(error);
  }
};
