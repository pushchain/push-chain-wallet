import { describe, expect, it, vi, afterEach } from 'vitest';
import { PhantomProvider } from './phantom';
import { ChainType } from '../../types/wallet.types';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const SIGNATURE = '0x' + 'ab'.repeat(65);

function ethereumStub() {
	return {
		isConnected: true,
		request: vi.fn(async ({ method }: { method: string }) => {
			if (method === 'eth_accounts' || method === 'eth_requestAccounts')
				return [ACCOUNT];
			if (method === 'eth_chainId') return '0xaa36a7';
			if (method === 'eth_signTypedData_v4') return SIGNATURE;
			return null;
		}),
	};
}

const typedData = {
	domain: {
		version: '0.1.0',
		chainId: 11155111,
		verifyingContract: '0x2222222222222222222222222222222222222222',
	},
	types: {
		UniversalPayload: [
			{ name: 'to', type: 'address' },
			{ name: 'value', type: 'uint256' },
		],
	},
	primaryType: 'UniversalPayload',
	message: { to: '0x3333333333333333333333333333333333333333', value: '1' },
};

afterEach(() => {
	// @ts-expect-error test global
	delete window.phantom;
	// @ts-expect-error test global
	delete window.ethereum;
});

/**
 * Phantom injects under `window.phantom`, not `window.ethereum`. A second
 * injected EVM wallet (MetaMask et al) claims `window.ethereum`.
 */
function injected(phantomEth: unknown, legacyEth: unknown) {
	// @ts-expect-error test global
	window.phantom = { ethereum: phantomEth };
	// @ts-expect-error test global
	window.ethereum = legacyEth;
}

describe('PhantomProvider.signTypedData', () => {
	it('signs through Phantom when it is the only injected EVM wallet', async () => {
		const phantom = ethereumStub();
		injected(phantom, undefined);

		const provider = new PhantomProvider() as unknown as {
		connect: (c: ChainType) => Promise<unknown>;
		signTypedData: (t: unknown) => Promise<Uint8Array>;
	};
		await provider.connect(ChainType.ETHEREUM);

		const sig = await provider.signTypedData(typedData);

		expect(Array.from(sig)).toEqual(
			SIGNATURE.slice(2).match(/../g)!.map((b) => parseInt(b, 16)),
		);
		expect(phantom.request).toHaveBeenCalledWith({
			method: 'eth_signTypedData_v4',
			params: [ACCOUNT, expect.any(String)],
		});
	});

	it('does not route the signature to another installed EVM wallet', async () => {
		const phantom = ethereumStub();
		const other = ethereumStub();
		injected(phantom, other);

		const provider = new PhantomProvider() as unknown as {
		connect: (c: ChainType) => Promise<unknown>;
		signTypedData: (t: unknown) => Promise<Uint8Array>;
	};
		await provider.connect(ChainType.ETHEREUM);

		await provider.signTypedData(typedData);

		expect(phantom.request).toHaveBeenCalledWith({
			method: 'eth_signTypedData_v4',
			params: [ACCOUNT, expect.any(String)],
		});
		expect(other.request).not.toHaveBeenCalledWith(
			expect.objectContaining({ method: 'eth_signTypedData_v4' }),
		);
	});
});
