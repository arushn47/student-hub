'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Send, MessageCircle, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Message {
    id: string
    content: string
    created_at: string
    user_id: string
    sender: {
        id: string
        full_name: string | null
        avatar_url: string | null
        email: string
    }
}

interface GroupChatProps {
    groupId: string
    assignmentTitle: string
    onClose?: () => void
}

export function GroupChat({ groupId, assignmentTitle, onClose }: GroupChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    const fetchMessages = useCallback(async () => {
        try {
            const res = await fetch(`/api/assignments/groups/messages?groupId=${groupId}`)
            const data = await res.json()

            if (res.ok && data.messages) {
                setMessages(data.messages)
            }
        } catch (error) {
            console.error('Error fetching messages:', error)
        } finally {
            setLoading(false)
        }
    }, [groupId])

    useEffect(() => {
        // Get current user
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id)
        })

        fetchMessages()

        // Subscribe to real-time updates
        const channel = supabase
            .channel(`group-${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'group_messages',
                    filter: `group_id=eq.${groupId}`,
                },
                async (payload) => {
                    // Fetch the message with sender info
                    const { data: newMsg } = await supabase
                        .from('group_messages')
                        .select(`
                            *,
                            sender:profiles!user_id(id, full_name, avatar_url, email)
                        `)
                        .eq('id', payload.new.id)
                        .single()

                    if (newMsg) {
                        setMessages(prev => [...prev, newMsg as Message])
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [groupId, supabase, fetchMessages])

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const sendMessage = async () => {
        if (!newMessage.trim() || sending) return

        setSending(true)
        try {
            const res = await fetch('/api/assignments/groups/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId,
                    content: newMessage.trim(),
                }),
            })

            if (res.ok) {
                setNewMessage('')
            }
        } catch (error) {
            console.error('Send error:', error)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-card border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-purple-400" />
                    <div>
                        <p className="font-medium text-sm">Group Chat</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {assignmentTitle}
                        </p>
                    </div>
                </div>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs">Start the conversation!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((message) => {
                            const isOwn = message.user_id === currentUserId
                            return (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "flex gap-2",
                                        isOwn && "flex-row-reverse"
                                    )}
                                >
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarImage src={message.sender?.avatar_url || undefined} />
                                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs">
                                            {message.sender?.full_name?.[0] || message.sender?.email?.[0]?.toUpperCase() || '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className={cn("max-w-[70%]", isOwn && "text-right")}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn(
                                                "text-xs font-medium",
                                                isOwn ? "text-purple-400" : "text-foreground"
                                            )}>
                                                {isOwn ? 'You' : (message.sender?.full_name || message.sender?.email)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <div className={cn(
                                            "rounded-lg px-3 py-2 text-sm inline-block",
                                            isOwn
                                                ? "bg-purple-500 text-white"
                                                : "bg-muted text-foreground"
                                        )}>
                                            {message.content}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                    <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        disabled={sending}
                        className="flex-1"
                    />
                    <Button
                        size="icon"
                        disabled={!newMessage.trim() || sending}
                        onClick={sendMessage}
                        className="bg-purple-500 hover:bg-purple-600"
                    >
                        {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
