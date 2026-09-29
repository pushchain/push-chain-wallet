import { describe, expect, it, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  SwapEvmBalanceClient,
  SwapSolanaConnection,
  fetchEvmSwapBalances,
  fetchSolanaSwapBalances,
  getSwapBalanceQueryKey,
  getSwapTokenKey,
  resolveSwapAccount,
} from './swap.balances';
import { PUSH_CHAIN_ID, ZERO_ADDRESS } from './swap.constants';
import { SwapToken } from './swap.types';

const EVM_CHAIN = 'eip155:11155111';
const SOLANA_CHAIN =
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const ACCOUNT = '0x1111111111111111111111111111111111111111';

const nativeToken = (
  chain: string,
  symbol: string,
  decimals = 18,
): SwapToken => ({
  chain,
  address: ZERO_ADDRESS,
  symbol,
  name: symbol,
  decimals,
  mechanism: 'native',
});

const contractToken = (
  chain: string,
  address: string,
  symbol: string,
  decimals: number,
): SwapToken => ({
  chain,
  address,
  symbol,
  name: symbol,
  decimals,
  mechanism: 'approve',
});

describe('swap balance keys', () => {
  it('normalizes EVM addresses but preserves Solana mint casing', () => {
    const evmToken = contractToken(
      EVM_CHAIN,
      '0xA8802F96cAd0d45343d9bc660B6f7d80050A660b',
      'USDC',
      6,
    );
    const solanaToken = contractToken(
      SOLANA_CHAIN,
      'EiXDnrAg9ea2Q6vEPV7E5TpTU1vh41jcuZqKjU5Dc4ZF',
      'USDT',
      6,
    );

    expect(getSwapTokenKey(evmToken)).toContain(
      evmToken.address.toLowerCase(),
    );
    expect(getSwapTokenKey(solanaToken)).toContain(
      solanaToken.address,
    );
  });

  it('isolates cached balances by account', () => {
    const tokens = [nativeToken(EVM_CHAIN, 'ETH')];
    const first = getSwapBalanceQueryKey({
      chain: EVM_CHAIN,
      account: ACCOUNT,
      tokens,
    });
    const second = getSwapBalanceQueryKey({
      chain: EVM_CHAIN,
      account: '0x2222222222222222222222222222222222222222',
      tokens,
    });

    expect(first).not.toEqual(second);
  });
});

