/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Loader2, X, Search, Check, ChevronsUpDown, Eye, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SUBJECTS, EXAM_TYPES } from '@/lib/constants'
import { useAuth } from '@/lib/auth-context'

type ImageQualityResult = {
    sharpnessScore: number
    brightness: number
    warning?: string
    blockReason?: string
}

async function checkImageQuality(file: File): Promise<ImageQualityResult | null> {
    if (!file.type.startsWith('image/')) return null

    // createImageBitmap is fast and avoids layout work.
    const bitmap = await createImageBitmap(file)

    // Downscale for speed. Bigger than ~600px doesn't materially help the score.
    const maxSide = 600
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(bitmap, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)

    // Convert to luminance grayscale for cheap analysis.
    const gray = new Uint8Array(w * h)
    let sum = 0
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        // Rec. 601 luma approximation
        const y = (0.299 * r + 0.587 * g + 0.114 * b)
        const v = y | 0
        gray[p] = v
        sum += v
    }
    const brightness = sum / gray.length

    // Sharpness proxy: variance of Laplacian (blur detection).
    // Kernel: [0,1,0; 1,-4,1; 0,1,0]
    let lapSum = 0
    let lapSqSum = 0
    let count = 0

    for (let y = 1; y < h - 1; y++) {
        const row = y * w
        const rowUp = (y - 1) * w
        const rowDown = (y + 1) * w
        for (let x = 1; x < w - 1; x++) {
            const idx = row + x
            const lap =
                gray[rowUp + x] +
                gray[rowDown + x] +
                gray[idx - 1] +
                gray[idx + 1] -
                4 * gray[idx]

            lapSum += lap
            lapSqSum += lap * lap
            count++
        }
    }

    const mean = lapSum / Math.max(1, count)
    const variance = lapSqSum / Math.max(1, count) - mean * mean
    const sharpnessScore = Math.max(0, variance)

    // Heuristics: block only for extreme cases; otherwise warn.
    let warning: string | undefined
    let blockReason: string | undefined

    if (brightness < 40) {
        blockReason = 'Image is too dark to read — please upload a clearer scan/photo.'
    } else if (brightness > 235) {
        blockReason = 'Image is too bright/washed out — please upload a clearer scan/photo.'
    } else if (sharpnessScore < 60) {
        blockReason = 'Image is too blurry to read — please upload a clearer scan/photo.'
    } else if (brightness < 55) {
        warning = 'Image looks a bit dark — scan mode/lighting might help.'
    } else if (brightness > 210) {
        warning = 'Image looks a bit bright — details may be washed out.'
    } else if (sharpnessScore < 120) {
        warning = 'Image looks a bit blurry — try a steadier photo or scan.'
    }

    return { sharpnessScore, brightness, warning, blockReason }
}

