import { isAddress, isHex, parseUnits } from 'viem';
import { SwapStep, SwapToken } from './swap.types';
import {
  getSwapChainDisplayName,
  isPushChain,
} from './swap.utils';

export type SwapSourceAccountType = 'UOA' | 'UEA' | 'CEA';

export type RamenStepValidationErrorCode =
  | 'NO_STEPS'
  | 'INVALID_STEP'
  | 'MISSING_INBOUND_BRIDGE'
  | 'MULTIPLE_INBOUND_BRIDGES'
  | 'UNEXPECTED_INBOUND_BRIDGE'
  | 'BRIDGE_SOURCE_CHAIN_MISMATCH'
  | 'BRIDGE_TOKEN_MISMATCH'
  | 'INVALID_BRIDGE_AMOUNT'
  | 'BRIDGE_AMOUNT_MISMATCH'
  | 'MISSING_OUTBOUND'
  | 'MULTIPLE_OUTBOUNDS'
  | 'UNEXPECTED_OUTBOUND'
  | 'OUTBOUND_DESTINATION_CHAIN_MISMATCH'
  | 'OUTBOUND_TOKEN_MISMATCH'
  | 'OUTBOUND_RECIPIENT_REQUIRED'
  | 'OUTBOUND_RECIPIENT_MISMATCH'
  | 'INVALID_OUTBOUND_AMOUNT'
  | 'INVALID_SWAP_VALUE'
  | 'INVALID_INPUT_AMOUNT';

export type RamenStepValidationError = {
  code: RamenStepValidationErrorCode;
  message: string;
  context?: Record<string, string | number>;
};

export type RamenStepValidationResult =
  | {
      success: true;
      sourceAccountType: SwapSourceAccountType;
    }
  | {
      success: false;
      sourceAccountType: SwapSourceAccountType;
      error: RamenStepValidationError;
    };

export type ValidateRamenSwapStepsParams = {
  originChain?: string | null;
  sourceChain: string;
  destinationChain: string;
  fromToken: Pick<
    SwapToken,
    'address' | 'symbol' | 'decimals' | 'mechanism'
  >;
  toToken: Pick<
    SwapToken,
    'address' | 'symbol' | 'decimals' | 'mechanism'
  >;
  /**
   * The destination account selected by the wallet. Required for an external
   * destination and intentionally omitted for a Push Chain destination.
   */
  expectedOutboundRecipient?: string | null;
  /**
   * When supplied, the bridge amount is also checked against the exact
   * base-unit representation of the user's input.
   */
  amountIn?: string;
  steps: readonly SwapStep[];
};

const normalizeChain = (chain: string) => chain.trim().toLowerCase();

const isSameChain = (first: string, second: string) =>
  normalizeChain(first) === normalizeChain(second);

const normalizeChainAddress = (chain: string, address: string) => {
  const trimmed = address.trim();
  return normalizeChain(chain).startsWith('eip155:')
    ? trimmed.toLowerCase()
    : trimmed;
};

const isSameChainAddress = (
  chain: string,
  first: string,
  second: string,
) =>
  normalizeChainAddress(chain, first) ===
  normalizeChainAddress(chain, second);

const isPositiveRawAmount = (amount: string) => /^[1-9]\d*$/.test(amount);

