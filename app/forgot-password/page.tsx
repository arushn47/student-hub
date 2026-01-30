'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const supabase = createClient()

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            })

            if (error) {
                toast.error(error.message)
                return
            }

            setSubmitted(true)
            toast.success('Password reset email sent!')
        } catch {
            toast.error('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]" />

                <Card className="w-full max-w-md relative bg-black/40 backdrop-blur-xl border-white/10">
                    <CardHeader className="space-y-1 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="p-3 rounded-full bg-linear-to-r from-purple-500 to-pink-500">
                                <BookOpen className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold text-white">Check your email</CardTitle>
                        <CardDescription className="text-gray-400">
                            We've sent a password reset link to <span className="text-white font-medium">{email}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-center text-gray-500 mb-4">
                            Click the link in the email to reset your password. If you don't see it, check your spam folder.
                        </p>
                        <Link href="/login">
                            <Button className="w-full" variant="secondary">
                                Back to Login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]" />

            <Card className="w-full max-w-md relative bg-black/40 backdrop-blur-xl border-white/10">
                <CardHeader className="space-y-1 text-center">
                    <div className="relative">
                        <Link href="/login" className="absolute left-0 top-0 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="h-6 w-6" />
                        </Link>
                        <div className="flex justify-center mb-4">
                            <div className="p-3 rounded-full bg-linear-to-r from-purple-500 to-pink-500">
                                <BookOpen className="h-8 w-8 text-white" />
                            </div>
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Reset Password</CardTitle>
                    <CardDescription className="text-gray-400">
                        Enter your email address and we'll send you a link to reset your password
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleReset} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-300">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Send Reset Link
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
