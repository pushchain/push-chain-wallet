import { afterEach, describe, expect, it, vi } from 'vitest';
import { switchNetwork } from './waapProvider';
import { ChainType } from '../types/wallet.types';

// 42101 = 0xa475 (pushWalletDonut), as viem's toHex renders it.
const DONUT_HEX = '0xa475';

/**
 * Models the real EIP-3326 / EIP-3085 handshake as `window.waap` exposes it:
 * switching to an unknown chain rejects, adding it registers the chain but does
 * NOT switch, and the chain is only active after an explicit
 * `wallet_switchEthereumChain`. `useWaapAuth.ensureConnected` switches to
 * `ChainType.PUSH_WALLET` on every auto-connect and login.
 *
 * `switchError` rejects only the FIRST switch, so the post-add switch can
 * succeed the way it does in a real wallet.
 */
function installWaap({ switchError }: { switchError?: unknown } = {}) {
	const added: Record<string, any>[] = [];
	const switched: string[] = [];
	let current = '0x1';
	let switches = 0;

	const waap = {
		request: vi.fn(async ({ method, params }: any) => {
			if (method === 'eth_chainId') return current;
			if (method === 'wallet_switchEthereumChain') {
				if (switchError !== undefined && switches === 0) {
					switches += 1;
					throw switchError;
				}
				const id = params[0].chainId;
				switched.push(id);
				current = id;
				return null;
			}
			if (method === 'wallet_addEthereumChain') {
				added.push(params[0]);
				return null;
			}
			throw new Error(`unexpected method ${method}`);
		}),
	};

	(window as any).waap = waap;

	return { added, switched, currentChainId: () => current };
}

const unknownChainError = () => {
	const err: any = new Error('Unrecognized chain ID');
	err.code = 4902;
	return err;
};

afterEach(() => {
	delete (window as any).waap;
	vi.restoreAllMocks();
});

describe('waapProvider.switchNetwork', () => {
	it('switches again after adding an unknown chain', async () => {
		const waap = installWaap({ switchError: unknownChainError() });

		await switchNetwork(ChainType.PUSH_WALLET);

		expect(waap.added).toHaveLength(1);
		// EIP-3085 add does not switch; without a second switch the wallet stays
		// on the old chain and the next transaction goes to the wrong network.
		expect(waap.switched).toEqual([DONUT_HEX]);
		expect(waap.currentChainId()).toBe(DONUT_HEX);
	});

	it('switches when the wallet already knows the chain', async () => {
		const waap = installWaap();

		await switchNetwork(ChainType.PUSH_WALLET);

		expect(waap.added).toEqual([]);
		expect(waap.switched).toEqual([DONUT_HEX]);
	});

	it('passes blockExplorerUrls as an array', async () => {
		const waap = installWaap({ switchError: unknownChainError() });

		await switchNetwork(ChainType.PUSH_WALLET);

		expect(Array.isArray(waap.added[0].blockExplorerUrls)).toBe(true);
		expect(waap.added[0].blockExplorerUrls).toEqual([
			'https://donut.push.network/',
		]);
	});

	it('rethrows a switch failure that is not an unknown chain', async () => {
		const denied: any = new Error('User rejected the request');
		denied.code = 4001;
		const waap = installWaap({ switchError: denied });

		await expect(switchNetwork(ChainType.PUSH_WALLET)).rejects.toThrow(
			'User rejected the request'
		);
		// A rejection must not be answered with an "add this chain" prompt.
		expect(waap.added).toEqual([]);
	});

	it('throws when WaaP is not initialised', async () => {
		delete (window as any).waap;

		await expect(switchNetwork(ChainType.PUSH_WALLET)).rejects.toThrow(
			'Provider is undefined'
		);
	});
});
