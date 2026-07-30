import { describe, expect, it } from 'vitest';
import {
  RamenActivity,
  SwapActivityRecord,
  buildPushTransactionExplorerUrl,
  buildSwapTrackingUrl,
  formatSwapActivityDateLabel,
  getSwapActivityIdentityHashes,
  getSwapActivityDateKey,
  groupSwapActivityRecordsByDate,
  mergeSwapActivityRecords,
  normalizeActivityTimestamp,
  normalizeRamenSwapActivity,
  shortenTransactionHash,
} from './swap.activity';

const HASH_A =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HASH_B =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const HASH_C =
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const HASH_D =
  '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

const ramenActivity = (
  overrides: Partial<RamenActivity> = {},
): RamenActivity => ({
  hash: HASH_A,
  type: 'swap',
  status: 'success',
  user: '0x1111111111111111111111111111111111111111',
  timestamp: 1_767_268_800,
  sourceChain: 'eip155:11155111',
  destinationChain: 'eip155:42101',
  networkCost: '0.00012',
  tokensIn: [
    {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'USDC',
      amount: '95',
      chainId: 'eip155:11155111',
      chainName: 'Ethereum Sepolia',
    },
  ],
  tokensOut: [
    {
      address: '0x3333333333333333333333333333333333333333',
      symbol: 'USDT',
      amount: '94.995',
      chainId: 'eip155:42101',
      chainName: 'Push Testnet Donut',
    },
  ],
  ...overrides,
});

const swapRecord = (
  overrides: Partial<SwapActivityRecord> = {},
): SwapActivityRecord => ({
  hash: HASH_A,
  type: 'swap',
  status: 'success',
  timestamp: Date.UTC(2026, 0, 1, 12),
  tokensIn: [
    {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'USDC',
      amount: '95',
      chain: 'eip155:11155111',
    },
  ],
  tokensOut: [
    {
      address: '0x3333333333333333333333333333333333333333',
      symbol: 'USDT',
      amount: '94.995',
      chain: 'eip155:42101',
    },
  ],
  ...overrides,
});

describe('swap activity timestamp normalization', () => {
  it('normalizes epoch seconds, epoch milliseconds, numeric strings, and ISO dates', () => {
    expect(normalizeActivityTimestamp(1_767_268_800)).toBe(
      1_767_268_800_000,
    );
    expect(normalizeActivityTimestamp(1_767_268_800_123)).toBe(
      1_767_268_800_123,
    );
    expect(normalizeActivityTimestamp('1767268800')).toBe(
      1_767_268_800_000,
    );
    expect(normalizeActivityTimestamp('2026-01-01T12:00:00.000Z')).toBe(
      Date.UTC(2026, 0, 1, 12),
    );
  });

  it('rejects missing and invalid timestamps', () => {
    expect(normalizeActivityTimestamp(undefined)).toBeNull();
    expect(normalizeActivityTimestamp('not-a-date')).toBeNull();
    expect(normalizeActivityTimestamp(Number.NaN)).toBeNull();
    expect(normalizeActivityTimestamp(new Date('invalid'))).toBeNull();
  });
});

describe('Ramen swap activity normalization', () => {
  it.each([
    'swap',
    'cross_chain_deposit',
    'cross_chain_withdrawal',
  ] as const)('normalizes a complete %s activity', (type) => {
    const normalized = normalizeRamenSwapActivity(ramenActivity({ type }));

    expect(normalized).toMatchObject({
      hash: HASH_A,
      type,
      status: 'success',
      timestamp: 1_767_268_800_000,
      sourceChain: 'eip155:11155111',
      destinationChain: 'eip155:42101',
      networkCost: '0.00012',
      explorerHash: HASH_A,
      explorerUrl: `https://donut.push.network/tx/${HASH_A}`,
      recordSource: 'remote',
    });
    expect(normalized?.tokensIn[0]).toMatchObject({
      symbol: 'USDC',
      amount: '95',
      chain: 'eip155:11155111',
    });
    expect(normalized?.tokensOut[0]).toMatchObject({
      symbol: 'USDT',
      amount: '94.995',
      chain: 'eip155:42101',
    });
  });

  it('uses token chain IDs when top-level route chains are absent', () => {
    const normalized = normalizeRamenSwapActivity(
      ramenActivity({
        sourceChain: undefined,
        destinationChain: undefined,
      }),
    );

    expect(normalized?.sourceChain).toBe('eip155:11155111');
    expect(normalized?.destinationChain).toBe('eip155:42101');
  });

  it.each([
    '0',
    '0.000000',
    '-0.00012',
    'not-a-cost',
    '~0.00012',
    '<0.000001',
  ])('omits an unusable or estimated network cost of %s', (networkCost) => {
    const normalized = normalizeRamenSwapActivity(
      ramenActivity({ networkCost }),
    );

    expect(normalized).not.toHaveProperty('networkCost');
  });

  it('excludes unsupported and incomplete activities', () => {
    expect(
      normalizeRamenSwapActivity(
        ramenActivity({ type: 'add_liquidity' }),
      ),
    ).toBeNull();
    expect(
      normalizeRamenSwapActivity(ramenActivity({ tokensOut: [] })),
    ).toBeNull();
    expect(
      normalizeRamenSwapActivity(
        ramenActivity({ timestamp: 'invalid' }),
      ),
    ).toBeNull();
  });
});

