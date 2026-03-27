import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Loader2, X, Search, Check, ChevronsUpDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { VIT_COLLEGES, SUBJECTS, EXAM_TYPES } from '@/lib/constants'

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

export function PaperUploadDialog({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [formData, setFormData] = useState({
        subject: '',
        exam_type: '',
        year: new Date().getFullYear().toString()
    })

    // Local state for custom entries
    const [customSubject, setCustomSubject] = useState('')

    const supabase = createClient()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    // Clipboard paste support
    const handlePaste = useCallback((e: ClipboardEvent) => {
        if (!open) return
        const items = e.clipboardData?.items
        if (!items) return
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const blob = item.getAsFile()
                if (blob) {
                    // Create a named file from the blob
                    const ext = item.type.split('/')[1] || 'png'
                    const pastedFile = new File([blob], `pasted-image.${ext}`, { type: item.type })
                    setFile(pastedFile)
                    toast.success('Image pasted!')
                }
                return
            }
        }
    }, [open])

    useEffect(() => {
        document.addEventListener('paste', handlePaste)
        return () => document.removeEventListener('paste', handlePaste)
    }, [handlePaste])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) {
            toast.error('Please select a file')
            return
        }

        // Use custom value if "Other" is selected, otherwise use dropdown value
        const finalCollege = 'VIT Bhopal'
        const finalSubject = formData.subject === 'Other' ? customSubject : formData.subject

        if (!finalSubject || !formData.exam_type) {
            toast.error('Please fill all fields')
            return
        }

        setLoading(true)

        try {
            // Auto-generate title for consistency
            const generatedTitle = `${finalSubject} - ${formData.exam_type} (${formData.year})`

            // 1. Upload file
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            // Sanitize path for storage
            const safeCollege = finalCollege.replace(/[^a-z0-9]/gi, '-').toLowerCase()
            const safeSubject = finalSubject.replace(/[^a-z0-9]/gi, '-').toLowerCase()
            const filePath = `${safeCollege}/${safeSubject}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('papers')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('papers')
                .getPublicUrl(filePath)

            // 2. Create DB record
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) throw new Error("Not authenticated")

            const { error: dbError } = await supabase
                .from('question_papers')
                .insert({
                    title: generatedTitle,
                    college: finalCollege,
                    subject: finalSubject,
                    exam_type: formData.exam_type,
                    year: parseInt(formData.year),
                    file_url: publicUrl,
                    uploaded_by: user.id
                })

            if (dbError) throw dbError

            toast.success('Paper uploaded successfully!')
            setOpen(false)
            setFile(null)
            // Reset form but keep catchy defaults if needed
            setFormData({ subject: '', exam_type: '', year: new Date().getFullYear().toString() })
            setCustomSubject('')
            onUploadSuccess?.()

        } catch (error) {
            console.error(error)
            toast.error('Failed to upload paper')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-linear-to-r from-purple-500 to-pink-500 text-white">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Paper
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-gray-950 border-white/10">
                <DialogHeader>
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
                                <SelectTrigger className="bg-black/40 border-white/10 h-10">
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
                                <SelectTrigger className="bg-black/40 border-white/10 h-10">
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

                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label className="text-gray-400">File (PDF or Image)</Label>
                        <div className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/30 hover:bg-white/5 transition-all relative group">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            {file ? (
                                <div className="flex items-center gap-3 text-purple-400 animate-in zoom-in-95">
                                    <Upload className="h-5 w-5" />
                                    <span className="text-sm font-medium">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            setFile(null)
                                        }}
                                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors relative z-20"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <Upload className="h-8 w-8 text-gray-500 mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm text-gray-500">Drop file or click to browse</span>
                                    <span className="text-xs text-gray-600 mt-1">or paste an image from clipboard (Ctrl+V)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-linear-to-r from-purple-500 to-pink-500 text-white font-medium h-11 rounded-xl shadow-lg shadow-purple-500/10 active:scale-[0.98] transition-transform" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Uploading...' : 'Upload Paper'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
