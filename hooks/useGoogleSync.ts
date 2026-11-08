'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface SyncResult {
    calendar?: { synced: number }
}

// Background sync hook - runs sync on mount and periodically
export function useGoogleSync(options?: {
    interval?: number  // Sync interval in minutes (default: 10)
    enabled?: boolean
    showToasts?: boolean
}) {
    const { interval = 10, enabled = true, showToasts = false } = options || {}
    const syncInProgress = useRef(false)
    const lastSync = useRef<Date | null>(null)
    const hasGoogleAccount = useRef<boolean | null>(null)
    const [needsReconnect, setNeedsReconnect] = useState(false)
    const [reconnectMessage, setReconnectMessage] = useState('')
    const reconnectDismissed = useRef(
        typeof window !== 'undefined' && sessionStorage.getItem('google-reconnect-dismissed') === 'true'
    )

    const dismissReconnect = useCallback(() => {
        setNeedsReconnect(false)
        setReconnectMessage('')
        reconnectDismissed.current = true
        try { sessionStorage.setItem('google-reconnect-dismissed', 'true') } catch { }
    }, [])

    const syncAll = useCallback(async (): Promise<SyncResult> => {
        if (syncInProgress.current) return {}
        syncInProgress.current = true

        const results: SyncResult = {}

        try {
            // Check if user has any Google account connected (cached after first check)
            if (hasGoogleAccount.current === null) {
                try {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) { hasGoogleAccount.current = false; return results }
                    const { count } = await supabase
                        .from('google_accounts')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                    hasGoogleAccount.current = (count ?? 0) > 0
                } catch {
                    hasGoogleAccount.current = false
                }
            }

            // Skip all sync requests if no Google account is connected
            if (!hasGoogleAccount.current) return results

            // Skip sync if user dismissed the reconnect dialog this session
            if (reconnectDismissed.current) return results

            lastSync.current = new Date()

            return results
        } finally {
            syncInProgress.current = false
        }
    }, [showToasts])

    useEffect(() => {
        if (!enabled) return

        // Initial sync on mount (with delay to not block initial render)
        const initialTimeout = setTimeout(() => {
            syncAll()
        }, 2000)

        // Periodic sync
        const intervalMs = interval * 60 * 1000
        const syncInterval = setInterval(() => {
            syncAll()
        }, intervalMs)

        return () => {
            clearTimeout(initialTimeout)
            clearInterval(syncInterval)
        }
    }, [enabled, interval, syncAll])

    return {
        syncAll,
        lastSync: lastSync.current,
        syncInProgress: syncInProgress.current,
        needsReconnect,
        reconnectMessage,
        dismissReconnect,
    }
}
