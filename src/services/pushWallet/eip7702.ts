import type {
  SignAuthorizationParams,
  SignedAuthorization,
} from '@pushchain/core'

export const EIP7702_UNSUPPORTED_ERROR =
  'Wallet does not support EIP-7702 authorization'

type AuthorizationLike = {
  address?: `0x${string}`
  chainId?: number | bigint
  nonce?: number | bigint
  r?: `0x${string}`
  s?: `0x${string}`
  yParity?: number | bigint
  signature?: {
    r: `0x${string}`
    s: `0x${string}`
    yParity: number | bigint
  }
}

export const normalizeSignedAuthorization = (
  auth: AuthorizationLike,
  params: SignAuthorizationParams,
): SignedAuthorization => {
  const signature = auth.signature ?? auth

  return {
    address: params.contractAddress,
    chainId: Number(auth.chainId ?? params.chainId),
    nonce: Number(auth.nonce ?? params.nonce),
    r: signature.r!,
    s: signature.s!,
    yParity: Number(signature.yParity),
  }
}

const isUnsupportedAuthorizationError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: unknown; message?: unknown }
  const message = String(candidate.message ?? '').toLowerCase()

  return candidate.code === 'UNSUPPORTED_OPERATION' ||
    message.includes('authorization not implemented')
}

export const signAuthorizationWithEthersSigner = async (
  getSigner: () => Promise<{
    authorize?: (authorization: {
      address: `0x${string}`
      chainId?: number
      nonce?: number
    }) => Promise<AuthorizationLike>
  }>,
  params: SignAuthorizationParams,
): Promise<SignedAuthorization> => {
  const signer = await getSigner()

  if (typeof signer.authorize !== 'function') {
    throw new Error(EIP7702_UNSUPPORTED_ERROR)
  }

  try {
    const auth = await signer.authorize({
      address: params.contractAddress,
      chainId: params.chainId,
      nonce: params.nonce,
    })

    return normalizeSignedAuthorization(auth, params)
  } catch (error) {
    if (isUnsupportedAuthorizationError(error)) {
      throw new Error(EIP7702_UNSUPPORTED_ERROR)
    }
    throw error
  }
}
