import { describe, it, expect } from 'vitest'
import {
    createTaskSchema,
    updateTaskSchema,
    createEventSchema,
} from '../schemas'

describe('createTaskSchema', () => {
    it('should accept a valid task with only required fields', () => {
        const result = createTaskSchema.safeParse({ title: 'Study for exam' })
        expect(result.success).toBe(true)
    })

    it('should accept a task with all fields', () => {
        const result = createTaskSchema.safeParse({
            title: 'Study for exam',
            notes: 'Focus on chapters 3-5',
            due: '2026-03-01T10:00:00+00:00',
            taskListId: 'list-123',
        })
        expect(result.success).toBe(true)
    })

    it('should reject an empty title', () => {
        const result = createTaskSchema.safeParse({ title: '' })
        expect(result.success).toBe(false)
    })

    it('should reject a title longer than 100 characters', () => {
        const result = createTaskSchema.safeParse({ title: 'x'.repeat(101) })
        expect(result.success).toBe(false)
    })

    it('should reject missing title', () => {
        const result = createTaskSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('should reject an invalid due date format', () => {
        const result = createTaskSchema.safeParse({
            title: 'Test',
            due: 'not-a-date',
        })
        expect(result.success).toBe(false)
    })

    it('should allow optional fields to be omitted', () => {
        const result = createTaskSchema.safeParse({ title: 'Test' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.notes).toBeUndefined()
            expect(result.data.due).toBeUndefined()
            expect(result.data.taskListId).toBeUndefined()
        }
    })
})

describe('updateTaskSchema', () => {
    it('should accept a valid update', () => {
        const result = updateTaskSchema.safeParse({
            taskId: 'task-1',
            taskListId: 'list-1',
            completed: true,
        })
        expect(result.success).toBe(true)
    })

    it('should reject when taskId is empty', () => {
        const result = updateTaskSchema.safeParse({
            taskId: '',
            taskListId: 'list-1',
            completed: false,
        })
        expect(result.success).toBe(false)
    })

    it('should reject when taskListId is empty', () => {
        const result = updateTaskSchema.safeParse({
            taskId: 'task-1',
            taskListId: '',
            completed: false,
        })
        expect(result.success).toBe(false)
    })

    it('should reject when completed is missing', () => {
        const result = updateTaskSchema.safeParse({
            taskId: 'task-1',
            taskListId: 'list-1',
        })
        expect(result.success).toBe(false)
    })

    it('should reject non-boolean completed value', () => {
        const result = updateTaskSchema.safeParse({
            taskId: 'task-1',
            taskListId: 'list-1',
            completed: 'yes',
        })
        expect(result.success).toBe(false)
    })
})

describe('createEventSchema', () => {
    const validEvent = {
        title: 'Team meeting',
        start: '2026-03-01T09:00:00+00:00',
        end: '2026-03-01T10:00:00+00:00',
    }

    it('should accept a valid event with required fields', () => {
        const result = createEventSchema.safeParse(validEvent)
        expect(result.success).toBe(true)
    })

    it('should accept a valid event with all fields', () => {
        const result = createEventSchema.safeParse({
            ...validEvent,
            description: 'Weekly sync',
            location: 'Room 201',
            addMeet: true,
        })
        expect(result.success).toBe(true)
    })

    it('should reject missing title', () => {
        const result = createEventSchema.safeParse({
            start: validEvent.start,
            end: validEvent.end,
        })
        expect(result.success).toBe(false)
    })

    it('should reject empty title', () => {
        const result = createEventSchema.safeParse({
            ...validEvent,
            title: '',
        })
        expect(result.success).toBe(false)
    })

    it('should reject invalid start datetime', () => {
        const result = createEventSchema.safeParse({
            ...validEvent,
            start: 'bad-date',
        })
        expect(result.success).toBe(false)
    })

    it('should reject invalid end datetime', () => {
        const result = createEventSchema.safeParse({
            ...validEvent,
            end: 'bad-date',
        })
        expect(result.success).toBe(false)
    })

    it('should reject missing start', () => {
        const result = createEventSchema.safeParse({
            title: 'Test',
            end: validEvent.end,
        })
        expect(result.success).toBe(false)
    })

    it('should reject missing end', () => {
        const result = createEventSchema.safeParse({
            title: 'Test',
            start: validEvent.start,
        })
        expect(result.success).toBe(false)
    })
})
