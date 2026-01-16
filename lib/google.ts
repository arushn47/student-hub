import { google } from 'googleapis'

// Environment variables for Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    : 'http://localhost:3000/api/auth/google/callback'

// Create OAuth2 client
export function getOAuth2Client() {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
    )
}

// Generate authorization URL
export function getAuthUrl() {
    const oauth2Client = getOAuth2Client()
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/tasks',
            'https://www.googleapis.com/auth/tasks.readonly',
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

// Type for stored tokens
export interface GoogleTokens {
    access_token: string
    refresh_token?: string
    expiry_date?: number
}
