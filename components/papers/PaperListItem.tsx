import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Eye, Download, Calendar, Folder, GraduationCap, Clock } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

interface PaperListItemProps {
    paper: {
        id: string
        title: string
        college: string
        subject: string
        exam_type: string | null
        year: number
        file_url: string | null
    }
}

export function PaperListItem({ paper }: PaperListItemProps) {
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
                    <Dialog>
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
                                        <div className="w-full h-full flex items-center justify-center bg-black/50 p-4">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={paper.file_url}
                                                alt={paper.title}
                                                className="max-w-full max-h-full object-contain shadow-2xl"
                                            />
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
                </div>
            </div>
        </div>
    )
}
