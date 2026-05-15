'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

import { cn } from '@/lib/utils'

export function MarkdownRenderer({
    content,
    className,
    variant = 'prose',
}: {
    content: string
    className?: string
    variant?: 'prose' | 'chat' | 'exam'
}) {
    const base =
        variant === 'chat'
            ? 'prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto prose-code:before:content-none prose-code:after:content-none'
            : variant === 'exam'
            ? 'prose prose-invert max-w-none prose-p:my-1.5 prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0 prose-pre:overflow-visible prose-code:before:content-none prose-code:after:content-none'
            : 'prose prose-invert max-w-none prose-pre:bg-muted/50 prose-pre:text-muted-foreground prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto prose-code:before:content-none prose-code:after:content-none'

    const isExam = variant === 'exam'

    return (
        <div className={cn(base, className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    pre: ({ children, className: preClassName, ...props }) => {
                        if (isExam) {
                            return (
                                <div className="not-prose my-3 rounded-lg border border-cyan-500/20 bg-black/60 backdrop-blur-sm overflow-hidden shadow-lg shadow-black/20">
                                    <div className="flex items-center gap-2 px-4 py-2 border-b border-cyan-500/15 bg-cyan-500/5">
                                        <div className="flex gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                                        </div>
                                        <span className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-wider ml-auto">Code</span>
                                    </div>
                                    <pre {...props} className={cn('p-4 overflow-x-auto text-sm leading-relaxed', preClassName)}>
                                        {children}
                                    </pre>
                                </div>
                            )
                        }

                        return (
                            <pre {...props} className={cn('not-prose', preClassName)}>
                                {children}
                            </pre>
                        )
                    },
                    code: ({ className: codeClassName, children, ...props }) => {
                        const isBlock = typeof codeClassName === 'string' && /language-/.test(codeClassName)
                        const lang = codeClassName?.replace('language-', '') || ''

                        if (!isBlock) {
                            return (
                                <code
                                    {...props}
                                    className={cn(
                                        'rounded px-1.5 py-0.5 font-mono text-[0.85em]',
                                        isExam
                                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
                                            : 'bg-white/10 text-foreground',
                                        codeClassName
                                    )}
                                >
                                    {children}
                                </code>
                            )
                        }

                        if (isExam && lang) {
                            return (
                                <>
                                    <code
                                        {...props}
                                        className={cn('block font-mono text-sm text-emerald-100/90', codeClassName)}
                                    >
                                        {children}
                                    </code>
                                </>
                            )
                        }

                        return (
                            <code
                                {...props}
                                className={cn('block font-mono text-sm text-foreground', codeClassName)}
                            >
                                {children}
                            </code>
                        )
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
