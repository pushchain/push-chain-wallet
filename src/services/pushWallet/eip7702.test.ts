import { describe, expect, it, vi } from 'vitest'
import { HDKey } from 'viem/accounts'
import { CHAIN } from '@pushchain/core/src/lib/constants/enums'
import {
  EIP7702_UNSUPPORTED_ERROR,
  signAuthorizationWithEthersSigner,
} from './eip7702'
import { chainSignerRegistry } from './signerRegistry'

const params = {
  contractAddress: '0x1111111111111111111111111111111111111111' as const,
  chainId: 42101,
  nonce: 7,
}

describe('EIP-7702 authorization signing', () => {
  it('delegates to an ethers authorize method and normalizes its response', async () => {
    const authorize = vi.fn().mockResolvedValue({
      chainId: 42101n,
      nonce: 7n,
      signature: {
        r: '0x01',
        s: '0x02',
        yParity: 1n,
      },
    })

    await expect(
      signAuthorizationWithEthersSigner(async () => ({ authorize }), params),
    ).resolves.toEqual({
      address: params.contractAddress,
      chainId: 42101,
      nonce: 7,
      r: '0x01',
      s: '0x02',
      yParity: 1,
    })
    expect(authorize).toHaveBeenCalledWith({
      address: params.contractAddress,
      chainId: 42101,
      nonce: 7,
    })
  })

  it('maps only unsupported ethers errors to the clear wallet error', async () => {
    await expect(
      signAuthorizationWithEthersSigner(async () => ({}), params),
    ).rejects.toThrow(EIP7702_UNSUPPORTED_ERROR)

    await expect(
      signAuthorizationWithEthersSigner(async () => ({
        authorize: vi.fn().mockRejectedValue(
          Object.assign(new Error('authorization not implemented for this signer'), {
            code: 'UNSUPPORTED_OPERATION',
          }),
        ),
      }), params),
    ).rejects.toThrow(EIP7702_UNSUPPORTED_ERROR)
  })

  it('propagates user rejection unchanged', async () => {
    const rejection = Object.assign(new Error('User rejected the request'), {
      code: 4001,
    })

    await expect(
      signAuthorizationWithEthersSigner(async () => ({
        authorize: vi.fn().mockRejectedValue(rejection),
      }), params),
    ).rejects.toBe(rejection)
  })

  it('signs with the local viem EVM account and normalizes the authorization', async () => {
    const handler = chainSignerRegistry[CHAIN.ETHEREUM_MAINNET]!
    const signer = await handler(HDKey.fromMasterSeed(new Uint8Array(32).fill(7)))

    expect(signer.signAuthorization).toBeTypeOf('function')
    const authorization = await signer.signAuthorization!(params)

    expect(authorization).toMatchObject({
      address: params.contractAddress,
      chainId: params.chainId,
      nonce: params.nonce,
    })
    expect(authorization.r).toMatch(/^0x[0-9a-f]{64}$/)
    expect(authorization.s).toMatch(/^0x[0-9a-f]{64}$/)
    expect([0, 1]).toContain(authorization.yParity)
  })

  it('keeps existing local EVM message and typed-data signing available', async () => {
    const handler = chainSignerRegistry[CHAIN.ETHEREUM_MAINNET]!
    const signer = await handler(HDKey.fromMasterSeed(new Uint8Array(32).fill(5)))

    await expect(signer.signMessage(new Uint8Array([1, 2, 3]))).resolves.toBeInstanceOf(Uint8Array)
    await expect(signer.signTypedData!({
      domain: {
        name: 'Push',
        version: '1',
        chainId: 42101,
        verifyingContract: params.contractAddress,
      },
      types: {
        Message: [{ name: 'value', type: 'string' }],
      },
      primaryType: 'Message',
      message: { value: 'unchanged' },
    })).resolves.toBeInstanceOf(Uint8Array)
  })

  it('does not expose authorization signing for Solana', async () => {
    const handler = chainSignerRegistry[CHAIN.SOLANA_MAINNET]!
    const signer = await handler(HDKey.fromMasterSeed(new Uint8Array(32).fill(9)))

    expect(signer).not.toHaveProperty('signAuthorization')
  })
})
