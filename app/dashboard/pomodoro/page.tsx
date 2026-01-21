'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Play,
    Pause,
    RotateCcw,
    Coffee,
    Brain,
    Flame,
    Volume2,
    VolumeX,
    Eye,
    EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TimerMode = 'focus' | 'shortBreak' | 'longBreak'

const TIMER_CONFIGS = {
    focus: { minutes: 25, label: 'Focus Time', color: 'rose', icon: Brain },
    shortBreak: { minutes: 5, label: 'Short Break', color: 'emerald', icon: Coffee },
    longBreak: { minutes: 15, label: 'Long Break', color: 'cyan', icon: Coffee },
}

// Web Audio API for notification sound
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

        // Create a pleasant bell/chime sound
        const playTone = (frequency: number, startTime: number, duration: number) => {
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.frequency.value = frequency
            oscillator.type = 'sine'

            // Envelope for natural sound
            gainNode.gain.setValueAtTime(0, startTime)
            gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01)
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

            oscillator.start(startTime)
            oscillator.stop(startTime + duration)
        }

        const now = audioContext.currentTime
        // Play a pleasant chord
        playTone(523.25, now, 0.3)      // C5
        playTone(659.25, now + 0.1, 0.3) // E5
        playTone(783.99, now + 0.2, 0.4) // G5
    } catch (e) {
        console.log('Audio not supported:', e)
    }
}

