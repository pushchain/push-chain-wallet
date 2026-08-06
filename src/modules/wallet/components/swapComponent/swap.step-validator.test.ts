import { describe, expect, it } from 'vitest';
import { PUSH_CHAIN_ID } from './swap.constants';
import {
  classifySwapSourceAccount,
  ValidateRamenSwapStepsParams,
  validateRamenSwapSteps,
} from './swap.step-validator';
import { SwapStep, SwapToken } from './swap.types';

const ETHEREUM = 'eip155:11155111';
const ARBITRUM = 'eip155:421614';
const BASE = 'eip155:84532';
const RECIPIENT = '0x9999999999999999999999999999999999999999';

const ETH = '0x0000000000000000000000000000000000000000';
const ETHEREUM_USDC =
  '0x1111111111111111111111111111111111111111';
const ARBITRUM_USDC =
  '0x2222222222222222222222222222222222222222';
const BASE_USDC = '0x3333333333333333333333333333333333333333';
const WPC = '0x4444444444444444444444444444444444444444';
const PUSH_USDC = '0x5555555555555555555555555555555555555555';

const token = ({
  chain,
  address,
  symbol,
  decimals,
  mechanism = 'approve',
}: {
  chain: string;
  address: string;
  symbol: string;
  decimals: number;
  mechanism?: SwapToken['mechanism'];
}): SwapToken => ({
  chain,
  address,
  symbol,
  name: symbol,
  decimals,
  mechanism,
});

const ethereumEth = token({
  chain: ETHEREUM,
  address: ETH,
  symbol: 'ETH',
  decimals: 18,
  mechanism: 'native',
});
const ethereumUsdc = token({
  chain: ETHEREUM,
  address: ETHEREUM_USDC,
  symbol: 'USDC',
  decimals: 6,
});
const arbitrumUsdc = token({
  chain: ARBITRUM,
  address: ARBITRUM_USDC,
  symbol: 'USDC',
  decimals: 6,
});
const baseUsdc = token({
  chain: BASE,
  address: BASE_USDC,
  symbol: 'USDC',
  decimals: 6,
});
const pushWpc = token({
  chain: PUSH_CHAIN_ID,
  address: WPC,
  symbol: 'WPC',
  decimals: 18,
});
const pushUsdc = token({
  chain: PUSH_CHAIN_ID,
  address: PUSH_USDC,
  symbol: 'USDC',
  decimals: 6,
});

const bridge = (
  sourceToken: SwapToken,
  amountRaw = '1000000',
): SwapStep =>
  ({
    type: 'bridge',
    amountRaw,
    token: {
      ...sourceToken,
      chainName: sourceToken.chain,
    },
  }) as SwapStep;

const swap = (value = '0'): SwapStep => ({
  type: 'swap',
  to: '0x6666666666666666666666666666666666666666',
  value,
  data: '0x12345678',
});

const outbound = (
  destinationToken: SwapToken,
  {
    destinationChain = destinationToken.chain,
    recipientAddress = RECIPIENT,
    amountRaw = '990000',
    tokenSymbol = destinationToken.symbol,
  }: {
    destinationChain?: string;
    recipientAddress?: string;
    amountRaw?: string;
    tokenSymbol?: string;
  } = {},
): SwapStep =>
  ({
    type: 'outbound',
    destinationChain,
    recipientAddress,
    amountRaw,
    tokenSymbol,
    token: {
      ...destinationToken,
      chainName: destinationToken.chain,
    },
  }) as SwapStep;

const validationParams = ({
  originChain = ETHEREUM,
  sourceChain = ETHEREUM,
  destinationChain = PUSH_CHAIN_ID,
  fromToken = ethereumUsdc,
  toToken = pushUsdc,
  expectedOutboundRecipient,
  amountIn = '1',
  steps = [bridge(ethereumUsdc), swap()],
}: Partial<ValidateRamenSwapStepsParams> = {}): ValidateRamenSwapStepsParams => ({
  originChain,
  sourceChain,
  destinationChain,
  fromToken,
  toToken,
  expectedOutboundRecipient:
    expectedOutboundRecipient ??
    (destinationChain === PUSH_CHAIN_ID ? undefined : RECIPIENT),
  amountIn,
  steps,
});

