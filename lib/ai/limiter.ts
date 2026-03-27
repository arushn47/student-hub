type Task<T> = {
    fn: () => Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: unknown) => void
    queuedAt: number
    timeoutId?: NodeJS.Timeout
}

export interface AILimiterOptions {
    concurrency: number
    maxQueue: number
    timeoutMs: number
    failureThreshold: number
    cooldownMs: number
}

export class AILimiter {
    private concurrency: number
    private maxQueue: number
    private timeoutMs: number
    private failureThreshold: number
    private cooldownMs: number

    private active = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private queue: Task<any>[] = []
    private failures = 0
    private openUntil: number | null = null

    constructor(opts: AILimiterOptions) {
        this.concurrency = opts.concurrency
        this.maxQueue = opts.maxQueue
        this.timeoutMs = opts.timeoutMs
        this.failureThreshold = opts.failureThreshold
        this.cooldownMs = opts.cooldownMs
    }

    isOpen() {
        if (this.openUntil && Date.now() < this.openUntil) return true
        if (this.openUntil && Date.now() >= this.openUntil) {
            // reset circuit
            this.openUntil = null
            this.failures = 0
            return false
        }
        return false
    }

    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.isOpen()) {
            return Promise.reject(new Error('AI service temporarily unavailable (circuit open)'))
        }

        if (this.active < this.concurrency) {
            return this.execute(fn)
        }

        if (this.queue.length >= this.maxQueue) {
            return Promise.reject(new Error('AI service busy — try again later'))
        }

        // Enqueue
        return new Promise<T>((resolve, reject) => {
            const task: Task<T> = { fn, resolve, reject, queuedAt: Date.now() }
            // Set a timeout for waiting in queue — if not started within timeout, reject
            task.timeoutId = setTimeout(() => {
                // Remove from queue if still present
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const idx = this.queue.indexOf(task as any)
                if (idx !== -1) this.queue.splice(idx, 1)
                reject(new Error('AI request timed out in queue'))
            }, this.timeoutMs)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.queue.push(task as any)
        })
    }

    private async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.active++
        let finished = false

        try {
            const result = await this.runWithTimeout(fn)
            finished = true
            this.onSuccess()
            return result
        } catch (err) {
            this.onFailure()
            throw err
        } finally {
            this.active--
            // Start queued tasks if any
            this.processQueue()
        }
    }

    private runWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let finished = false
            const timer = setTimeout(() => {
                if (!finished) {
                    finished = true
                    reject(new Error('AI request timed out'))
                }
            }, this.timeoutMs)

            fn()
                .then((res) => {
                    if (finished) return
                    finished = true
                    clearTimeout(timer)
                    resolve(res)
                })
                .catch((err) => {
                    if (finished) return
                    finished = true
                    clearTimeout(timer)
                    reject(err)
                })
        })
    }

    private processQueue() {
        while (this.active < this.concurrency && this.queue.length > 0) {
            const task = this.queue.shift()!
            if (task.timeoutId) clearTimeout(task.timeoutId)

            // Execute and resolve/reject accordingly
            this.execute(task.fn)
                .then((v) => task.resolve(v))
                .catch((e) => task.reject(e))
        }
    }

    private onSuccess() {
        this.failures = 0
    }

    private onFailure() {
        this.failures++
        if (this.failures >= this.failureThreshold) {
            this.openUntil = Date.now() + this.cooldownMs
            console.warn(`AI circuit opened for ${this.cooldownMs}ms after ${this.failures} failures`)
        }
    }
}

// Default instance — per-process limiter
export const aiLimiter = new AILimiter({
    concurrency: 5, // per-user preference: 3-5; choose 5 conservative upper bound
    maxQueue: 20,
    timeoutMs: 15000, // 15s
    failureThreshold: 5,
    cooldownMs: 60000, // 60s cooldown
})
