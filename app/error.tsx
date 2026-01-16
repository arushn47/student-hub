'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service in production
        console.error('Global error:', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="text-center max-w-md space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
                    <p className="text-gray-400">
                        We encountered an unexpected error. Please try again or return to the dashboard.
                    </p>
                </div>

                {process.env.NODE_ENV === 'development' && error.message && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-left">
                        <p className="text-sm font-mono text-red-400 break-all">
                            {error.message}
                        </p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={reset}
                        className="bg-purple-500 hover:bg-purple-600"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                    </Button>
                    <Link href="/dashboard">
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/10 w-full">
                            <Home className="mr-2 h-4 w-4" />
                            Go to Dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
