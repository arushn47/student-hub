import { z } from 'zod'

// ---------------------------------------------------------------------------
// Event Schema
// ---------------------------------------------------------------------------

export const createEventSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    location: z.string().optional(),
    addMeet: z.boolean().optional()
})

// ---------------------------------------------------------------------------
// AI Route Schemas
// ---------------------------------------------------------------------------

/** POST /api/ai/explain */
export const explainSchema = z.object({
    text: z.string().min(1, "Text is required").max(2000, "Text too long (max 2000 chars)"),
})

/** POST /api/ai/breakdown */
export const breakdownSchema = z.object({
    task: z.string().min(1, "Task description is required").max(500, "Task description too long (max 500 chars)"),
})

/** POST /api/ai/quiz */
export const quizSchema = z.object({
    content: z.string().min(1, "Content is required").max(5000, "Content too long"),
    questionCount: z.number().int().min(1).max(20).optional(),
})

/** POST /api/ai/parse-expense */
export const parseExpenseSchema = z.object({
    text: z.string().min(1, "Text is required").max(500, "Text too long"),
})
