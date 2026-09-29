import { SwapActivityRecord } from './swap.activity';
import { SwapTransactionRef } from './swap.types';
import {
  getSwapChainDisplayName,
  getSwapTokenDisplaySymbol,
} from './swap.utils';

const MAX_TECHNICAL_ERROR_LENGTH = 4_000;
const SENSITIVE_FIELD =
  '(?:x-api-key|api[_ -]?key|authorization|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|private[_ -]?key|mnemonic|seed(?:[_ -]?phrase)?|vite_[a-z0-9_]*(?:key|secret|token))';

const asErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return '';
  }
};

/**
 * Error messages can contain upstream request/header data. Keep the useful
 * diagnostic text while ensuring credentials are never rendered in the UI.
 */
export const sanitizeSwapErrorMessage = (
  error: unknown,
  fallback = 'No technical error was returned.',
) => {
  const message = asErrorMessage(error).trim();
  if (!message) return fallback;

  return message
    .replace(
      new RegExp(
        `((?:["']?${SENSITIVE_FIELD}["']?)\\s*[:=]\\s*)(["'])(.*?)\\2`,
        'gi',
      ),
      (_match, prefix: string, quote: string) =>
        `${prefix}${quote}[redacted]${quote}`,
    )
    .replace(
      new RegExp(
        `((?:["']?${SENSITIVE_FIELD}["']?)\\s*[:=]\\s*)(?!["'])([^\\s,;}\\]&#]+)`,
        'gi',
      ),
      '$1[redacted]',
    )
    .replace(
      new RegExp(`([?&]${SENSITIVE_FIELD}=)[^&#\\s]+`, 'gi'),
      '$1[redacted]',
    )
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]')
    .replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
      '[redacted]',
    )
    .replace(
      /(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi,
      '$1[redacted]@',
    )
    .replace(
      /(https?:\/\/[^/\s]+\/(?:v2|v3)\/)[A-Za-z0-9_-]{16,}/gi,
      '$1[redacted]',
    )
    .slice(0, MAX_TECHNICAL_ERROR_LENGTH);
};

export const getSwapFailureSummary = (error: unknown) => {
  const message = sanitizeSwapErrorMessage(error, '').toLowerCase();

  if (/user rejected|user denied|request rejected|cancelled by user/.test(message)) {
    return 'The transaction was rejected in your wallet.';
  }
  if (/insufficient (?:funds|balance)|exceeds balance/.test(message)) {
    return 'The selected account does not have enough balance to complete this swap.';
  }
  if (/liquidity|no pool|no route|route not found|no swap steps/.test(message)) {
    return 'No executable route with enough liquidity was found for this swap.';
  }
  if (/slippage|minimum amount|amount out.*minimum/.test(message)) {
    return 'The quote moved beyond your slippage tolerance.';
  }
  if (/429|too many requests|rate.?limit/.test(message)) {
    return 'The swap service is temporarily rate-limited.';
  }
  if (/route is incomplete|missing.*bridge|stopped before signing/.test(message)) {
    return 'RamenFi returned an incomplete route, so the wallet stopped before signing.';
  }
  if (/revert|execution failed|call exception/.test(message)) {
    return 'The transaction reverted before the swap could complete.';
  }
  if (/timed? ?out|timeout|not confirmed/.test(message)) {
    return 'The swap could not be confirmed before the request timed out.';
  }
  if (
    /api.?key|unauthori[sz]ed|forbidden|authentication|status\s*40[13]/.test(
      message,
    )
  ) {
    return 'The swap service could not authenticate the request.';
  }

  return 'The swap could not be completed.';
};

type SwapFailureContext = Pick<
  SwapActivityRecord,
  | 'error'
  | 'tokensIn'
  | 'tokensOut'
  | 'sourceChain'
  | 'destinationChain'
  | 'sourceAddress'
  | 'destinationAddress'
  | 'failure'
> & {
  transactionRefs?: readonly SwapTransactionRef[];
};

export type SwapFailureDetail = {
  label: string;
  value: string;
  kind?: 'text' | 'address' | 'transaction' | 'error';
};

export type SwapFailurePresentation = {
  summary: string;
  technicalMessage: string;
  details: SwapFailureDetail[];
};

