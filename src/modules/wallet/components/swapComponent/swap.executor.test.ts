import { PushChain } from '@pushchain/core';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSwapSteps } from './swap.executor';
import { SwapStep } from './swap.types';

type TestProgressHook = (event: {
  id: string;
  response: Record<string, unknown> | null;
}) => void;

type TestExecutionOptions = {
  progressHook?: TestProgressHook;
};

const { waitForTransactionReceipt } = vi.hoisted(() => ({
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock('../../../../utils/viemClient', () => ({
  viemClient: {
    waitForTransactionReceipt,
  },
}));

const sourceToken = {
  chain: CHAIN.ARBITRUM_SEPOLIA,
  chainName: 'ARBITRUM_SEPOLIA',
  symbol: 'ETH',
  address: '0x0000000000000000000000000000000000000000',
  decimals: 18,
  mechanism: 'native' as const,
};

const pushSteps: SwapStep[] = [
  {
    type: 'bridge',
    amountRaw: '1000000000000000',
    token: sourceToken,
  },
  {
    type: 'swap',
    to: '0x1111111111111111111111111111111111111111',
    value: '0',
    data: '0x1234',
  },
];

const createClient = () => {
  const sendTransaction = vi.fn().mockResolvedValue({
    hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    wait: vi.fn().mockResolvedValue({
      finalTxHash:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    }),
  });
  const prepareTransaction = vi.fn();
  const executeTransactions = vi.fn();

  return {
    client: {
      universal: {
        sendTransaction,
        prepareTransaction,
        executeTransactions,
      },
      explorer: {
        getTransactionUrl: vi.fn(
          (hash: string) => `https://explorer.test/tx/${hash}`,
        ),
      },
    } as unknown as PushChain,
    executeTransactions,
    prepareTransaction,
    sendTransaction,
  };
};

describe('swap step execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
    });
  });

  it('marks a non-origin external source as a CEA route', async () => {
    const { client, sendTransaction } = createClient();

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:11155111',
      sourceChain: 'eip155:421614',
      steps: pushSteps,
    });

    expect(result.success).toBe(true);
    expect(sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { chain: 'eip155:421614' },
        funds: expect.objectContaining({
          amount: 1000000000000000n,
        }),
        data: [
          {
            to: '0x1111111111111111111111111111111111111111',
            value: 0n,
            data: '0x1234',
          },
        ],
      }),
      expect.objectContaining({
        progressHook: expect.any(Function),
      }),
    );
  });

  it('uses the connected UOA when the selected source is the origin chain', async () => {
    const { client, sendTransaction } = createClient();

    await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:421614',
      sourceChain: 'eip155:421614',
      steps: pushSteps,
    });

    expect(sendTransaction).toHaveBeenCalledTimes(1);
    expect(sendTransaction.mock.calls[0][0]).not.toHaveProperty('from');
  });

  it('reports an external source hash before the returned Push hash', async () => {
    const { client, sendTransaction } = createClient();
    const sourceHash =
      '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
    const pushHash =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const finalPushHash =
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const progress = vi.fn();
    const submitted = vi.fn();
    const callbackOrder: string[] = [];

    sendTransaction.mockImplementationOnce(
      async (_request: unknown, options?: TestExecutionOptions) => {
        options?.progressHook?.({
          id: 'SEND-TX-106-02',
          response: { txHash: sourceHash },
        });
        return {
          hash: pushHash,
          wait: vi.fn().mockResolvedValue({
            finalTxHash: finalPushHash,
            pushInboundTxHash: finalPushHash,
          }),
        };
      },
    );

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:11155111',
      sourceChain: 'eip155:421614',
      steps: pushSteps,
      onTransactionProgress: (transaction) => {
        callbackOrder.push(`progress:${transaction.phase}:${transaction.hash}`);
        progress(transaction);
      },
      onTransactionSubmitted: (hash) => {
        callbackOrder.push(`submitted:${hash}`);
        submitted(hash);
      },
    });

    expect(progress).toHaveBeenNthCalledWith(1, {
      phase: 'source',
      chainId: 'eip155:421614',
      hash: sourceHash,
    });
    expect(progress).toHaveBeenNthCalledWith(2, {
      phase: 'push',
      chainId: 'eip155:42101',
      hash: pushHash,
    });
    expect(progress).toHaveBeenNthCalledWith(3, {
      phase: 'push',
      chainId: 'eip155:42101',
      hash: finalPushHash,
    });
    expect(submitted).toHaveBeenCalledOnce();
    expect(submitted).toHaveBeenCalledWith(pushHash);
    expect(callbackOrder.slice(0, 3)).toEqual([
      `progress:source:${sourceHash}`,
      `progress:push:${pushHash}`,
      `submitted:${pushHash}`,
    ]);
    expect(result).toMatchObject({
      success: true,
      pushTxHash: finalPushHash,
    });
  });

  it('deduplicates SDK and fallback Push refs while submitting once', async () => {
    const { client, sendTransaction } = createClient();
    const pushHash =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const progress = vi.fn();
    const submitted = vi.fn();

    sendTransaction.mockImplementationOnce(
      async (_request: unknown, options?: TestExecutionOptions) => {
        const event = {
          id: 'SEND-TX-199-01',
          response: { txHash: pushHash },
        };
        options?.progressHook?.(event);
        options?.progressHook?.(event);
        return { hash: pushHash };
      },
    );

    await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:42101',
      sourceChain: 'eip155:42101',
      steps: [pushSteps[1]],
      onTransactionProgress: progress,
      onTransactionSubmitted: submitted,
    });

    expect(progress).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledWith({
      phase: 'push',
      chainId: 'eip155:42101',
      hash: pushHash,
    });
    expect(submitted).toHaveBeenCalledOnce();
    expect(submitted).toHaveBeenCalledWith(pushHash);
  });

  it('cascades bridge, swap, and outbound into one SDK execution', async () => {
    const { client, executeTransactions, prepareTransaction } = createClient();
    const preparedPush = { route: 'CEA_TO_PUSH' };
    const preparedOutbound = { route: 'UOA_TO_CEA' };
    prepareTransaction
      .mockResolvedValueOnce(preparedPush)
      .mockResolvedValueOnce(preparedOutbound);
    executeTransactions.mockResolvedValue({
      initialTxHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      finalTxHash:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      waitForAll: vi.fn().mockResolvedValue({
        success: true,
        finalTxHash:
          '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      }),
    });

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:11155111',
      sourceChain: 'eip155:421614',
      steps: [
        ...pushSteps,
        {
          type: 'outbound',
          destinationChain: 'eip155:84532',
          recipientAddress: '0x3333333333333333333333333333333333333333',
          amountRaw: '900000000000000',
          tokenSymbol: 'ETH',
          token: {
            chain: CHAIN.BASE_SEPOLIA,
            chainName: 'BASE_SEPOLIA',
            symbol: 'ETH',
            address: '0x0000000000000000000000000000000000000000',
            decimals: 18,
            mechanism: 'native',
          },
        },
      ],
    });

    expect(prepareTransaction).toHaveBeenCalledTimes(2);
    expect(prepareTransaction.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        from: { chain: 'eip155:421614' },
      }),
    );
    expect(executeTransactions).toHaveBeenCalledWith(
      [preparedPush, preparedOutbound],
      expect.objectContaining({
        progressHook: expect.any(Function),
      }),
    );
    expect(result).toEqual({
      success: true,
      txHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      pushTxHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      finalTxHash:
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      finalTxExplorerUrl:
        'https://explorer.test/tx/0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    });
  });

  it('does not prepare a cascade for a native Push signer', async () => {
    const { client, executeTransactions, prepareTransaction, sendTransaction } =
      createClient();
    sendTransaction
      .mockResolvedValueOnce({
        hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
      .mockResolvedValueOnce({
        hash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        wait: vi.fn().mockResolvedValue({
          status: 1,
          externalStatus: 'success',
          externalTxHash:
            '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        }),
      });

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:42101',
      sourceChain: 'eip155:42101',
      steps: [
        pushSteps[1],
        {
          type: 'outbound',
          destinationChain: 'eip155:84532',
          recipientAddress: '0x3333333333333333333333333333333333333333',
          amountRaw: '900000000000000',
          tokenSymbol: 'ETH',
          token: {
            chain: CHAIN.BASE_SEPOLIA,
            chainName: 'BASE_SEPOLIA',
            symbol: 'ETH',
            address: '0x0000000000000000000000000000000000000000',
            decimals: 18,
            mechanism: 'native',
          },
        },
      ],
    });

    expect(prepareTransaction).not.toHaveBeenCalled();
    expect(executeTransactions).not.toHaveBeenCalled();
    expect(sendTransaction).toHaveBeenCalledTimes(2);
    expect(sendTransaction).toHaveBeenNthCalledWith(
      1,
      {
        to: '0x1111111111111111111111111111111111111111',
        value: 0n,
        data: '0x1234',
      },
      expect.objectContaining({
        progressHook: expect.any(Function),
      }),
    );
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      timeout: 60_000,
    });
    expect(sendTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: {
          address: '0x3333333333333333333333333333333333333333',
          chain: 'eip155:84532',
        },
      }),
      expect.objectContaining({
        progressHook: expect.any(Function),
      }),
    );
    expect(sendTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      waitForTransactionReceipt.mock.invocationCallOrder[0],
    );
    expect(waitForTransactionReceipt.mock.invocationCallOrder[0]).toBeLessThan(
      sendTransaction.mock.invocationCallOrder[1],
    );
    expect(result.success).toBe(true);
  });

  it('does not report a failed CEA receipt as a successful swap', async () => {
    const { client, sendTransaction } = createClient();
    sendTransaction.mockResolvedValueOnce({
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      wait: vi.fn().mockResolvedValue({
        status: 1,
        externalStatus: 'failed',
        externalError: 'CEA execution reverted',
      }),
    });

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:11155111',
      sourceChain: 'eip155:421614',
      steps: pushSteps,
    });

    expect(result).toEqual({
      success: false,
      error: 'CEA execution reverted',
      txHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      pushTxHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      failure: {
        stage: 'source',
        message: 'CEA execution reverted',
      },
    });
  });

  it('keeps relay timeouts pending because settlement can still complete', async () => {
    const { client, sendTransaction } = createClient();
    sendTransaction.mockResolvedValueOnce({
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      wait: vi.fn().mockResolvedValue({
        status: 1,
        externalStatus: 'timeout',
        externalError: 'Timed out waiting for inbound settlement',
      }),
    });

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:11155111',
      sourceChain: 'eip155:421614',
      steps: pushSteps,
    });

    expect(result).toMatchObject({
      success: false,
      pending: true,
      error: 'Timed out waiting for inbound settlement',
      failure: {
        stage: 'source',
        retryable: true,
      },
    });
  });

  it('preserves decoded SDK terminal errors and their execution stage', async () => {
    const { client, sendTransaction } = createClient();
    sendTransaction.mockImplementationOnce(
      async (_request: unknown, options?: TestExecutionOptions) => {
        options?.progressHook?.({
          id: 'SEND-TX-199-02',
          title: 'Push Chain Tx Failed',
          message: 'execution reverted',
          level: 'ERROR',
          response: {
            error: 'execution reverted',
            decodedError: 'STF',
            txHash:
              '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        } as Parameters<TestProgressHook>[0]);
        return {
          hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          wait: vi.fn().mockResolvedValue({ status: 0 }),
        };
      },
    );

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:11155111',
      sourceChain: 'eip155:421614',
      steps: pushSteps,
    });

    expect(result).toMatchObject({
      success: false,
      failure: {
        stage: 'push',
        code: 'SEND-TX-199-02',
        eventId: 'SEND-TX-199-02',
        title: 'Push Chain Tx Failed',
        decodedError: 'STF',
      },
    });
  });

  it('does not report a reverted native Push swap as successful', async () => {
    const { client } = createClient();
    waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'reverted',
    });

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: 'eip155:42101',
      sourceChain: 'eip155:42101',
      steps: [pushSteps[1]],
    });

    expect(result).toMatchObject({
      success: false,
      failure: {
        stage: 'push',
      },
    });
  });
});
