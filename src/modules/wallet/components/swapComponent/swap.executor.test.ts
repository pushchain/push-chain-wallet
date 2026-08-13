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

  it('preserves approval/swap/unwrap ordering in relay multicall data', async () => {
    const { client, sendTransaction } = createClient();
    const calls: SwapStep[] = [
      {
        type: 'swap',
        to: '0x1111111111111111111111111111111111111111',
        value: '0',
        data: '0xaaaaaaaa',
      },
      {
        type: 'swap',
        to: '0x2222222222222222222222222222222222222222',
        value: '7',
        data: '0xbbbbbbbb',
      },
      {
        type: 'swap',
        to: '0x3333333333333333333333333333333333333333',
        value: '0',
        data: '0xcccccccc',
      },
    ];

    await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x4444444444444444444444444444444444444444',
      originChain: CHAIN.ETHEREUM_SEPOLIA,
      sourceChain: CHAIN.ARBITRUM_SEPOLIA,
      steps: [pushSteps[0], ...calls],
    });

    expect(sendTransaction.mock.calls[0][0].data).toEqual([
      {
        to: '0x1111111111111111111111111111111111111111',
        value: 0n,
        data: '0xaaaaaaaa',
      },
      {
        to: '0x2222222222222222222222222222222222222222',
        value: 7n,
        data: '0xbbbbbbbb',
      },
      {
        to: '0x3333333333333333333333333333333333333333',
        value: 0n,
        data: '0xcccccccc',
      },
    ]);
  });

  it('executes an external-to-Push identity route as bridge-only', async () => {
    const { client, sendTransaction } = createClient();
    const userAddress = '0x2222222222222222222222222222222222222222';
    const receiverAddress = '0x3333333333333333333333333333333333333333';

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress,
      pushRecipientAddress: receiverAddress,
      originChain: CHAIN.ETHEREUM_SEPOLIA,
      sourceChain: CHAIN.ETHEREUM_SEPOLIA,
      steps: [pushSteps[0]],
    });

    expect(sendTransaction).toHaveBeenCalledWith(
      {
        to: receiverAddress,
        funds: {
          amount: 1000000000000000n,
          token: sourceToken,
        },
      },
      expect.any(Object),
    );
    expect(result.success).toBe(true);
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

  it('uses explicit CEA routing when origin metadata is unavailable', async () => {
    const { client, sendTransaction } = createClient();

    await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      sourceChain: 'eip155:421614',
      steps: pushSteps,
    });

    expect(sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { chain: 'eip155:421614' },
      }),
      expect.any(Object),
    );
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

  it.each([
    {
      description: 'native output with value',
      token: {
        chain: CHAIN.ETHEREUM_SEPOLIA,
        chainName: 'ETHEREUM_SEPOLIA',
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        mechanism: 'native' as const,
      },
      expectedValue: 900000000000000n,
    },
    {
      description: 'ERC-20 output without value',
      token: {
        chain: CHAIN.ETHEREUM_SEPOLIA,
        chainName: 'ETHEREUM_SEPOLIA',
        symbol: 'USDC',
        address: '0x9999999999999999999999999999999999999999',
        decimals: 6,
        mechanism: 'approve' as const,
      },
      expectedValue: undefined,
    },
  ])(
    'executes an outbound-only $description',
    async ({ token, expectedValue }) => {
      const { client, sendTransaction } = createClient();
      const recipient = '0x3333333333333333333333333333333333333333';

      const result = await executeSwapSteps({
        pushChainClient: client,
        userAddress: '0x2222222222222222222222222222222222222222',
        originChain: CHAIN.PUSH_TESTNET_DONUT,
        sourceChain: CHAIN.PUSH_TESTNET_DONUT,
        steps: [
          {
            type: 'outbound',
            destinationChain: CHAIN.ETHEREUM_SEPOLIA,
            recipientAddress: recipient,
            amountRaw: '900000000000000',
            tokenSymbol: token.symbol,
            token,
          },
        ],
      });

      expect(sendTransaction).toHaveBeenCalledWith(
        {
          to: {
            address: recipient,
            chain: CHAIN.ETHEREUM_SEPOLIA,
          },
          ...(expectedValue === undefined
            ? {}
            : { value: expectedValue }),
          funds: {
            amount: 900000000000000n,
            token,
          },
        },
        expect.objectContaining({ progressHook: expect.any(Function) }),
      );
      expect(result.success).toBe(true);
    },
  );

  it('cascades bridge, swap, and outbound into one SDK execution', async () => {
    const { client, executeTransactions, prepareTransaction } = createClient();
    const preparedInbound = { route: 'CEA_TO_PUSH' };
    const preparedSwap = { route: 'PUSH_SWAP' };
    const preparedOutbound = { route: 'UOA_TO_CEA' };
    prepareTransaction
      .mockResolvedValueOnce(preparedInbound)
      .mockResolvedValueOnce(preparedSwap)
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

    expect(prepareTransaction).toHaveBeenCalledTimes(3);
    expect(prepareTransaction.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        from: { chain: 'eip155:421614' },
      }),
    );
    expect(executeTransactions).toHaveBeenCalledWith(
      [preparedInbound, preparedSwap, preparedOutbound],
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

  it('prepares a bridge-only external-to-external cascade for Solana output', async () => {
    const { client, executeTransactions, prepareTransaction } = createClient();
    const preparedInbound = { route: 'UOA_TO_PUSH' };
    const preparedOutbound = { route: 'UOA_TO_SOLANA_CEA' };
    prepareTransaction
      .mockResolvedValueOnce(preparedInbound)
      .mockResolvedValueOnce(preparedOutbound);
    executeTransactions.mockResolvedValue({
      initialTxHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      waitForAll: vi.fn().mockResolvedValue({
        success: true,
        finalTxHash:
          '5HueCGU8rMjxEXxiPuD5BDuRaKQhL2n4QW7P4L9Dbh9Vj3qA1nYvR8oZ6tT2cS7wE4mK9pQ2xD5fG8hJ1kL3mN5',
      }),
    });
    const recipient = '11111111111111111111111111111111';

    const result = await executeSwapSteps({
      pushChainClient: client,
      userAddress: '0x2222222222222222222222222222222222222222',
      originChain: CHAIN.ETHEREUM_SEPOLIA,
      sourceChain: CHAIN.ETHEREUM_SEPOLIA,
      steps: [
        pushSteps[0],
        {
          type: 'outbound',
          destinationChain: CHAIN.SOLANA_DEVNET,
          recipientAddress: recipient,
          amountRaw: '900000',
          tokenSymbol: 'USDC',
          token: {
            chain: CHAIN.SOLANA_DEVNET,
            chainName: 'SOLANA_DEVNET',
            symbol: 'USDC',
            address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
            decimals: 6,
            mechanism: 'approve',
          },
        },
      ],
    });

    expect(prepareTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: { address: recipient, chain: CHAIN.SOLANA_DEVNET },
        funds: expect.objectContaining({ amount: 900000n }),
      }),
    );
    expect(executeTransactions).toHaveBeenCalledWith(
      [preparedInbound, preparedOutbound],
      expect.any(Object),
    );
    expect(result.success).toBe(true);
  });

  it('uses the same atomic cascade for a native Push signer', async () => {
    const { client, executeTransactions, prepareTransaction, sendTransaction } =
      createClient();
    const preparedSwap = { route: 'PUSH_SWAP' };
    const preparedOutbound = { route: 'PUSH_TO_CEA' };
    prepareTransaction
      .mockResolvedValueOnce(preparedSwap)
      .mockResolvedValueOnce(preparedOutbound);
    executeTransactions.mockResolvedValue({
      initialTxHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      finalTxHash:
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      waitForAll: vi.fn().mockResolvedValue({
        success: true,
        finalTxHash:
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

    expect(prepareTransaction).toHaveBeenCalledTimes(2);
    expect(prepareTransaction).toHaveBeenNthCalledWith(
      1,
      {
        to: '0x1111111111111111111111111111111111111111',
        value: 0n,
        data: '0x1234',
      },
    );
    expect(prepareTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: {
          address: '0x3333333333333333333333333333333333333333',
          chain: 'eip155:84532',
        },
        value: 900000000000000n,
      }),
    );
    expect(executeTransactions).toHaveBeenCalledWith(
      [preparedSwap, preparedOutbound],
      expect.objectContaining({
        progressHook: expect.any(Function),
      }),
    );
    expect(sendTransaction).not.toHaveBeenCalled();
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
