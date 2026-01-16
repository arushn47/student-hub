import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
})

export async function generateText(prompt: string): Promise<string> {
    try {
        const result = await geminiModel.generateContent(prompt)
        return result.response.text()
    } catch (error) {
        console.error('Gemini API Error:', error)
        throw new Error('Failed to generate AI response. Please try again.')
    }
}

export async function generateJSON<T>(prompt: string): Promise<T> {
    try {
        const result = await geminiModel.generateContent(prompt)
        const text = result.response.text()
        // Clean up the response - remove markdown code blocks if present
        const cleanedText = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()
        return JSON.parse(cleanedText) as T
    } catch (error) {
        console.error('Gemini API Error:', error)
        throw new Error('Failed to generate AI response. Please try again.')
    }
}
