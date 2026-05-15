import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData()
        const file = form.get('file') as File
        const filePath = form.get('filePath') as string
        const metadataStr = form.get('metadata') as string

        if (!file || !filePath) {
            return NextResponse.json({ error: 'Missing file or filePath' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        const { error: uploadError } = await supabase.storage
            .from('papers')
            .upload(filePath, buffer, { contentType: file.type, upsert: false })

        if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

        const { data: urlData } = supabase.storage.from('papers').getPublicUrl(filePath)
        const publicUrl = urlData.publicUrl

        if (metadataStr) {
            const metadata = JSON.parse(metadataStr)
            
            // If this is the last file, also do the DB insert
            if (metadata.isLast) {
                const { error: dbError } = await supabase
                    .from('question_papers')
                    .insert({
                        ...metadata.record,
                        file_urls: [...metadata.previousUrls, publicUrl],
                        file_url: metadata.previousUrls[0] ?? publicUrl,
                    })
                if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ url: publicUrl })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
