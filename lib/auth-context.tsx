'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LoginRequiredDialog } from '@/components/ui/LoginRequiredDialog'
import { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/rbac'

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

        const supabase = createClient()
        supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                if (data?.role) {
                    setRole(data.role as UserRole)
                }
            })
    }, [user])

    // Listen for auth state changes (e.g. OAuth login, logout)
    useEffect(() => {
        const supabase = createClient()
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                setUser(session.user)
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
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
            const supabase = createClient()
            const { data: { user: freshUser } } = await supabase.auth.getUser()
            if (freshUser) {
                setUser(freshUser)
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
