import { describe, expect, it, vi } from 'vitest';

vi.mock('../../blocks', () => ({
  DefaultChainMonotone: () => null,
  PushChainLogo: () => null,
}));

vi.mock('../Common.constants', () => ({
  CHAIN_LOGO: {},
}));

import { normalizeChainId } from './ChainIcon';

describe('chain icon identifiers', () => {
  it('normalizes CAIP and hexadecimal EVM identifiers', () => {
    expect(normalizeChainId('eip155:11155111')).toBe('11155111');
    expect(normalizeChainId('eip155:421614:0xabc')).toBe('421614');
    expect(normalizeChainId('0x14a75')).toBe('84597');
  });

  it('normalizes Solana CAIP identifiers to their network reference', () => {
    expect(
      normalizeChainId(
        'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      ),
    ).toBe('EtWTRABZaYq6iMfeYKouRu166VU2xqa1');
  });
});
