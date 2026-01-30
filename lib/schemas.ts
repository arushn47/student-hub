import { z } from 'zod'

// Task Schemas
export const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title too long"),
    notes: z.string().optional(),
    due: z.string().datetime({ offset: true }).optional(), // ISO string
    taskListId: z.string().optional()
})

export const updateTaskSchema = z.object({
    taskId: z.string().min(1, "Task ID is required"),
    taskListId: z.string().min(1, "Task List ID is required"),
    completed: z.boolean()
})

// Event Schema
export const createEventSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    location: z.string().optional(),
    addMeet: z.boolean().optional()
})
