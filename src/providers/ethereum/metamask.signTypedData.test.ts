import { describe, expect, it, vi } from 'vitest';
import { MetamaskProvider } from './metamask';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const SIGNATURE = '0x' + 'ab'.repeat(65);

/**
 * viem types EIP-712 `uint256` fields as `bigint`, so a payload built with it
 * carries real bigints. `JSON.stringify` throws on those, which used to abort
 * the signature before the request was ever sent.
 */
const bigintTypedData = {
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
  message: { to: ACCOUNT, value: 5n },
};

function signTypedDataWithStub(typedData: unknown) {
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts')
      return [ACCOUNT];
    if (method === 'eth_chainId') return '0xaa36a7';
    if (method === 'eth_signTypedData_v4') return SIGNATURE;
    return null;
  });

  const provider = new MetamaskProvider() as unknown as {
    getProvider: () => { request: typeof request };
    connectedChainType: string;
    signTypedData: (data: unknown) => Promise<Uint8Array>;
  };
  provider.getProvider = () => ({ request });
  provider.connectedChainType = 'ETHEREUM';

  return provider.signTypedData(typedData as never).then((signature) => ({
    signature,
    request,
  }));
}

describe('MetamaskProvider.signTypedData', () => {
  it('signs a payload carrying bigint values', async () => {
    const { signature, request } = await signTypedDataWithStub(bigintTypedData);

    expect(signature).toHaveLength(65);

    const call = request.mock.calls.find(
      ([arg]) => arg.method === 'eth_signTypedData_v4',
    );
    const sent = JSON.parse(call?.[0].params[1] as string);
    expect(sent.message.value).toBe('5');
  });
});