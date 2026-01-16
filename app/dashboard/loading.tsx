import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardLoading() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="space-y-1">
                <Skeleton className="h-9 w-64 bg-white/10" />
                <Skeleton className="h-5 w-80 bg-white/10" />
            </div>

            {/* Motivation card skeleton */}
            <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
                <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                        <Skeleton className="h-9 w-9 rounded-full bg-white/10" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-24 bg-white/10" />
                            <Skeleton className="h-5 w-full bg-white/10" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats grid skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="bg-white/5 border-white/10">
                        <CardContent className="p-4">
                            <Skeleton className="h-5 w-5 mb-2 bg-white/10" />
                            <Skeleton className="h-8 w-12 mb-1 bg-white/10" />
                            <Skeleton className="h-4 w-20 bg-white/10" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Widgets grid skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <Card key={i} className="bg-black/40 border-white/10">
                        <CardHeader className="pb-2">
                            <Skeleton className="h-6 w-32 bg-white/10" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[...Array(3)].map((_, j) => (
                                <Skeleton key={j} className="h-16 w-full bg-white/10" />
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Next class skeleton */}
            <Card className="bg-black/40 border-white/10">
                <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full bg-white/10" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-40 bg-white/10" />
                            <Skeleton className="h-4 w-24 bg-white/10" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
