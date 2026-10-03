import { describe, expect, it } from 'vitest';
import { serializeTypedData } from './serializeTypedData';

const base = {
  domain: {
    name: 'Push Chain',
    version: '0.1.0',
    chainId: 11155111,
    verifyingContract: '0x2222222222222222222222222222222222222222',
  },
  primaryType: 'UniversalPayload',
  types: {
    UniversalPayload: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  },
};

describe('serializeTypedData', () => {
  it('serialises a bigint field as a decimal string', () => {
    const serialized = serializeTypedData({
      ...base,
      message: { to: '0x1111111111111111111111111111111111111111', value: 5n },
    });

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(JSON.parse(serialized).message.value).toBe('5');
  });

  it('serialises bigints nested in arrays and structs', () => {
    const serialized = serializeTypedData({
      ...base,
      message: { amounts: [1n, 2n], inner: { fee: 3n } },
    });

    expect(JSON.parse(serialized).message).toEqual({
      amounts: ['1', '2'],
      inner: { fee: '3' },
    });
  });

  it('leaves an all-string payload byte-identical to JSON.stringify', () => {
    const payload = {
      ...base,
      message: { to: '0x1111111111111111111111111111111111111111', value: '5' },
    };

    expect(serializeTypedData(payload)).toBe(JSON.stringify(payload));
  });
});