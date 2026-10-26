import { describe, expect, it } from 'vitest';
import {
  formatFunctionSignature,
  functionSelector,
  parseAbiFile,
  parseFunctionSignature,
  writableFunctionsFromAbi,
} from './agenticWallet.functions';

describe('parseFunctionSignature', () => {
  it('accepts the canonical, Solidity, display and JSON forms', () => {
    expect(parseFunctionSignature('execute(bytes,bytes[],uint256)')).toBe('execute(bytes,bytes[],uint256)');
    expect(parseFunctionSignature('function execute(bytes commands, bytes[] inputs, uint256 deadline) payable')).toBe(
      'execute(bytes,bytes[],uint256)',
    );
    expect(parseFunctionSignature('execute bytes, bytes[], uint256')).toBe('execute(bytes,bytes[],uint256)');
    expect(
      parseFunctionSignature(
        '{"type":"function","name":"transfer","inputs":[{"type":"address","name":"to"},{"type":"uint256","name":"v"}],"outputs":[],"stateMutability":"nonpayable"}',
      ),
    ).toBe('transfer(address,uint256)');
  });

  it('keeps tuple parameters intact', () => {
    const sig = parseFunctionSignature(
      'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256)',
    );
    expect(sig).toBe('exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))');
    expect(functionSelector(sig!)).toBe('0x04e45aaf');
  });

  it('rejects things that are not functions', () => {
    expect(parseFunctionSignature('')).toBeNull();
    expect(parseFunctionSignature('not a function!!')).toBeNull();
    expect(parseFunctionSignature('event Transfer(address,address,uint256)')).toBeNull();
  });
});

describe('formatFunctionSignature', () => {
  it('shows "name (type, type)", with a readable label in place of the name', () => {
    expect(formatFunctionSignature('execute(bytes,bytes[],uint256)')).toBe('execute (bytes, bytes[], uint256)');
    expect(formatFunctionSignature('exactInputSingle((address,uint24),uint256)')).toBe(
      'exactInputSingle ((address, uint24), uint256)',
    );
    expect(formatFunctionSignature('increment()')).toBe('increment');
    expect(formatFunctionSignature('supply(address,uint256,address,uint16)', 'Supply')).toBe(
      'Supply (address, uint256, address, uint16)',
    );
    // A stored 4-byte selector has no parameters to show
    expect(formatFunctionSignature('0xdb006a75')).toBe('0xdb006a75');
  });

  it('round-trips through parse', () => {
    const display = formatFunctionSignature('execute(bytes,bytes[],uint256)');
    expect(parseFunctionSignature(display)).toBe('execute(bytes,bytes[],uint256)');
    const tuple = 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))';
    expect(parseFunctionSignature(formatFunctionSignature(tuple))).toBe(tuple);
    expect(parseFunctionSignature(formatFunctionSignature('increment()'))).toBe('increment()');
    // The earlier "name type, type" form still parses
    expect(parseFunctionSignature('execute bytes, bytes[], uint256')).toBe('execute(bytes,bytes[],uint256)');
  });
});

describe('ABI import', () => {
  const abi = [
    { type: 'function', name: 'swap', inputs: [{ type: 'uint256', name: 'a' }], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'quote', inputs: [], outputs: [{ type: 'uint256', name: '' }], stateMutability: 'view' },
    { type: 'event', name: 'Swapped', inputs: [], anonymous: false },
  ] as const;

  it('keeps only state-changing functions', () => {
    expect(writableFunctionsFromAbi(abi)).toEqual(['swap(uint256)']);
  });

  it('reads bare ABIs and build artifacts', () => {
    expect(parseAbiFile(JSON.stringify(abi))).toHaveLength(3);
    expect(parseAbiFile(JSON.stringify({ abi }))).toHaveLength(3);
    expect(parseAbiFile('{"not":"an abi"}')).toBeNull();
  });
});
