"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    FileText, Eye, Download, Calendar, GraduationCap, Trash2, Loader2,
    ZoomIn, ZoomOut, RotateCcw, FileType, Layers, ChevronLeft, ChevronRight
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import { normalizePaperExamType } from '@/lib/papers'

interface PaperCardProps {
    paper: {
        id: string
        title: string
        college: string
        subject: string
        exam_type: string | null
        year: number
        file_url: string | null
        file_urls?: string[] | null
        uploaded_by: string | null
        slot?: string | null
        page_count?: number | null
    }
    currentUserId?: string
    isAdmin?: boolean
    onDelete?: () => Promise<void>
}

export function PaperCard({ paper, currentUserId, isAdmin, onDelete }: PaperCardProps) {
    const [deleting, setDeleting] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [zoom, setZoom] = useState(1)
    const [currentPage, setCurrentPage] = useState(0)
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
    const [imageError, setImageError] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Resolve the list of page URLs — prefer file_urls array, fall back to single file_url
    const pageUrls: string[] = paper.file_urls && paper.file_urls.length > 0
        ? paper.file_urls
        : paper.file_url ? [paper.file_url] : []
    const totalPages = pageUrls.length
    const activeUrl = pageUrls[currentPage] ?? null

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
            el.scrollLeft = Math.max(0, (scaledW - containerW) / 2)
            el.scrollTop = Math.max(0, (scaledH - containerH) / 2)
        })
    }, [zoom, imgSize])

    const canDelete = isAdmin || (currentUserId && paper.uploaded_by === currentUserId)
    const displayExamType = normalizePaperExamType(paper.exam_type) ?? paper.exam_type
    const displayTitle = `${paper.subject} - ${displayExamType || 'Exam'} (${paper.year})`
    const isPdf = activeUrl?.toLowerCase().endsWith('.pdf')

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

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (pageUrls.length === 1) { 
            window.open(pageUrls[0], '_blank')
            return 
        }
        
        setIsDownloading(true)
        const loadingToast = toast.loading('Compiling PDF...')
        
        // Build a descriptive filename
        const filenameParts = [paper.subject, paper.exam_type, paper.year, paper.slot].filter(Boolean)
        const safeFilename = filenameParts.join('_').replace(/\s+/g, '_')

        try {
            const res = await fetch('/api/download-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls: pageUrls,
                    filename: safeFilename
                })
            })
            if (!res.ok) throw new Error('PDF compilation failed')
            
            const blob = await res.blob()
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `${safeFilename}.pdf`
            a.click()
            URL.revokeObjectURL(a.href)
            toast.success('Download complete', { id: loadingToast })
        } catch (err) {
            console.error('Download error:', err)
            toast.error('Failed to download PDF', { id: loadingToast })
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <div className="group relative overflow-hidden bg-black/40 border border-white/[0.08] rounded-2xl transition-all duration-300 hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.12)] hover:-translate-y-1 flex flex-col">
            <div onClick={() => setPreviewOpen(true)} className="flex flex-col flex-1 cursor-pointer">
                {/* Thumbnail Area */}
                <div className="relative h-36 bg-gradient-to-b from-[#1a1a2e] to-[#12121f] overflow-hidden">
                {/* Subtle grid pattern */}
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                />

                {/* Center icon or Image Preview */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {!isPdf && activeUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                            src={activeUrl} 
                            alt="Paper preview" 
                            loading="lazy"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" 
                        />
                    ) : (
                        <div className="relative">
                            <FileText className="h-14 w-14 text-purple-500/30 group-hover:text-purple-500/50 transition-colors duration-300" />
                            {/* Stacked page effect */}
                            <div className="absolute -bottom-1 -right-1 w-10 h-12 border border-purple-500/10 rounded bg-[#1a1a2e]/80" />
                        </div>
                    )}
                </div>

                {/* Bottom gradient overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />

                {/* Bottom-left: page count */}
                {totalPages > 0 && (
                    <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                        <Layers className="h-3 w-3 text-gray-400" />
                        <span className="text-[11px] font-medium text-gray-300">
                            {totalPages === 1 ? '1 page' : `${totalPages} pages`}
                        </span>
                    </div>
                )}

                {/* Bottom-right: file type badge */}
                <div className="absolute bottom-2.5 right-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/20">
                        {isPdf ? 'PDF' : 'IMG'}
                    </span>
                </div>
            </div>

            {/* Card Body */}
            <div className="flex-1 p-4 space-y-3">
                {/* Subject name */}
                <h3 className="font-semibold text-gray-100 text-[15px] leading-tight line-clamp-2 group-hover:text-purple-200 transition-colors">
                    {paper.subject}
                </h3>

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[11px] font-medium bg-purple-500/10 text-purple-400 border-purple-500/20 px-2 py-0.5">
                        {displayExamType || 'Exam'}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] font-medium bg-white/5 text-gray-400 border-white/10 px-2 py-0.5">
                        {paper.year}
                    </Badge>
                    {paper.slot && (
                        <Badge variant="outline" className="text-[11px] font-medium bg-amber-500/10 text-amber-400 border-amber-500/20 px-2 py-0.5">
                            {paper.slot}
                        </Badge>
                    )}
                </div>

                {/* College */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>{paper.college}</span>
                </div>
            </div>
            </div>

            {/* Card Footer */}
            <div className="px-4 pb-4 pt-0 flex items-center gap-2">
                {/* Preview */}
                <Dialog open={previewOpen} onOpenChange={(open) => {
                setPreviewOpen(open)
                if (open) { setZoom(1); setImageError(false); setCurrentPage(0); setImgSize(null) }
            }}>
                    <Button onClick={() => setPreviewOpen(true)} variant="outline" size="sm" className="flex-1 bg-black/20 border-white/10 hover:bg-white/10 hover:text-white gap-1.5 text-xs h-8 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                    </Button>
                    <DialogContent className="w-[95vw] h-[85vh] max-w-none sm:max-w-6xl p-0 gap-0 bg-gray-950 border-white/10 flex flex-col overflow-hidden outline-none sm:rounded-xl">
                        <div className="h-14 min-h-14 px-4 border-b border-white/10 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm z-10 shrink-0">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="h-5 w-5 text-purple-400 shrink-0" />
                                <DialogTitle className="font-medium text-sm sm:text-base truncate text-gray-200 m-0">
                                    {displayTitle}
                                    {paper.slot && <span className="text-amber-400 ml-2 text-xs">({paper.slot})</span>}
                                </DialogTitle>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Page navigation */}
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1 bg-black/40 rounded-lg border border-white/10 px-1">
                                        <Button variant="ghost" size="sm" className="h-8 w-7 p-0 text-gray-400 hover:text-white disabled:opacity-30"
                                            disabled={currentPage === 0}
                                            onClick={() => { setCurrentPage(p => p - 1); setZoom(1); setImgSize(null); setImageError(false) }}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs text-gray-300 font-medium min-w-[44px] text-center">
                                            {currentPage + 1} / {totalPages}
                                        </span>
                                        <Button variant="ghost" size="sm" className="h-8 w-7 p-0 text-gray-400 hover:text-white disabled:opacity-30"
                                            disabled={currentPage === totalPages - 1}
                                            onClick={() => { setCurrentPage(p => p + 1); setZoom(1); setImgSize(null); setImageError(false) }}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                                <Button size="sm" className="bg-white text-black hover:bg-gray-200" onClick={() => window.open(activeUrl || '', '_blank')}>
                                    <Download className="h-4 w-4 mr-2" />
                                    {totalPages > 1 ? `Page ${currentPage + 1}` : 'Download'}
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 bg-gray-900 relative w-full h-full overflow-hidden">
                            {activeUrl ? (
                                isPdf ? (
                                    <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(activeUrl)}&embedded=true`}
                                        className="w-full h-full border-0 absolute inset-0"
                                        title={displayTitle}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-black/50 relative">
                                        {/* Zoom controls */}
                                        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-lg border border-white/15 p-1 shadow-xl">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-white/15" onClick={() => setZoom(z => Math.min(5, z + 0.25))}>
                                                <ZoomIn className="h-4 w-4" />
                                            </Button>
                                            <span className="text-xs text-gray-300 font-medium w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-white/15" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
                                                <ZoomOut className="h-4 w-4" />
                                            </Button>
                                            {zoom !== 1 && (
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-white/15" onClick={() => setZoom(1)}>
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                        {/* Scrollable image */}
                                        <div ref={scrollRef} className="absolute inset-0 overflow-auto z-10">
                                            <div style={imgSize ? {
                                                minWidth: '100%', minHeight: '100%',
                                                width: imgSize.w * zoom, height: imgSize.h * zoom,
                                                position: 'relative',
                                            } : { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {imageError ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2">
                                                        <FileText className="h-12 w-12 opacity-20" />
                                                        <p className="text-sm">Preview failed to load</p>
                                                    </div>
                                                ) : (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={activeUrl}
                                                        alt={`${displayTitle} — Page ${currentPage + 1}`}
                                                        className="shadow-2xl absolute"
                                                        style={imgSize ? {
                                                            left: '50%', top: '50%',
                                                            transform: `translate(-50%, -50%) scale(${zoom})`,
                                                            width: imgSize.w, height: imgSize.h,
                                                        } : {
                                                            maxWidth: '100%', maxHeight: '100%',
                                                            objectFit: 'contain' as const,
                                                        }}
                                                        draggable={false}
                                                        onError={() => setImageError(true)}
                                                        onLoad={(e) => {
                                                            const img = e.currentTarget
                                                            const container = scrollRef.current
                                                            if (!container) return
                                                            const cw = container.clientWidth
                                                            const ch = container.clientHeight
                                                            const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1)
                                                            setImgSize({ w: img.naturalWidth * scale, h: img.naturalHeight * scale })
                                                        }}
                                                    />
                                                )}
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

                {/* Download */}
                <Button
                    size="sm"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg shadow-purple-500/10 text-xs h-8 gap-1.5"
                    onClick={handleDownload}
                    disabled={!activeUrl || isDownloading}
                >
                    {isDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Download className="h-3.5 w-3.5" />
                    )}
                    {isDownloading ? 'Compiling...' : 'Download'}
                </Button>

                {/* Delete */}
                {canDelete && (
                    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 bg-black/20 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-red-400 hover:text-red-300 transition-all shrink-0"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm bg-gray-950 border-white/10">
                            <DialogTitle className="text-lg font-semibold">Delete Paper</DialogTitle>
                            <p className="text-sm text-gray-400 mt-1">
                                Are you sure you want to delete <span className="text-gray-200 font-medium">{displayTitle}</span>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 mt-4 justify-end">
                                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} className="border-white/10">Cancel</Button>
                                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
                                    {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </div>
    )
}
