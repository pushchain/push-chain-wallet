import { describe, expect, it } from 'vitest';
import type {
  WalletActivitiesResponse,
  WalletActivityTokenTransfer,
} from '../../../../types/walletactivities.types';
import {
  getActivityTokenDisplaySymbol,
  getRelevantActivityTokenTransfer,
  getVerifiedActivityAddressName,
} from './walletActivityDisplay';

const WALLET = '0x1111111111111111111111111111111111111111';
const POOL = '0x2222222222222222222222222222222222222222';
const OTHER = '0x3333333333333333333333333333333333333333';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const tokenTransfer = ({
  from,
  to,
  symbol,
  name,
  type = 'ERC-20',
}: {
  from: string;
  to: string;
  symbol?: string | null;
  name?: string | null;
  type?: string;
}): WalletActivityTokenTransfer => ({
  from: { hash: from },
  to: { hash: to },
  token: {
    address: '0x4444444444444444444444444444444444444444',
    decimals: '18',
    name,
    symbol,
    type,
  },
  total: {
    decimals: '18',
    value: '1000000000000000000',
  },
});

const transaction = (
  tokenTransfers: WalletActivityTokenTransfer[],
): WalletActivitiesResponse => ({
  hash: `0x${'a'.repeat(64)}`,
  value: '0',
  from: { hash: OTHER },
  to: { hash: WALLET },
  created_contract: null,
  token_transfers: tokenTransfers,
  timestamp: '2026-07-30T00:00:00.000Z',
  gas_used: '1',
  fee: { value: '0' },
  status: 'ok',
  transaction_types: ['token_transfer'],
  block_number: 1,
});

describe('wallet activity address display', () => {
  it('uses a verified explorer contract name', () => {
    expect(
      getVerifiedActivityAddressName({
        hash: '0x1111111111111111111111111111111111111111',
        name: '  OnChainChess  ',
        is_verified: true,
      }),
    ).toBe('OnChainChess');
  });

  it('does not trust names on unverified addresses', () => {
    expect(
      getVerifiedActivityAddressName({
        hash: '0x1111111111111111111111111111111111111111',
        name: 'chess.push.org',
        is_verified: false,
      }),
    ).toBeNull();
  });

  it('requires an explicit verification signal', () => {
    expect(
      getVerifiedActivityAddressName({
        hash: '0x1111111111111111111111111111111111111111',
        name: 'Untrusted label',
      }),
    ).toBeNull();
  });
});

describe('wallet activity token transfer selection', () => {
  it('prefers the underlying received asset over a minted debt token', () => {
    const debtToken = tokenTransfer({
      from: ZERO_ADDRESS,
      to: WALLET,
      symbol: 'debtUSDT',
    });
    const underlyingToken = tokenTransfer({
      from: POOL,
      to: WALLET,
      symbol: 'USDT',
    });

    expect(
      getRelevantActivityTokenTransfer(
        transaction([debtToken, underlyingToken]),
        [WALLET],
      ),
    ).toBe(underlyingToken);
  });

  it('prefers the underlying sent asset over a minted receipt token', () => {
    const receiptToken = tokenTransfer({
      from: ZERO_ADDRESS,
      to: WALLET,
      symbol: 'apETH',
    });
    const underlyingToken = tokenTransfer({
      from: WALLET,
      to: POOL,
      symbol: 'pETH',
    });

    expect(
      getRelevantActivityTokenTransfer(
        transaction([receiptToken, underlyingToken]),
        [WALLET],
      ),
    ).toBe(underlyingToken);
  });

  it('prefers the underlying returned asset over a burned receipt token', () => {
    const receiptToken = tokenTransfer({
      from: WALLET,
      to: ZERO_ADDRESS,
      symbol: 'apETH',
    });
    const underlyingToken = tokenTransfer({
      from: POOL,
      to: WALLET,
      symbol: 'pETH',
    });

    expect(
      getRelevantActivityTokenTransfer(
        transaction([receiptToken, underlyingToken]),
        [WALLET],
      ),
    ).toBe(underlyingToken);
  });

  it('retains a mint or burn when it is the only wallet transfer', () => {
    const debtToken = tokenTransfer({
      from: ZERO_ADDRESS,
      to: WALLET,
      symbol: 'debtCETRA',
    });

    expect(
      getRelevantActivityTokenTransfer(
        transaction([debtToken]),
        [WALLET],
      ),
    ).toBe(debtToken);
  });

  it('does not display an unrelated internal transfer', () => {
    const unrelated = tokenTransfer({
      from: POOL,
      to: OTHER,
      symbol: 'USDT',
    });

    expect(
      getRelevantActivityTokenTransfer(
        transaction([unrelated]),
        [WALLET],
      ),
    ).toBeUndefined();
  });
});

describe('wallet activity token metadata fallback', () => {
  it('uses the explorer token name when the symbol is unavailable', () => {
    expect(
      getActivityTokenDisplaySymbol(
        tokenTransfer({
          from: ZERO_ADDRESS,
          to: WALLET,
          symbol: null,
          name: 'Cetra Position',
        }),
      ),
    ).toBe('Cetra Position');
  });

  it.each(['ERC-721', 'ERC-1155'])(
    'identifies a symbol-less %s transfer as an NFT',
    (type) => {
      expect(
        getActivityTokenDisplaySymbol(
          tokenTransfer({
            from: ZERO_ADDRESS,
            to: WALLET,
            symbol: null,
            name: null,
            type,
          }),
        ),
      ).toBe('NFT');
    },
  );

  it('does not present the old Token fallback as verified metadata', () => {
    expect(
      getActivityTokenDisplaySymbol(
        tokenTransfer({
          from: ZERO_ADDRESS,
          to: WALLET,
          symbol: null,
          name: null,
        }),
      ),
    ).toBe('Unknown token');
  });
});
