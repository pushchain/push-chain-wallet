import {
  QuoteApiRequest,
  QuoteApiSuccessResponse,
  SwapFailureStage,
  SwapApiRequest,
  SwapApiSuccessResponse,
} from './swap.types';
import {
  SwapActivitiesRequest,
  SwapActivitiesResponse,
  SwapActivitiesSuccessResponse,
} from './swap.activity-api.types';
import { SwapFlowError } from './swap.errors';

const DEFAULT_SWAP_API_URL = 'https://www.ramenfi.xyz';
const SWAP_API_MAX_ATTEMPTS = 3;
const SWAP_API_RETRY_DELAY_MS = 350;
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 502, 503, 504]);

const getSwapApiUrl = () =>
  (import.meta.env.VITE_SWAP_API_URL || DEFAULT_SWAP_API_URL)
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

const getSwapApiKey = () =>
  import.meta.env.VITE_RAMENFI_API_KEY ||
  import.meta.env.VITE_SWAP_API_KEY ||
  '';

const getSwapApiHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  // Keep the same variable name as push-chain-examples/apps/bridge.
  // Both names are client-exposed Vite variables, so production deployments
  // should prefer a server-side proxy instead of embedding a private API key.
  const apiKey = getSwapApiKey();
  if (apiKey) headers['x-api-key'] = apiKey;
  return headers;
};

type SwapApiErrorResponse = {
  success?: false;
  error?: string;
  code?: string;
};

const waitBeforeRetry = (attempt: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(
      resolve,
      SWAP_API_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    );
  });

const isRetryableSwapApiFailure = ({
  status,
  code,
  message,
  networkError,
}: {
  status: number;
  code?: string;
  message: string;
  networkError?: boolean;
}) =>
  !!networkError ||
  RETRYABLE_HTTP_STATUS.has(status) ||
  /(?:too many requests|rate.?limit|status:\s*429|http\s*429|rpc.*429|temporar(?:y|ily)|service unavailable|bad gateway|gateway timeout)/i.test(
    `${code ?? ''} ${message}`,
  );

const post = async <T extends { success: boolean }>(
  path: '/api/quote' | '/api/swap',
  body: unknown,
  stage: Extract<SwapFailureStage, 'quote' | 'route-preparation'>,
): Promise<T> => {
  const endpoint = `${getSwapApiUrl()}${path}`;

  for (let attempt = 1; attempt <= SWAP_API_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: getSwapApiHeaders(),
        body: JSON.stringify(body),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The swap service could not be reached';
      const retryable = isRetryableSwapApiFailure({
        status: 0,
        message,
        networkError: true,
      });
      if (retryable && attempt < SWAP_API_MAX_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }

      throw new SwapFlowError({
        stage,
        code: 'NETWORK_ERROR',
        message,
        attempts: attempt,
        retryable,
        context: { endpoint: path },
      });
    }

    let data: (T & SwapApiErrorResponse) | null = null;
    try {
      data = (await response.json()) as T & SwapApiErrorResponse;
    } catch {
      // The status and endpoint below still provide actionable diagnostics.
    }

    if (response.ok && data && data.success !== false) {
      return data as T;
    }

    const message =
      data?.error ||
      `Swap service request failed (HTTP ${response.status})`;
    const retryable = isRetryableSwapApiFailure({
      status: response.status,
      code: data?.code,
      message,
    });
    if (retryable && attempt < SWAP_API_MAX_ATTEMPTS) {
      await waitBeforeRetry(attempt);
      continue;
    }

    throw new SwapFlowError({
      stage,
      message,
      ...(data?.code ? { code: data.code } : {}),
      ...(response.status ? { httpStatus: response.status } : {}),
      attempts: attempt,
      retryable,
      context: { endpoint: path },
    });
  }

  throw new SwapFlowError({
    stage,
    code: 'RETRY_EXHAUSTED',
    message: 'The swap service did not return a response',
    attempts: SWAP_API_MAX_ATTEMPTS,
    retryable: true,
    context: { endpoint: path },
  });
};

export const fetchSwapQuote = (request: QuoteApiRequest) =>
  post<QuoteApiSuccessResponse>('/api/quote', request, 'quote');

export const fetchSwapSteps = (request: SwapApiRequest) =>
  post<SwapApiSuccessResponse>(
    '/api/swap',
    request,
    'route-preparation',
  );

const getActivityErrorMessage = (
  data: SwapActivitiesResponse | null,
  status: number,
) => {
  if (
    data &&
    data.success === false &&
    typeof data.error === 'string' &&
    data.error.trim()
  ) {
    return data.error;
  }

  return `Swap activity service request failed (${status})`;
};

export const fetchSwapActivities = async (
  {
    walletAddress,
    page = 1,
    limit = 20,
  }: SwapActivitiesRequest,
  options: { signal?: AbortSignal } = {},
): Promise<SwapActivitiesSuccessResponse> => {
  const normalizedAddress = walletAddress.trim();
  if (!normalizedAddress) {
    throw new Error('walletAddress is required to fetch swap activity');
  }

  const searchParams = new URLSearchParams({
    walletAddress: normalizedAddress,
    page: String(page),
    limit: String(limit),
  });
  const response = await fetch(
    `${getSwapApiUrl()}/api/activity?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: getSwapApiHeaders(),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );

  let data: SwapActivitiesResponse | null = null;
  try {
    data = (await response.json()) as SwapActivitiesResponse;
  } catch {
    throw new Error(getActivityErrorMessage(null, response.status));
  }

  if (!response.ok || !data || data.success === false) {
    throw new Error(getActivityErrorMessage(data, response.status));
  }

  if (!Array.isArray(data.activities)) {
    throw new Error('Swap activity service returned an invalid response');
  }

  return data;
};
