'use client'

import { useEffect, useState } from 'react'

export function ClientOnly({ children, fallback = null }: { children: React.ReactNode, fallback?: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line
        setMounted(true)
    }, [])

    if (!mounted) {
        return fallback
    }

    return <>{children}</>
}
