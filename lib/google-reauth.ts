import { NextResponse } from 'next/server'

const DEFAULT_RECONNECT_MESSAGE =
    'Your Google session has expired. Please reconnect your Google account in Settings.'

export function isGoogleReauthError(error: unknown): boolean {
    const err = error as {
        code?: number
        message?: string
        response?: { status?: number; data?: unknown }
    }

    const messageRaw = err?.message ?? (error instanceof Error ? error.message : '')
    const message = messageRaw.toLowerCase()

    const responseStatus = err?.response?.status
    const code = err?.code

    let responseError = ''
    const data = err?.response?.data as { error?: unknown } | undefined
    if (data && typeof data.error === 'string') {
        responseError = data.error.toLowerCase()
    }

    return (
        code === 401 ||
        responseStatus === 401 ||
        message.includes('invalid_grant') ||
        responseError.includes('invalid_grant') ||
        message.includes('token has been expired or revoked')
    )
}

export function googleReauthResponse(message: string = DEFAULT_RECONNECT_MESSAGE) {
    return NextResponse.json(
        {
            error: message,
            needsReconnect: true,
            code: 'google_reauth_required',
        },
        { status: 401 }
    )
}

export function googleInsufficientScopeResponse(
    message: string = 'Please reconnect Google in Settings to enable Tasks access.'
) {
    return NextResponse.json(
        {
            error: message,
            needsReconnect: true,
            code: 'google_insufficient_scope',
        },
        { status: 403 }
    )
}
