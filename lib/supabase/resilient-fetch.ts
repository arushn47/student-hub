const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRY_DELAY_MS = 300

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function isTransientNetworkError(error: unknown) {
  // Browser/undici commonly surface network failures as TypeError('Failed to fetch')
  return error instanceof TypeError && /failed to fetch/i.test(error.message)
}

export function createResilientFetch(baseFetch: typeof fetch, opts?: {
  timeoutMs?: number
  retryDelayMs?: number
}) {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryDelayMs = opts?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  const resilientFetch: typeof fetch = async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const canRetry = method === 'GET' || method === 'HEAD'

    const attempt = async () => {
      // If the caller already passed a signal, don't override it.
      if (init?.signal) return baseFetch(input, init)

      // Only apply the strict timeout to GET/HEAD requests. 
      // Mutating requests (POST, PUT, DELETE) like file uploads can take much longer and shouldn't be forcefully killed early.
      if (!canRetry) {
          return baseFetch(input, init)
      }

      const controller = new AbortController()
      const id = setTimeout(() => {
        controller.abort(new DOMException('Request timed out', 'AbortError'))
      }, timeoutMs)

      try {
        return await baseFetch(input, { ...init, signal: controller.signal })
      } finally {
        clearTimeout(id)
      }
    }

    try {
      return await attempt()
    } catch (error) {
      if (canRetry && isTransientNetworkError(error)) {
        await sleep(retryDelayMs)
        return attempt()
      }
      throw error
    }
  }

  return resilientFetch
}
