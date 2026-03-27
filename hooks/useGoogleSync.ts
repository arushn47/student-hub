'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface SyncResult {
    tasks?: { synced: number }
    classroom?: { imported: number }
    calendar?: { synced: number }
}

// Background sync hook - runs sync on mount and periodically
export function useGoogleSync(options?: {
    interval?: number  // Sync interval in minutes (default: 10)
    enabled?: boolean
    showToasts?: boolean
    skipClassroom?: boolean
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
                    const supabase = createClient()
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

            // 1. Sync Google Tasks (fetch new tasks from Google)
            try {
                const tasksRes = await fetch('/api/google/sync', { method: 'POST' })
                if (tasksRes.ok) {
                    const data = await tasksRes.json()
                    results.tasks = { synced: data.synced || 0 }
                } else if (tasksRes.status === 401 || tasksRes.status === 403) {
                    // Token expired/revoked — check if reconnect is needed
                    try {
                        const data = await tasksRes.json()
                        if (data.needsReconnect && !reconnectDismissed.current) {
                            setNeedsReconnect(true)
                            setReconnectMessage(data.error || 'Your Google session has expired. Please reconnect your Google account.')
                        }
                    } catch {
                        // Couldn't parse JSON, still mark as needing reconnect
                    }
                    hasGoogleAccount.current = false
                    return results
                }
            } catch {
                // Network error - silently ignore
            }

            // 2. Import Google Classroom assignments (skip if feature is disabled)
            if (!options?.skipClassroom) {
                try {
                    const classroomRes = await fetch('/api/google/classroom', { method: 'POST' })
                    if (classroomRes.ok) {
                        const data = await classroomRes.json()
                        results.classroom = { imported: data.imported || 0 }
                    } else if (classroomRes.status === 401 || classroomRes.status === 403) {
                        // Token expired/revoked — surface reconnect dialog
                        try {
                            const data = await classroomRes.json()
                            if (data.needsReconnect && !reconnectDismissed.current) {
                                setNeedsReconnect(true)
                                setReconnectMessage(data.error || 'Your Google session has expired. Please reconnect your Google account.')
                            }
                        } catch {
                            // Couldn't parse JSON
                        }
                        hasGoogleAccount.current = false
                        return results
                    }
                } catch {
                    // Network error - silently ignore
                }
            }

            // Note: Calendar sync would go here when implemented

            lastSync.current = new Date()

            // Show toast if anything was synced
            if (showToasts) {
                const totalSynced = (results.tasks?.synced || 0) + (results.classroom?.imported || 0)
                if (totalSynced > 0) {
                    toast.success(`Synced ${totalSynced} items from Google`)
                }
            }

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
