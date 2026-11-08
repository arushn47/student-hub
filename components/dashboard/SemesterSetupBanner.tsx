'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { GraduationCap, Sparkles, X } from 'lucide-react'
import { SemesterSetupWizard } from '@/components/settings/SemesterSetupWizard'

interface SemesterSetupBannerProps {
    userId: string
}

export function SemesterSetupBanner({ userId }: SemesterSetupBannerProps) {
    const [wizardOpen, setWizardOpen] = useState(false)
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                return localStorage.getItem('student-hub:semester-banner-dismissed') === 'true'
            } catch {
                return false
            }
        }
        return false
    })

    const handleDismiss = () => {
        setDismissed(true)
        try {
            localStorage.setItem('student-hub:semester-banner-dismissed', 'true')
        } catch {}
    }

    if (dismissed) return null

    return (
        <div className="relative p-6 rounded-3xl bg-gradient-to-r from-purple-500/10 to-indigo-600/10 border border-purple-500/30 overflow-hidden shadow-xl animate-in fade-in duration-300">
            {/* Dismiss Button */}
            <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors z-20"
                aria-label="Dismiss banner"
            >
                <X className="h-4 w-4" />
            </button>

            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                <GraduationCap className="w-40 h-40 text-purple-400 transform rotate-12" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pr-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-400" />
                            Setup Required
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-white">✨ Complete your academic profile setup</h3>
                    <p className="text-gray-300 text-sm max-w-xl leading-relaxed">
                        Configure your semesters in seconds to unlock Class Timetable, Attendance tracking, and Calendar features.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button
                        onClick={() => setWizardOpen(true)}
                        className="w-full md:w-auto px-6 py-5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg shadow-purple-900/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Sparkles className="h-4 w-4" />
                        Launch Setup Wizard
                    </Button>
                </div>
            </div>

            <SemesterSetupWizard
                isOpen={wizardOpen}
                onOpenChange={setWizardOpen}
                onComplete={() => {
                    window.location.reload()
                }}
                userId={userId}
            />
        </div>
    )
}

