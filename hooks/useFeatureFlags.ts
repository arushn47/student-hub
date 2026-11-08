'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

interface FeatureFlags {
    [key: string]: boolean
}

// Safe initial defaults: core tools enabled, experimental/hidden features disabled by default
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
    exam_prep: true,
    grades: true,
    question_papers: true,
    calendar: true,
    timetable: true,
    attendance: true,
    pomodoro: true,
    reminders: true,
    budget: true,
    semesters: true,
}

/**
 * Hook to fetch feature flags from the database.
 * Returns { isEnabled, isLoading, flags }
 * - Uses Stale-While-Revalidate pattern with sessionStorage
 * - Falls back to safe defaults if network or database is unreachable
 */
export function useFeatureFlags() {
    const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let isCancelled = false

        // 1. Read from sessionStorage cache immediately for instant render
        try {
            const cached = sessionStorage.getItem('feature-flags')
            if (cached) {
                const parsed = JSON.parse(cached)
                setFlags(prev => ({ ...prev, ...parsed }))
                setIsLoading(false)
            }
        } catch { }

        // 2. Always revalidate in background from Supabase (Stale-While-Revalidate)
        const fetchFlags = async () => {
            try {
                // Safety timeout in case of network stalls
                const timeoutPromise = new Promise<{ data: null }>((resolve) =>
                    setTimeout(() => resolve({ data: null }), 5000)
                )

                const queryPromise = supabase
                    .from('feature_flags')
                    .select('name, is_enabled')

                const response = await Promise.race([queryPromise, timeoutPromise])

                if (!isCancelled && response && 'data' in response && response.data) {
                    const flagMap: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS }
                    for (const flag of response.data) {
                        flagMap[flag.name] = flag.is_enabled
                    }
                    setFlags(flagMap)
                    try {
                        sessionStorage.setItem('feature-flags', JSON.stringify(flagMap))
                    } catch { }
                }
            } catch (err) {
                console.warn('Failed to fetch latest feature flags:', err)
            } finally {
                if (!isCancelled) {
                    setIsLoading(false)
                }
            }
        }

        fetchFlags()

        return () => {
            isCancelled = true
        }
    }, [])

    const isEnabled = useCallback((name: string): boolean => {
        if (name in flags) {
            return flags[name]
        }
        return DEFAULT_FEATURE_FLAGS[name] ?? false
    }, [flags])

    return { isEnabled, isLoading, flags }
}
