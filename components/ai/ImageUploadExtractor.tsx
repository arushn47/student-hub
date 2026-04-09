'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Upload, X, Loader2, Sparkles, Clipboard } from 'lucide-react'
import { toast } from 'sonner'
import { extractTextFromImages } from '@/lib/ocr'

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
    const [selectedImages, setSelectedImages] = useState<string[]>([])
    const [files, setFiles] = useState<File[]>([])
    const [loading, setLoading] = useState(false)
    const [statusText, setStatusText] = useState('')
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dropZoneRef = useRef<HTMLDivElement>(null)

    const processFiles = useCallback((newFiles: File[]) => {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']

        let acceptedFiles = newFiles.filter(f => validTypes.includes(f.type))
        if (acceptedFiles.length < newFiles.length) {
            toast.error('Some files were unsupported and skipped.')
        }

        // Check file size
        if (acceptedFiles.some(f => f.size > 5 * 1024 * 1024)) {
            toast.error('Files must be less than 5MB.')
            acceptedFiles = acceptedFiles.filter(f => f.size <= 5 * 1024 * 1024)
        }

        if (acceptedFiles.length === 0) return

        // If a PDF is included, it must be the only file
        if (acceptedFiles.some(f => f.type === 'application/pdf')) {
            if (files.length > 0 || acceptedFiles.length > 1) {
                toast.error('PDFs must be uploaded one at a time without other files.')
                acceptedFiles = [acceptedFiles.find(f => f.type === 'application/pdf')!]
                setFiles(acceptedFiles)
                setSelectedImages([])
                return
            }
        }

        // Limit to 5 files total
        const totalFiles = [...files, ...acceptedFiles]
        if (totalFiles.length > 5) {
            toast.error('Maximum 5 images allowed.')
            acceptedFiles = acceptedFiles.slice(0, 5 - files.length)
        }

        if (acceptedFiles.length === 0) return

        setFiles(prev => [...prev, ...acceptedFiles])

        // Read and set previews for images
        acceptedFiles.forEach(f => {
            if (f.type !== 'application/pdf') {
                const reader = new FileReader()
                reader.onload = (e) => {
                    setSelectedImages(prev => [...prev, e.target?.result as string])
                }
                reader.readAsDataURL(f)
            }
        })
    }, [files.length])

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
                        processFiles([pastedFile])
                        toast.success('Image pasted from clipboard!')
                    }
                    return
                }
            }
        }

        window.addEventListener('paste', handlePaste)
        return () => window.removeEventListener('paste', handlePaste)
    }, [open, processFiles])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) processFiles(Array.from(e.target.files))
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
        if (e.dataTransfer.files?.length) processFiles(Array.from(e.dataTransfer.files))
    }

    const handleExtract = async () => {
        if (files.length === 0) return

        try {
            setLoading(true)
            const hasPdf = files.some(f => f.type === 'application/pdf')

            let response: Response

            if (hasPdf) {
                // PDFs can't be OCR'd client-side — send directly to Gemini vision
                setStatusText('Uploading PDF...')
                const formData = new FormData()
                files.forEach(f => formData.append('image', f))
                formData.append('type', type)

                response = await fetch('/api/ai/extract', {
                    method: 'POST',
                    body: formData,
                })
            } else {
                // Images: run OCR client-side first, then send text to API
                setStatusText('Reading text from image...')
                const ocrText = await extractTextFromImages(files, (progress) => {
                    setStatusText(`Reading text... ${progress}%`)
                })

                if (ocrText && ocrText.trim().length > 20) {
                    // OCR produced meaningful text — send as text (saves quota)
                    setStatusText('Extracting data...')
                    response = await fetch('/api/ai/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, text: ocrText }),
                    })
                } else {
                    // OCR produced too little text — fall back to image upload
                    setStatusText('Uploading image to AI...')
                    const formData = new FormData()
                    files.forEach(f => formData.append('image', f))
                    formData.append('type', type)

                    response = await fetch('/api/ai/extract', {
                        method: 'POST',
                        body: formData,
                    })
                }
            }

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
            setStatusText('')
        }
    }

    const reset = () => {
        setSelectedImages([])
        setFiles([])
        setStatusText('')
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
            <DialogContent  className="bg-gray-900 border-white/10 sm:max-w-md" aria-describedby="dialog-description">
                <div id="dialog-description" className="sr-only">
                    {description}
                </div>
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
                    {selectedImages.length === 0 && files.length === 0 ? (
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
                            {files[0]?.type === 'application/pdf' ? (
                                <div className="text-center">
                                    <div className="mx-auto bg-red-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                                        <div className="text-red-400 font-bold text-xl">PDF</div>
                                    </div>
                                    <p className="text-sm text-gray-300">{files[0].name}</p>
                                </div>
                            ) : (
                                <div className={`w-full h-full p-2 grid gap-2 ${selectedImages.length > 2 ? 'grid-cols-2 grid-rows-2' : selectedImages.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {selectedImages.map((src, i) => (
                                        <div key={i} className="relative w-full h-full min-h-[100px] rounded-lg overflow-hidden bg-black/60 shadow-inner">
                                            <Image
                                                src={src}
                                                alt={`Preview ${i}`}
                                                fill
                                                unoptimized
                                                className="object-contain"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={reset}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
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
                        multiple
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
                            disabled={files.length === 0 || loading}
                            className="gradient-primary text-white gap-2 min-w-30"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {statusText || 'Analyzing...'}
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
