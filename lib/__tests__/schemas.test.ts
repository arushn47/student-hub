import { describe, it, expect } from 'vitest'
import {
    createEventSchema,
} from '../schemas'

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