const isNonNegativeRawAmount = (amount: string) =>
  /^(?:0|[1-9]\d*)$/.test(amount);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getMalformedStepReason = (step: unknown): string | null => {
  if (!isRecord(step)) return 'The step is not an object.';

  if (step.type === 'bridge') {
    if (typeof step.amountRaw !== 'string') {
      return 'The bridge amount is missing or is not a string.';
    }
    if (
      !isRecord(step.token) ||
      typeof step.token.chain !== 'string' ||
      typeof step.token.address !== 'string'
    ) {
      return 'The bridge token chain or address is missing.';
    }
    return null;
  }

  if (step.type === 'swap') {
    if (
      typeof step.to !== 'string' ||
      typeof step.value !== 'string' ||
      typeof step.data !== 'string'
    ) {
      return 'The swap target, value, or calldata is missing.';
    }
    if (!isAddress(step.to)) {
      return 'The swap target is not a valid Push Chain address.';
    }
    if (!isHex(step.data) || step.data.length < 10) {
      return 'The swap calldata is not valid encoded function data.';
    }
    return null;
  }

  if (step.type === 'outbound') {
    if (
      typeof step.destinationChain !== 'string' ||
      typeof step.recipientAddress !== 'string' ||
      typeof step.amountRaw !== 'string' ||
      typeof step.tokenSymbol !== 'string'
    ) {
      return 'The outbound destination, recipient, token, or amount is missing.';
    }
    if (
      !isRecord(step.token) ||
      typeof step.token.chain !== 'string' ||
      typeof step.token.address !== 'string'
    ) {
      return 'The outbound token chain or address is missing.';
    }
    return null;
  }

  return `The step type "${String(step.type ?? 'unknown')}" is unsupported.`;
};

const describeChain = (chain: string) =>
  `${getSwapChainDisplayName(chain)} (${chain})`;

const fail = (
  sourceAccountType: SwapSourceAccountType,
  code: RamenStepValidationErrorCode,
  message: string,
  context?: Record<string, string | number>,
): RamenStepValidationResult => ({
  success: false,
  sourceAccountType,
  error: {
    code,
    message,
    ...(context ? { context } : {}),
  },
});

/**
 * A Push-side source is the user's universal executor account. For an external
 * source, the connected origin chain is the UOA and every other chain is a CEA.
 * Treat a missing external origin conservatively as CEA so a route can never
 * silently omit its explicit source-chain semantics.
 */
export const classifySwapSourceAccount = ({
  originChain,
  sourceChain,
}: Pick<
  ValidateRamenSwapStepsParams,
  'originChain' | 'sourceChain'
>): SwapSourceAccountType => {
  if (isPushChain(sourceChain.trim())) return 'UEA';
  if (originChain && isSameChain(sourceChain, originChain)) return 'UOA';
  return 'CEA';
};

/**
 * Validates the RamenFi execution plan before any wallet signature is
 * requested. This deliberately validates route invariants rather than
 * re-building the route client-side.
 */
