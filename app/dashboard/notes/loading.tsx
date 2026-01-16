import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function NotesLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Skeleton className="h-8 w-32 bg-white/10" />
                    <Skeleton className="h-5 w-48 bg-white/10" />
                </div>
                <Skeleton className="h-10 w-28 bg-white/10" />
            </div>

            {/* Search bar */}
            <Skeleton className="h-10 w-full max-w-md bg-white/10" />

            {/* Notes grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <Card key={i} className="bg-black/40 border-white/10">
                        <CardHeader className="pb-2">
                            <Skeleton className="h-5 w-3/4 bg-white/10" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-4 w-full bg-white/10" />
                            <Skeleton className="h-4 w-2/3 bg-white/10" />
                            <Skeleton className="h-3 w-20 mt-4 bg-white/10" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
