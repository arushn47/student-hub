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
    VolumeX
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TimerMode = 'focus' | 'shortBreak' | 'longBreak'

const TIMER_CONFIGS = {
    focus: { minutes: 25, label: 'Focus Time', color: 'rose', icon: Brain },
    shortBreak: { minutes: 5, label: 'Short Break', color: 'emerald', icon: Coffee },
    longBreak: { minutes: 15, label: 'Long Break', color: 'cyan', icon: Coffee },
}

export default function PomodoroPage() {
    const [mode, setMode] = useState<TimerMode>('focus')
    const [timeLeft, setTimeLeft] = useState(TIMER_CONFIGS.focus.minutes * 60)
    const [isRunning, setIsRunning] = useState(false)
    const [sessionsCompleted, setSessionsCompleted] = useState(0)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const config = TIMER_CONFIGS[mode]
    const totalSeconds = config.minutes * 60
    const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60

    const playSound = useCallback(() => {
        if (soundEnabled && audioRef.current) {
            audioRef.current.play().catch(() => { })
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
                            // Auto-switch mode or stop
                            setMode(nextMode)
                            return TIMER_CONFIGS[nextMode].minutes * 60
                        } else {
                            setMode('focus')
                            return TIMER_CONFIGS.focus.minutes * 60
                        }
                    }
                    return prev - 1
                })
            }, 1000)
        } else if (timeLeft === 0 && isRunning) {
            setIsRunning(false)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isRunning, timeLeft, mode, sessionsCompleted, playSound])

    // Effect to stop running when mode changes auto-magically if needed, 
    // but the above refactor handles the switch and resets time.
    // We need to ensure isRunning stays true or becomes false as desired.
    // Let's stop the timer when it completes a cycle.

    useEffect(() => {
        // Reset running state if we switched modes manually or automatically via the interval logic
        // Actually, if we want auto-transition, the above logic sets new time.
        // If we want it to PAUSE after a session:
    }, [])

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
        },
        emerald: {
            gradient: 'from-emerald-500 to-teal-600',
            ring: 'stroke-emerald-500',
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-400',
            border: 'border-emerald-500/30',
        },
        cyan: {
            gradient: 'from-cyan-500 to-blue-600',
            ring: 'stroke-cyan-500',
            bg: 'bg-cyan-500/10',
            text: 'text-cyan-400',
            border: 'border-cyan-500/30',
        },
    }

    const colors = colorClasses[config.color as keyof typeof colorClasses]

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Hidden audio element */}
            <audio ref={audioRef} src="/sounds/bell.mp3" preload="auto" />

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
                </CardContent>
            </Card>
        </div>
    )
}