export const validateRamenSwapSteps = ({
  originChain,
  sourceChain,
  destinationChain,
  fromToken,
  toToken,
  expectedOutboundRecipient,
  amountIn,
  steps,
}: ValidateRamenSwapStepsParams): RamenStepValidationResult => {
  const sourceAccountType = classifySwapSourceAccount({
    originChain,
    sourceChain,
  });
  const sourceIsPush = isPushChain(sourceChain.trim());
  const destinationIsPush = isPushChain(destinationChain.trim());

  if (!steps.length) {
    return fail(
      sourceAccountType,
      'NO_STEPS',
      'RamenFi returned an empty execution route. The swap was stopped before signing.',
    );
  }

  const invalidStepIndex = (steps as readonly unknown[]).findIndex(
    (step) => getMalformedStepReason(step) !== null,
  );
  if (invalidStepIndex >= 0) {
    const reason = getMalformedStepReason(steps[invalidStepIndex]);
    return fail(
      sourceAccountType,
      'INVALID_STEP',
      `RamenFi returned an invalid execution step: ${reason} The swap was stopped before signing.`,
      {
        stepIndex: invalidStepIndex,
        reason: reason ?? 'Unknown execution step error.',
      },
    );
  }

  let expectedInputAmountRaw: string | undefined;
  if (amountIn !== undefined) {
    try {
      expectedInputAmountRaw = parseUnits(
        amountIn,
        fromToken.decimals,
      ).toString();
    } catch {
      return fail(
        sourceAccountType,
        'INVALID_INPUT_AMOUNT',
        'The selected input amount could not be converted to token base units. The swap was stopped before signing.',
        { amountIn, decimals: fromToken.decimals },
      );
    }

    if (!isPositiveRawAmount(expectedInputAmountRaw)) {
      return fail(
        sourceAccountType,
        'INVALID_INPUT_AMOUNT',
        'The selected input amount must be greater than zero. The swap was stopped before signing.',
        { amountIn, decimals: fromToken.decimals },
      );
    }
  }

  const bridgeSteps = steps.filter((step) => step.type === 'bridge');
  const swapSteps = steps.filter((step) => step.type === 'swap');
  const outboundSteps = steps.filter((step) => step.type === 'outbound');

  if (!sourceIsPush && bridgeSteps.length === 0) {
    return fail(
      sourceAccountType,
      'MISSING_INBOUND_BRIDGE',
      `The RamenFi route is incomplete: ${describeChain(sourceChain)} is an external source, but no inbound bridge step was returned. The swap was stopped before signing.`,
      { sourceChain },
    );
  }
  if (!sourceIsPush && bridgeSteps.length > 1) {
    return fail(
      sourceAccountType,
      'MULTIPLE_INBOUND_BRIDGES',
      `RamenFi returned ${bridgeSteps.length} inbound bridge steps for one source amount. The swap was stopped before signing.`,
      { sourceChain, bridgeCount: bridgeSteps.length },
    );
  }
  if (sourceIsPush && bridgeSteps.length > 0) {
    return fail(
      sourceAccountType,
      'UNEXPECTED_INBOUND_BRIDGE',
      'RamenFi returned an inbound bridge for a Push Chain source. The swap was stopped before signing.',
      { sourceChain },
    );
  }

  const bridgeStep = bridgeSteps[0];
  if (bridgeStep) {
    if (!isSameChain(bridgeStep.token.chain, sourceChain)) {
      return fail(
        sourceAccountType,
        'BRIDGE_SOURCE_CHAIN_MISMATCH',
        `The inbound bridge uses ${describeChain(bridgeStep.token.chain)}, but the selected source is ${describeChain(sourceChain)}. The swap was stopped before signing.`,
        {
          expectedSourceChain: sourceChain,
          receivedSourceChain: bridgeStep.token.chain,
        },
      );
    }
    if (
      !isSameChainAddress(
        sourceChain,
        bridgeStep.token.address,
        fromToken.address,
      ) ||
      bridgeStep.token.symbol.trim().toLowerCase() !==
        fromToken.symbol.trim().toLowerCase() ||
      bridgeStep.token.decimals !== fromToken.decimals ||
      bridgeStep.token.mechanism !== fromToken.mechanism
    ) {
      return fail(
        sourceAccountType,
        'BRIDGE_TOKEN_MISMATCH',
        `The inbound bridge token does not match the selected ${fromToken.symbol} token. The swap was stopped before signing.`,
        {
          expectedToken: fromToken.address,
          receivedToken: bridgeStep.token.address,
          expectedMechanism: fromToken.mechanism,
          receivedMechanism: bridgeStep.token.mechanism,
        },
      );
    }
    if (!isPositiveRawAmount(bridgeStep.amountRaw)) {
      return fail(
        sourceAccountType,
        'INVALID_BRIDGE_AMOUNT',
        'RamenFi returned an invalid inbound bridge amount. The swap was stopped before signing.',
        { receivedAmount: bridgeStep.amountRaw },
      );
    }

    if (
      expectedInputAmountRaw !== undefined &&
      bridgeStep.amountRaw !== expectedInputAmountRaw
    ) {
      return fail(
        sourceAccountType,
        'BRIDGE_AMOUNT_MISMATCH',
        'The inbound bridge amount does not match the amount entered for this swap. The swap was stopped before signing.',
        {
          expectedAmount: expectedInputAmountRaw,
          receivedAmount: bridgeStep.amountRaw,
        },
      );
    }
  }

  if (!destinationIsPush && outboundSteps.length === 0) {
    return fail(
      sourceAccountType,
      'MISSING_OUTBOUND',
      `The RamenFi route is incomplete: ${describeChain(destinationChain)} is an external destination, but no outbound step was returned. The swap was stopped before signing.`,
      { destinationChain },
    );
  }
  if (!destinationIsPush && outboundSteps.length > 1) {
    return fail(
      sourceAccountType,
      'MULTIPLE_OUTBOUNDS',
      `RamenFi returned ${outboundSteps.length} outbound steps for one destination. The swap was stopped before signing.`,
      { destinationChain, outboundCount: outboundSteps.length },
    );
  }
  if (destinationIsPush && outboundSteps.length > 0) {
    return fail(
      sourceAccountType,
      'UNEXPECTED_OUTBOUND',
      'RamenFi returned an outbound step for a Push Chain destination. The swap was stopped before signing.',
      { destinationChain },
    );
  }

  const outboundStep = outboundSteps[0];
  if (outboundStep) {
    if (!isSameChain(outboundStep.destinationChain, destinationChain)) {
      return fail(
        sourceAccountType,
        'OUTBOUND_DESTINATION_CHAIN_MISMATCH',
        `The outbound step targets ${describeChain(outboundStep.destinationChain)}, but the selected destination is ${describeChain(destinationChain)}. The swap was stopped before signing.`,
        {
          expectedDestinationChain: destinationChain,
          receivedDestinationChain: outboundStep.destinationChain,
        },
      );
    }
    if (
      !isSameChain(outboundStep.token.chain, destinationChain) ||
      !isSameChainAddress(
        destinationChain,
        outboundStep.token.address,
        toToken.address,
      ) ||
      outboundStep.tokenSymbol.trim().toLowerCase() !==
        toToken.symbol.trim().toLowerCase() ||
      outboundStep.token.decimals !== toToken.decimals ||
      outboundStep.token.mechanism !== toToken.mechanism
    ) {
      return fail(
        sourceAccountType,
        'OUTBOUND_TOKEN_MISMATCH',
        `The outbound token does not match the selected ${toToken.symbol} destination token. The swap was stopped before signing.`,
        {
          expectedToken: toToken.address,
          receivedToken: outboundStep.token.address,
          expectedSymbol: toToken.symbol,
          receivedSymbol: outboundStep.tokenSymbol,
          expectedMechanism: toToken.mechanism,
          receivedMechanism: outboundStep.token.mechanism,
        },
      );
    }
    if (!expectedOutboundRecipient?.trim()) {
      return fail(
        sourceAccountType,
        'OUTBOUND_RECIPIENT_REQUIRED',
        'A destination account is required for this external outbound route. The swap was stopped before signing.',
        { destinationChain },
      );
    }
    if (
      !isSameChainAddress(
        destinationChain,
        outboundStep.recipientAddress,
        expectedOutboundRecipient,
      )
    ) {
      return fail(
        sourceAccountType,
        'OUTBOUND_RECIPIENT_MISMATCH',
        'The outbound recipient returned by RamenFi does not match the destination account selected by the wallet. The swap was stopped before signing.',
        {
          expectedRecipient: expectedOutboundRecipient,
          receivedRecipient: outboundStep.recipientAddress,
        },
      );
    }
    if (!isPositiveRawAmount(outboundStep.amountRaw)) {
      return fail(
        sourceAccountType,
        'INVALID_OUTBOUND_AMOUNT',
        'RamenFi returned an invalid outbound amount. The swap was stopped before signing.',
        { receivedAmount: outboundStep.amountRaw },
      );
    }
  }

  const invalidSwapStep = swapSteps.find(
    (step) => !isNonNegativeRawAmount(step.value),
  );
  if (invalidSwapStep) {
    return fail(
      sourceAccountType,
      'INVALID_SWAP_VALUE',
      'RamenFi returned a swap call with an invalid native value. The swap was stopped before signing.',
      {
        target: invalidSwapStep.to,
        receivedValue: invalidSwapStep.value,
      },
    );
  }

  return {
    success: true,
    sourceAccountType,
  };
};
