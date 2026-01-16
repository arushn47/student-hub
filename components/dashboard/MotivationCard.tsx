'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Client-side cache key
const CACHE_KEY = 'motivation_quote'
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in ms

interface CachedQuote {
    quote: string
    timestamp: number
}

function getCachedQuote(): string | null {
    if (typeof window === 'undefined') return null

    try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (!cached) return null

        const { quote, timestamp }: CachedQuote = JSON.parse(cached)

        // Check if cache is still valid (1 hour)
        if (Date.now() - timestamp < CACHE_DURATION) {
            return quote
        }

        // Cache expired
        localStorage.removeItem(CACHE_KEY)
        return null
    } catch {
        return null
    }
}

function setCachedQuote(quote: string): void {
    if (typeof window === 'undefined') return

    try {
        const cached: CachedQuote = {
            quote,
            timestamp: Date.now()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
    } catch {
        // Ignore localStorage errors
    }
}

// Fallback quotes to use when API fails or rate limited
const FALLBACK_QUOTES = [
    '"The beautiful thing about learning is that no one can take it away from you." - B.B. King',
    '"Education is the most powerful weapon which you can use to change the world." - Nelson Mandela',
    '"The expert in anything was once a beginner." - Helen Hayes',
    '"Success is the sum of small efforts, repeated day in and day out." - Robert Collier',
    '"The only way to do great work is to love what you do." - Steve Jobs',
    '"Believe you can and you\'re halfway there." - Theodore Roosevelt',
    '"Learning never exhausts the mind." - Leonardo da Vinci',
]

function getRandomFallbackQuote(): string {
    return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]
}

export function MotivationCard() {
    const [quote, setQuote] = useState<string>('')
    const [loading, setLoading] = useState(true)

    const fetchQuote = async (forceRefresh = false) => {
        setLoading(true)

        // Check client-side cache first (unless forcing refresh)
        if (!forceRefresh) {
            const cached = getCachedQuote()
            if (cached) {
                setQuote(cached)
                setLoading(false)
                return
            }
        }

        try {
            const response = await fetch('/api/ai/motivation')

            // Handle rate limiting or errors gracefully
            if (!response.ok) {
                const fallback = getRandomFallbackQuote()
                setQuote(fallback)
                setCachedQuote(fallback)
                return
            }

            const data = await response.json()
            const newQuote = data.quote || getRandomFallbackQuote()
            setQuote(newQuote)
            setCachedQuote(newQuote)
        } catch {
            const fallback = getRandomFallbackQuote()
            setQuote(fallback)
            setCachedQuote(fallback)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchQuote()
    }, [])

    return (
        <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 backdrop-blur-xl">
            <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex-shrink-0">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-purple-300">Daily Motivation</p>
                            {loading ? (
                                <div className="h-5 w-48 bg-white/10 animate-pulse rounded" />
                            ) : (
                                <p className="text-white/90 italic leading-relaxed">{quote}</p>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fetchQuote(true)}
                        disabled={loading}
                        className="text-purple-300 hover:text-white hover:bg-white/10 flex-shrink-0"
                        title="Get new quote"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
