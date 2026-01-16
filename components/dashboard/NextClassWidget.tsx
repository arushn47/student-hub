'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, ArrowRight, MapPin } from 'lucide-react'
import type { ClassSchedule } from '@/types'

interface NextClassWidgetProps {
    classes: ClassSchedule[]
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function NextClassWidget({ classes }: NextClassWidgetProps) {
    // Find the next upcoming class
    const now = new Date()
    const currentDay = now.getDay()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    // Sort classes by day and time to find next one
    const sortedClasses = [...classes].sort((a, b) => {
        const aDayDiff = (a.day_of_week - currentDay + 7) % 7
        const bDayDiff = (b.day_of_week - currentDay + 7) % 7

        if (aDayDiff !== bDayDiff) return aDayDiff - bDayDiff

        const aTime = parseInt(a.start_time.split(':')[0]) * 60 + parseInt(a.start_time.split(':')[1])
        const bTime = parseInt(b.start_time.split(':')[0]) * 60 + parseInt(b.start_time.split(':')[1])

        return aTime - bTime
    })

    // Find the next class (either today after current time, or on a future day)
    const nextClass = sortedClasses.find((cls) => {
        const dayDiff = (cls.day_of_week - currentDay + 7) % 7
        const classTime = parseInt(cls.start_time.split(':')[0]) * 60 + parseInt(cls.start_time.split(':')[1])

        if (dayDiff === 0) {
            return classTime > currentTime
        }
        return true
    }) || sortedClasses[0]

    return (
        <Card className="bg-black/40 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    Next Class
                </CardTitle>
                <Link href="/dashboard/timetable">
                    <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 hover:bg-white/10">
                        Timetable <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                {!nextClass ? (
                    <div className="text-center py-4">
                        <p className="text-gray-400">No classes scheduled</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <div
                            className="w-2 h-16 rounded-full"
                            style={{ backgroundColor: nextClass.color }}
                        />
                        <div className="flex-1">
                            <p className="font-semibold text-white">{nextClass.name}</p>
                            <p className="text-sm text-gray-400">
                                {dayNames[nextClass.day_of_week]} • {nextClass.start_time} - {nextClass.end_time}
                            </p>
                            {nextClass.location && (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3" /> {nextClass.location}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
