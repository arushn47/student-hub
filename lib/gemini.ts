import { GoogleGenerativeAI, Part } from '@google/generative-ai'
import { jsonrepair } from 'jsonrepair'
const MODELS = ['gemini-2.5-flash'] as const
function getClient(): GoogleGenerativeAI {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY is not configured')
    return new GoogleGenerativeAI(key)
}

export class GeminiRateLimitError extends Error {
    status = 429 as const
    retryAfterSeconds?: number

    constructor(message: string, retryAfterSeconds?: number) {
        super(message)
        this.name = 'GeminiRateLimitError'
        this.retryAfterSeconds = retryAfterSeconds
    }
}

export interface GenerateTextResult {
    text: string
    tokensUsed: number | null
    model: string
}

/** Whether a Gemini API key is configured. */
export function hasKey(): boolean {
    return !!process.env.GEMINI_API_KEY
}

/** Check if an error is retryable (429 quota / 503 overload). */
function isRetryableError(err: unknown): boolean {
    const status = (err as { status?: number })?.status
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
    
    return (
        status === 429 || status === 503 ||
        msg.includes('429') || msg.includes('503') ||
        msg.includes('overloaded') ||
        msg.includes('high demand') ||
        msg.includes('quota') ||
        msg.includes('fetch failed') ||
        msg.includes('timeout') ||
        msg.includes('connecttimeout') ||
        msg.includes('und_err_connect_timeout')
    )
}

/**
 * Try calling `fn` with each model in MODELS order.
 * Falls back to the next model on 429/503 errors.
 */
async function withModelFallback<T>(
    fn: (model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>, modelName: string) => Promise<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config?: Record<string, any>
): Promise<T> {
    const client = getClient()
    let lastErr: unknown = null

    for (let i = 0; i < MODELS.length; i++) {
        const modelName = MODELS[i]
        try {
            const model = config
                ? client.getGenerativeModel({ model: modelName, generationConfig: config })
                : client.getGenerativeModel({ model: modelName })
            console.log(`Using model: ${modelName}`)
            const result = await fn(model, modelName)
            return result
        } catch (err) {
            lastErr = err
            if (isRetryableError(err) && i < MODELS.length - 1) {
                console.warn(`Model ${modelName} failed (${(err as { status?: number })?.status || 'quota/overload'}), falling back to ${MODELS[i + 1]}...`)
                continue
            }
            throw err
        }
    }

    throw lastErr
}

export async function generateTextWithMeta(prompt: string | (string | Part)[]): Promise<GenerateTextResult> {
    try {
        return await withModelFallback(async (model, modelName) => {
            const result = await model.generateContent(prompt)
            return {
                text: result.response.text(),
                tokensUsed: result.response.usageMetadata?.totalTokenCount ?? null,
                model: modelName,
            }
        })
    } catch (error) {
        const classified = classifyGeminiError(error)
        console.error('Gemini API Error:', error)
        throw classified
    }
}

export async function generateText(prompt: string | (string | Part)[]): Promise<string> {
    try {
        return await withModelFallback(async (model) => {
            const result = await model.generateContent(prompt)
            return result.response.text()
        })
    } catch (error) {
        const classified = classifyGeminiError(error)
        console.error('Gemini API Error:', error)
        throw classified
    }
}

const JSON_CONFIG = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    maxOutputTokens: 4096,
}

export async function generateJSON<T>(prompt: string | (string | Part)[]): Promise<T> {
    try {
        return await withModelFallback(async (model) => {
            const result = await model.generateContent(prompt)
            const text = result.response.text()
            const cleanedText = text
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim()

            const candidate = extractJsonObject(cleanedText)
            const parsed = tryParseJson<T>(candidate)
            if (parsed !== null) return parsed

            // One retry: ask the model to output syntactically valid JSON only.
            const clipped = candidate.length > 30000 ? candidate.slice(0, 30000) : candidate
            const fixPrompt = `Fix the following to be STRICTLY valid JSON.

Rules:
- Output ONLY the JSON object (no markdown, no explanations).
- Preserve the same keys and overall structure.

Input:
${clipped}`

            const fixed = await model.generateContent(fixPrompt)
            const fixedText = extractJsonObject(
                fixed.response
                    .text()
                    .replace(/```json\n?/g, '')
                    .replace(/```\n?/g, '')
                    .trim()
            )

            const parsedFixed = tryParseJson<T>(fixedText)
            if (parsedFixed !== null) return parsedFixed

            throw new Error('Model did not return valid JSON after repair/retry')
        }, JSON_CONFIG)
    } catch (error) {
        const classified = classifyGeminiError(error)
        console.error('Gemini API Error:', error)
        throw classified
    }
}

/**
 * Direct model call for extract route — tries 2.5-flash then 2.0-flash.
 */
export async function generateContent(
    promptContent: string | (string | Part)[],
    timeoutMs: number = 55000
) {
    try {
        return await withModelFallback(async (model, modelName) => {
            console.log(`Extraction with ${modelName}`)
            return Promise.race([
                model.generateContent(promptContent),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('AI request timed out')), timeoutMs)
                ),
            ])
        })
    } catch (error) {
        const classified = classifyGeminiError(error)
        console.error('Gemini API Error:', error)
        throw classified
    }
}

function classifyGeminiError(error: unknown): Error {
    const anyErr = error as { status?: number; message?: string; errorDetails?: unknown[] }
    const rawMessage = typeof anyErr?.message === 'string' ? anyErr.message : 'Gemini request failed'

    if (anyErr?.status === 429 || rawMessage.includes('429') || rawMessage.toLowerCase().includes('quota')) {
        const retryAfter = extractRetryAfterSeconds(anyErr?.errorDetails)
        return new GeminiRateLimitError(rawMessage, retryAfter)
    }

    return new Error('Failed to generate AI response. Please try again.')
}

function extractRetryAfterSeconds(errorDetails?: unknown[]): number | undefined {
    if (!Array.isArray(errorDetails)) return undefined
    for (const d of errorDetails) {
        const obj = d as { ['@type']?: string; retryDelay?: string }
        if (obj?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && typeof obj.retryDelay === 'string') {
            const match = obj.retryDelay.match(/(\d+)s/)
            if (match) return Number(match[1])
        }
    }
    return undefined
}

function extractJsonObject(text: string): string {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
        return text.slice(start, end + 1).trim()
    }
    return text.trim()
}

function tryParseJson<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T
    } catch {
        try {
            const repaired = jsonrepair(text)
            return JSON.parse(repaired) as T
        } catch {
            return null
        }
    }
}
