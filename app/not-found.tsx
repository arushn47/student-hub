'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="text-center max-w-md space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/20 border border-purple-500/30">
                    <FileQuestion className="h-10 w-10 text-purple-400" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-6xl font-bold text-white">404</h1>
                    <h2 className="text-xl font-semibold text-white">Page Not Found</h2>
                    <p className="text-gray-400">
                        The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/dashboard">
                        <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 w-full">
                            <Home className="mr-2 h-4 w-4" />
                            Go to Dashboard
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        className="border-white/10 text-white hover:bg-white/10"
                        onClick={() => window.history.back()}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go Back
                    </Button>
                </div>
            </div>
        </div>
    )
}
