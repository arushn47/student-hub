'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { GoogleAccount, GoogleService } from '@/lib/google'

const SERVICES: { id: GoogleService; label: string; icon: string }[] = [
    { id: 'tasks', label: 'Tasks', icon: '✓' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'classroom', label: 'Classroom', icon: '🎓' },
]

interface GoogleAccountsManagerProps {
    onConnectionChange?: (connected: boolean) => void
}

export function GoogleAccountsManager({ onConnectionChange }: GoogleAccountsManagerProps) {
    const [accounts, setAccounts] = useState<GoogleAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [connecting, setConnecting] = useState(false)
    const supabase = createClient()

    const loadAccounts = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('google_accounts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

        if (!error && data) {
            setAccounts(data as GoogleAccount[])
            onConnectionChange?.(data.length > 0)
        }
        setLoading(false)
    }, [supabase, onConnectionChange])

    useEffect(() => {
        loadAccounts()
    }, [loadAccounts])

    const connectNewAccount = async () => {
        setConnecting(true)
        try {
            const res = await fetch('/api/auth/google')
            const { authUrl } = await res.json()
            window.location.href = authUrl
        } catch {
            toast.error('Failed to start Google connection')
            setConnecting(false)
        }
    }

    const disconnectAccount = async (accountId: string) => {
        const { error } = await supabase
            .from('google_accounts')
            .delete()
            .eq('id', accountId)

        if (error) {
            toast.error('Failed to disconnect account')
        } else {
            toast.success('Account disconnected')
            loadAccounts()
        }
    }

    const toggleService = async (accountId: string, service: GoogleService, currentServices: string[]) => {
        // First, remove this service from all other accounts
        for (const account of accounts) {
            if (account.id !== accountId && account.services.includes(service)) {
                const newServices = account.services.filter(s => s !== service)
                await supabase
                    .from('google_accounts')
                    .update({ services: newServices })
                    .eq('id', account.id)
            }
        }

        // Toggle service on selected account
        let newServices: string[]
        if (currentServices.includes(service)) {
            newServices = currentServices.filter(s => s !== service)
        } else {
            newServices = [...currentServices, service]
        }

        const { error } = await supabase
            .from('google_accounts')
            .update({ services: newServices })
            .eq('id', accountId)

        if (error) {
            toast.error('Failed to update services')
        } else {
            loadAccounts()
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {accounts.length === 0 ? (
                <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">No Google accounts connected</p>
                    <Button onClick={connectNewAccount} disabled={connecting}>
                        {connecting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Plus className="h-4 w-4 mr-2" />
                        )}
                        Connect Google Account
                    </Button>
                </div>
            ) : (
                <>
                    {accounts.map((account) => (
                        <div
                            key={account.id}
                            className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10"
                        >
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={account.picture || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                                    {account.email[0].toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-white font-medium truncate">{account.name || account.email}</p>
                                    {account.is_primary && (
                                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                                    )}
                                </div>
                                <p className="text-gray-400 text-sm truncate">{account.email}</p>

                                {/* Service toggles */}
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {SERVICES.map((service) => {
                                        const isActive = account.services.includes(service.id)
                                        return (
                                            <button
                                                key={service.id}
                                                onClick={() => toggleService(account.id, service.id, account.services)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${isActive
                                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                {isActive && <CheckCircle2 className="h-3 w-3" />}
                                                <span>{service.icon}</span>
                                                <span>{service.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => disconnectAccount(account.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    {/* Add another account button */}
                    <Button
                        variant="outline"
                        className="w-full border-dashed border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
                        onClick={connectNewAccount}
                        disabled={connecting}
                    >
                        {connecting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Plus className="h-4 w-4 mr-2" />
                        )}
                        Connect Another Google Account
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                        Click services to assign them to different accounts (e.g., Classroom to school account)
                    </p>
                </>
            )}
        </div>
    )
}
