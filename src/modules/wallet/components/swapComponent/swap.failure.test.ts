import { describe, expect, it } from 'vitest';
import {
  getSwapFailurePresentation,
  getSwapFailureSummary,
  sanitizeSwapErrorMessage,
} from './swap.failure';

const SOURCE_HASH = `0x${'1'.repeat(64)}`;
const PUSH_HASH = `0x${'2'.repeat(64)}`;

describe('swap failure presentation', () => {
  it('redacts credentials from common header, JSON, query and RPC formats', () => {
    const message = [
      'x-api-key: ramen-secret',
      '"authorization":"Bearer header-secret"',
      'privateKey=0xprivate-secret',
      'https://service.test/swap?api_key=query-secret&route=1',
      'https://sepolia.infura.io/v3/1234567890abcdef1234567890abcdef',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ3YWxsZXQifQ.signature12345678',
    ].join(' | ');

    const sanitized = sanitizeSwapErrorMessage(message);

    expect(sanitized).not.toContain('ramen-secret');
    expect(sanitized).not.toContain('header-secret');
    expect(sanitized).not.toContain('0xprivate-secret');
    expect(sanitized).not.toContain('query-secret');
    expect(sanitized).not.toContain('1234567890abcdef1234567890abcdef');
    expect(sanitized).not.toContain('signature12345678');
    expect(sanitized.match(/\[redacted\]/g)?.length).toBeGreaterThanOrEqual(6);
    expect(sanitized).toContain(
      '"authorization":"[redacted]"',
    );
    expect(sanitized).toContain('?api_key=[redacted]&route=1');
  });

  it('maps technical failures to concise user-facing summaries', () => {
    expect(getSwapFailureSummary('execution reverted: transfer failed')).toBe(
      'The transaction reverted before the swap could complete.',
    );
    expect(getSwapFailureSummary('insufficient funds for gas')).toBe(
      'The selected account does not have enough balance to complete this swap.',
    );
    expect(getSwapFailureSummary('something unexpected')).toBe(
      'The swap could not be completed.',
    );
  });

  it('includes route, request and every recorded transaction in the details', () => {
    const presentation = getSwapFailurePresentation({
      error: 'execution reverted; x-api-key=do-not-render',
      failure: {
        stage: 'push',
        code: 'SEND-TX-199-02',
        eventId: 'SEND-TX-199-02',
        title: 'Push Chain Tx Failed',
        message: 'execution reverted; x-api-key=do-not-render',
        decodedError: 'STF',
        context: {
          phase: 'push',
        },
      },
      sourceChain: 'eip155:11155111',
      destinationChain: 'eip155:42101',
      sourceAddress: '0xsource',
      destinationAddress: '0xdestination',
      tokensIn: [
        {
          address: '0xinput',
          amount: '1',
          symbol: 'ETH',
          chain: 'eip155:11155111',
        },
      ],
      tokensOut: [
        {
          address: '0xoutput',
          amount: '184.2',
          symbol: 'WPC',
          chain: 'eip155:42101',
        },
      ],
      transactionRefs: [
        {
          phase: 'source',
          chainId: 'eip155:11155111',
          hash: SOURCE_HASH,
        },
        {
          phase: 'push',
          chainId: 'eip155:42101',
          hash: PUSH_HASH,
        },
      ],
    });

    expect(presentation.summary).toContain('reverted');
    expect(presentation.technicalMessage).toBe(
      'execution reverted; x-api-key=[redacted]',
    );
    expect(presentation.details).toEqual(
      expect.arrayContaining([
        {
          label: 'Last recorded stage',
          value: 'Push Chain execution',
        },
        {
          label: 'Input',
          value: '1 ETH',
        },
        {
          label: 'Quoted output',
          value: '184.2 WPC',
        },
        {
          label: 'Error code',
          value: 'SEND-TX-199-02',
        },
        {
          label: 'SDK event',
          value: 'SEND-TX-199-02 · Push Chain Tx Failed',
        },
        {
          label: 'Source transaction',
          value: expect.stringContaining(SOURCE_HASH),
          kind: 'transaction',
        },
        {
          label: 'Push transaction',
          value: expect.stringContaining(PUSH_HASH),
          kind: 'transaction',
        },
      ]),
    );
  });

  it('reports route preparation when failure happens before submission', () => {
    const presentation = getSwapFailurePresentation({
      error: 'No swap steps to execute',
      sourceChain: 'eip155:11155111',
      destinationChain: 'eip155:42101',
      tokensIn: [],
      tokensOut: [],
      transactionRefs: [],
    });

    expect(presentation.details[0]).toEqual({
      label: 'Last recorded stage',
      value: 'Route preparation',
    });
  });
});
