import { useState, useCallback, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Eye, Download, Calendar, Folder, GraduationCap, Clock, Trash2, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'

interface PaperListItemProps {
    paper: {
        id: string
        title: string
        college: string
        subject: string
        exam_type: string | null
        year: number
        file_url: string | null
        uploaded_by: string | null
    }
    currentUserId?: string
    isAdmin?: boolean
    onDelete?: () => Promise<void>
}

export function PaperListItem({ paper, currentUserId, isAdmin, onDelete }: PaperListItemProps) {
    const [deleting, setDeleting] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [zoom, setZoom] = useState(1)
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Scroll wheel → zoom (non-passive so we can block page scroll)
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const handler = (e: WheelEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setZoom(z => Math.min(5, Math.max(0.5, z + (e.deltaY > 0 ? -0.15 : 0.15))))
        }
        el.addEventListener('wheel', handler, { passive: false })
        return () => el.removeEventListener('wheel', handler)
    }, [])

    // Auto-center scroll when zoom changes
    useEffect(() => {
        const el = scrollRef.current
        if (!el || !imgSize) return
        requestAnimationFrame(() => {
            const scaledW = imgSize.w * zoom
            const scaledH = imgSize.h * zoom
            const containerW = el.clientWidth
            const containerH = el.clientHeight
            // Scroll to center: total content = max(scaledSize, containerSize), center = half of spillover
            el.scrollLeft = Math.max(0, (scaledW - containerW) / 2)
            el.scrollTop = Math.max(0, (scaledH - containerH) / 2)
        })
    }, [zoom, imgSize])

    const canDelete = isAdmin || (currentUserId && paper.uploaded_by === currentUserId)

    const handleDelete = async () => {
        if (!onDelete) return
        setDeleting(true)
        try {
            await onDelete()
            toast.success('Paper deleted successfully')
        } catch {
            toast.error('Failed to delete paper')
        } finally {
            setDeleting(false)
            setConfirmOpen(false)
        }
    }

    return (
        <div className="group relative overflow-hidden bg-black/40 hover:bg-white/5 border border-white/5 hover:border-purple-500/20 rounded-xl transition-all duration-300">
            {/* Hover decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/0 to-purple-500/0 group-hover:via-purple-500/5 transition-all duration-500" />

            <div className="relative p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    {/* Icon Box */}
                    <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-xl bg-gray-900/50 border border-white/5 items-center justify-center text-purple-400 group-hover:scale-105 group-hover:border-purple-500/30 transition-all shadow-lg shadow-black/20">
                        <FileText className="h-6 w-6" />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-gray-100 group-hover:text-purple-300 transition-colors text-lg">
                                {paper.subject}
                            </h3>
                            <Badge variant="outline" className="text-xs font-normal bg-purple-500/10 text-purple-400 border-purple-500/20">
                                {paper.exam_type || 'Exam'}
                            </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5 hover:text-gray-300 transition-colors">
                                <GraduationCap className="h-4 w-4" />
                                {paper.college}
                            </div>
                            <div className="w-1 h-1 bg-gray-700 rounded-full hidden sm:block" />
                            <div className="flex items-center gap-1.5 hover:text-gray-300 transition-colors">
                                <Calendar className="h-4 w-4" />
                                {paper.year}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0 mt-2 sm:mt-0">
                    <Dialog onOpenChange={(open) => { if (open) setZoom(1) }}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="bg-black/20 border-white/10 hover:bg-white/10 hover:text-white gap-2 transition-all">
                                <Eye className="h-4 w-4" />
                                <span className="hidden sm:inline">Preview</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] h-[85vh] max-w-none sm:max-w-6xl p-0 gap-0 bg-gray-950 border-white/10 flex flex-col overflow-hidden outline-none sm:rounded-xl">
                            <div className="h-14 min-h-[3.5rem] px-4 border-b border-white/10 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm z-10 shrink-0">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="h-5 w-5 text-purple-400 shrink-0" />
                                    <DialogTitle className="font-medium text-sm sm:text-base truncate text-gray-200 m-0">
                                        {paper.title}
                                    </DialogTitle>
                                </div>
                                <Button size="sm" className="bg-white text-black hover:bg-gray-200 shrink-0" onClick={() => window.open(paper.file_url || '', '_blank')}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                </Button>
                            </div>
                            <div className="flex-1 bg-gray-900 relative w-full h-full overflow-hidden">
                                {paper.file_url ? (
                                    paper.file_url.toLowerCase().endsWith('.pdf') ? (
                                        <iframe
                                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(paper.file_url)}&embedded=true`}
                                            className="w-full h-full border-0 absolute inset-0"
                                            title={paper.title}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-black/50 relative">
                                            {/* Zoom controls — above scroll area */}
                                            <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-lg border border-white/15 p-1 shadow-xl">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-white/15"
                                                    onClick={() => setZoom(z => Math.min(5, z + 0.25))}
                                                >
                                                    <ZoomIn className="h-4 w-4" />
                                                </Button>
                                                <span className="text-xs text-gray-300 font-medium w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-white/15"
                                                    onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                                                >
                                                    <ZoomOut className="h-4 w-4" />
                                                </Button>
                                                {zoom !== 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-white/15"
                                                        onClick={() => setZoom(1)}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                            {/* Scrollable image area */}
                                            <div
                                                ref={scrollRef}
                                                className="absolute inset-0 overflow-auto z-10"
                                            >
                                                {/* Spacer: centers image at 100%, overflows correctly when zoomed without extra left space */}
                                                <div style={imgSize ? {
                                                    minWidth: '100%',
                                                    minHeight: '100%',
                                                    width: imgSize.w * zoom,
                                                    height: imgSize.h * zoom,
                                                    position: 'relative',
                                                } : { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={paper.file_url}
                                                        alt={paper.title}
                                                        className="shadow-2xl absolute"
                                                        style={imgSize ? {
                                                            left: '50%',
                                                            top: '50%',
                                                            transform: `translate(-50%, -50%) scale(${zoom})`,
                                                            width: imgSize.w,
                                                            height: imgSize.h,
                                                        } : {
                                                            maxWidth: '100%',
                                                            maxHeight: '100%',
                                                            objectFit: 'contain' as const,
                                                        }}
                                                        draggable={false}
                                                        onLoad={(e) => {
                                                            const img = e.currentTarget
                                                            const container = scrollRef.current
                                                            if (!container) return
                                                            const cw = container.clientWidth
                                                            const ch = container.clientHeight
                                                            const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1)
                                                            setImgSize({
                                                                w: img.naturalWidth * scale,
                                                                h: img.naturalHeight * scale,
                                                            })
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                                        <FileText className="h-12 w-12 opacity-20" />
                                        <p>Preview not available</p>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg shadow-purple-500/20"
                        onClick={() => window.open(paper.file_url || '', '_blank')}
                        disabled={!paper.file_url}
                    >
                        <Download className="h-4 w-4" />
                    </Button>

                    {canDelete && (
                        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-black/20 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-red-400 hover:text-red-300 transition-all"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-sm bg-gray-950 border-white/10">
                                <DialogTitle className="text-lg font-semibold">Delete Paper</DialogTitle>
                                <p className="text-sm text-gray-400 mt-1">
                                    Are you sure you want to delete <span className="text-gray-200 font-medium">{paper.title}</span>? This action cannot be undone.
                                </p>
                                <div className="flex gap-3 mt-4 justify-end">
                                    <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} className="border-white/10">
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                    >
                                        {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        {deleting ? 'Deleting...' : 'Delete'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>
        </div>
    )
}