const expectFailureCode = (
  params: ValidateRamenSwapStepsParams,
  code: string,
) => {
  const result = validateRamenSwapSteps(params);
  expect(result.success).toBe(false);
  if ('error' in result) {
    expect(result.error.code).toBe(code);
    expect(result.error.message).toContain(
      'stopped before signing',
    );
  }
};

describe('swap source account classification', () => {
  it.each([
    {
      description: 'the connected external origin as UOA',
      originChain: ETHEREUM,
      sourceChain: ETHEREUM,
      expected: 'UOA',
    },
    {
      description: 'Push Chain as UEA',
      originChain: ETHEREUM,
      sourceChain: PUSH_CHAIN_ID,
      expected: 'UEA',
    },
    {
      description: 'another external source as CEA',
      originChain: ETHEREUM,
      sourceChain: ARBITRUM,
      expected: 'CEA',
    },
    {
      description: 'an external source without origin context as CEA',
      originChain: undefined,
      sourceChain: BASE,
      expected: 'CEA',
    },
  ])('classifies $description', ({ originChain, sourceChain, expected }) => {
    expect(
      classifySwapSourceAccount({ originChain, sourceChain }),
    ).toBe(expected);
  });
});

describe('valid RamenFi account route matrix', () => {
  it.each([
    {
      description: 'UOA to UOA through Push with native input',
      expectedSource: 'UOA',
      params: validationParams({
        sourceChain: ETHEREUM,
        destinationChain: ETHEREUM,
        fromToken: ethereumEth,
        toToken: ethereumUsdc,
        amountIn: '0.001',
        steps: [
          bridge(ethereumEth, '1000000000000000'),
          swap(),
          outbound(ethereumUsdc),
        ],
      }),
    },
    {
      description: 'UOA to CEA through Push with ERC-20 input',
      expectedSource: 'UOA',
      params: validationParams({
        sourceChain: ETHEREUM,
        destinationChain: ARBITRUM,
        fromToken: ethereumUsdc,
        toToken: arbitrumUsdc,
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(arbitrumUsdc),
        ],
      }),
    },
    {
      description: 'UOA to UEA with native input',
      expectedSource: 'UOA',
      params: validationParams({
        sourceChain: ETHEREUM,
        destinationChain: PUSH_CHAIN_ID,
        fromToken: ethereumEth,
        toToken: pushWpc,
        amountIn: '0.001',
        steps: [bridge(ethereumEth, '1000000000000000'), swap()],
      }),
    },
    {
      description: 'CEA to UOA through Push with ERC-20 input',
      expectedSource: 'CEA',
      params: validationParams({
        sourceChain: ARBITRUM,
        destinationChain: ETHEREUM,
        fromToken: arbitrumUsdc,
        toToken: ethereumUsdc,
        steps: [
          bridge(arbitrumUsdc),
          swap(),
          outbound(ethereumUsdc),
        ],
      }),
    },
    {
      description: 'CEA to CEA through Push with ERC-20 input',
      expectedSource: 'CEA',
      params: validationParams({
        sourceChain: ARBITRUM,
        destinationChain: BASE,
        fromToken: arbitrumUsdc,
        toToken: baseUsdc,
        steps: [
          bridge(arbitrumUsdc),
          swap(),
          outbound(baseUsdc),
        ],
      }),
    },
    {
      description: 'CEA to UEA with ERC-20 input',
      expectedSource: 'CEA',
      params: validationParams({
        sourceChain: ARBITRUM,
        destinationChain: PUSH_CHAIN_ID,
        fromToken: arbitrumUsdc,
        toToken: pushUsdc,
        steps: [bridge(arbitrumUsdc), swap()],
      }),
    },
    {
      description: 'UEA to UOA with PRC-20 input',
      expectedSource: 'UEA',
      params: validationParams({
        sourceChain: PUSH_CHAIN_ID,
        destinationChain: ETHEREUM,
        fromToken: pushWpc,
        toToken: ethereumUsdc,
        steps: [swap(), outbound(ethereumUsdc)],
      }),
    },
    {
      description: 'UEA to CEA with PRC-20 input',
      expectedSource: 'UEA',
      params: validationParams({
        sourceChain: PUSH_CHAIN_ID,
        destinationChain: ARBITRUM,
        fromToken: pushUsdc,
        toToken: arbitrumUsdc,
        steps: [swap(), outbound(arbitrumUsdc)],
      }),
    },
    {
      description: 'UEA to UEA with PRC-20 input',
      expectedSource: 'UEA',
      params: validationParams({
        sourceChain: PUSH_CHAIN_ID,
        destinationChain: PUSH_CHAIN_ID,
        fromToken: pushUsdc,
        toToken: pushWpc,
        steps: [swap()],
      }),
    },
    {
      description: 'UOA to UEA as an identity bridge',
      expectedSource: 'UOA',
      params: validationParams({
        sourceChain: ETHEREUM,
        destinationChain: PUSH_CHAIN_ID,
        fromToken: ethereumEth,
        toToken: token({
          chain: PUSH_CHAIN_ID,
          address: ETHEREUM_USDC,
          symbol: 'pETH',
          decimals: 18,
        }),
        amountIn: '0.001',
        steps: [bridge(ethereumEth, '1000000000000000')],
      }),
    },
    {
      description: 'CEA to UEA as an identity bridge',
      expectedSource: 'CEA',
      params: validationParams({
        sourceChain: ARBITRUM,
        destinationChain: PUSH_CHAIN_ID,
        fromToken: arbitrumUsdc,
        toToken: pushUsdc,
        steps: [bridge(arbitrumUsdc)],
      }),
    },
    {
      description: 'UEA to UOA as an outbound-only identity route',
      expectedSource: 'UEA',
      params: validationParams({
        sourceChain: PUSH_CHAIN_ID,
        destinationChain: ETHEREUM,
        fromToken: pushUsdc,
        toToken: ethereumUsdc,
        steps: [outbound(ethereumUsdc)],
      }),
    },
    {
      description: 'UEA to CEA as an outbound-only identity route',
      expectedSource: 'UEA',
      params: validationParams({
        sourceChain: PUSH_CHAIN_ID,
        destinationChain: ARBITRUM,
        fromToken: pushUsdc,
        toToken: arbitrumUsdc,
        steps: [outbound(arbitrumUsdc)],
      }),
    },
  ])(
    'accepts $description',
    ({ params, expectedSource }) => {
      expect(validateRamenSwapSteps(params)).toEqual({
        success: true,
        sourceAccountType: expectedSource,
      });
    },
  );
});

