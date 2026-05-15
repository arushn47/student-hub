import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Use getSession() instead of getUser() to avoid making ANY network requests in the Edge Runtime.
    // This perfectly bypasses the Indian ISP/Jio IPv6 routing timeout because it parses the JWT cookie locally!
    const {
        data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user

    // Catch auth codes that land on the wrong page (e.g. Supabase falling
    // back to site root when redirect URL isn't in the allowlist).
    // Forward them to /auth/callback so the code gets exchanged properly.
    // But skip our custom Google OAuth callback — it has its own code exchange.
    const code = request.nextUrl.searchParams.get('code')
    if (
        code &&
        !request.nextUrl.pathname.startsWith('/auth/callback') &&
        !request.nextUrl.pathname.startsWith('/api/auth/google/callback')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/callback'
        // Preserve existing params and decide where to redirect after exchange
        const type = request.nextUrl.searchParams.get('type')
        if (!url.searchParams.has('next')) {
            url.searchParams.set('next', type === 'recovery' ? '/reset-password' : '/dashboard')
        }
        return NextResponse.redirect(url)
    }

    // Protected routes - redirect to login if not authenticated
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/signup') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/forgot-password') &&
        !request.nextUrl.pathname.startsWith('/reset-password') &&
        request.nextUrl.pathname !== '/'
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth pages
    if (
        user &&
        (request.nextUrl.pathname.startsWith('/login') ||
            request.nextUrl.pathname.startsWith('/signup'))
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // Admin role protection is handled securely inside app/dashboard/admin/page.tsx
    // We removed the profile fetch from middleware to keep Edge runtime 100% offline.

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
