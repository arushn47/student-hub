'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

import { cn } from '@/lib/utils'

function preprocessMarkdown(content: string): string {
    if (!content) return ''
    let processed = content

    // 1. If table is inline on same line as bullet: e.g. "- **Comparison & Trade-offs**: | Col 1 | Col 2 |"
    processed = processed.replace(
        /([-*]\s*\*\*[^*]+\*\*:\s*)\|([^\n]+\|)/g,
        '$1\n\n|$2'
    )

    // 2. If table is collapsed on single line with `| |`: e.g. "| Col 1 | | :--- | | Val 1 |"
    processed = processed.replace(/\|\s+\|\s*([:-])/g, '|\n| $1')
    processed = processed.replace(/\|\s+\|\s*([^*\n|])/g, '|\n| $1')

    // 3. If table immediately follows text or bullet without empty line:
    processed = processed.replace(/([^\n])\r?\n(\|[^\n]+\|\r?\n\|[-:\s|]+\|)/g, '$1\n\n$2')

    // 4. If table immediately precedes text or bullet without empty line:
    processed = processed.replace(/(\|[^\n]+\|)\r?\n(?!\s*\|)([^\n]+)/g, '$1\n\n$2')

    return processed
}

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
    const normalizedContent = preprocessMarkdown(content)

    return (
        <div className={cn(base, className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    table: ({ children, className: tableClassName, ...props }) => (
                        <div className="not-prose my-4 w-full overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] shadow-sm">
                            <table {...props} className={cn('w-full border-collapse text-left text-sm', tableClassName)}>
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children, className: theadClassName, ...props }) => (
                        <thead {...props} className={cn('border-b border-white/10 bg-white/[0.05] text-xs font-semibold uppercase tracking-wider text-muted-foreground', theadClassName)}>
                            {children}
                        </thead>
                    ),
                    tbody: ({ children, className: tbodyClassName, ...props }) => (
                        <tbody {...props} className={cn('divide-y divide-white/5', tbodyClassName)}>
                            {children}
                        </tbody>
                    ),
                    tr: ({ children, className: trClassName, ...props }) => (
                        <tr {...props} className={cn('transition-colors hover:bg-white/[0.03]', trClassName)}>
                            {children}
                        </tr>
                    ),
                    th: ({ children, className: thClassName, ...props }) => (
                        <th {...props} className={cn('px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider', thClassName)}>
                            {children}
                        </th>
                    ),
                    td: ({ children, className: tdClassName, ...props }) => (
                        <td {...props} className={cn('px-4 py-3 text-sm text-foreground/90 align-top leading-relaxed', tdClassName)}>
                            {children}
                        </td>
                    ),
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
                {normalizedContent}
            </ReactMarkdown>
        </div>
    )
}
