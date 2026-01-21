'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, X, Send, Loader2, Sparkles, Minimize2, Maximize2, Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

type ChatSize = 'small' | 'medium' | 'large'

const CHAT_SIZES: Record<ChatSize, { width: string; height: string }> = {
    small: { width: 'md:w-80', height: 'md:h-[400px]' },
    medium: { width: 'md:w-96', height: 'md:h-[500px]' },
    large: { width: 'md:w-[450px]', height: 'md:h-[600px]' },
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
    const [isListening, setIsListening] = useState(false)
    const [speechSupported, setSpeechSupported] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null)

    // Check for speech recognition support
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            setSpeechSupported(!!SpeechRecognition)
        }
    }, [])

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Initialize speech recognition
    const startListening = useCallback(() => {
        if (!speechSupported) return

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()

        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onstart = () => {
            setIsListening(true)
        }

        recognition.onresult = (event: { results: Iterable<unknown> | ArrayLike<unknown> }) => {
            const transcript = Array.from(event.results)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((result: any) => result[0].transcript)
                .join('')
            setInput(transcript)
        }

        recognition.onerror = () => {
            setIsListening(false)
        }

        recognition.onend = () => {
            setIsListening(false)
        }

        recognitionRef.current = recognition
        recognition.start()
    }, [speechSupported])

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            setIsListening(false)
        }
    }, [])

    const toggleListening = () => {
        if (isListening) {
            stopListening()
        } else {
            startListening()
        }
    }

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

            // Handle action responses (reminders, notes)
            if (data.action) {
                if (data.action.type === 'reminder' && data.action.success && data.action.data) {
                    // Save reminder to localStorage
                    const existingReminders = JSON.parse(localStorage.getItem('reminders') || '[]')
                    const newReminder = {
                        id: crypto.randomUUID(),
                        title: data.action.data.title,
                        datetime: data.action.data.datetime,
                        type: 'custom',
                        notified: false,
                    }
                    existingReminders.push(newReminder)
                    localStorage.setItem('reminders', JSON.stringify(existingReminders))
                }
                // Notes are already saved to database by the API
            }

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

            {/* Chat Panel - Fullscreen on mobile, positioned panel on desktop */}
            <div
                className={cn(
                    "fixed z-50 bg-gray-900/95 backdrop-blur-xl",
                    // Mobile: fullscreen
                    "inset-0 md:inset-auto",
                    // Desktop: positioned panel
                    "md:bottom-6 md:right-6 md:rounded-2xl md:shadow-2xl md:border md:border-white/10",
                    currentSize.width, currentSize.height,
                    "flex flex-col overflow-hidden",
                    "transition-all duration-300 ease-out",
                    isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
                )}
            >
                {/* Header */}
                <div className="p-3 md:p-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 shrink-0">
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
                            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 hidden md:flex"
                            title={`Size: ${size}`}
                        >
                            {size === 'large' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="h-8 w-8 md:h-7 md:w-7 text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <X className="h-5 w-5 md:h-4 md:w-4" />
                        </Button>
                    </div>
                </div>

                {/* Messages - Proper scrollable container */}
                <div className="flex-1 overflow-y-auto p-3 md:p-3">
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
                                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input - Fixed at bottom with proper padding for mobile */}
                <div className="p-3 md:p-3 border-t border-white/10 shrink-0 safe-area-bottom">
                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask me anything..."
                            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500 text-sm h-10"
                            disabled={loading}
                        />
                        {/* Voice Input Button */}
                        {speechSupported && (
                            <Button
                                onClick={toggleListening}
                                size="sm"
                                variant={isListening ? "destructive" : "outline"}
                                className={cn(
                                    "h-10 w-10 shrink-0",
                                    isListening
                                        ? "bg-red-500 hover:bg-red-600 border-red-500"
                                        : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                                )}
                            >
                                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </Button>
                        )}
                        <Button
                            onClick={sendMessage}
                            disabled={!input.trim() || loading}
                            size="sm"
                            className="h-10 w-10 shrink-0 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                    {isListening && (
                        <p className="text-xs text-purple-400 mt-2 text-center animate-pulse">
                            🎤 Listening... Speak now
                        </p>
                    )}
                </div>
            </div>
        </>
    )
}

// Add Web Speech API type declarations
declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SpeechRecognition: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webkitSpeechRecognition: any
    }
}
