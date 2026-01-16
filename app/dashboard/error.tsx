'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Dashboard error:', error)
    }, [error])

    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-sm space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30">
                    <AlertCircle className="h-6 w-6 text-red-400" />
                </div>

                <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
                    <p className="text-sm text-gray-400">
                        Failed to load dashboard data. Please try again.
                    </p>
                </div>

                {process.env.NODE_ENV === 'development' && error.message && (
                    <p className="text-xs font-mono text-red-400 p-2 bg-red-500/10 rounded">
                        {error.message}
                    </p>
                )}

                <Button onClick={reset} size="sm" className="bg-purple-500 hover:bg-purple-600">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            </div>
        </div>
    )
}
