'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SpeechToTextButtonProps {
    onTranscript: (text: string) => void
    className?: string
    disabled?: boolean
}

// Check if Web Speech API is available
const isSpeechRecognitionSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

export function SpeechToTextButton({ onTranscript, className, disabled }: SpeechToTextButtonProps) {
    const [isListening, setIsListening] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        if (!isSpeechRecognitionSupported) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        const recognitionInstance = new SpeechRecognitionAPI()

        recognitionInstance.continuous = true
        recognitionInstance.interimResults = true
        recognitionInstance.lang = 'en-US'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognitionInstance.onresult = (event: any) => {
            let finalTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    finalTranscript += transcript
                }
            }

            if (finalTranscript) {
                onTranscript(finalTranscript)
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognitionInstance.onerror = (event: any) => {
            // 'network' error is expected on localhost without HTTPS - suppress it
            if (event.error === 'network') {
                console.log('Speech API needs HTTPS (works on deployed site)')
                setIsListening(false)
                return
            }
            console.error('Speech recognition error:', event.error)
            if (event.error === 'not-allowed') {
                toast.error('Microphone access denied. Please enable it in browser settings.')
            } else if (event.error !== 'aborted') {
                toast.error('Speech recognition error: ' + event.error)
            }
            setIsListening(false)
        }

        recognitionInstance.onend = () => {
            setIsListening(false)
        }

        recognitionRef.current = recognitionInstance

        return () => {
            recognitionInstance.abort()
        }
    }, [onTranscript])

    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) {
            toast.error('Speech recognition not supported in this browser')
            return
        }

        if (isListening) {
            recognitionRef.current.stop()
            setIsListening(false)
        } else {
            try {
                recognitionRef.current.start()
                setIsListening(true)
                toast.info('🎤 Listening... Speak now!')
            } catch {
                // Already started
            }
        }
    }, [isListening])

    if (!isSpeechRecognitionSupported) {
        return null
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            disabled={disabled}
            className={cn(
                "h-8 w-8 transition-all",
                isListening
                    ? "text-red-400 bg-red-500/20 hover:bg-red-500/30 animate-pulse"
                    : "text-gray-400 hover:text-purple-400 hover:bg-purple-500/10",
                className
            )}
            title={isListening ? "Stop listening" : "Start voice input"}
        >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
    )
}

// Text-to-Speech utility
export function speakText(text: string, options?: { rate?: number; pitch?: number; voice?: string }) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        toast.error('Text-to-speech not supported in this browser')
        return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options?.rate ?? 1
    utterance.pitch = options?.pitch ?? 1

    // Try to find a preferred voice
    const voices = window.speechSynthesis.getVoices()
    if (options?.voice) {
        const selectedVoice = voices.find(v => v.name.includes(options.voice!))
        if (selectedVoice) utterance.voice = selectedVoice
    }

    window.speechSynthesis.speak(utterance)
}

// TTS Button component
interface TextToSpeechButtonProps {
    text: string
    className?: string
    disabled?: boolean
}

export function TextToSpeechButton({ text, className, disabled }: TextToSpeechButtonProps) {
    const [isSpeaking, setIsSpeaking] = useState(false)

    const handleSpeak = () => {
        if (!text.trim()) {
            toast.error('No text to speak')
            return
        }

        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            toast.error('Text-to-speech not supported')
            return
        }

        if (isSpeaking) {
            window.speechSynthesis.cancel()
            setIsSpeaking(false)
        } else {
            setIsSpeaking(true)
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.onend = () => setIsSpeaking(false)
            utterance.onerror = () => setIsSpeaking(false)
            window.speechSynthesis.speak(utterance)
        }
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSpeak}
            disabled={disabled || !text.trim()}
            className={cn(
                "transition-all text-xs",
                isSpeaking
                    ? "text-purple-400 bg-purple-500/20"
                    : "text-gray-400 hover:text-purple-400 hover:bg-purple-500/10",
                className
            )}
        >
            {isSpeaking ? '🔊 Stop' : '🔈 Listen'}
        </Button>
    )
}
