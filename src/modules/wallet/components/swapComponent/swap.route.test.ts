import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { encodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  completeWalletSwapRoute,
  getRamenSwapRecipients,
} from './swap.route';
import { SwapStep, SwapToken } from './swap.types';

const sourceToken = (chain: string, overrides: Partial<SwapToken> = {}) => ({
  chain,
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  name: 'ETH',
  decimals: 18,
  mechanism: 'native' as const,
  ...overrides,
});

const swapStep: SwapStep = {
  type: 'swap',
  to: '0x1111111111111111111111111111111111111111',
  value: '0',
  data: '0x1234',
};

describe('wallet swap route completion', () => {
  it.each([
    ['UOA', CHAIN.ETHEREUM_SEPOLIA],
    ['CEA', CHAIN.ARBITRUM_SEPOLIA],
  ])('adds the canonical inbound funding step for an external %s', (_, chain) => {
    const route = completeWalletSwapRoute({
      sourceChain: chain,
      fromToken: sourceToken(chain),
      amountIn: '0.001',
      steps: [swapStep],
    });

    expect(route[0]).toMatchObject({
      type: 'bridge',
      amountRaw: '1000000000000000',
      token: {
        chain,
        chainName: expect.any(String),
        symbol: 'ETH',
        mechanism: 'native',
      },
    });
    expect(route[1]).toBe(swapStep);
  });

  it('completes the known same-external-chain RamenFi omission', () => {
    const chain = CHAIN.ETHEREUM_SEPOLIA;
    const outbound: SwapStep = {
      type: 'outbound',
      destinationChain: chain,
      recipientAddress: '0x2222222222222222222222222222222222222222',
      amountRaw: '1500000',
      tokenSymbol: 'USDT',
      token: {
        chain,
        chainName: 'ETHEREUM_SEPOLIA',
        symbol: 'USDT',
        address: '0xC4230aEaFcF6b8B49a7b4e53886420f00ff71876',
        decimals: 6,
        mechanism: 'approve',
      },
    };

    expect(
      completeWalletSwapRoute({
        sourceChain: chain,
        fromToken: sourceToken(chain),
        amountIn: '0.001',
        steps: [swapStep, outbound],
      }).map((step) => step.type),
    ).toEqual(['bridge', 'swap', 'outbound']);
  });

  it('does not alter Push routes or duplicate a RamenFi bridge', () => {
    const pushRoute = completeWalletSwapRoute({
      sourceChain: CHAIN.PUSH_TESTNET_DONUT,
      fromToken: sourceToken(CHAIN.PUSH_TESTNET_DONUT),
      amountIn: '1',
      steps: [swapStep],
    });
    expect(pushRoute).toEqual([swapStep]);

    const bridge: SwapStep = {
      type: 'bridge',
      amountRaw: '1000000000000000',
      token: {
        chain: CHAIN.ETHEREUM_SEPOLIA,
        chainName: 'ETHEREUM_SEPOLIA',
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        mechanism: 'native',
      },
    };
    const ramenRoute = completeWalletSwapRoute({
      sourceChain: CHAIN.ETHEREUM_SEPOLIA,
      fromToken: sourceToken(CHAIN.ETHEREUM_SEPOLIA),
      amountIn: '0.001',
      steps: [bridge, swapStep],
    });
    expect(ramenRoute).toEqual([bridge, swapStep]);
  });

  it('refuses to invent funding metadata for an unknown token', () => {
    expect(
      completeWalletSwapRoute({
        sourceChain: CHAIN.ETHEREUM_SEPOLIA,
        fromToken: sourceToken(CHAIN.ETHEREUM_SEPOLIA, {
          address: '0x9999999999999999999999999999999999999999',
        }),
        amountIn: '1',
        steps: [swapStep],
      }),
    ).toEqual([swapStep]);
  });

  it('caps outbound funds to the minimum guaranteed by swap calldata', () => {
    const dexStep: SwapStep = {
      type: 'swap',
      to: '0x1111111111111111111111111111111111111111',
      value: '0',
      data: encodeFunctionData({
        abi: [
          {
            name: 'exactInputSingle',
            type: 'function',
            stateMutability: 'payable',
            inputs: [
              {
                name: 'params',
                type: 'tuple',
                components: [
                  { name: 'tokenIn', type: 'address' },
                  { name: 'tokenOut', type: 'address' },
                  { name: 'fee', type: 'uint24' },
                  { name: 'recipient', type: 'address' },
                  { name: 'deadline', type: 'uint256' },
                  { name: 'amountIn', type: 'uint256' },
                  { name: 'amountOutMinimum', type: 'uint256' },
                  { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
              },
            ],
            outputs: [{ name: 'amountOut', type: 'uint256' }],
          },
        ] as const,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: '0x1111111111111111111111111111111111111111',
            tokenOut: '0x2222222222222222222222222222222222222222',
            fee: 3000,
            recipient: '0x3333333333333333333333333333333333333333',
            deadline: 1n,
            amountIn: 1_000_000n,
            amountOutMinimum: 990_000n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }),
    };
    const outbound: SwapStep = {
      type: 'outbound',
      destinationChain: CHAIN.BASE_SEPOLIA,
      recipientAddress: '0x4444444444444444444444444444444444444444',
      amountRaw: '995000',
      tokenSymbol: 'USDC',
      token: {
        chain: CHAIN.BASE_SEPOLIA,
        chainName: 'BASE_SEPOLIA',
        symbol: 'USDC',
        address: '0x5c3504F0E3bA28FDc1F74234fE936518276AaBB8',
        decimals: 6,
        mechanism: 'approve',
      },
    };

    const route = completeWalletSwapRoute({
      sourceChain: CHAIN.PUSH_TESTNET_DONUT,
      fromToken: sourceToken(CHAIN.PUSH_TESTNET_DONUT),
      amountIn: '1',
      steps: [dexStep, outbound],
    });

    expect(route[1]).toMatchObject({
      type: 'outbound',
      amountRaw: '990000',
    });
    expect(getRamenSwapRecipients(route)).toEqual([
      '0x3333333333333333333333333333333333333333',
    ]);
  });
});
