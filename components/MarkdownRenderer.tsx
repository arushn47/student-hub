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
    variant?: 'prose' | 'chat'
}) {
    const base =
        variant === 'chat'
            ? 'prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto prose-code:before:content-none prose-code:after:content-none'
            : 'prose prose-invert max-w-none prose-pre:bg-muted/50 prose-pre:text-muted-foreground prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto prose-code:before:content-none prose-code:after:content-none'

    return (
        <div className={cn(base, className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    pre: ({ children, className: preClassName, ...props }) => (
                        <pre {...props} className={cn('not-prose', preClassName)}>
                            {children}
                        </pre>
                    ),
                    code: ({ className: codeClassName, children, ...props }) => {
                        const isBlock = typeof codeClassName === 'string' && /language-/.test(codeClassName)

                        if (!isBlock) {
                            return (
                                <code
                                    {...props}
                                    className={cn(
                                        'rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-foreground',
                                        codeClassName
                                    )}
                                >
                                    {children}
                                </code>
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
