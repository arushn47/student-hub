'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'

// Configure NProgress
NProgress.configure({
    showSpinner: false,
    minimum: 0.1,
    speed: 300,
    trickleSpeed: 100,
})

export function NavigationProgress() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        NProgress.done()
    }, [pathname, searchParams])

    return null
}

// Hook to trigger progress on navigation
export function useNavigationProgress() {
    return {
        start: () => NProgress.start(),
        done: () => NProgress.done(),
    }
}
