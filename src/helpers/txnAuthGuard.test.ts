import { PushChain } from '@pushchain/core';
import { describe, expect, it, vi } from 'vitest';
import { createGuardedPushChain } from './txnAuthGuard';

const createClient = () => {
  const universal = {
    sendTransaction: vi.fn(),
    prepareTransaction: vi.fn(),
    executeTransactions: vi.fn(),
    signMessage: vi.fn(),
    signTypedData: vi.fn(),
  };
  const baseClient = {
    universal,
    isReadMode: false,
    accountStatusReady: Promise.resolve(),
    accountStatus: {
      uea: {
        loaded: true,
        requiresUpgrade: true,
        version: 1,
        minRequiredVersion: 2,
      },
    },
  } as unknown as PushChain;

  return { baseClient, universal };
};

describe('guarded Push Chain cascade writes', () => {
  it.each(['prepareTransaction', 'executeTransactions'] as const)(
    'guards %s with the same account-upgrade check as sendTransaction',
    async (method) => {
      const { baseClient, universal } = createClient();
      const dispatch = vi.fn();
      const guarded = createGuardedPushChain(
        baseClient,
        vi.fn(),
        vi.fn(),
        {} as never,
        {
          network:
            PushChain.CONSTANTS.PUSH_NETWORK.TESTNET_DONUT,
        },
        undefined,
        dispatch,
      );

      await expect(
        (
          guarded.universal[method] as unknown as (
            ...args: unknown[]
          ) => Promise<unknown>
        )({}),
      ).rejects.toThrow(
        'Account upgrade required before performing write operations',
      );
      expect(universal[method]).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SHOW_UPGRADE_DRAWER' }),
      );
    },
  );
});
