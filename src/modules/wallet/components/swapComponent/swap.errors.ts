import {
  SwapFailureDetails,
  SwapFailureStage,
} from './swap.types';

type ErrorLike = {
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  cause?: unknown;
  code?: unknown;
  name?: unknown;
};

const cleanString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const stringifyUnknown = (value: unknown) => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const collectErrorMessages = (
  error: unknown,
  messages: string[],
  visited: Set<unknown>,
  depth: number,
) => {
  if (error === null || error === undefined || depth > 4) return;
  if (visited.has(error)) return;
  visited.add(error);

  if (typeof error === 'string') {
    if (error.trim()) messages.push(error.trim());
    return;
  }

  if (typeof error !== 'object') {
    messages.push(String(error));
    return;
  }

  const candidate = error as ErrorLike;
  [
    candidate.shortMessage,
    candidate.message,
    candidate.details,
  ].forEach((value) => {
    const message = cleanString(value);
    if (message) messages.push(message);
  });

  if (candidate.cause && candidate.cause !== error) {
    collectErrorMessages(
      candidate.cause,
      messages,
      visited,
      depth + 1,
    );
  }
};

export const getDetailedSwapErrorMessage = (
  error: unknown,
  fallback = 'The swap could not be completed',
) => {
  const messages: string[] = [];
  collectErrorMessages(error, messages, new Set(), 0);

  const uniqueMessages = messages.filter(
    (message, index) =>
      messages.findIndex(
        (candidate) => candidate.toLowerCase() === message.toLowerCase(),
      ) === index,
  );

  if (uniqueMessages.length) return uniqueMessages.join('\n\n');
  if (error !== undefined && error !== null) {
    const serialized = stringifyUnknown(error).trim();
    if (serialized && serialized !== '{}') return serialized;
  }
  return fallback;
};

export class SwapFlowError extends Error {
  readonly failure: SwapFailureDetails;

  constructor(failure: SwapFailureDetails) {
    super(failure.message);
    this.name = 'SwapFlowError';
    this.failure = failure;
  }
}

export const getSwapFailureDetails = (
  error: unknown,
  stage: SwapFailureStage = 'unknown',
): SwapFailureDetails => {
  if (error instanceof SwapFlowError) return error.failure;

  const candidate =
    error && typeof error === 'object'
      ? (error as ErrorLike)
      : null;
  const code =
    typeof candidate?.code === 'string' ||
    typeof candidate?.code === 'number'
      ? String(candidate.code)
      : undefined;

  return {
    stage,
    message: getDetailedSwapErrorMessage(error),
    ...(code ? { code } : {}),
  };
};

export const isTimeoutFailure = (failure?: SwapFailureDetails) =>
  !!failure &&
  (/timeout|timed out/i.test(failure.message) ||
    /(?:^|[-_])(?:TIMEOUT|999-03|399-03|299-03|199-03)$/i.test(
      failure.code ?? failure.eventId ?? '',
    ));