export default function PomodoroPage() {
    const [mode, setMode] = useState<TimerMode>('focus')
    const [timeLeft, setTimeLeft] = useState(TIMER_CONFIGS.focus.minutes * 60)
    const [isRunning, setIsRunning] = useState(false)
    const [sessionsCompleted, setSessionsCompleted] = useState(0)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [timerHidden, setTimerHidden] = useState(false)
    const lastModeRef = useRef(mode)

    const config = TIMER_CONFIGS[mode]
    const totalSeconds = config.minutes * 60
    const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60

    const playSound = useCallback(() => {
        if (soundEnabled) {
            playNotificationSound()
        }
    }, [soundEnabled])

    const switchMode = useCallback((newMode: TimerMode) => {
        setMode(newMode)
        setTimeLeft(TIMER_CONFIGS[newMode].minutes * 60)
        setIsRunning(false)
    }, [])

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null

        if (isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        // Timer finished
                        playSound()
                        if (mode === 'focus') {
                            setSessionsCompleted(c => c + 1)
                            const nextCount = sessionsCompleted + 1
                            const nextMode = (nextCount + 1) % 4 === 0 ? 'longBreak' : 'shortBreak'
                            setMode(nextMode)
                            setIsRunning(false) // Pause after session completion
                            return TIMER_CONFIGS[nextMode].minutes * 60
                        } else {
                            setMode('focus')
                            setIsRunning(false) // Pause after break
                            return TIMER_CONFIGS.focus.minutes * 60
                        }
                    }
                    return prev - 1
                })
            }, 1000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isRunning, timeLeft, mode, sessionsCompleted, playSound])

    // Reset time when mode changes manually


    const toggleTimer = () => setIsRunning(!isRunning)

    const resetTimer = () => {
        setTimeLeft(config.minutes * 60)
        setIsRunning(false)
    }

    const colorClasses = {
        rose: {
            gradient: 'from-rose-500 to-pink-600',
            ring: 'stroke-rose-500',
            bg: 'bg-rose-500/10',
            text: 'text-rose-400',
            border: 'border-rose-500/30',
            progressBg: 'bg-rose-500',
        },
        emerald: {
            gradient: 'from-emerald-500 to-teal-600',
            ring: 'stroke-emerald-500',
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-400',
            border: 'border-emerald-500/30',
            progressBg: 'bg-emerald-500',
        },
        cyan: {
            gradient: 'from-cyan-500 to-blue-600',
            ring: 'stroke-cyan-500',
            bg: 'bg-cyan-500/10',
            text: 'text-cyan-400',
            border: 'border-cyan-500/30',
            progressBg: 'bg-cyan-500',
        },
    }

    const colors = colorClasses[config.color as keyof typeof colorClasses]

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-white">Pomodoro Timer</h1>
                <p className="text-gray-400">Stay focused and boost your productivity</p>
            </div>

            {/* Session Counter */}
            <div className="flex justify-center gap-2">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-3 h-3 rounded-full transition-all",
                            i < (sessionsCompleted % 4)
                                ? "bg-gradient-to-r from-rose-500 to-pink-500"
                                : "bg-white/10"
                        )}
                    />
                ))}
                {sessionsCompleted > 0 && (
                    <span className="ml-2 text-sm text-gray-400 flex items-center gap-1">
                        <Flame className="h-4 w-4 text-rose-400" />
                        {sessionsCompleted} sessions
                    </span>
                )}
            </div>

            {/* Mode Selector */}
            <div className="flex justify-center">
                <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                    {(Object.keys(TIMER_CONFIGS) as TimerMode[]).map((m) => (
                        <Button
                            key={m}
                            variant="ghost"
                            size="sm"
                            onClick={() => switchMode(m)}
                            className={cn(
                                "rounded-lg px-4 transition-all",
                                mode === m
                                    ? `${colors.bg} ${colors.text}`
                                    : "text-gray-400 hover:text-white"
                            )}
                        >
                            {TIMER_CONFIGS[m].label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Timer Display */}
            <Card className="glass-card border-white/[0.06] overflow-hidden">
                <CardContent className="p-8 md:p-12">
                    {timerHidden ? (
                        // Hidden Timer Mode - Minimal progress bar
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className={cn("inline-flex p-4 rounded-2xl mb-4", colors.bg)}>
                                    <config.icon className={cn("h-10 w-10", colors.text)} />
                                </div>
                                <p className={cn("text-lg font-medium", colors.text)}>
                                    {config.label}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {isRunning ? 'In progress...' : 'Paused'}
                                </p>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full transition-all duration-1000 rounded-full", colors.progressBg)}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        // Normal Timer Mode
                        <div className="relative flex items-center justify-center">
                            {/* Progress Ring */}
                            <svg className="w-64 h-64 md:w-80 md:h-80 transform -rotate-90">
                                {/* Background circle */}
                                <circle
                                    cx="50%"
                                    cy="50%"
                                    r="45%"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    className="text-white/5"
                                />
                                {/* Progress circle */}
                                <circle
                                    cx="50%"
                                    cy="50%"
                                    r="45%"
                                    fill="none"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    className={cn(colors.ring, "transition-all duration-1000")}
                                    strokeDasharray={`${2 * Math.PI * 45}%`}
                                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}%`}
                                />
                            </svg>

                            {/* Time Display */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className={cn("p-3 rounded-2xl mb-4", colors.bg)}>
                                    <config.icon className={cn("h-8 w-8", colors.text)} />
                                </div>
                                <span className="text-6xl md:text-7xl font-bold text-white font-mono tracking-tight">
                                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                                </span>
                                <span className={cn("text-sm mt-2", colors.text)}>
                                    {config.label}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex justify-center items-center gap-4 mt-8">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetTimer}
                            className="h-12 w-12 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <RotateCcw className="h-5 w-5" />
                        </Button>

                        <Button
                            onClick={toggleTimer}
                            className={cn(
                                "h-16 w-16 rounded-full bg-gradient-to-r shadow-lg transition-all hover:scale-105",
                                colors.gradient
                            )}
                        >
                            {isRunning ? (
                                <Pause className="h-7 w-7 text-white" />
                            ) : (
                                <Play className="h-7 w-7 text-white ml-1" />
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className="h-12 w-12 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            {soundEnabled ? (
                                <Volume2 className="h-5 w-5" />
                            ) : (
                                <VolumeX className="h-5 w-5" />
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTimerHidden(!timerHidden)}
                            className="h-12 w-12 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                            title={timerHidden ? "Show timer" : "Hide timer (focus mode)"}
                        >
                            {timerHidden ? (
                                <Eye className="h-5 w-5" />
                            ) : (
                                <EyeOff className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tips */}
            <Card className="glass-card border-white/[0.06]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">Focus Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-sm text-gray-300">
                        🎯 <span className="text-white font-medium">The Pomodoro Technique:</span> Work for 25 minutes, then take a 5-minute break. After 4 sessions, take a longer 15-minute break.
                    </p>
                    <p className="text-sm text-gray-400">
                        💡 Remove distractions, silence notifications, and focus on one task at a time.
                    </p>
                    <p className="text-sm text-gray-400">
                        👁️ Use the <span className="text-white">hide timer</span> button if watching the clock is distracting you!
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}

