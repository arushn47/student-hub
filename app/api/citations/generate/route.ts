import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/gemini'

interface CitationResult {
    title: string
    citation_apa: string
    citation_mla: string
    citation_chicago: string
    source_url?: string
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { type } = body

        let prompt = ''
        let sourceUrl = ''

        if (type === 'url') {
            const { url } = body
            sourceUrl = url
            prompt = `Generate academic citations for this web page URL: ${url}

Assume it's a web article. Generate proper citations in three formats.
Use today's date for the access date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.

Return ONLY valid JSON:
{
  "title": "Article/Page title (infer from URL if needed)",
  "citation_apa": "Full APA 7th edition citation",
  "citation_mla": "Full MLA 9th edition citation",
  "citation_chicago": "Full Chicago 17th edition citation"
}`
        } else if (type === 'book') {
            const { title, author, publisher, year, edition } = body
            prompt = `Generate academic citations for this book:
- Title: ${title}
- Author(s): ${author}
- Publisher: ${publisher || 'Unknown'}
- Year: ${year || 'n.d.'}
- Edition: ${edition || '1st'}

Return ONLY valid JSON:
{
  "title": "${title}",
  "citation_apa": "Full APA 7th edition citation",
  "citation_mla": "Full MLA 9th edition citation",
  "citation_chicago": "Full Chicago 17th edition citation"
}`
        } else if (type === 'article') {
            const { title, author, journal, year, volume, pages } = body
            prompt = `Generate academic citations for this journal article:
- Title: ${title}
- Author(s): ${author}
- Journal: ${journal || 'Unknown Journal'}
- Year: ${year || 'n.d.'}
- Volume: ${volume || ''}
- Pages: ${pages || ''}

Return ONLY valid JSON:
{
  "title": "${title}",
  "citation_apa": "Full APA 7th edition citation",
  "citation_mla": "Full MLA 9th edition citation",
  "citation_chicago": "Full Chicago 17th edition citation"
}`
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
        }

        const result = await generateJSON<CitationResult>(prompt)

        return NextResponse.json({
            ...result,
            source_url: sourceUrl || null
        })

    } catch (error) {
        console.error('Citation generation error:', error)
        return NextResponse.json({ error: 'Failed to generate citation' }, { status: 500 })
    }
}