const getLastRecordedStage = (
  transactions: readonly SwapTransactionRef[],
  failure?: SwapActivityRecord['failure'],
) => {
  if (failure?.stage === 'quote') return 'Quote';
  if (failure?.stage === 'route-preparation') return 'Route preparation';
  if (failure?.stage === 'route-validation') return 'Route validation';
  if (failure?.stage === 'source') return 'Source-chain execution';
  if (failure?.stage === 'push') return 'Push Chain execution';
  if (failure?.stage === 'destination') return 'Destination settlement';
  if (failure?.stage === 'cascade') return 'Multichain execution';

  const phase = transactions[transactions.length - 1]?.phase;

  if (phase === 'source') return 'Source-chain submission';
  if (phase === 'push') return 'Push Chain execution';
  if (phase === 'destination') return 'Destination settlement';
  return 'Route preparation';
};

const formatChain = (chain?: string) =>
  chain ? `${getSwapChainDisplayName(chain)} (${chain})` : 'Unknown chain';

const formatTokenAmount = (
  token: SwapActivityRecord['tokensIn'][number] | undefined,
) => {
  if (!token) return 'Unavailable';
  return `${token.amount || '0'} ${getSwapTokenDisplaySymbol(token.symbol)}`;
};

export const getSwapFailurePresentation = (
  record: SwapFailureContext,
): SwapFailurePresentation => {
  const transactions = record.transactionRefs ?? [];
  const input = record.tokensIn[0];
  const output = record.tokensOut[0];
  const sourceChain = record.sourceChain ?? input?.chain;
  const destinationChain = record.destinationChain ?? output?.chain;
  const technicalMessage = sanitizeSwapErrorMessage(
    record.failure?.message ?? record.error,
  );
  const details: SwapFailureDetail[] = [
    {
      label: 'Last recorded stage',
      value: getLastRecordedStage(transactions, record.failure),
    },
    {
      label: 'Route',
      value: `${formatChain(sourceChain)} → ${formatChain(destinationChain)}`,
    },
    {
      label: 'Input',
      value: formatTokenAmount(input),
    },
    {
      label: 'Quoted output',
      value: formatTokenAmount(output),
    },
  ];

  if (record.failure?.code) {
    details.push({
      label: 'Error code',
      value: record.failure.code,
    });
  }
  if (record.failure?.httpStatus) {
    details.push({
      label: 'HTTP status',
      value: String(record.failure.httpStatus),
    });
  }
  if (record.failure?.eventId) {
    details.push({
      label: 'SDK event',
      value: [
        record.failure.eventId,
        record.failure.title,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  if (record.failure?.failedAt !== undefined) {
    details.push({
      label: 'Failed hop',
      value: record.failure.total
        ? `${record.failure.failedAt} of ${record.failure.total}`
        : String(record.failure.failedAt),
    });
  }
  if (record.failure?.attempts) {
    details.push({
      label: 'Route attempts',
      value: String(record.failure.attempts),
    });
  }
  Object.entries(record.failure?.context ?? {}).forEach(([key, value]) => {
    details.push({
      label: `Detail · ${key}`,
      value: sanitizeSwapErrorMessage(String(value)),
      kind:
        /(?:hash|address|recipient|token)/i.test(key)
          ? 'address'
          : 'text',
    });
  });

  if (input?.address) {
    details.push({
      label: 'Input token',
      value: input.address,
      kind: 'address',
    });
  }
  if (output?.address) {
    details.push({
      label: 'Output token',
      value: output.address,
      kind: 'address',
    });
  }
  if (record.sourceAddress) {
    details.push({
      label: 'Source account',
      value: record.sourceAddress,
      kind: 'address',
    });
  }
  if (record.destinationAddress) {
    details.push({
      label: 'Recipient',
      value: record.destinationAddress,
      kind: 'address',
    });
  }

  transactions.forEach((transaction) => {
    const phaseLabel =
      transaction.phase === 'source'
        ? 'Source transaction'
        : transaction.phase === 'push'
          ? 'Push transaction'
          : 'Destination transaction';
    details.push({
      label: phaseLabel,
      value: `${formatChain(transaction.chainId)} · ${transaction.hash}`,
      kind: 'transaction',
    });
  });

  details.push({
    label: 'Technical error',
    value: technicalMessage,
    kind: 'error',
  });
  if (
    record.failure?.decodedError &&
    record.failure.decodedError !== technicalMessage
  ) {
    details.push({
      label: 'Decoded contract error',
      value: sanitizeSwapErrorMessage(record.failure.decodedError),
      kind: 'error',
    });
  }

  return {
    summary: getSwapFailureSummary(
      record.failure?.message ?? record.error,
    ),
    technicalMessage,
    details,
  };
};
