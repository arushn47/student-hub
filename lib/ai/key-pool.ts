import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'

/**
 * Gemini API Key Pool — round-robins across multiple API keys to
 * distribute free-tier quota evenly.
 *
 * Env setup:
 *   GEMINI_API_KEYS=key1,key2,key3   (comma-separated, preferred)
 *   GEMINI_API_KEY=key1              (single key fallback)
 */

function loadKeys(): string[] {
    const multi = process.env.GEMINI_API_KEYS
    if (multi) {
        const keys = multi.split(',').map(k => k.trim()).filter(Boolean)
        if (keys.length > 0) return keys
    }

    const single = process.env.GEMINI_API_KEY
    if (single) return [single]

    console.error('FATAL: No Gemini API keys configured (GEMINI_API_KEYS or GEMINI_API_KEY)')
    return []
}

const keys = loadKeys()
let index = 0

/** Get the next API key via round-robin. */
export function getNextKey(): string {
    if (keys.length === 0) return ''
    const key = keys[index % keys.length]
    index = (index + 1) % keys.length
    return key
}

/** Get a fresh GenerativeAI client using the next key in the pool. */
export function getRotatedClient(): GoogleGenerativeAI {
    return new GoogleGenerativeAI(getNextKey())
}

/** Get a model using the next key in the pool. */
export function getRotatedModel(modelName: string): GenerativeModel {
    return getRotatedClient().getGenerativeModel({ model: modelName })
}

/** How many keys are in the pool. */
export function poolSize(): number {
    return keys.length
}

/** Whether any keys are configured. */
export function hasKeys(): boolean {
    return keys.length > 0
}
