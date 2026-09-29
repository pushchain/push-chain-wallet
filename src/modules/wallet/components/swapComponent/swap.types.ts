import { PushChain } from '@pushchain/core';
import { Address } from 'viem';

export type SwapChain = string;

export type SwapToken = {
  chain: SwapChain;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  mechanism: 'native' | 'approve' | 'permit2';
};

export type PayableToken = ReturnType<
  typeof PushChain.utils.tokens.getPayableTokens
>['tokens'][number];

export type MoveableToken = ReturnType<
  typeof PushChain.utils.tokens.getMoveableTokens
>['tokens'][number] & {
  prc20Address?: `0x${string}`;
  sourceChain?: string;
};

export type SwapBridgeStep = {
  type: 'bridge';
  amountRaw: string;
  token: PayableToken;
};

export type SwapTransactionStep = {
  type: 'swap';
  to: Address;
  value: string;
  data: `0x${string}`;
};

export type SwapOutboundStep = {
  type: 'outbound';
  destinationChain: string;
  recipientAddress: string;
  amountRaw: string;
  tokenSymbol: string;
  token: MoveableToken;
};

export type SwapStep =
  | SwapBridgeStep
  | SwapTransactionStep
  | SwapOutboundStep;

export type SwapTransactionRef = {
  phase: 'source' | 'push' | 'destination';
  chainId: string;
  hash: string;
  explorerUrl?: string;
};

export type SwapFailureStage =
  | 'quote'
  | 'route-validation'
  | 'route-preparation'
  | 'source'
  | 'push'
  | 'destination'
  | 'cascade'
  | 'unknown';

export type SwapFailureDetails = {
  stage: SwapFailureStage;
  message: string;
  code?: string;
  httpStatus?: number;
  eventId?: string;
  title?: string;
  decodedError?: string;
  failedAt?: string | number;
  total?: number;
  attempts?: number;
  retryable?: boolean;
  context?: Record<string, string | number | boolean>;
};

export type QuoteApiRequest = {
  sourceChain: string;
  destinationChain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
};

export type QuoteApiSuccessResponse = {
  success: true;
  amountOut: string;
  gasEstimate: number;
  liquidity: {
    hasSufficientLiquidity: boolean;
    minimumLiquidity: string;
    pools: {
      address: string;
      liquidity: string;
      hasEnoughLiquidity: boolean;
    }[];
  } | null;
  poolResult: {
    type: string;
    pools: {
      address: string;
      fee: number;
      token0: string;
      token1: string;
    }[];
  } | null;
};

export type SwapApiRequest = QuoteApiRequest & {
  userAddress: string;
  recipient?: string;
  outboundRecipient?: string;
  poolResult: QuoteApiSuccessResponse['poolResult'];
  maxSlippage?: string | number;
};

export type SwapApiSuccessResponse = {
  success: true;
  steps: SwapStep[];
  message?: string;
};

export type SwapExecutionResult =
  | {
      success: true;
      txHash: string;
      pushTxHash?: string;
      finalTxHash?: string;
      finalTxExplorerUrl?: string;
    }
  | {
      success: false;
      error: string;
      /**
       * A relay timeout is not a terminal failure. The transaction can still
       * settle, so callers must keep it pending and retain its tracking link.
       */
      pending?: boolean;
      txHash?: string;
      pushTxHash?: string;
      failure?: SwapFailureDetails;
    };