describe('resolveSwapAccount', () => {
  it('uses the Push executor on Push Chain without derivation', async () => {
    const deriveExecutorAccount = vi.fn();
    const result = await resolveSwapAccount({
      chain: PUSH_CHAIN_ID,
      executorAddress: ACCOUNT,
      origin: {
        chain: EVM_CHAIN,
        address: '0x3333333333333333333333333333333333333333',
      },
      deriveExecutorAccount,
    });

    expect(result).toBe(ACCOUNT);
    expect(deriveExecutorAccount).not.toHaveBeenCalled();
  });

  it('uses the connected EOA on its origin chain', async () => {
    const deriveExecutorAccount = vi.fn();
    const originAddress =
      '0x3333333333333333333333333333333333333333';
    const result = await resolveSwapAccount({
      chain: EVM_CHAIN,
      executorAddress: ACCOUNT,
      origin: { chain: EVM_CHAIN, address: originAddress },
      deriveExecutorAccount,
    });

    expect(result).toBe(originAddress);
    expect(deriveExecutorAccount).not.toHaveBeenCalled();
  });

  it('derives other CEAs from the Push executor account', async () => {
    const derivedAddress =
      '0x4444444444444444444444444444444444444444';
    const deriveExecutorAccount = vi.fn(async () => ({
      address: derivedAddress,
    }));
    const targetChain = 'eip155:84532';
    const result = await resolveSwapAccount({
      chain: targetChain,
      executorAddress: ACCOUNT,
      origin: {
        chain: EVM_CHAIN,
        address: '0x3333333333333333333333333333333333333333',
      },
      deriveExecutorAccount,
    });

    expect(result).toBe(derivedAddress);
    expect(deriveExecutorAccount).toHaveBeenCalledWith(
      {
        chain: PUSH_CHAIN_ID,
        address: ACCOUNT,
      },
      {
        chain: targetChain,
        skipNetworkCheck: true,
      },
    );
  });

  it('converts a derived Solana CEA from hex to base58', async () => {
    const bytes = Uint8Array.from(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    const deriveExecutorAccount = vi.fn(async () => ({
      address: `0x${Buffer.from(bytes).toString('hex')}`,
    }));
    const result = await resolveSwapAccount({
      chain: SOLANA_CHAIN,
      executorAddress: ACCOUNT,
      origin: {
        chain: EVM_CHAIN,
        address: '0x3333333333333333333333333333333333333333',
      },
      deriveExecutorAccount,
    });

    expect(result).toBe(new PublicKey(bytes).toBase58());
  });
});

describe('fetchEvmSwapBalances', () => {
  it('uses one canonical multicall for external native and ERC20 balances', async () => {
    const tokens = [
      nativeToken(EVM_CHAIN, 'ETH'),
      contractToken(
        EVM_CHAIN,
        '0x97F477B7f970D47a87B42869ceeace218106152a',
        'USDC',
        6,
      ),
    ];
    const multicall = vi.fn<SwapEvmBalanceClient['multicall']>(
      async () => [
        {
          status: 'success' as const,
          result: 2_000_000_000_000_000_000n,
        },
        { status: 'success' as const, result: 12_500_000n },
      ],
    );
    const getBalance = vi.fn(async () => 0n);
    const client: SwapEvmBalanceClient = {
      multicall,
      getBalance,
    };

    const balances = await fetchEvmSwapBalances({
      chain: EVM_CHAIN,
      account: ACCOUNT,
      tokens,
      evmClient: client,
    });

    expect(getBalance).not.toHaveBeenCalled();
    expect(multicall).toHaveBeenCalledTimes(1);
    const parameters = multicall.mock.calls[0][0];
    expect(parameters.contracts).toHaveLength(2);
    expect(parameters).not.toHaveProperty('deployless');
    expect(
      (parameters.contracts[0] as { functionName: string }).functionName,
    ).toBe('getEthBalance');
    expect(balances[getSwapTokenKey(tokens[0])]).toBe('2');
    expect(balances[getSwapTokenKey(tokens[1])]).toBe('12.5');
  });

  it('uses deployless multicall plus one native read on Push', async () => {
    const tokens = [
      nativeToken(PUSH_CHAIN_ID, 'PC'),
      contractToken(
        PUSH_CHAIN_ID,
        '0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9',
        'WPC',
        18,
      ),
    ];
    const multicall = vi.fn<SwapEvmBalanceClient['multicall']>(
      async () => [
        {
          status: 'success' as const,
          result: 500_000_000_000_000_000n,
        },
      ],
    );
    const getBalance = vi.fn(async () => 3_000_000_000_000_000_000n);
    const client: SwapEvmBalanceClient = {
      multicall,
      getBalance,
    };

    const balances = await fetchEvmSwapBalances({
      chain: PUSH_CHAIN_ID,
      account: ACCOUNT,
      tokens,
      evmClient: client,
    });

    expect(getBalance).toHaveBeenCalledTimes(1);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(multicall.mock.calls[0][0]).toMatchObject({
      deployless: true,
      allowFailure: true,
      batchSize: 0,
    });
    expect(balances[getSwapTokenKey(tokens[0])]).toBe('3');
    expect(balances[getSwapTokenKey(tokens[1])]).toBe('0.5');
  });

  it('maps an individual contract failure to zero', async () => {
    const tokens = [
      nativeToken(EVM_CHAIN, 'ETH'),
      contractToken(
        EVM_CHAIN,
        '0x97F477B7f970D47a87B42869ceeace218106152a',
        'USDC',
        6,
      ),
    ];
    const client: SwapEvmBalanceClient = {
      getBalance: vi.fn(async () => 0n),
      multicall: vi.fn(async () => [
        { status: 'success' as const, result: 1_000_000_000_000_000_000n },
        { status: 'failure' as const },
      ]),
    };

    const balances = await fetchEvmSwapBalances({
      chain: EVM_CHAIN,
      account: ACCOUNT,
      tokens,
      evmClient: client,
    });

    expect(balances[getSwapTokenKey(tokens[1])]).toBe('0');
  });

  it('throws when the complete multicall batch fails', async () => {
    const tokens = [
      nativeToken(EVM_CHAIN, 'ETH'),
      contractToken(
        EVM_CHAIN,
        '0x97F477B7f970D47a87B42869ceeace218106152a',
        'USDC',
        6,
      ),
    ];
    const client: SwapEvmBalanceClient = {
      getBalance: vi.fn(async () => 0n),
      multicall: vi.fn(async () => [
        { status: 'failure' as const },
        { status: 'failure' as const },
      ]),
    };

    await expect(
      fetchEvmSwapBalances({
        chain: EVM_CHAIN,
        account: ACCOUNT,
        tokens,
        evmClient: client,
      }),
    ).rejects.toThrow('Unable to fetch token balances');
  });
});

describe('fetchSolanaSwapBalances', () => {
  it('fetches all SPL accounts once and sums accounts for the same mint', async () => {
    const mint = 'EiXDnrAg9ea2Q6vEPV7E5TpTU1vh41jcuZqKjU5Dc4ZF';
    const tokens = [
      nativeToken(SOLANA_CHAIN, 'SOL', 9),
      contractToken(SOLANA_CHAIN, mint, 'USDT', 6),
    ];
    const getBalance = vi.fn(async () => 1_500_000_000);
    const getParsedTokenAccountsByOwner = vi.fn(async () => ({
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  mint,
                  tokenAmount: { amount: '1200000' },
                },
              },
            },
          },
        },
        {
          account: {
            data: {
              parsed: {
                info: {
                  mint,
                  tokenAmount: { amount: '300000' },
                },
              },
            },
          },
        },
      ],
    }));
    const connection: SwapSolanaConnection = {
      getBalance,
      getParsedTokenAccountsByOwner,
    };
    const owner = new PublicKey(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1)),
    ).toBase58();

    const balances = await fetchSolanaSwapBalances({
      chain: SOLANA_CHAIN,
      account: owner,
      tokens,
      solanaConnection: connection,
    });

    expect(getBalance).toHaveBeenCalledTimes(1);
    expect(getParsedTokenAccountsByOwner).toHaveBeenCalledTimes(1);
    expect(balances[getSwapTokenKey(tokens[0])]).toBe('1.5');
    expect(balances[getSwapTokenKey(tokens[1])]).toBe('1.5');
  });
});
