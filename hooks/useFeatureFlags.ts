'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FeatureFlags {
    [key: string]: boolean
}

/**
 * Hook to fetch feature flags from the database.
 * Returns { isEnabled, isLoading, flags }
 * - Admins bypass flags (everything is enabled)
 * - Caches flags for the session
 */
export function useFeatureFlags() {
    const [flags, setFlags] = useState<FeatureFlags>({})
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Check sessionStorage cache first
        try {
            const cached = sessionStorage.getItem('feature-flags')
            if (cached) {
                setFlags(JSON.parse(cached))
                setIsLoading(false)
                return
            }
        } catch { }

        const supabase = createClient()
        supabase
            .from('feature_flags')
            .select('name, is_enabled')
            .then(({ data }) => {
                if (data) {
                    const flagMap: FeatureFlags = {}
                    for (const flag of data) {
                        flagMap[flag.name] = flag.is_enabled
                    }
                    setFlags(flagMap)
                    try { sessionStorage.setItem('feature-flags', JSON.stringify(flagMap)) } catch { }
                }
                setIsLoading(false)
            })
    }, [])

    const isEnabled = useCallback((name: string): boolean => {
        // If flag doesn't exist, default to enabled
        if (!(name in flags)) return true
        return flags[name]
    }, [flags])

    return { isEnabled, isLoading, flags }
}
