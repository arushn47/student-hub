'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Upload, X, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size must be less than 5MB')
                return
            }
            setFile(file)
            const reader = new FileReader()
            reader.onload = (e) => setSelectedImage(e.target?.result as string)
            reader.readAsDataURL(file)
        }
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

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to extract data')
            }

            if (result.data) {
                onExtract(result.data)
                setOpen(false)
                reset()
                toast.success('Data extracted successfully!')
            } else {
                toast.error('No data found in response')
            }
        } catch (error: unknown) {
            console.error('Extraction error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image';
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
                        Extract from Image
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="glass-card border-violet-500/20 max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-400" />
                        {title}
                    </DialogTitle>
                    <p className="text-gray-400 text-sm">
                        {description}
                    </p>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    {!selectedImage && !file ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/10 hover:border-violet-500/50 hover:bg-white/5 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all group"
                        >
                            <div className="p-4 rounded-full bg-white/5 group-hover:bg-violet-500/10 mb-3 transition-colors">
                                <Upload className="h-6 w-6 text-gray-400 group-hover:text-violet-400" />
                            </div>
                            <p className="text-sm text-gray-300 font-medium">Click to upload file</p>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 5MB</p>
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
                                <img
                                    src={selectedImage!}
                                    alt="Preview"
                                    className="max-h-full max-w-full object-contain"
                                />
                            )}
                            <button
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
                            className="gradient-primary text-white gap-2 min-w-[120px]"
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
