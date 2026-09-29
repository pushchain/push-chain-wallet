import { describe, expect, it, vi } from 'vitest';
import { ChainType } from '../../types/wallet.types';
import { isUnknownChainError, switchOrAddEvmChain } from './switchEvmChain';

const SEPOLIA_HEX = '0xaa36a7';
const DONUT_HEX = '0xa475'; // 42101

type Request = { method: string; params?: [{ chainId: string } & Record<string, unknown>] };

const walletError = (code: number, message = 'error') =>
  Object.assign(new Error(message), { code });

/**
 * Wallet that rejects the first switch with `firstSwitchError`, records adds,
 * and only changes chain on an explicit switch.
 */
function makeWallet(firstSwitchError?: Error, addError?: Error) {
  const calls: Request[] = [];
  let current = '0x1';
  let failNextSwitch = !!firstSwitchError;

  const request = vi.fn(async ({ method, params }: Request) => {
    calls.push({ method, params });
    if (method === 'wallet_switchEthereumChain') {
      if (failNextSwitch) {
        failNextSwitch = false;
        throw firstSwitchError;
      }
      current = params![0].chainId;
      return null;
    }
    if (method === 'wallet_addEthereumChain') {
      if (addError) throw addError;
      return null;
    }
    throw new Error(`unexpected method ${method}`);
  });

  return { request, calls, currentChainId: () => current };
}

describe('isUnknownChainError', () => {
  it.each([
    [walletError(4902), true],
    [walletError(-32603), true],
    [new Error('Unrecognized chain ID "0xa475".'), true],
    [walletError(4001, 'User rejected the request'), false],
    [undefined, false],
  ])('%s -> %s', (err, expected) => {
    expect(isUnknownChainError(err)).toBe(expected);
  });
});

describe('switchOrAddEvmChain', () => {
  it('only switches when the wallet knows the chain', async () => {
    const wallet = makeWallet();

    await switchOrAddEvmChain(wallet, ChainType.ETHEREUM);

    expect(wallet.calls.map((c) => c.method)).toEqual(['wallet_switchEthereumChain']);
    expect(wallet.currentChainId()).toBe(SEPOLIA_HEX);
  });

  it.each([
    ['4902 (desktop)', walletError(4902)],
    ['-32603 (MetaMask Mobile)', walletError(-32603)],
    ['message only', new Error('Unrecognized chain ID')],
  ])('adds then switches on %s', async (_, err) => {
    const wallet = makeWallet(err);

    await switchOrAddEvmChain(wallet, ChainType.PUSH_WALLET);

    expect(wallet.calls.map((c) => c.method)).toEqual([
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'wallet_switchEthereumChain',
    ]);
    expect(wallet.currentChainId()).toBe(DONUT_HEX);
  });

  it('sends EIP-3085 add params with hex chainId and array URLs', async () => {
    const wallet = makeWallet(walletError(4902));

    await switchOrAddEvmChain(wallet, ChainType.PUSH_WALLET);

    const add = wallet.calls.find((c) => c.method === 'wallet_addEthereumChain')!;
    expect(add.params![0]).toEqual({
      chainId: DONUT_HEX,
      chainName: 'Push Testnet Donut',
      rpcUrls: ['https://evm.donut.rpc.push.org/'],
      nativeCurrency: { decimals: 18, name: 'PUSH Chain', symbol: 'PC' },
      blockExplorerUrls: ['https://donut.push.network/'],
    });
  });

  it('rethrows a switch failure that is not an unknown chain', async () => {
    const wallet = makeWallet(walletError(4001, 'User rejected the request'));

    await expect(switchOrAddEvmChain(wallet, ChainType.ETHEREUM)).rejects.toThrow(
      'User rejected the request'
    );
    expect(wallet.calls.map((c) => c.method)).toEqual(['wallet_switchEthereumChain']);
  });

  it('rethrows when adding the chain fails', async () => {
    const wallet = makeWallet(walletError(4902), walletError(4001, 'User rejected add'));

    await expect(switchOrAddEvmChain(wallet, ChainType.PUSH_WALLET)).rejects.toThrow(
      'User rejected add'
    );
  });

  it('throws when there is no provider', async () => {
    await expect(switchOrAddEvmChain(undefined, ChainType.ETHEREUM)).rejects.toThrow(
      'Provider is undefined'
    );
  });

  it('throws for a chain type that is not an EVM chain', async () => {
    const wallet = makeWallet();

    await expect(switchOrAddEvmChain(wallet, ChainType.WALLET_CONNECT)).rejects.toThrow(
      'Unsupported EVM chain: walletConnect'
    );
    expect(wallet.request).not.toHaveBeenCalled();
  });
});