function SearchableSelect({
    options,
    value,
    onChange,
    placeholder,
    className
}: {
    options: string[],
    value: string,
    onChange: (val: string) => void,
    placeholder: string,
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between bg-black/40 border-white/10 h-10 font-normal hover:bg-black/60 transition-colors", className)}
                >
                    <span className="truncate">{value || placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0 bg-gray-950 border-white/10 w-(--radix-popover-trigger-width)"
                align="start"
                sideOffset={4}
            >
                <div className="flex items-center border-b border-white/10 px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
                        placeholder={`Search...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <ScrollArea className="h-75">
                    <div className="p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500">No results found.</div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-white/10 transition-colors",
                                        value === opt && "bg-white/10 text-purple-400"
                                    )}
                                    onClick={() => {
                                        onChange(opt)
                                        setOpen(false)
                                        setSearch("")
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === opt ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {opt}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}

const compressImage = async (file: File, maxWidth = 1280): Promise<File> => {
    if (!file.type.startsWith('image/')) {
        console.log(`[Compressor] Skipping non-image file: ${file.name}`)
        return file;
    }
    
    try {
        console.log(`[Compressor] Starting compression for ${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`)
        const bitmap = await createImageBitmap(file);
        let width = bitmap.width;
        let height = bitmap.height;

        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }
        if (height > 1920) {
            width = Math.round((width * 1920) / height);
            height = 1920;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn(`[Compressor] Failed to get canvas context for ${file.name}`)
            return file;
        }
        
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        return await new Promise<File>((resolve) => {
            canvas.toBlob((blob) => {
                if (blob && blob.size < file.size) {
                    console.log(`[Compressor] Success: ${file.name} compressed to ${(blob.size/1024/1024).toFixed(2)}MB`)
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg', lastModified: Date.now() }));
                } else {
                    console.log(`[Compressor] Bypassed: Compressed file was larger or failed for ${file.name}`)
                    resolve(file); // fallback
                }
            }, 'image/jpeg', 0.72); // 72% quality
        });
    } catch (e) {
        console.error(`[Compressor] Fatal error during compression for ${file.name}:`, e);
        return file; // fallback to original file
    }
};



export function PaperUploadDialog({
    onUploadSuccess,
    trigger,
}: {
    onUploadSuccess?: () => void
    trigger?: ReactNode
}) {
    const MAX_FILES = 10
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState('')
    const [files, setFiles] = useState<File[]>([])
    const [qualityHints, setQualityHints] = useState<Record<number, string | null>>({})
    const [qualityChecking, setQualityChecking] = useState(false)


    const [qualityBlockReasons, setQualityBlockReasons] = useState<Record<number, string | null>>({})
    const [previewFile, setPreviewFile] = useState<File | null>(null)
    const [formData, setFormData] = useState({
        subject: '',
        exam_type: '',
        year: new Date().getFullYear().toString(),
        slot: '',
        page_count: ''
    })

    // Local state for custom entries
    const [customSubject, setCustomSubject] = useState('')

    const cancelledRef = useRef(false)

    const { user } = useAuth()

    const addFiles = useCallback(async (newFiles: File[]) => {
        let uniqueFiles: File[] = []
        setFiles(prev => {
            const prevSignatures = new Set(prev.map(f => `${f.size}-${f.name}`))
            uniqueFiles = newFiles.filter(f => !prevSignatures.has(`${f.size}-${f.name}`))
            
            if (uniqueFiles.length < newFiles.length) {
                toast.info('Duplicate files ignored')
            }

            const combined = [...prev, ...uniqueFiles].slice(0, MAX_FILES)
            return combined
        })
        
        if (uniqueFiles.length === 0) return

        // Quality-check each image
        setQualityChecking(true)
        for (const f of uniqueFiles) {
            if (!f.type.startsWith('image/')) continue
            const result = await checkImageQuality(f)
            if (!result) continue
            setFiles(prev => {
                const idx = prev.indexOf(f)
                if (idx === -1) return prev // already removed
                if (result.blockReason) {
                    setQualityBlockReasons(r => ({ ...r, [idx]: result.blockReason! }))
                    setQualityHints(h => ({ ...h, [idx]: result.blockReason! }))
                    toast.error(`Page ${idx + 1}: ${result.blockReason}`)
                } else {
                    setQualityHints(h => ({ ...h, [idx]: result.warning ?? 'Image quality looks good.' }))
                    if (result.warning) toast.warning(`Page ${idx + 1}: ${result.warning}`)
                }
                return prev
            })
        }
        setQualityChecking(false)
    }, [])

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
        setQualityHints(prev => {
            const n = { ...prev }; delete n[index]; return n
        })
        setQualityBlockReasons(prev => {
            const n = { ...prev }; delete n[index]; return n
        })
    }

    const moveFile = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === files.length - 1) return

        const targetIdx = direction === 'up' ? index - 1 : index + 1

        setFiles(prev => {
            const newFiles = [...prev]
            const temp = newFiles[index]
            newFiles[index] = newFiles[targetIdx]
            newFiles[targetIdx] = temp
            return newFiles
        })
        
        setQualityHints(prev => {
            const newHints = { ...prev }
            const temp = newHints[index]
            newHints[index] = newHints[targetIdx]
            newHints[targetIdx] = temp
            return newHints
        })
        
        setQualityBlockReasons(prev => {
            const newReasons = { ...prev }
            const temp = newReasons[index]
            newReasons[index] = newReasons[targetIdx]
            newReasons[targetIdx] = temp
            return newReasons
        })
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            void addFiles(Array.from(e.target.files))
        }
    }

    // Clipboard paste support — appends instead of replacing
    const handlePaste = useCallback((e: ClipboardEvent) => {
        if (!open) return
        const items = e.clipboardData?.items
        if (!items) return
        const imageFiles: File[] = []
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile()
                // Prevent duplicate pasted images by checking size
                if (blob && !files.some(f => f.size === blob.size) && !imageFiles.some(f => f.size === blob.size)) {
                    const ext = item.type.split('/')[1] || 'png'
                    imageFiles.push(new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: item.type }))
                } else if (blob) {
                    toast.info('Duplicate image ignored')
                }
            }
        }
        if (imageFiles.length > 0) {
            e.preventDefault()
            void addFiles(imageFiles)
            toast.success(`${imageFiles.length === 1 ? 'Image' : imageFiles.length + ' images'} added!`)
        }
    }, [open, addFiles, files])

    useEffect(() => {
        document.addEventListener('paste', handlePaste)
        return () => document.removeEventListener('paste', handlePaste)
    }, [handlePaste])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (files.length === 0) {
            toast.error('Please select at least one file')
            return
        }

        const blockedIdx = Object.entries(qualityBlockReasons).find(([, v]) => v)
        if (blockedIdx) {
            toast.error(`Fix image quality issues before uploading`)
            return
        }

        const finalCollege = 'VIT Bhopal'
        const finalSubject = formData.subject === 'Other' ? customSubject : formData.subject
        const finalSlot = formData.slot.trim() || null
        // Auto-populate page count from file count if not manually set
        const finalPageCount = formData.page_count ? parseInt(formData.page_count) : files.length

        if (!finalSubject || !formData.exam_type) {
            toast.error('Please fill all fields')
            return
        }

        setLoading(true)
        setUploadStatus('Preparing upload...')

        try {
            console.log('[Upload] Starting upload process, checking auth...')
            if (!user) throw new Error('Not authenticated')
            console.log(`[Upload] Authenticated as ${user.id}`)

            const uploadedUrls: string[] = []

            for (let i = 0; i < files.length; i++) {
                if (cancelledRef.current) {
                    cancelledRef.current = false;
                    throw new Error('Upload cancelled');
                }

                const file = files[i];
                setUploadStatus(`Uploading file ${i + 1} of ${files.length}...`)
                
                const compressedFile = await compressImage(file);
                const filePath = `${Date.now()}-${i}-${compressedFile.name}`;
                const isLast = i === files.length - 1;

                console.log('[Upload] Uploading via API proxy:', filePath);

                const fd = new FormData()
                fd.append('file', compressedFile)
                fd.append('filePath', filePath)
                fd.append('metadata', JSON.stringify({
                    isLast,
                    previousUrls: uploadedUrls,
                    record: {
                        title: `${finalSubject} - ${formData.exam_type} (${formData.year})`,
                        college: finalCollege,
                        subject: finalSubject,
                        exam_type: formData.exam_type,
                        year: parseInt(formData.year),
                        uploaded_by: user.id,
                        slot: finalSlot,
                        page_count: finalPageCount,
                    }
                }))

                const res = await fetch('/api/upload', { method: 'POST', body: fd })
                const json = await res.json()
                
                console.log('[Upload] API route result:', json)
                if (!res.ok) throw new Error(json.error || 'Upload failed')

                uploadedUrls.push(json.url);
            }

            toast.success('Paper uploaded successfully!')
            setOpen(false)
            setFiles([])
            setFormData({
                subject: '',
                exam_type: '',
                year: new Date().getFullYear().toString(),
                slot: '',
                page_count: ''
            })
            setCustomSubject('')
            if (onUploadSuccess) onUploadSuccess()
        } catch (error: any) {
            console.error('[Upload] Process aborted with error:', error)
            if (error.message !== 'Upload cancelled') {
                toast.error(error.message || 'Upload failed. Please try again.')
            }
        } finally {
            setLoading(false)
            setUploadStatus('')
        }
    }

    const handleCancel = () => {
        cancelledRef.current = true
        setLoading(false)
        setUploadStatus('')
        toast.info('Upload cancelled')
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className="bg-linear-to-r from-purple-500 to-pink-500 text-white">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Paper
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-gray-950 border-white/10">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                    <DialogTitle>Upload Question Paper</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-2">

                    {/* Subject (Full Width) */}
                    <div className="space-y-2">
                        <Label className="text-gray-400">Subject</Label>
                        <SearchableSelect
                            options={SUBJECTS}
                            value={formData.subject}
                            onChange={(val) => setFormData({ ...formData, subject: val })}
                            placeholder="Select Subject"
                        />
                        {formData.subject === 'Other' && (
                            <Input
                                placeholder="Enter Subject Name"
                                value={customSubject}
                                onChange={(e) => setCustomSubject(e.target.value)}
                                className="mt-2 bg-black/40 border-white/10 h-10 focus:border-purple-500/50"
                            />
                        )}
                    </div>

                    {/* Exam Type & Year (Side by Side) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Exam Type</Label>
                            <Select
                                value={formData.exam_type}
                                onValueChange={(val) => setFormData({ ...formData, exam_type: val })}
                            >
                                <SelectTrigger className="w-full bg-black/40 border-white/10 h-10">
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Year</Label>
                            <Select
                                value={formData.year}
                                onValueChange={(val) => setFormData({ ...formData, year: val })}
                            >
                                <SelectTrigger className="w-full bg-black/40 border-white/10 h-10">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent className="max-h-96">
                                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Slot & Page Count */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Slot <span className="text-gray-600">(optional)</span></Label>
                            <Input
                                placeholder="e.g. A21+A22+A23"
                                value={formData.slot}
                                onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                                className="bg-black/40 border-white/10 h-10 focus:border-purple-500/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Pages <span className="text-gray-600">(optional)</span></Label>
                            <Input
                                type="number"
                                placeholder="e.g. 4"
                                min={1}
                                max={100}
                                value={formData.page_count}
                                onChange={(e) => setFormData({ ...formData, page_count: e.target.value })}
                                className="bg-black/40 border-white/10 h-10 focus:border-purple-500/50"
                            />
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label className="text-gray-400">
                            Files (PDF or Images)
                            {files.length > 0 && <span className="text-gray-500 ml-2 font-normal">({files.length}/{MAX_FILES})</span>}
                        </Label>

                        {/* Uploaded files list */}
                        {files.length > 0 && (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                        <Upload className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                        <span className="text-xs text-gray-300 flex-1 truncate">
                                            <span className="text-purple-400 font-medium mr-1.5">P{i + 1}</span>{f.name}
                                        </span>
                                        {qualityHints[i] && (
                                            <span className={`text-[10px] shrink-0 ${qualityBlockReasons[i] ? 'text-red-400' : 'text-green-400'}`}>
                                                {qualityBlockReasons[i] ? '✗' : '✓'}
                                            </span>
                                        )}
                                        <div className="flex flex-col shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); moveFile(i, 'up'); }}
                                                disabled={i === 0}
                                                className="hover:bg-white/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            >
                                                <ChevronUp className="h-3 w-3 text-gray-400" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); moveFile(i, 'down'); }}
                                                disabled={i === files.length - 1}
                                                className="hover:bg-white/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            >
                                                <ChevronDown className="h-3 w-3 text-gray-400" />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); setPreviewFile(f); }}
                                            className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0"
                                            title="Preview file"
                                        >
                                            <Eye className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(i)}
                                            className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0"
                                        >
                                            <X className="h-3 w-3 text-gray-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Drop zone — always visible if below MAX_FILES */}
                        {files.length < MAX_FILES && (
                            <div className="border-2 border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/30 hover:bg-white/5 transition-all relative group">
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    multiple
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                                <Upload className="h-7 w-7 text-gray-500 mb-1.5 group-hover:scale-110 transition-transform" />
                                <span className="text-sm text-gray-500">Drop files or click to browse</span>
                                <span className="text-xs text-gray-600 mt-0.5">Paste images (Ctrl+V) to add pages</span>
                            </div>
                        )}

                        {qualityChecking && (
                            <p className="text-xs text-gray-500">Checking image quality…</p>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {loading && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                className="flex-1 bg-black/20 border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 h-11 rounded-xl transition-all"
                            >
                                Cancel
                            </Button>
                        )}
                        <Button type="submit" className="flex-1 bg-linear-to-r from-purple-500 to-pink-500 text-white font-medium h-11 rounded-xl shadow-lg shadow-purple-500/10 active:scale-[0.98] transition-transform" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? uploadStatus || 'Uploading...' : 'Upload Paper'}
                        </Button>
                    </div>
                </form>
            </DialogContent>

            {/* Preview Sub-Modal */}
            <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
                <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 bg-gray-950 border-white/10 flex flex-col overflow-hidden">
                    <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-gray-900/50">
                        <DialogTitle className="text-gray-200 text-sm font-medium truncate">
                            Preview: {previewFile?.name}
                        </DialogTitle>
                    </div>
                    <div className="flex-1 overflow-auto bg-black/50 flex items-center justify-center p-4">
                        {previewFile && previewFile.type.startsWith('image/') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={URL.createObjectURL(previewFile)}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain rounded border border-white/10"
                            />
                        ) : previewFile && previewFile.type === 'application/pdf' ? (
                            <iframe
                                src={URL.createObjectURL(previewFile)}
                                className="w-full h-full rounded border-0"
                                title="PDF Preview"
                            />
                        ) : (
                            <div className="text-gray-500">Preview not available for this file type.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </Dialog>
    )
}
