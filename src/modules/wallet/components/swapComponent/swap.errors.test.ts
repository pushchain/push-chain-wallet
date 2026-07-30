import { describe, expect, it } from 'vitest';
import {
  getDetailedSwapErrorMessage,
  getSwapFailureDetails,
  isTimeoutFailure,
  SwapFlowError,
} from './swap.errors';

describe('swap error normalization', () => {
  it('preserves nested wallet and RPC diagnostics without losing the concise cause', () => {
    const error = {
      shortMessage: 'Transaction execution failed',
      details: 'execution reverted',
      cause: {
        message: 'ERC20: insufficient allowance',
      },
    };

    expect(getDetailedSwapErrorMessage(error)).toBe(
      [
        'Transaction execution failed',
        'execution reverted',
        'ERC20: insufficient allowance',
      ].join('\n\n'),
    );
  });

  it('preserves structured flow failures and classifies timeout as non-terminal', () => {
    const flowError = new SwapFlowError({
      stage: 'destination',
      code: 'SEND-TX-299-03',
      message: 'Timed out waiting for destination relay',
      retryable: true,
    });

    const failure = getSwapFailureDetails(flowError);
    expect(failure.stage).toBe('destination');
    expect(isTimeoutFailure(failure)).toBe(true);
  });
});
