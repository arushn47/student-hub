import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse, checkRateLimit, rateLimitResponse } from '@/lib/api-utils'
import { createClient } from '@/lib/supabase/server'
import { addMinutes, addHours, addDays } from 'date-fns'

interface ChatAction {
    type: 'reminder' | 'note'
    success: boolean
    message: string
    data?: Record<string, unknown>
}

// Parse time expressions like "in 30 minutes", "tomorrow", "in 2 hours"
function parseTimeExpression(text: string): Date | null {
    const now = new Date()
    const lowerText = text.toLowerCase()

    // "in X minutes"
    const minutesMatch = lowerText.match(/in (\d+) minutes?/i)
    if (minutesMatch) {
        return addMinutes(now, parseInt(minutesMatch[1]))
    }

    // "in X hours"
    const hoursMatch = lowerText.match(/in (\d+) hours?/i)
    if (hoursMatch) {
        return addHours(now, parseInt(hoursMatch[1]))
    }

    // "tomorrow"
    if (lowerText.includes('tomorrow')) {
        const tomorrow = addDays(now, 1)
        tomorrow.setHours(9, 0, 0, 0) // Default to 9 AM
        return tomorrow
    }

    // "in X days"
    const daysMatch = lowerText.match(/in (\d+) days?/i)
    if (daysMatch) {
        return addDays(now, parseInt(daysMatch[1]))
    }

    // Default: 15 minutes from now
    return addMinutes(now, 15)
}

// Detect if message contains an action command
function detectAction(message: string): { type: 'reminder' | 'note' | null; content: string } {
    const lowerMsg = message.toLowerCase()

    // Reminder patterns
    const reminderPatterns = [
        /remind me (?:to |about )?(.+)/i,
        /set a reminder (?:to |for |about )?(.+)/i,
        /add reminder (?:to |for |about )?(.+)/i,
        /create reminder (?:to |for |about )?(.+)/i,
    ]

    for (const pattern of reminderPatterns) {
        const match = message.match(pattern)
        if (match) {
            return { type: 'reminder', content: match[1].trim() }
        }
    }

    // Note patterns
    const notePatterns = [
        /(?:create|add|make|write) (?:a )?note (?:about |for |titled )?(.+)/i,
        /note (?:down|this)[ :]+(.+)/i,
        /save (?:this )?(?:as )?(?:a )?note[ :]+(.+)/i,
    ]

    for (const pattern of notePatterns) {
        const match = message.match(pattern)
        if (match) {
            return { type: 'note', content: match[1].trim() }
        }
    }

    return { type: null, content: '' }
}

export async function POST(request: Request) {
    try {
        // Check authentication
        const user = await getAuthenticatedUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Check rate limit (20 chat messages per minute)
        const rateLimit = checkRateLimit(user.id, 'chat', 20, 60000)
        if (!rateLimit.allowed) {
            return rateLimitResponse(rateLimit.resetIn)
        }

        const { messages } = await request.json()

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Messages array is required' },
                { status: 400 }
            )
        }

        // Get the latest user message
        const latestMessage = messages[messages.length - 1]
        const userMessage = latestMessage?.role === 'user' ? latestMessage.content : ''

        // Detect if this is an action command
        const actionDetected = detectAction(userMessage)
        let action: ChatAction | null = null

        if (actionDetected.type) {
            const supabase = await createClient()

            if (actionDetected.type === 'reminder') {
                // Create reminder
                const reminderTime = parseTimeExpression(userMessage)
                const reminderTitle = actionDetected.content
                    .replace(/in \d+ (minutes?|hours?|days?)/gi, '')
                    .replace(/tomorrow/gi, '')
                    .trim()

                // Note: Reminders are stored in localStorage on client side
                // So we'll return the action for the frontend to handle
                action = {
                    type: 'reminder',
                    success: true,
                    message: `I've created a reminder for you! "${reminderTitle}" scheduled for ${reminderTime?.toLocaleString() || 'soon'}.`,
                    data: {
                        title: reminderTitle || actionDetected.content,
                        datetime: reminderTime?.toISOString(),
                    }
                }
            } else if (actionDetected.type === 'note') {
                // Create note in database
                const noteTitle = actionDetected.content.slice(0, 100)
                const { data, error } = await supabase
                    .from('notes')
                    .insert({
                        user_id: user.id,
                        title: noteTitle,
                        content: `<p>${actionDetected.content}</p>`,
                        is_pinned: false,
                    })
                    .select('id')
                    .single()

                if (error) {
                    action = {
                        type: 'note',
                        success: false,
                        message: 'Sorry, I couldn\'t create the note. Please try again.'
                    }
                } else {
                    action = {
                        type: 'note',
                        success: true,
                        message: `Done! I've created a new note titled "${noteTitle}". You can find it in your Notes section.`,
                        data: { id: data?.id, title: noteTitle }
                    }
                }
            }

            // Return action result directly without calling AI
            if (action) {
                return NextResponse.json(
                    { response: action.message, action },
                    {
                        headers: {
                            'X-RateLimit-Remaining': rateLimit.remaining.toString()
                        }
                    }
                )
            }
        }

        // Regular chat - not an action
        // Limit conversation history to prevent token abuse
        const recentMessages = messages.slice(-10)

        // Build conversation context
        const conversationHistory = recentMessages
            .map((msg: { role: string; content: string }) =>
                `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`
            )
            .join('\n')

        const prompt = `You are a helpful, friendly study tutor called "Study Buddy" for the StudentHub platform.

Role & Restrictions:
1. STRICTLY limited to academic topics, study advice, and helping users navigate this StudentHub website.
2. Refuse to answer inappropriate, NSFW, political, or non-educational off-topic questions.
3. If asked about website features, explain them: Dashboard, Notes (AI-powered), Tasks, Pomodoro, Flashcards, Grades (CGPA), and Budget.

Special Commands (tell users about these!):
- "Remind me to..." - Creates a reminder
- "Create a note about..." - Creates a new note
- "Add reminder for..." - Creates a reminder

Guidelines:
- Be encouraging and supportive
- Explain concepts in simple, easy-to-understand terms
- Use examples when helpful
- Keep responses concise but thorough
- If you don't know something, be honest about it
- Focus on education and learning

Conversation so far:
${conversationHistory}

Provide a helpful response as the tutor. Be conversational and friendly.`

        const response = await generateText(prompt)

        return NextResponse.json(
            { response },
            {
                headers: {
                    'X-RateLimit-Remaining': rateLimit.remaining.toString()
                }
            }
        )
    } catch (error) {
        console.error('Chat API Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate response. Please try again.' },
            { status: 500 }
        )
    }
}

