import { z } from 'zod'

// ---------------------------------------------------------------------------
// Task Schemas
// ---------------------------------------------------------------------------

export const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title too long"),
    notes: z.string().optional(),
    due: z.string().datetime({ offset: true }).optional(), // ISO string
    taskListId: z.string().optional()
})

export const updateTaskSchema = z.object({
    taskId: z.string().min(1, "Task ID is required"),
    taskListId: z.string().min(1, "Task List ID is required"),
    completed: z.boolean(),
    title: z.string().min(1).max(100).optional(),
    notes: z.string().optional(),
    due: z.string().datetime({ offset: true }).optional(), // ISO string
})

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

/** POST /api/ai/chat */
export const chatSchema = z.object({
    message: z.string().min(1, "Message is required").max(4000, "Message too long"),
    history: z.array(z.object({
        role: z.enum(['user', 'model']),
        parts: z.array(z.object({ text: z.string() })),
    })).optional(),
})

/** POST /api/ai/parse-expense */
export const parseExpenseSchema = z.object({
    text: z.string().min(1, "Text is required").max(500, "Text too long"),
})
