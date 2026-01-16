'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, X, Send, Loader2, Sparkles, Minimize2, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

type ChatSize = 'small' | 'medium' | 'large'

const CHAT_SIZES: Record<ChatSize, { width: string; height: string }> = {
    small: { width: 'w-80', height: 'h-[400px]' },
    medium: { width: 'w-96', height: 'h-[500px]' },
    large: { width: 'w-[450px]', height: 'h-[600px]' },
}

export function StudyBuddyWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [size, setSize] = useState<ChatSize>('medium')
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Hi! I'm your Study Buddy 📚 Ask me anything about your studies, and I'll help you understand it better!"
        }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const cycleSize = () => {
        const sizes: ChatSize[] = ['small', 'medium', 'large']
        const currentIndex = sizes.indexOf(size)
        const nextIndex = (currentIndex + 1) % sizes.length
        setSize(sizes[nextIndex])
    }

    const sendMessage = async () => {
        if (!input.trim() || loading) return

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setLoading(true)

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', content: userMessage }]
                }),
            })

            if (!response.ok) throw new Error('Failed to get response')

            const data = await response.json()
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I couldn't process that. Please try again!"
            }])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const currentSize = CHAT_SIZES[size]

    return (
        <>
            {/* Floating Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
                    "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
                    "transition-transform duration-200",
                    isOpen && "scale-0"
                )}
            >
                <MessageCircle className="h-6 w-6" />
            </Button>

            {/* Chat Panel */}
            <div
                className={cn(
                    "fixed bottom-6 right-6 z-50",
                    currentSize.width, currentSize.height,
                    "bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10",
                    "flex flex-col overflow-hidden",
                    "transition-all duration-300 ease-out",
                    isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
                )}
            >
                {/* Header */}
                <div className="p-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                            <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white text-sm">Study Buddy</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={cycleSize}
                            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
                            title={`Size: ${size}`}
                        >
                            {size === 'large' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                    <div className="space-y-3">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex",
                                    message.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-2xl px-3 py-2",
                                        message.role === 'user'
                                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                            : "bg-white/10 text-gray-200"
                                    )}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white/10 rounded-2xl px-3 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-3 border-t border-white/10">
                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask me anything..."
                            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500 text-sm"
                            disabled={loading}
                        />
                        <Button
                            onClick={sendMessage}
                            disabled={!input.trim() || loading}
                            size="sm"
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
