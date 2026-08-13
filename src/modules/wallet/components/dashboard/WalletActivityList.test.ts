import { describe, expect, it } from 'vitest';
import { WalletActivitiesResponse } from '../../../../types/walletactivities.types';
import { SwapActivityRecord } from '../swapComponent/swap.activity';
import { isSwapFundingTransaction } from './walletActivityDedupe';

const WALLET = '0x1111111111111111111111111111111111111111';

const transaction = (overrides: Partial<WalletActivitiesResponse> = {}) =>
  ({
    hash: '0xsource',
    value: '0',
    from: { hash: WALLET },
    to: { hash: '0x2222222222222222222222222222222222222222' },
    created_contract: null,
    timestamp: '2026-08-11T12:00:00.000Z',
    gas_used: '1',
    fee: { value: '1' },
    status: 'success',
    transaction_types: ['universal_tx'],
    block_number: 1,
    token_transfers: [
      {
        from: { hash: WALLET },
        to: { hash: '0x2222222222222222222222222222222222222222' },
        token: { symbol: 'USDT.eth', decimals: 6 },
        total: { value: '1000000', decimals: 6 },
      },
    ],
    ...overrides,
  }) as WalletActivitiesResponse;

const swap: SwapActivityRecord = {
  hash: '0xpush',
  type: 'swap',
  status: 'success',
  timestamp: Date.parse('2026-08-11T12:05:00.000Z'),
  tokensIn: [{ address: '0xtoken', symbol: 'USDT', amount: '1' }],
  tokensOut: [{ address: '0xtoken', symbol: 'USDT', amount: '0.42' }],
  transactionRefs: [],
};

describe('swap activity funding de-duplication', () => {
  it('recognizes a nearby universal transaction funding the swap input', () => {
    expect(isSwapFundingTransaction(transaction(), [swap], [WALLET])).toBe(
      true,
    );
  });

  it('keeps unrelated universal transactions', () => {
    expect(
      isSwapFundingTransaction(
        transaction({
          token_transfers: [
            {
              from: { hash: WALLET },
              token: { symbol: 'USDT.eth', decimals: 6 },
              total: { value: '2000000', decimals: 6 },
            },
          ],
        }),
        [swap],
        [WALLET],
      ),
    ).toBe(false);
  });
});
