'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckSquare, ArrowRight, Plus } from 'lucide-react'
import type { Task } from '@/types'

interface TasksWidgetProps {
    tasks: Task[]
}

const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
}

export function TasksWidget({ tasks }: TasksWidgetProps) {
    const upcomingTasks = tasks
        .filter(task => task.status !== 'done')
        .slice(0, 5)

    return (
        <Card className="bg-black/40 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-purple-400" />
                    Upcoming Tasks
                </CardTitle>
                <Link href="/dashboard/tasks">
                    <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300 hover:bg-white/10">
                        View All <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                {upcomingTasks.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400 mb-4">No tasks yet</p>
                        <Link href="/dashboard/tasks">
                            <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
                                <Plus className="mr-2 h-4 w-4" /> Add Task
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {upcomingTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{task.title}</p>
                                    {task.due_date && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            Due: {new Date(task.due_date).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                                <Badge className={priorityColors[task.priority]}>
                                    {task.priority}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
