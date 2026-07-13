export type SigningBridgeMessage<T = unknown> = {
  type: string
  requestId?: string
  data: T
}

type PendingRequest = {
  action: string
  resolve: (data: unknown) => void
  reject: (error: Error) => void
  settled?: () => void
}

let fallbackRequestId = 0

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackRequestId += 1
  return `signing-${Date.now()}-${fallbackRequestId}`
}

export const bridgeError = (error: unknown): { message: string; code?: unknown } => {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; code?: unknown }
    return {
      message: String(candidate.message ?? error),
      ...(candidate.code !== undefined ? { code: candidate.code } : {}),
    }
  }
  return { message: String(error) }
}

export class SigningRequestRegistry {
  private readonly pending = new Map<string, PendingRequest>()

  request<TParams, TResult>(
    action: string,
    data: TParams,
    send: (message: SigningBridgeMessage<TParams>) => void,
    settled?: () => void,
  ): Promise<TResult> {
    const requestId = createRequestId()

    return new Promise<TResult>((resolve, reject) => {
      this.pending.set(requestId, {
        action,
        resolve: (value) => resolve(value as TResult),
        reject,
        settled,
      })
      send({ type: action, requestId, data })
    })
  }

  resolve(message: SigningBridgeMessage): boolean {
    const entry = this.find(message)
    if (!entry) return false

    this.pending.delete(entry.requestId)
    entry.pending.resolve(message.data)
    entry.pending.settled?.()
    return true
  }

  reject(message: SigningBridgeMessage<{
    error?: { message?: string; code?: unknown } | string
  }>): boolean {
    const entry = this.find(message)
    if (!entry) return false

    this.pending.delete(entry.requestId)
    const value = message.data?.error
    const errorMessage = typeof value === 'string'
      ? value
      : value?.message ?? 'Signature request failed'
    const error = new Error(errorMessage) as Error & { code?: unknown }
    if (typeof value === 'object' && value?.code !== undefined) {
      error.code = value.code
    }
    entry.pending.reject(error)
    entry.pending.settled?.()
    return true
  }

  private find(message: SigningBridgeMessage): {
    requestId: string
    pending: PendingRequest
  } | undefined {
    if (message.requestId) {
      const pending = this.pending.get(message.requestId)
      return pending ? { requestId: message.requestId, pending } : undefined
    }

    for (const [requestId, pending] of this.pending) {
      if (message.type === 'error' || pending.action === message.type) {
        return { requestId, pending }
      }
    }
    return undefined
  }
}
