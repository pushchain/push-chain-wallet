import { PushChain } from '@pushchain/core';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { decodeFunctionData, parseUnits } from 'viem';
import { PayableToken, SwapStep, SwapToken } from './swap.types';
import { isPushChain } from './swap.utils';

type CompleteSwapRouteParams = {
  sourceChain: string;
  fromToken: Pick<
    SwapToken,
    'address' | 'symbol' | 'decimals' | 'mechanism'
  >;
  amountIn: string;
  steps: readonly SwapStep[];
};

const RAMEN_SWAP_ABI = [
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
  {
    name: 'exactInput',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

const normalizeAddress = (chain: string, address: string) =>
  chain.toLowerCase().startsWith('eip155:')
    ? address.trim().toLowerCase()
    : address.trim();

const getRamenMinimumOutput = (steps: readonly SwapStep[]) => {
  for (const step of steps) {
    if (step.type !== 'swap') continue;

    try {
      const decoded = decodeFunctionData({
        abi: RAMEN_SWAP_ABI,
        data: step.data,
      });
      if (
        decoded.functionName !== 'exactInput' &&
        decoded.functionName !== 'exactInputSingle'
      ) {
        continue;
      }

      const params = decoded.args[0];
      if (
        params.amountOutMinimum > 0n
      ) {
        return params.amountOutMinimum;
      }
    } catch {
      // Approval, wrapping, and unwrapping are also represented as swap steps.
    }
  }

  return null;
};

const synchronizeOutboundMinimum = (steps: SwapStep[]) => {
  const minimumOutput = getRamenMinimumOutput(steps);
  if (minimumOutput === null) return steps;

  return steps.map((step) => {
    if (step.type !== 'outbound') return step;
    if (!/^[1-9]\d*$/.test(step.amountRaw)) return step;

    const requestedAmount = BigInt(step.amountRaw);
    // RamenFi currently returns the spot quote for outbound even though its
    // swap calldata permits output down to amountOutMinimum. Bridging the spot
    // quote can therefore fail after a valid, slipped swap. Never increase an
    // API-provided amount; cap it to the exact minimum encoded in the trusted
    // swap calldata so every successful swap can fund its outbound leg.
    return minimumOutput < requestedAmount
      ? { ...step, amountRaw: minimumOutput.toString() }
      : step;
  });
};

/**
 * RamenFi owns swap discovery/calldata. Account topology belongs to the
 * wallet: every external UOA/CEA source must first fund its Push universal
 * account. Some RamenFi routes (notably same-external-chain swaps) omit that
 * bridge step, so complete it from the SDK's canonical payable-token registry
 * before running the strict route validator.
 */
export const completeWalletSwapRoute = ({
  sourceChain,
  fromToken,
  amountIn,
  steps,
}: CompleteSwapRouteParams): SwapStep[] => {
  const route = synchronizeOutboundMinimum([...steps]);
  if (
    isPushChain(sourceChain) ||
    route.some((step) => step.type === 'bridge')
  ) {
    return route;
  }

  const payableTokens = PushChain.utils.tokens.getPayableTokens(
    sourceChain as CHAIN,
  ).tokens;
  const expectedAddress = normalizeAddress(sourceChain, fromToken.address);
  const canonicalToken = payableTokens.find(
    (token) =>
      normalizeAddress(sourceChain, token.address) === expectedAddress &&
      token.symbol.toLowerCase() === fromToken.symbol.toLowerCase() &&
      token.decimals === fromToken.decimals &&
      token.mechanism === fromToken.mechanism,
  );

  if (!canonicalToken) {
    // Do not synthesize SDK funding metadata from API or display data. The
    // validator will reject the still-incomplete route before signing.
    return route;
  }

  const amountRaw = parseUnits(amountIn, canonicalToken.decimals);
  if (amountRaw <= 0n) return route;

  return [
    {
      type: 'bridge',
      amountRaw: amountRaw.toString(),
      token: canonicalToken as PayableToken,
    },
    ...route,
  ];
};
