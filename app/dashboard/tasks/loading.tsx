import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function TasksLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Skeleton className="h-8 w-32 bg-white/10" />
                    <Skeleton className="h-5 w-56 bg-white/10" />
                </div>
                <Skeleton className="h-10 w-28 bg-white/10" />
            </div>

            {/* Kanban columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['To Do', 'In Progress', 'Done'].map((column, i) => (
                    <Card key={i} className="bg-black/40 border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-5 w-24 bg-white/10" />
                                <Skeleton className="h-5 w-6 rounded-full bg-white/10" />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[...Array(i === 0 ? 3 : i === 1 ? 2 : 1)].map((_, j) => (
                                <Card key={j} className="bg-white/5 border-white/10">
                                    <CardContent className="p-3 space-y-2">
                                        <Skeleton className="h-4 w-3/4 bg-white/10" />
                                        <div className="flex justify-between items-center">
                                            <Skeleton className="h-3 w-16 bg-white/10" />
                                            <Skeleton className="h-5 w-12 rounded-full bg-white/10" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
