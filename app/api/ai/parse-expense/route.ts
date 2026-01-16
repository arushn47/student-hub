import { NextRequest, NextResponse } from 'next/server'
import { geminiModel } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const { text } = await req.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        const prompt = `Parse this bank SMS, UPI notification, or email about a transaction and extract expense data.

Text to parse:
"${text}"

Extract:
1. amount: The transaction amount (number only, no currency symbols)
2. description: Merchant name or transaction description
3. category: One of: food, transport, entertainment, shopping, education, other
4. date: Transaction date if mentioned (YYYY-MM-DD format), or null

Rules:
- For Indian banks: Look for "debited", "spent", "paid", "Rs.", "INR"
- For UPI: Extract merchant from "to" or "VPA" or "UPI-" prefix
- Category hints: Swiggy/Zomato=food, Uber/Ola/Metro=transport, Amazon/Flipkart=shopping
- If amount not found, return null
- Be smart about parsing different SMS formats

Return ONLY valid JSON:
{"amount": number|null, "description": string, "category": string, "date": string|null}
`

        const result = await geminiModel.generateContent(prompt)
        const responseText = result.response.text()

        // Clean markdown if present
        const cleanedText = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

        try {
            const data = JSON.parse(cleanedText)
            return NextResponse.json({ data })
        } catch (e) {
            console.error('JSON Parse Error:', e, 'Raw:', responseText)
            return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Parse expense error:', error)
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
    }
}
