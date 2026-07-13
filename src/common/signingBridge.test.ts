import { describe, expect, it } from 'vitest'
import type { SignAuthorizationParams, SignedAuthorization } from '@pushchain/core'
import { SigningRequestRegistry, type SigningBridgeMessage } from './signingBridge'

describe('SigningRequestRegistry', () => {
  it('preserves authorization parameters and response fields', async () => {
    const registry = new SigningRequestRegistry()
    const sent: SigningBridgeMessage<SignAuthorizationParams>[] = []
    const params: SignAuthorizationParams = {
      contractAddress: '0x2222222222222222222222222222222222222222',
      chainId: 42101,
      nonce: 3,
    }

    const pending = registry.request<SignAuthorizationParams, { authorization: SignedAuthorization }>(
      'signAuthorization',
      params,
      (message) => sent.push(message),
    )

    expect(sent[0].data).toEqual(params)
    const authorization: SignedAuthorization = {
      address: params.contractAddress,
      chainId: 42101,
      nonce: 3,
      r: '0x01',
      s: '0x02',
      yParity: 0,
    }
    registry.resolve({
      type: 'signAuthorization',
      requestId: sent[0].requestId,
      data: { authorization },
    })

    await expect(pending).resolves.toEqual({ authorization })
  })

  it('correlates concurrent signing responses by request ID', async () => {
    const registry = new SigningRequestRegistry()
    const sent: SigningBridgeMessage<number>[] = []
    const first = registry.request<number, { signature: number }>(
      'signMessage', 1, (message) => sent.push(message),
    )
    const second = registry.request<number, { signature: number }>(
      'signMessage', 2, (message) => sent.push(message),
    )

    registry.resolve({
      type: 'signMessage', requestId: sent[1].requestId, data: { signature: 20 },
    })
    registry.resolve({
      type: 'signMessage', requestId: sent[0].requestId, data: { signature: 10 },
    })

    await expect(first).resolves.toEqual({ signature: 10 })
    await expect(second).resolves.toEqual({ signature: 20 })
  })

  it('propagates a bridged rejection message', async () => {
    const registry = new SigningRequestRegistry()
    let sent!: SigningBridgeMessage<SignAuthorizationParams>
    const pending = registry.request<SignAuthorizationParams, unknown>(
      'signAuthorization',
      { contractAddress: '0x3333333333333333333333333333333333333333' },
      (message) => { sent = message },
    )

    registry.reject({
      type: 'error',
      requestId: sent.requestId,
      data: { error: { message: 'User rejected the request', code: 4001 } },
    })

    await expect(pending).rejects.toThrow('User rejected the request')
    await pending.catch((error) => expect(error.code).toBe(4001))
  })
})
