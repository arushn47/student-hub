import { GoogleGenerativeAI, Part } from '@google/generative-ai'
import { jsonrepair } from 'jsonrepair'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
})

const geminiFallbackModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
})

const geminiJsonModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 4096,
    },
})

const geminiJsonFallbackModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 4096,
    },
})

export class GeminiRateLimitError extends Error {
    status = 429 as const
    retryAfterSeconds?: number

    constructor(message: string, retryAfterSeconds?: number) {
        super(message)
        this.name = 'GeminiRateLimitError'
        this.retryAfterSeconds = retryAfterSeconds
    }
}

export async function generateText(prompt: string | (string | Part)[]): Promise<string> {
    try {
        const result = await geminiModel.generateContent(prompt)
        return result.response.text()
    } catch (error) {
        const classified = classifyGeminiError(error)
        if (classified instanceof GeminiRateLimitError) {
            // Try fallback model once
            try {
                const result = await geminiFallbackModel.generateContent(prompt)
                return result.response.text()
            } catch (fallbackErr) {
                throw classifyGeminiError(fallbackErr)
            }
        }
        console.error('Gemini API Error:', error)
        throw new Error('Failed to generate AI response. Please try again.')
    }
}

export async function generateJSON<T>(prompt: string | (string | Part)[]): Promise<T> {
    try {
        const result = await geminiJsonModel.generateContent(prompt)
        const text = result.response.text()
        // Clean up the response - remove markdown code blocks if present
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

        const fixed = await geminiJsonModel.generateContent(fixPrompt)
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
    } catch (error) {
        const classified = classifyGeminiError(error)
        if (classified instanceof GeminiRateLimitError) {
            // Try fallback JSON model once
            try {
                const result = await geminiJsonFallbackModel.generateContent(prompt)
                const text = result.response.text()
                const cleanedText = text
                    .replace(/```json\n?/g, '')
                    .replace(/```\n?/g, '')
                    .trim()

                const candidate = extractJsonObject(cleanedText)
                const parsed = tryParseJson<T>(candidate)
                if (parsed !== null) return parsed

                throw new Error('Fallback model did not return valid JSON')
            } catch (fallbackErr) {
                throw classifyGeminiError(fallbackErr)
            }
        }

        console.error('Gemini API Error:', error)
        const message = classified instanceof Error ? classified.message : 'Failed to generate AI response. Please try again.'
        throw new Error(message)
    }
}

function classifyGeminiError(error: unknown): Error {
    // The SDK throws an Error that may have status/statusText/errorDetails.
    const anyErr = error as { status?: number; message?: string; errorDetails?: unknown[] }
    const message = typeof anyErr?.message === 'string' ? anyErr.message : 'Gemini request failed'

    if (anyErr?.status === 429 || message.includes('429') || message.toLowerCase().includes('quota')) {
        const retryAfter = extractRetryAfterSeconds(anyErr?.errorDetails)
        return new GeminiRateLimitError(message, retryAfter)
    }

    return error instanceof Error ? error : new Error(message)
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
    // Prefer the first complete JSON object in the response.
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
