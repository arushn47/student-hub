'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { LoginRequiredDialog } from '@/components/ui/LoginRequiredDialog'
import { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/rbac'

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError'
}

function isNetworkFetchError(error: unknown) {
    return error instanceof TypeError && /failed to fetch/i.test(error.message)
}

interface AuthContextType {
    user: User | null
    role: UserRole
    isAdmin: boolean
    isGuest: boolean
    isLoading: boolean
    checkAuthAndPrompt: (feature?: string) => Promise<boolean>
    requireAuth: (feature?: string) => boolean
    setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
    children,
    initialUser
}: {
    children: ReactNode
    initialUser: User | null
}) {
    const [user, setUser] = useState<User | null>(initialUser)
    const [role, setRole] = useState<UserRole>('user')
    const [isLoading, setIsLoading] = useState(false)
    const [showLoginDialog, setShowLoginDialog] = useState(false)
    const [currentFeature, setCurrentFeature] = useState<string>('')

    // Fetch user role from profiles table
    useEffect(() => {
        if (!user) {
            setRole('user')
            return
        }

                let cancelled = false
        void (async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                if (cancelled) return
                if (data?.role) setRole(data.role as UserRole)
            } catch {
                // Network issues shouldn't crash auth context.
            }
        })()

        return () => {
            cancelled = true
        }
    }, [user])

    // Listen for auth state changes (e.g. OAuth login, logout)
    useEffect(() => {
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_OUT') {
                setUser(null)
                return
            }

            // Avoid using session.user (can be insecure per Supabase warning).
            try {
                const { data, error } = await supabase.auth.getUser()
                if (!error) setUser(data.user)
            } catch (e) {
                // If auth server is unreachable, keep current state.
                if (isAbortError(e) || isNetworkFetchError(e)) return
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const isGuest = user === null

    // Check if user is authenticated and show login dialog if not
    const checkAuthAndPrompt = useCallback(async (feature?: string): Promise<boolean> => {
        if (user) return true

        // Double check with fresh auth state
        setIsLoading(true)
        try {
                        const { data, error } = await supabase.auth.getUser()
            if (!error && data.user) {
                setUser(data.user)
                return true
            }
        } catch {
            // Ignore errors
        } finally {
            setIsLoading(false)
        }

        // Not authenticated - show dialog
        setCurrentFeature(feature || 'this feature')
        setShowLoginDialog(true)
        return false
    }, [user])

    // Synchronous version for immediate checks
    const requireAuth = useCallback((feature?: string): boolean => {
        if (user) return true
        setCurrentFeature(feature || 'this feature')
        setShowLoginDialog(true)
        return false
    }, [user])

    return (
        <AuthContext.Provider value={{
            user,
            role,
            isAdmin: role === 'admin',
            isGuest,
            isLoading,
            checkAuthAndPrompt,
            requireAuth,
            setUser,
        }}>
            {children}
            <LoginRequiredDialog
                open={showLoginDialog}
                onOpenChange={setShowLoginDialog}
                feature={currentFeature}
                message={`Sign in to use ${currentFeature} and save your progress`}
            />
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// Hook to use for protecting actions
export function useRequireAuth() {
    const { requireAuth, checkAuthAndPrompt } = useAuth()
    return { requireAuth, checkAuthAndPrompt }
}
