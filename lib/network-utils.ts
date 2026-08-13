/**
 * Wraps a promise or a promise-generating function in a strict timeout race with automatic retries.
 * If a function is provided, it automatically retries the operation on failure/timeout up to `retries` times.
 * Timeout window increased to 15 seconds to support extremely slow internet/ISP connections.
 */
export async function withTimeout<T>(
    promiseOrFn: (PromiseLike<T> | Promise<T>) | (() => PromiseLike<T> | Promise<T>),
    timeoutMs = 15000,
    retries = 2,
    delayMs = 1000
): Promise<T> {
    let attempt = 0

    const execute = async (): Promise<T> => {
        let timeoutId: NodeJS.Timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Network request timed out. Please check your internet connection.'))
            }, timeoutMs)
        })

        try {
            const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn
            const result = await Promise.race([Promise.resolve(promise), timeoutPromise])
            clearTimeout(timeoutId!)
            return result
        } catch (error) {
            clearTimeout(timeoutId!)
            throw error
        }
    }

    // If it is a pre-created promise, we cannot retry it (it can only run once)
    if (typeof promiseOrFn !== 'function') {
        return execute()
    }

    // If it is a function, we run with automatic retries
    while (attempt <= retries) {
        try {
            return await execute()
        } catch (error) {
            attempt++
            if (attempt > retries) {
                throw error
            }
            console.warn(`Network query failed (attempt ${attempt}/${retries + 1}). Retrying in ${delayMs}ms...`, error)
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    throw new Error('Network request failed')
}
