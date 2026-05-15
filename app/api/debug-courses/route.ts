import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        console.log('--- USER COURSES DUMP ---')
        body.forEach((c: any) => {
            console.log(`Code: ${c.code} | Category: "${c.category}" | Credits: ${c.credits}`)
        })
        console.log('--- END USER COURSES DUMP ---')
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: true })
    }
}
