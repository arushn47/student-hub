'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Upload, X, Loader2, Sparkles, Clipboard } from 'lucide-react'
import { toast } from 'sonner'

interface ImageUploadExtractorProps {
    type: 'grades' | 'flashcards' | 'timetable' | 'expenses'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onExtract: (data: any) => void
    trigger?: React.ReactNode
    title?: string
    description?: string
}

export function ImageUploadExtractor({
    type,
    onExtract,
    trigger,
    title = 'AI Extraction',
    description = 'Upload an image to automatically extract data.'
}: ImageUploadExtractorProps) {
    const [open, setOpen] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dropZoneRef = useRef<HTMLDivElement>(null)

    const processFile = useCallback((f: File) => {
        if (f.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB')
            return
        }
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']
        if (!validTypes.includes(f.type)) {
            toast.error('Unsupported file type. Use PNG, JPG, WebP, or PDF.')
            return
        }
        setFile(f)
        const reader = new FileReader()
        reader.onload = (e) => setSelectedImage(e.target?.result as string)
        reader.readAsDataURL(f)
    }, [])

    // Listen for paste events when dialog is open
    useEffect(() => {
        if (!open) return

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items
            if (!items) return

            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault()
                    const pastedFile = item.getAsFile()
                    if (pastedFile) {
                        processFile(pastedFile)
                        toast.success('Image pasted from clipboard!')
                    }
                    return
                }
            }
        }

        window.addEventListener('paste', handlePaste)
        return () => window.removeEventListener('paste', handlePaste)
    }, [open, processFile])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (f) processFile(f)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const droppedFile = e.dataTransfer.files?.[0]
        if (droppedFile) processFile(droppedFile)
    }

    const handleExtract = async () => {
        if (!file) return

        try {
            setLoading(true)
            const formData = new FormData()
            formData.append('image', file)
            formData.append('type', type)

            const response = await fetch('/api/ai/extract', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                // Try to extract a meaningful error message
                let errMsg = `Server error (${response.status})`
                try {
                    const result = await response.json()
                    if (typeof result.error === 'string') {
                        errMsg = result.error
                    } else if (result.error?.message) {
                        errMsg = result.error.message
                    } else if (result.message) {
                        errMsg = result.message
                    } else if (typeof result === 'object') {
                        errMsg = JSON.stringify(result)
                    }
                } catch {
                    // Response wasn't JSON (e.g. Vercel timeout HTML page)
                    if (response.status === 504) {
                        errMsg = 'Request timed out. Try a smaller file.'
                    }
                }
                throw new Error(errMsg)
            }

            const result = await response.json()

            if (result.data) {
                onExtract(result.data)
                setOpen(false)
                reset()
                toast.success('Data extracted successfully!')
            } else {
                toast.error('No data found in response')
            }
        } catch (error: unknown) {
            console.error('Extraction error:', JSON.stringify(error, null, 2))
            const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image'
            toast.error(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    const reset = () => {
        setSelectedImage(null)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val)
            if (!val) reset()
        }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Sparkles className="h-4 w-4 text-violet-400" />
                        Extract from Image/PDF
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent  className="bg-gray-900 border-white/10 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-white">
                        <Sparkles className="h-5 w-5 text-violet-400" />
                        {title || "Extract from Image"}
                    </DialogTitle>
                    <p className="text-gray-400 text-sm">
                        {description}
                    </p>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    {!selectedImage && !file ? (
                        <div
                            ref={dropZoneRef}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all group ${
                                isDragging
                                    ? 'border-violet-500 bg-violet-500/10 scale-[1.02]'
                                    : 'border-white/10 hover:border-violet-500/50 hover:bg-white/5'
                            }`}
                        >
                            <div className={`p-4 rounded-full mb-3 transition-colors ${
                                isDragging ? 'bg-violet-500/20' : 'bg-white/5 group-hover:bg-violet-500/10'
                            }`}>
                                {isDragging ? (
                                    <Upload className="h-6 w-6 text-violet-400 animate-bounce" />
                                ) : (
                                    <Upload className="h-6 w-6 text-gray-400 group-hover:text-violet-400" />
                                )}
                            </div>
                            <p className="text-sm text-gray-300 font-medium">
                                {isDragging ? 'Drop file here' : 'Click, paste, or drag file'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <Clipboard className="h-3 w-3 text-gray-500" />
                                <p className="text-xs text-gray-500">Ctrl+V to paste • PNG, JPG, PDF up to 5MB</p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center">
                            {file?.type === 'application/pdf' ? (
                                <div className="text-center">
                                    <div className="mx-auto bg-red-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                                        <div className="text-red-400 font-bold text-xl">PDF</div>
                                    </div>
                                    <p className="text-sm text-gray-300">{file.name}</p>
                                </div>
                            ) : (
                                <div className="relative w-full h-full">
                                    {selectedImage && (
                                        <Image
                                            src={selectedImage}
                                            alt="Preview"
                                            fill
                                            unoptimized
                                            className="object-contain"
                                        />
                                    )}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={reset}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*,application/pdf"
                        className="hidden"
                    />

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                            className="text-gray-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleExtract}
                            disabled={!file || loading}
                            className="gradient-primary text-white gap-2 min-w-30"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Extract Data
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
