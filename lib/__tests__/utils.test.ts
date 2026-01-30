import { describe, it, expect } from 'vitest'
import { cn, formatDateMDY, formatDateISO } from '../utils'

describe('cn (className utility)', () => {
    it('should merge class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
        expect(cn('base', true && 'active', false && 'hidden')).toBe('base active')
    })

    it('should merge tailwind classes correctly', () => {
        expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })

    it('should handle undefined and null values', () => {
        expect(cn('base', undefined, null, 'end')).toBe('base end')
    })

    it('should handle arrays of classes', () => {
        expect(cn(['foo', 'bar'])).toBe('foo bar')
    })
})

describe('formatDateMDY', () => {
    it('should format Date object to M/D/YYYY', () => {
        const date = new Date(2026, 0, 15) // January 15, 2026
        expect(formatDateMDY(date)).toBe('1/15/2026')
    })

    it('should format ISO date string to M/D/YYYY', () => {
        expect(formatDateMDY('2026-01-15')).toBe('1/15/2026')
    })

    it('should handle date string with time', () => {
        const result = formatDateMDY('2026-12-25T10:30:00Z')
        expect(result).toMatch(/12\/25\/2026/)
    })
})

describe('formatDateISO', () => {
    it('should format Date object to YYYY-MM-DD', () => {
        const date = new Date(2026, 0, 5) // January 5, 2026
        expect(formatDateISO(date)).toBe('2026-01-05')
    })

    it('should format date string to YYYY-MM-DD', () => {
        expect(formatDateISO('2026-01-15')).toBe('2026-01-15')
    })

    it('should pad single digit months and days', () => {
        const date = new Date(2026, 2, 9) // March 9, 2026
        expect(formatDateISO(date)).toBe('2026-03-09')
    })

    it('should handle end of year dates', () => {
        const date = new Date(2026, 11, 31) // December 31, 2026
        expect(formatDateISO(date)).toBe('2026-12-31')
    })
})
