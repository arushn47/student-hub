'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(true)
    const [hasSession, setHasSession] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        let mounted = true

        const checkRecoveryState = async () => {
            try {
                const searchParams = new URLSearchParams(window.location.search)
                const urlError = searchParams.get('error_description') || searchParams.get('error')
                if (urlError) {
                    setErrorMessage(urlError)
                }

                // 1. Check if there's a code in search params (PKCE callback)
                const code = searchParams.get('code')
                if (code) {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
                    if (!mounted) return
                    if (!error && data.session) {
                        setHasSession(true)
                        setVerifying(false)
                        return
                    }
                }

                // 2. Check if there's token_hash and type in search params
                const token_hash = searchParams.get('token_hash')
                const type = searchParams.get('type') as 'recovery' | null
                if (token_hash && type === 'recovery') {
                    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
                    if (!mounted) return
                    if (!error && data.session) {
                        setHasSession(true)
                        setVerifying(false)
                        return
                    }
                }

                // 3. Check for existing active session
                const { data: { session } } = await supabase.auth.getSession()
                if (!mounted) return
                if (session) {
                    setHasSession(true)
                    setVerifying(false)
                    return
                }

                // 4. If URL has hash fragment (implicit token), allow Supabase SDK to parse it
                if (window.location.hash.includes('access_token')) {
                    // Small grace period for Supabase client to parse the hash
                    setTimeout(async () => {
                        if (!mounted) return
                        const { data: { session: hashSession } } = await supabase.auth.getSession()
                        if (hashSession) {
                            setHasSession(true)
                        }
                        setVerifying(false)
                    }, 800)
                    return
                }

                setVerifying(false)
            } catch (err) {
                console.error('Password reset auth check error:', err)
                if (mounted) setVerifying(false)
            }
        }

        // Listen for auth state changes (e.g. PASSWORD_RECOVERY event)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return
            if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
                setHasSession(true)
                setVerifying(false)
            }
        })

        checkRecoveryState()

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            toast.error("Passwords don't match")
            return
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }

        setLoading(true)

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) {
                toast.error(error.message)
                return
            }

            toast.success('Password updated successfully! Welcome back.')
            router.push('/dashboard')
        } catch {
            toast.error('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    if (verifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]" />
                <Card className="w-full max-w-md relative bg-black/40 backdrop-blur-xl border-white/10 text-center py-8">
                    <CardContent className="space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-400" />
                        <p className="text-gray-300 text-sm">Verifying your password reset link...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!hasSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]" />
                <Card className="w-full max-w-md relative bg-black/40 backdrop-blur-xl border-white/10 text-center">
                    <CardHeader className="space-y-2">
                        <div className="flex justify-center mb-2">
                            <div className="p-3 rounded-full bg-red-500/20 text-red-400">
                                <AlertCircle className="h-8 w-8" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold text-white">Link Expired or Invalid</CardTitle>
                        <CardDescription className="text-gray-400">
                            {errorMessage || 'This password reset link is invalid or has already expired. Please request a new one.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link href="/forgot-password" className="block w-full">
                            <Button className="w-full bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                                Request New Reset Link
                            </Button>
                        </Link>
                        <Link href="/login" className="block w-full">
                            <Button variant="ghost" className="w-full text-gray-400 hover:text-white">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
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
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-full bg-linear-to-r from-purple-500 to-pink-500">
                            <GraduationCap className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Set New Password</CardTitle>
                    <CardDescription className="text-gray-400">
                        Enter your new password below
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-300">New Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Update Password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
