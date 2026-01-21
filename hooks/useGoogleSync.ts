'use client'

import { useEffect, useRef, useCallback } from 'react'
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
}) {
    const { interval = 10, enabled = true, showToasts = false } = options || {}
    const syncInProgress = useRef(false)
    const lastSync = useRef<Date | null>(null)

    const syncAll = useCallback(async (): Promise<SyncResult> => {
        if (syncInProgress.current) return {}
        syncInProgress.current = true

        const results: SyncResult = {}

        try {
            // 1. Sync Google Tasks (fetch new tasks from Google)
            try {
                const tasksRes = await fetch('/api/google/sync', { method: 'POST' })
                if (tasksRes.ok) {
                    const data = await tasksRes.json()
                    results.tasks = { synced: data.synced || 0 }
                }
                // 400 = no Google account connected - silently ignore
            } catch {
                // Network error - silently ignore
            }

            // 2. Import Google Classroom assignments
            try {
                const classroomRes = await fetch('/api/google/classroom', { method: 'POST' })
                if (classroomRes.ok) {
                    const data = await classroomRes.json()
                    results.classroom = { imported: data.imported || 0 }
                }
                // 400 = no Google account connected - silently ignore
            } catch {
                // Network error - silently ignore
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

    return { syncAll, lastSync: lastSync.current, syncInProgress: syncInProgress.current }
}