describe('swap activity merging', () => {
  it('normalizes and deduplicates every known operation hash', () => {
    expect(
      getSwapActivityIdentityHashes(
        swapRecord({
          hash: HASH_A.toUpperCase(),
          submittedHash: HASH_B,
          explorerHash: HASH_A,
          transactionRefs: [
            {
              phase: 'push',
              chainId: 'eip155:42101',
              hash: HASH_C,
            },
            {
              phase: 'push',
              chainId: 'eip155:42101',
              hash: HASH_C.toUpperCase(),
            },
          ],
        }),
      ),
    ).toEqual([HASH_A, HASH_B, HASH_C]);
  });

  it('dedupes hashes case-insensitively, prefers remote values, and preserves richer local fallbacks', () => {
    const local = swapRecord({
      hash: HASH_A.toUpperCase(),
      timestamp: Date.UTC(2026, 0, 1, 11),
      sourceChain: 'eip155:11155111',
      destinationChain: 'eip155:42101',
      submittedHash: HASH_B,
      submittedChain: 'eip155:11155111',
      trackUrl: `https://donut.push.network/track?utx=eip155:11155111:${HASH_B}`,
      explorerUrl: 'https://fallback.example/transaction',
      recordSource: 'local',
      tokensIn: [
        {
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'USDC',
          amount: '95.1',
          chain: 'eip155:11155111',
          name: 'USD Coin',
          decimals: 6,
        },
      ],
    });
    const remote = swapRecord({
      hash: HASH_A,
      timestamp: Date.UTC(2026, 0, 1, 12),
      networkCost: '0.00042',
      explorerUrl: `https://donut.push.network/tx/${HASH_A}`,
      recordSource: 'remote',
      tokensIn: [
        {
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'USDC',
          amount: '95',
          chain: 'eip155:11155111',
          chainName: 'Ethereum Sepolia',
        },
      ],
    });

    const result = mergeSwapActivityRecords([remote], [local]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      hash: HASH_A,
      timestamp: Date.UTC(2026, 0, 1, 12),
      networkCost: '0.00042',
      explorerUrl: `https://donut.push.network/tx/${HASH_A}`,
      submittedHash: HASH_B,
      submittedChain: 'eip155:11155111',
      recordSource: 'remote',
    });
    expect(result[0].tokensIn[0]).toMatchObject({
      amount: '95',
      chainName: 'Ethereum Sepolia',
      name: 'USD Coin',
      decimals: 6,
    });
  });

  it('merges a remote canonical hash with a local submitted-hash alias', () => {
    const local = swapRecord({
      hash: HASH_A,
      submittedHash: HASH_B.toUpperCase(),
      submittedChain: 'eip155:11155111',
      recordSource: 'local',
    });
    const remote = swapRecord({
      hash: HASH_B,
      timestamp: Date.UTC(2026, 0, 1, 13),
      networkCost: '0.0007',
      recordSource: 'remote',
    });

    const result = mergeSwapActivityRecords([remote], [local]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      hash: HASH_B,
      submittedHash: HASH_B.toUpperCase(),
      submittedChain: 'eip155:11155111',
      networkCost: '0.0007',
      recordSource: 'remote',
    });
  });

  it('does not let an unusable remote cost replace a measured explorer cost', () => {
    const explorer = swapRecord({
      networkCost: '0.000288454',
      recordSource: 'local',
    });
    const remote = swapRecord({
      networkCost: '0',
      recordSource: 'remote',
    });

    const result = mergeSwapActivityRecords([remote], [explorer]);

    expect(result[0]?.networkCost).toBe('0.000288454');
  });

  it('merges records when a transaction reference aliases the remote hash', () => {
    const local = swapRecord({
      hash: HASH_A,
      recordSource: 'local',
      transactionRefs: [
        {
          phase: 'push',
          chainId: 'eip155:42101',
          hash: HASH_B,
        },
      ],
    });
    const remote = swapRecord({
      hash: HASH_B,
      recordSource: 'remote',
    });

    const result = mergeSwapActivityRecords([remote], [local]);

    expect(result).toHaveLength(1);
    expect(result[0].transactionRefs).toEqual(local.transactionRefs);
    expect(result[0].recordSource).toBe('remote');
  });

  it('collapses all source, Push, and destination legs transitively', () => {
    const local = swapRecord({
      hash: HASH_A,
      submittedHash: HASH_B,
      recordSource: 'local',
      transactionRefs: [
        {
          phase: 'push',
          chainId: 'eip155:42101',
          hash: HASH_A,
        },
        {
          phase: 'source',
          chainId: 'eip155:11155111',
          hash: HASH_B,
        },
        {
          phase: 'push',
          chainId: 'eip155:42101',
          hash: HASH_C,
        },
        {
          phase: 'destination',
          chainId: 'eip155:84532',
          hash: HASH_D,
        },
      ],
    });
    const remotePush = swapRecord({
      hash: HASH_C,
      timestamp: Date.UTC(2026, 0, 1, 13),
      recordSource: 'remote',
    });
    const remoteDestination = swapRecord({
      hash: HASH_D,
      timestamp: Date.UTC(2026, 0, 1, 14),
      recordSource: 'remote',
    });

    const result = mergeSwapActivityRecords(
      [remotePush, remoteDestination],
      [local],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      hash: HASH_D,
      submittedHash: HASH_B,
      timestamp: Date.UTC(2026, 0, 1, 14),
      recordSource: 'remote',
    });
    expect(getSwapActivityIdentityHashes(result[0])).toEqual([
      HASH_D,
      HASH_B,
      HASH_A,
      HASH_C,
    ]);
  });

  it('does not merge unrelated swaps with identical tokens, amounts, and timestamps', () => {
    const first = swapRecord({ hash: HASH_A });
    const second = swapRecord({ hash: HASH_B });

    const result = mergeSwapActivityRecords([first, second]);

    expect(result).toHaveLength(2);
    expect(result.map((record) => record.hash)).toEqual([HASH_A, HASH_B]);
  });

  it('sorts merged records newest first', () => {
    const older = swapRecord({
      hash: HASH_A,
      timestamp: Date.UTC(2026, 0, 1),
    });
    const newer = swapRecord({
      hash: HASH_B,
      timestamp: Date.UTC(2026, 0, 2),
    });

    expect(
      mergeSwapActivityRecords([older, newer]).map((record) => record.hash),
    ).toEqual([HASH_B, HASH_A]);
  });
});

