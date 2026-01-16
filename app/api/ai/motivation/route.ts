import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse, checkRateLimit, rateLimitResponse } from '@/lib/api-utils'

// Cache motivation quotes to reduce API calls
// Key: date string, Value: quote
const quoteCache = new Map<string, { quote: string; timestamp: number }>()
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

function getCachedQuote(): string | null {
    const today = new Date().toDateString()
    const cached = quoteCache.get(today)

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.quote
    }

    return null
}

function setCachedQuote(quote: string): void {
    const today = new Date().toDateString()
    quoteCache.set(today, { quote, timestamp: Date.now() })

    // Clean old cache entries
    for (const [key] of quoteCache.entries()) {
        if (key !== today) {
            quoteCache.delete(key)
        }
    }
}

export async function GET() {
    try {
        // Check authentication
        const user = await getAuthenticatedUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Check rate limit (5 requests per minute for motivation)
        const rateLimit = checkRateLimit(user.id, 'motivation', 5, 60000)
        if (!rateLimit.allowed) {
            return rateLimitResponse(rateLimit.resetIn)
        }

        // Check cache first
        const cachedQuote = getCachedQuote()
        if (cachedQuote) {
            return NextResponse.json(
                { quote: cachedQuote },
                {
                    headers: {
                        'X-Cache': 'HIT',
                        'X-RateLimit-Remaining': rateLimit.remaining.toString()
                    }
                }
            )
        }

        const prompt = `Generate a short, inspiring motivational quote for a student. The quote should be:
- Encouraging and uplifting
- Related to learning, studying, growth, or academic success
- Original or a famous quote with attribution
- Maximum 2 sentences

Return ONLY the quote text and attribution (if any), nothing else. Example format:
"The beautiful thing about learning is that no one can take it away from you." - B.B. King`

        const response = await generateText(prompt)
        const quote = response.trim()

        // Cache the quote
        setCachedQuote(quote)

        return NextResponse.json(
            { quote },
            {
                headers: {
                    'X-Cache': 'MISS',
                    'X-RateLimit-Remaining': rateLimit.remaining.toString()
                }
            }
        )
    } catch (error) {
        console.error('Motivation API Error:', error)
        // Return fallback quote on error (don't expose error details)
        return NextResponse.json(
            { quote: '"Every expert was once a beginner. Keep going!" - Unknown' },
            { status: 200 }
        )
    }
}
