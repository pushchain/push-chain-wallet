import { describe, expect, it } from 'vitest';
import type { WalletActivitiesResponse } from '../../../../types/walletactivities.types';
import { PUSH_CHAIN_ID } from './swap.constants';
import { normalizeExplorerSwapActivity } from './swap.explorer-activity';

const HASH =
  '0x7b49326c256927c4d6381ccda7aa6310d32be7bf3b2a2fc7a75922d8fb07167d';
const EXECUTOR = '0xd8dd20ff91DBf06803E890E9B48B49D8af482844';
const POOL = '0x012d5C099f8AE00009f40824317a18c3A342f622';
const OTHER_USER = '0x1111111111111111111111111111111111111111';

const transaction = (
  overrides: Partial<WalletActivitiesResponse> = {},
): WalletActivitiesResponse => ({
  hash: HASH,
  value: '0',
  from: { hash: '0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7' },
  to: { hash: EXECUTOR },
  created_contract: null,
  timestamp: '2026-07-30T07:19:52.000000Z',
  gas_used: '288454',
  fee: { value: '0' },
  status: 'ok',
  transaction_types: ['contract_call', 'token_transfer'],
  block_number: 20347668,
  has_swap_event: true,
  token_transfers: [
    {
      from: { hash: POOL },
      to: { hash: EXECUTOR },
      token: {
        address: '0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9',
        decimals: '18',
        name: 'Wrapped PC',
        symbol: 'WPC',
      },
      total: {
        decimals: '18',
        value: '18225380654551171160',
      },
    },
    {
      from: { hash: EXECUTOR },
      to: { hash: POOL },
      token: {
        address: '0x2971824Db68229D087931155C2b8bB820B275809',
        decimals: '18',
        name: 'pETH',
        symbol: 'pETH',
      },
      total: {
        decimals: '18',
        value: '1000000000000000',
      },
    },
  ],
  ...overrides,
});

describe('explorer swap activity normalization', () => {
  it('recovers the persisted ETH to WPC swap from its Swap event and token flows', () => {
    const result = normalizeExplorerSwapActivity(transaction(), [
      `eip155:42101:${EXECUTOR}`,
    ]);

    expect(result).toMatchObject({
      hash: HASH,
      type: 'swap',
      status: 'success',
      sourceChain: 'eip155:11155111',
      destinationChain: PUSH_CHAIN_ID,
      tokensIn: [
        {
          symbol: 'ETH',
          amount: '0.001',
          chain: 'eip155:11155111',
        },
      ],
      tokensOut: [
        {
          symbol: 'WPC',
          amount: '18.22538065455117116',
          chain: PUSH_CHAIN_ID,
        },
      ],
      transactionRefs: [
        {
          phase: 'push',
          chainId: PUSH_CHAIN_ID,
          hash: HASH,
        },
      ],
    });
  });

  it('derives a positive network cost from gas used and base fee when the actual fee is zero', () => {
    const result = normalizeExplorerSwapActivity(
      transaction({
        fee: { value: '0' },
        gas_used: '288454',
        base_fee_per_gas: '1000000000',
      }),
      [EXECUTOR],
    );

    expect(result?.networkCost).toBe('0.000288454');
  });

  it('prefers a positive actual fee over the gas-used base-fee fallback', () => {
    const result = normalizeExplorerSwapActivity(
      transaction({
        fee: { value: '420000000000000' },
        gas_used: '288454',
        base_fee_per_gas: '1000000000',
      }),
      [EXECUTOR],
    );

    expect(result?.networkCost).toBe('0.00042');
  });

  it.each([
    {},
    { gas_used: '288454', base_fee_per_gas: '0' },
    { gas_used: 'not-gas', base_fee_per_gas: '1000000000' },
    { gas_used: '288454', base_fee_per_gas: 'not-a-fee' },
  ])(
    'omits network cost when neither the actual fee nor usable base-fee data is available',
    (overrides) => {
      const result = normalizeExplorerSwapActivity(
        transaction({
          fee: { value: '0' },
          ...overrides,
        }),
        [EXECUTOR],
      );

      expect(result).not.toHaveProperty('networkCost');
    },
  );

  it('does not infer a swap without the canonical receipt event', () => {
    expect(
      normalizeExplorerSwapActivity(
        transaction({ has_swap_event: false }),
        [EXECUTOR],
      ),
    ).toBeNull();
  });

  it('rejects reverted and incomplete token flows', () => {
    expect(
      normalizeExplorerSwapActivity(
        transaction({ status: 'error' }),
        [EXECUTOR],
      ),
    ).toBeNull();
    expect(
      normalizeExplorerSwapActivity(
        transaction({ token_transfers: transaction().token_transfers?.slice(0, 1) }),
        [EXECUTOR],
      ),
    ).toBeNull();
  });

  it('does not classify a user-to-user send as a swap', () => {
    expect(
      normalizeExplorerSwapActivity(
        transaction({
          token_transfers: [
            {
              from: { hash: EXECUTOR },
              to: { hash: OTHER_USER },
              token: {
                address: '0x2971824Db68229D087931155C2b8bB820B275809',
                decimals: '18',
                name: 'pETH',
                symbol: 'pETH',
              },
              total: {
                decimals: '18',
                value: '1000000000000000',
              },
            },
          ],
        }),
        [EXECUTOR],
      ),
    ).toBeNull();
  });

  it('does not classify a user-to-user receive as a swap', () => {
    expect(
      normalizeExplorerSwapActivity(
        transaction({
          token_transfers: [
            {
              from: { hash: OTHER_USER },
              to: { hash: EXECUTOR },
              token: {
                address: '0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9',
                decimals: '18',
                name: 'Wrapped PC',
                symbol: 'WPC',
              },
              total: {
                decimals: '18',
                value: '18225380654551171160',
              },
            },
          ],
        }),
        [EXECUTOR],
      ),
    ).toBeNull();
  });
});
