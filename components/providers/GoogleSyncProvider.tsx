'use client'

import { useGoogleSync } from '@/hooks/useGoogleSync'

// This component runs in the background and syncs Google services
export function GoogleSyncProvider() {
    // Sync every 10 minutes, show toast only when items are synced
    useGoogleSync({
        interval: 10,
        enabled: true,
        showToasts: true
    })

    // This component doesn't render anything
    return null
}