describe('swap activity date grouping', () => {
  it('groups by the requested local calendar day and labels each group', () => {
    const lateJanuaryFirst = swapRecord({
      hash: HASH_A,
      timestamp: Date.UTC(2026, 0, 2, 0, 30),
    });
    const earlyJanuaryFirst = swapRecord({
      hash: HASH_B,
      timestamp: Date.UTC(2026, 0, 1, 18),
    });

    const groups = groupSwapActivityRecordsByDate(
      [earlyJanuaryFirst, lateJanuaryFirst],
      {
        locale: 'en-US',
        timeZone: 'America/Los_Angeles',
      },
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('2026-01-01');
    expect(groups[0].label).toBe('January 1, 2026');
    expect(groups[0].activities.map((activity) => activity.hash)).toEqual([
      HASH_A,
      HASH_B,
    ]);
  });

  it('exposes matching date key and label helpers', () => {
    const timestamp = Date.UTC(2026, 6, 17, 12);
    const options = { locale: 'en-US', timeZone: 'UTC' };

    expect(getSwapActivityDateKey(timestamp, options)).toBe('2026-07-17');
    expect(formatSwapActivityDateLabel(timestamp, options)).toBe(
      'July 17, 2026',
    );
  });
});

describe('swap transaction URLs and hash formatting', () => {
  it('builds the universal transaction tracking URL from a CAIP chain and submitted hash', () => {
    expect(buildSwapTrackingUrl('eip155:11155111', HASH_A)).toBe(
      `https://donut.push.network/track?utx=eip155:11155111:${HASH_A}`,
    );
  });

  it('builds Push explorer transaction URLs and handles trailing base slashes', () => {
    expect(
      buildPushTransactionExplorerUrl(
        HASH_A,
        'https://donut.push.network/',
      ),
    ).toBe(`https://donut.push.network/tx/${HASH_A}`);
  });

  it('rejects unsafe or incomplete tracking values', () => {
    expect(buildSwapTrackingUrl('11155111', HASH_A)).toBeNull();
    expect(
      buildSwapTrackingUrl(
        'eip155:11155111',
        `${HASH_A}?redirect=example`,
      ),
    ).toBeNull();
    expect(buildPushTransactionExplorerUrl('')).toBeNull();
  });

  it('shortens valid hashes without changing short values', () => {
    expect(shortenTransactionHash(HASH_A)).toBe(
      '0xaaaaaa…aaaaaaaa',
    );
    expect(shortenTransactionHash('abc123')).toBe('abc123');
    expect(shortenTransactionHash(undefined)).toBe('—');
  });
});
