import { google } from 'googleapis'

// Environment variables for Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

function getDefaultRedirectUri() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    return appUrl
        ? `${appUrl}/api/auth/google/callback`
        : 'http://localhost:3000/api/auth/google/callback'
}

// Create OAuth2 client
export function getOAuth2Client(options?: { redirectUri?: string }) {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        options?.redirectUri ?? getDefaultRedirectUri()
    )
}

// Generate authorization URL
export function getAuthUrl(options?: { redirectUri?: string }) {
    const oauth2Client = getOAuth2Client({ redirectUri: options?.redirectUri })
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/tasks',
            'https://www.googleapis.com/auth/tasks.readonly',
            'https://www.googleapis.com/auth/classroom.courses.readonly',
            'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
            'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
        ],
        prompt: 'consent', // Force to get refresh token
    })
}

// Get authenticated client from tokens
export function getAuthenticatedClient(tokens: { access_token: string; refresh_token?: string }) {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(tokens)
    return oauth2Client
}

// Calendar API helpers
export function getCalendarClient(tokens: { access_token: string; refresh_token?: string }) {
    const auth = getAuthenticatedClient(tokens)
    return google.calendar({ version: 'v3', auth })
}

// Tasks API helpers
export function getTasksClient(tokens: { access_token: string; refresh_token?: string }) {
    const auth = getAuthenticatedClient(tokens)
    return google.tasks({ version: 'v1', auth })
}

// Classroom API helpers
export function getClassroomClient(tokens: { access_token: string; refresh_token?: string }) {
    const auth = getAuthenticatedClient(tokens)
    return google.classroom({ version: 'v1', auth })
}

// Type for stored tokens
export interface GoogleTokens {
    access_token: string
    refresh_token?: string
    expiry_date?: number
}

// Type for google_accounts table row
export interface GoogleAccount {
    id: string
    user_id: string
    email: string
    name: string | null
    picture: string | null
    tokens: GoogleTokens
    services: string[]
    is_primary: boolean
    created_at: string
    updated_at: string
}

// Service types
export type GoogleService = 'tasks' | 'calendar' | 'classroom'
