import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch messages for a group
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const groupId = searchParams.get('groupId')

        if (!groupId) {
            return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
        }

        // Verify user is a member of this group
        const { data: membership } = await supabase
            .from('assignment_group_members')
            .select('id')
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .eq('status', 'accepted')
            .single()

        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
        }

        // Fetch messages
        const { data: messages, error } = await supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true })
            .limit(100)

        if (error) {
            console.error('Error fetching messages:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get unique user IDs and fetch their profiles
        const userIds = [...new Set(messages?.map(m => m.user_id) || [])]

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .in('id', userIds)

        // Create a quick lookup
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

        // Attach sender info to messages
        const messagesWithSender = messages?.map(m => ({
            ...m,
            sender: profileMap.get(m.user_id) || { id: m.user_id, full_name: null, avatar_url: null, email: 'Unknown' }
        })) || []

        return NextResponse.json({ messages: messagesWithSender })
    } catch (error) {
        console.error('Get messages error:', error)
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }
}

// POST: Send a message to a group
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { groupId, content } = body

        if (!groupId || !content?.trim()) {
            return NextResponse.json({ error: 'groupId and content are required' }, { status: 400 })
        }

        if (content.length > 2000) {
            return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 })
        }

        // Verify user is a member of this group
        const { data: membership } = await supabase
            .from('assignment_group_members')
            .select('id')
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .eq('status', 'accepted')
            .single()

        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
        }

        // Insert message
        const { data: message, error } = await supabase
            .from('group_messages')
            .insert({
                group_id: groupId,
                user_id: user.id,
                content: content.trim(),
            })
            .select('*')
            .single()

        if (error) {
            console.error('Error sending message:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get sender profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .eq('id', user.id)
            .single()

        return NextResponse.json({
            message: {
                ...message,
                sender: profile || { id: user.id, full_name: null, avatar_url: null, email: 'Unknown' }
            }
        })
    } catch (error) {
        console.error('Send message error:', error)
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}