describe('RamenFi route invariant failures', () => {
  it('rejects the current same-external-chain route defect', () => {
    expectFailureCode(
      validationParams({
        sourceChain: ETHEREUM,
        destinationChain: ETHEREUM,
        fromToken: ethereumEth,
        toToken: ethereumUsdc,
        amountIn: '0.001',
        steps: [swap(), outbound(ethereumUsdc)],
      }),
      'MISSING_INBOUND_BRIDGE',
    );
  });

  it.each([
    {
      description: 'an empty route',
      code: 'NO_STEPS',
      params: validationParams({ steps: [] }),
    },
    {
      description: 'a zero input amount',
      code: 'INVALID_INPUT_AMOUNT',
      params: validationParams({ amountIn: '0' }),
    },
    {
      description: 'an input amount with excessive precision',
      code: 'INVALID_INPUT_AMOUNT',
      params: validationParams({ amountIn: '0.0000001' }),
    },
    {
      description: 'an unknown step',
      code: 'INVALID_STEP',
      params: validationParams({
        steps: [{ type: 'approve' } as unknown as SwapStep],
      }),
    },
    {
      description: 'a malformed bridge step',
      code: 'INVALID_STEP',
      params: validationParams({
        steps: [
          {
            type: 'bridge',
            amountRaw: '1000000',
          } as unknown as SwapStep,
          swap(),
        ],
      }),
    },
    {
      description: 'invalid swap calldata',
      code: 'INVALID_STEP',
      params: validationParams({
        steps: [
          bridge(ethereumUsdc),
          { ...swap(), data: '0x12' },
        ],
      }),
    },
    {
      description: 'a bridge with the wrong funding mechanism',
      code: 'BRIDGE_TOKEN_MISMATCH',
      params: validationParams({
        steps: [
          bridge({ ...ethereumUsdc, mechanism: 'native' }),
          swap(),
        ],
      }),
    },
    {
      description: 'more than one inbound bridge',
      code: 'MULTIPLE_INBOUND_BRIDGES',
      params: validationParams({
        steps: [
          bridge(ethereumUsdc),
          bridge(ethereumUsdc),
          swap(),
        ],
      }),
    },
    {
      description: 'an inbound bridge for a Push source',
      code: 'UNEXPECTED_INBOUND_BRIDGE',
      params: validationParams({
        sourceChain: PUSH_CHAIN_ID,
        fromToken: pushUsdc,
        steps: [bridge(pushUsdc), swap()],
      }),
    },
    {
      description: 'a bridge on the wrong source chain',
      code: 'BRIDGE_SOURCE_CHAIN_MISMATCH',
      params: validationParams({
        steps: [bridge(arbitrumUsdc), swap()],
      }),
    },
    {
      description: 'a bridge for the wrong source token',
      code: 'BRIDGE_TOKEN_MISMATCH',
      params: validationParams({
        steps: [bridge(ethereumEth, '1000000'), swap()],
      }),
    },
    {
      description: 'a zero bridge amount',
      code: 'INVALID_BRIDGE_AMOUNT',
      params: validationParams({
        steps: [bridge(ethereumUsdc, '0'), swap()],
      }),
    },
    {
      description: 'a bridge amount different from the input',
      code: 'BRIDGE_AMOUNT_MISMATCH',
      params: validationParams({
        steps: [bridge(ethereumUsdc, '999999'), swap()],
      }),
    },
    {
      description: 'a missing external outbound',
      code: 'MISSING_OUTBOUND',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        steps: [bridge(ethereumUsdc), swap()],
      }),
    },
    {
      description: 'more than one external outbound',
      code: 'MULTIPLE_OUTBOUNDS',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(arbitrumUsdc),
          outbound(arbitrumUsdc),
        ],
      }),
    },
    {
      description: 'an outbound for a Push destination',
      code: 'UNEXPECTED_OUTBOUND',
      params: validationParams({
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(pushUsdc),
        ],
      }),
    },
    {
      description: 'an outbound to the wrong chain',
      code: 'OUTBOUND_DESTINATION_CHAIN_MISMATCH',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(arbitrumUsdc, { destinationChain: BASE }),
        ],
      }),
    },
    {
      description: 'an outbound for the wrong token',
      code: 'OUTBOUND_TOKEN_MISMATCH',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(baseUsdc, {
            destinationChain: ARBITRUM,
          }),
        ],
      }),
    },
    {
      description: 'an outbound with the wrong funding mechanism',
      code: 'OUTBOUND_TOKEN_MISMATCH',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound({ ...arbitrumUsdc, mechanism: 'native' }),
        ],
      }),
    },
    {
      description: 'a missing outbound recipient',
      code: 'OUTBOUND_RECIPIENT_REQUIRED',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        expectedOutboundRecipient: '',
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(arbitrumUsdc),
        ],
      }),
    },
    {
      description: 'an outbound to the wrong recipient',
      code: 'OUTBOUND_RECIPIENT_MISMATCH',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(arbitrumUsdc, {
            recipientAddress:
              '0x8888888888888888888888888888888888888888',
          }),
        ],
      }),
    },
    {
      description: 'a zero outbound amount',
      code: 'INVALID_OUTBOUND_AMOUNT',
      params: validationParams({
        destinationChain: ARBITRUM,
        toToken: arbitrumUsdc,
        steps: [
          bridge(ethereumUsdc),
          swap(),
          outbound(arbitrumUsdc, { amountRaw: '0' }),
        ],
      }),
    },
    {
      description: 'a negative swap call value',
      code: 'INVALID_SWAP_VALUE',
      params: validationParams({
        steps: [bridge(ethereumUsdc), swap('-1')],
      }),
    },
  ])('rejects $description', ({ code, params }) => {
    expectFailureCode(params, code);
  });
});
