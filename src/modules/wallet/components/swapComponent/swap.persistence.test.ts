import { describe, expect, it } from 'vitest';
import type { SwapExecutionRecord } from '../../../../context/SwapTransactionContext';
import {
  loadPersistedSwapExecutions,
  persistSuccessfulSwapExecutions,
  SWAP_EXECUTION_STORAGE_KEY,
  SWAP_EXECUTION_STORAGE_LIMIT,
  SWAP_EXECUTION_STORAGE_TTL_MS,
  SWAP_EXECUTION_STORAGE_VERSION,
} from './swap.persistence';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const NOW = Date.UTC(2026, 6, 30, 12);
const EXECUTOR = '0x1111111111111111111111111111111111111111';

const execution = (
  overrides: Partial<SwapExecutionRecord> = {},
): SwapExecutionRecord => ({
  executionId: 'swap-execution-1',
  executorAddress: EXECUTOR,
  hash: `0x${'a'.repeat(64)}`,
  type: 'swap',
  status: 'success',
  timestamp: NOW - 1_000,
  tokensIn: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      amount: '1',
      chain: 'eip155:11155111',
      decimals: 18,
    },
  ],
  tokensOut: [
    {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'WPC',
      amount: '18.22',
      chain: 'eip155:42101',
      decimals: 18,
    },
  ],
  sourceChain: 'eip155:11155111',
  destinationChain: 'eip155:42101',
  recordSource: 'local',
  transactionRefs: [
    {
      phase: 'push',
      chainId: 'eip155:42101',
      hash: `0x${'b'.repeat(64)}`,
    },
  ],
  ...overrides,
});

describe('successful swap execution persistence', () => {
  it('round-trips only successful records and strips diagnostic fields', () => {
    const storage = new MemoryStorage();
    const successful = execution({
      error: 'x-api-key: should-not-be-stored',
      failure: {
        stage: 'push',
        message: 'private diagnostic',
      },
    });
    const failed = execution({
      executionId: 'failed',
      hash: `0x${'c'.repeat(64)}`,
      status: 'failed',
      error: 'secret',
    });

    persistSuccessfulSwapExecutions([successful, failed], {
      storage,
      now: NOW,
    });

    const serialized = storage.getItem(SWAP_EXECUTION_STORAGE_KEY);
    expect(serialized).not.toContain('should-not-be-stored');
    expect(serialized).not.toContain('private diagnostic');
    expect(serialized).not.toContain('secret');

    expect(
      loadPersistedSwapExecutions({ storage, now: NOW }),
    ).toEqual([
      expect.objectContaining({
        executionId: successful.executionId,
        executorAddress: EXECUTOR,
        hash: successful.hash,
        status: 'success',
      }),
    ]);
  });

  it('persists only positive measured network costs', () => {
    const storage = new MemoryStorage();
    const values = [
      ['positive', '0.00012'],
      ['zero', '0'],
      ['malformed', 'not-a-cost'],
      ['estimated', '~0.00012'],
    ] as const;

    persistSuccessfulSwapExecutions(
      values.map(([executionId, networkCost], index) =>
        execution({
          executionId,
          hash: `0x${(index + 10).toString(16).padStart(64, '0')}`,
          networkCost,
          timestamp: NOW - index,
        }),
      ),
      { storage, now: NOW },
    );

    const restored = loadPersistedSwapExecutions({ storage, now: NOW });
    expect(
      restored.find((record) => record.executionId === 'positive'),
    ).toMatchObject({ networkCost: '0.00012' });
    for (const executionId of ['zero', 'malformed', 'estimated']) {
      expect(
        restored.find((record) => record.executionId === executionId),
      ).not.toHaveProperty('networkCost');
    }
  });

  it('ignores corrupt data and unsupported schema versions', () => {
    const storage = new MemoryStorage();
    storage.setItem(SWAP_EXECUTION_STORAGE_KEY, '{bad-json');
    expect(loadPersistedSwapExecutions({ storage, now: NOW })).toEqual([]);

    storage.setItem(
      SWAP_EXECUTION_STORAGE_KEY,
      JSON.stringify({
        version: SWAP_EXECUTION_STORAGE_VERSION + 1,
        records: [execution()],
      }),
    );
    expect(loadPersistedSwapExecutions({ storage, now: NOW })).toEqual([]);
  });

  it('drops expired and malformed records', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SWAP_EXECUTION_STORAGE_KEY,
      JSON.stringify({
        version: SWAP_EXECUTION_STORAGE_VERSION,
        records: [
          execution({
            timestamp: NOW - SWAP_EXECUTION_STORAGE_TTL_MS - 1,
          }),
          execution({
            executionId: 'wrong-account',
            hash: `0x${'d'.repeat(64)}`,
            executorAddress: 'not-an-address',
          }),
          execution({
            executionId: 'future',
            hash: `0x${'e'.repeat(64)}`,
            timestamp: NOW + 1,
          }),
        ],
      }),
    );

    expect(loadPersistedSwapExecutions({ storage, now: NOW })).toEqual([]);
  });

  it('keeps the newest unique records within the storage limit', () => {
    const storage = new MemoryStorage();
    const records = Array.from(
      { length: SWAP_EXECUTION_STORAGE_LIMIT + 5 },
      (_, index) =>
        execution({
          executionId: `swap-${index}`,
          hash: `0x${index.toString(16).padStart(64, '0')}`,
          timestamp: NOW - index,
        }),
    );
    records.push({
      ...records[0],
      executionId: 'older-duplicate',
      timestamp: NOW - 5_000,
    });

    persistSuccessfulSwapExecutions(records, { storage, now: NOW });
    const restored = loadPersistedSwapExecutions({ storage, now: NOW });

    expect(restored).toHaveLength(SWAP_EXECUTION_STORAGE_LIMIT);
    expect(restored[0].executionId).toBe('swap-0');
    expect(restored[restored.length - 1]?.executionId).toBe(
      `swap-${SWAP_EXECUTION_STORAGE_LIMIT - 1}`,
    );
    expect(
      restored.some((record) => record.executionId === 'older-duplicate'),
    ).toBe(false);
  });

  it('does not throw when browser storage is unavailable', () => {
    expect(() =>
      persistSuccessfulSwapExecutions([execution()], {
        storage: null,
        now: NOW,
      }),
    ).not.toThrow();
    expect(
      loadPersistedSwapExecutions({ storage: null, now: NOW }),
    ).toEqual([]);
  });
});
