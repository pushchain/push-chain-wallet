import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSwapActivities,
  fetchSwapQuote,
  fetchSwapSteps,
} from './swap.api';
import { SwapFlowError } from './swap.errors';

const quoteRequest = {
  sourceChain: 'eip155:11155111',
  destinationChain: 'eip155:42101',
  fromToken: '0x0000000000000000000000000000000000000000',
  toToken: '0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9',
  amountIn: '0.01',
};

describe('RamenFi swap API', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the hosted RamenFi quote route by default', async () => {
    vi.stubEnv('VITE_SWAP_API_URL', '');
    vi.stubEnv('VITE_RAMENFI_API_KEY', '');
    vi.stubEnv('VITE_SWAP_API_KEY', '');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        amountOut: '1',
        gasEstimate: 1,
        liquidity: null,
        poolResult: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchSwapQuote(quoteRequest);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.ramenfi.xyz/api/quote',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'x-api-key': expect.anything(),
        }),
      }),
    );
  });

  it('uses the bridge-compatible API key for quote requests', async () => {
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test/api/');
    vi.stubEnv('VITE_RAMENFI_API_KEY', 'test-api-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        amountOut: '1',
        gasEstimate: 1,
        liquidity: null,
        poolResult: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchSwapQuote(quoteRequest);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ramenfi.test/api/quote',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': 'test-api-key',
        }),
        body: JSON.stringify(quoteRequest),
      }),
    );
  });

  it('posts the RamenFi pool result to the swap route', async () => {
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test/');
    vi.stubEnv('VITE_RAMENFI_API_KEY', 'test-api-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        steps: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      ...quoteRequest,
      userAddress: '0x2222222222222222222222222222222222222222',
      poolResult: {
        type: 'direct',
        pools: [
          {
            address: '0x3333333333333333333333333333333333333333',
            fee: 500,
            token0: quoteRequest.fromToken,
            token1: quoteRequest.toToken,
          },
        ],
      },
      maxSlippage: '0.5',
    };

    await fetchSwapSteps(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ramenfi.test/api/swap',
      expect.objectContaining({
        body: JSON.stringify(request),
      }),
    );
  });

  it('retries a transient upstream RPC 429 before returning the quote', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test');
    const rateLimitResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        success: false,
        code: 'INTERNAL_ERROR',
        error:
          'Push RPC failed with Status: 429 Too Many Requests',
      }),
    };
    const successResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        amountOut: '1',
        gasEstimate: 1,
        liquidity: null,
        poolResult: null,
      }),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);
    vi.stubGlobal('fetch', fetchMock);

    const quotePromise = fetchSwapQuote(quoteRequest);
    await vi.runAllTimersAsync();

    await expect(quotePromise).resolves.toMatchObject({
      success: true,
      amountOut: '1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('preserves route stage, API code, HTTP status, and retry attempts', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({
        success: false,
        code: 'INTERNAL_ERROR',
        error: 'Push RPC service unavailable',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const stepsPromise = fetchSwapSteps({
      ...quoteRequest,
      userAddress: '0x2222222222222222222222222222222222222222',
      poolResult: null,
    }).catch((reason) => reason);
    await vi.runAllTimersAsync();

    const error = await stepsPromise;
    expect(error).toBeInstanceOf(SwapFlowError);
    expect((error as SwapFlowError).failure).toMatchObject({
      stage: 'route-preparation',
      code: 'INTERNAL_ERROR',
      httpStatus: 503,
      attempts: 3,
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fetches paginated activity with the shared RamenFi API key', async () => {
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test/api/');
    vi.stubEnv('VITE_RAMENFI_API_KEY', 'test-api-key');
    const activityResponse = {
      success: true,
      address: '0x2222222222222222222222222222222222222222',
      page: 2,
      limit: 25,
      hasMore: true,
      totalItems: 25,
      totalPages: 3,
      activities: [
        {
          hash: `0x${'a'.repeat(64)}`,
          type: 'swap',
          status: 'success',
          user: '0x2222222222222222222222222222222222222222',
          tokensIn: [
            {
              address: quoteRequest.fromToken,
              symbol: 'ETH',
              amount: '0.01',
              chainId: quoteRequest.sourceChain,
            },
          ],
          tokensOut: [
            {
              address: quoteRequest.toToken,
              symbol: 'WPC',
              amount: '1.5',
              chainId: quoteRequest.destinationChain,
            },
          ],
          networkCost: '0.0001',
          timestamp: 1_785_362_440,
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(activityResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSwapActivities({
      walletAddress: ' 0x2222222222222222222222222222222222222222 ',
      page: 2,
      limit: 25,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ramenfi.test/api/activity?walletAddress=0x2222222222222222222222222222222222222222&page=2&limit=25',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': 'test-api-key',
        },
      },
    );
    expect(result).toEqual(activityResponse);
  });

  it('surfaces the RamenFi activity API error message', async () => {
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: 'Invalid or missing API key',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchSwapActivities({
        walletAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).rejects.toThrow('Invalid or missing API key');
  });

  it('uses a stable fallback when the activity response is not JSON', async () => {
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchSwapActivities({
        walletAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).rejects.toThrow('Swap activity service request failed (502)');
  });

  it('rejects malformed successful activity responses', async () => {
    vi.stubEnv('VITE_SWAP_API_URL', 'https://ramenfi.test');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        address: '0x2222222222222222222222222222222222222222',
        page: 1,
        limit: 20,
        hasMore: false,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchSwapActivities({
        walletAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).rejects.toThrow('Swap activity service returned an invalid response');
  });

  it('does not request activity without a wallet address', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchSwapActivities({
        walletAddress: ' ',
      }),
    ).rejects.toThrow('walletAddress is required to fetch swap activity');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
