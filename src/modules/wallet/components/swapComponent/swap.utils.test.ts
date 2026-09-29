import { describe, expect, it } from 'vitest';
import {
  doesSwapAmountExceedBalance,
  getDestinationTokens,
  getMaxSwapAmount,
  getSourceTokens,
  getSwapChainDisplayName,
  getSwapRecipientError,
  getSwapTokenDisplaySymbol,
  isSameToken,
  isValidSwapAmount,
  normalizeAmountInput,
  shortenSwapAddress,
} from './swap.utils';

describe('swap utilities', () => {
  it('accepts positive decimal amounts only', () => {
    expect(isValidSwapAmount('1')).toBe(true);
    expect(isValidSwapAmount('0.25')).toBe(true);
    expect(isValidSwapAmount('0')).toBe(false);
    expect(isValidSwapAmount('-1')).toBe(false);
    expect(isValidSwapAmount('1e3')).toBe(false);
  });

  it('normalizes leading decimals and enforces token precision', () => {
    expect(normalizeAmountInput('.5', 6)).toBe('0.5');
    expect(normalizeAmountInput('1.123456', 6)).toBe('1.123456');
    expect(normalizeAmountInput('1.1234567', 6)).toBeNull();
    expect(normalizeAmountInput('hello', 6)).toBeNull();
  });

  it('shortens receiver addresses for display', () => {
    expect(
      shortenSwapAddress('0x1919335B474AFF7654476eD155cAf13e220e459E'),
    ).toBe('0x191...e459E');
    expect(shortenSwapAddress('abc123')).toBe('abc123');
  });

  it('validates recipient addresses against the destination chain family', () => {
    const evmAddress = '0x1111111111111111111111111111111111111111';
    const solanaAddress = '11111111111111111111111111111111';

    expect(getSwapRecipientError(evmAddress, 'eip155:84532')).toBe('');
    expect(getSwapRecipientError(evmAddress, 'eip155:42101')).toBe('');
    expect(getSwapRecipientError(solanaAddress, 'eip155:84532')).toContain(
      'EVM',
    );
    expect(
      getSwapRecipientError(
        solanaAddress,
        'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      ),
    ).toBe('');
    expect(
      getSwapRecipientError(
        evmAddress,
        'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      ),
    ).toContain('Solana');
  });

  it('compares both token chain and address', () => {
    const token = {
      chain: 'eip155:42101',
      address: '0xabc',
      symbol: 'TEST',
      name: 'Test',
      decimals: 18,
      mechanism: 'approve' as const,
    };
    expect(isSameToken(token, { ...token, address: '0xABC' })).toBe(true);
    expect(isSameToken(token, { ...token, chain: 'eip155:1' })).toBe(false);
  });

  it('does not expose external tokens without a Push representation', () => {
    const ethereumSource = getSourceTokens('eip155:11155111');
    const solanaDestination = getDestinationTokens(
      'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    );

    expect(ethereumSource.map((token) => token.symbol)).toEqual([
      'ETH',
      'USDT',
      'USDC',
    ]);
    expect(solanaDestination.map((token) => token.symbol)).toEqual([
      'SOL',
      'USDT',
      'USDC',
    ]);
  });

  it('formats network and compact chain labels consistently', () => {
    expect(getSwapChainDisplayName('eip155:11155111')).toBe(
      'Ethereum Sepolia',
    );
    expect(
      getSwapChainDisplayName('eip155:11155111', 'family'),
    ).toBe('Ethereum');
    expect(getSwapChainDisplayName('eip155:42101', 'family')).toBe(
      'Push Chain',
    );
    expect(getSwapChainDisplayName('eip155:97', 'family')).toBe(
      'BNB Chain',
    );
  });

  it('uses the base symbol for bridged token variants', () => {
    expect(getSwapTokenDisplaySymbol('USDC.eth')).toBe('USDC');
    expect(getSwapTokenDisplaySymbol('USDT_bnb')).toBe('USDT');
    expect(getSwapTokenDisplaySymbol('WPC')).toBe('WPC');
  });

  it('reserves source-chain gas when MAX is used with a native token', () => {
    expect(
      getMaxSwapAmount(
        {
          chain: 'eip155:11155111',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          mechanism: 'native',
        },
        '1',
      ),
    ).toBe('0.999');
  });

  it('uses the complete ERC-20 balance and compares amounts in base units', () => {
    expect(
      getMaxSwapAmount(
        {
          chain: 'eip155:11155111',
          address: '0x1111111111111111111111111111111111111111',
          decimals: 6,
          mechanism: 'approve',
        },
        '9007199254740991.123456',
      ),
    ).toBe('9007199254740991.123456');
    expect(
      doesSwapAmountExceedBalance(
        '9007199254740991.123457',
        '9007199254740991.123456',
        6,
      ),
    ).toBe(true);
  });
});
