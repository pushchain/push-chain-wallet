import { PushChain } from '@pushchain/core';
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
  chain: 'eip155:421614',
  chainName: 'ARBITRUM_SEPOLIA',
  symbol: 'ETH',
  address: '0x0000000000000000000000000000000000000000',
  decimals: 18,
  mechanism: 'native' as const,
};

// A UOA source on an external chain bridging in, so the SDK emits the 1xx
// route: the funds lock is submitted on the origin chain (106-02) before
// anything touches Push Chain.
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
    wait: vi.fn().mockResolvedValue({ status: 0 }),
  });

  return {
    client: {
      universal: { sendTransaction },
      explorer: {
        getTransactionUrl: vi.fn(
          (hash: string) => `https://explorer.test/tx/${hash}`,
        ),
      },
    } as unknown as PushChain,
    sendTransaction,
  };
};

/**
 * Emits one ERROR progress event through the real SDK progressHook seam, then
 * resolves a status:0 receipt so the executor takes its failure path.
 */
const runWithFailingProgressEvent = async (id: string) => {
  const { client, sendTransaction } = createClient();
  sendTransaction.mockImplementationOnce(
    async (_request: unknown, options?: TestExecutionOptions) => {
      options?.progressHook?.({
        id,
        title: 'Origin chain lock failed',
        message: 'insufficient funds for gas',
        level: 'ERROR',
        response: {
          error: 'insufficient funds for gas',
          chain: 'eip155:421614',
        },
      } as Parameters<TestProgressHook>[0]);
      return {
        hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        wait: vi.fn().mockResolvedValue({ status: 0 }),
      };
    },
  );

  return executeSwapSteps({
    pushChainClient: client,
    userAddress: '0x2222222222222222222222222222222222222222',
    originChain: 'eip155:11155111',
    sourceChain: 'eip155:421614',
    steps: pushSteps,
  });
};

describe('swap failure stage classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitForTransactionReceipt.mockResolvedValue({ status: 'success' });
  });

  // 1xx is the UOA -> Push Chain route. 101-107 all run on the origin chain:
  // 105-02 is "Gas funding confirmed on origin chain" and 106-04 is "Origin
  // chain lock confirmed". Reporting them as Push Chain execution sends the
  // user to the wrong explorer for the leg that actually failed.
  it.each([
    'SEND-TX-101',
    'SEND-TX-102-01',
    'SEND-TX-103-04',
    'SEND-TX-104-04',
    'SEND-TX-105-02',
    'SEND-TX-106-02',
    'SEND-TX-106-03',
    'SEND-TX-106-04',
  ])('reports %s as a source-chain failure', async (id) => {
    const result = await runWithFailingProgressEvent(id);

    expect(result).toMatchObject({
      success: false,
      failure: { stage: 'source', eventId: id },
    });
  });

  // Control: 199 is the terminal Push Chain leg of the same route, so it must
  // keep reporting 'push'.
  it('reports the terminal Push leg 199-02 as a Push Chain failure', async () => {
    const result = await runWithFailingProgressEvent('SEND-TX-199-02');

    expect(result).toMatchObject({
      success: false,
      failure: { stage: 'push', eventId: 'SEND-TX-199-02' },
    });
  });

  // Control: 2xx is UEA -> Push -> CEA on the target chain, so it is the
  // destination and must not be reclassified.
  it('reports 2xx terminal failures as destination failures', async () => {
    const result = await runWithFailingProgressEvent('SEND-TX-299-02');

    expect(result).toMatchObject({
      success: false,
      failure: { stage: 'destination', eventId: 'SEND-TX-299-02' },
    });
  });
});
