import { vi, describe, it, expect } from 'vitest'

// Mock Supabase client to avoid loading real env variables in test
vi.mock('@/lib/supabase/client', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => Promise.resolve({ data: [], error: null })
            })
        })
    }
}))

import { generateProgramSemesters } from '../semester-utils'

describe('generateProgramSemesters', () => {
    it('projects semesters properly for B.Tech starting in Semester 3', () => {
        // Semester 3 starts on August 1st, 2025
        const semesters = generateProgramSemesters(8, 3, '2025-08-01')

        expect(semesters.length).toBe(8)
        
        // Semester 3 (Active)
        const sem3 = semesters[2]
        expect(sem3.name).toBe('Semester 3')
        expect(sem3.start_date).toBe('2025-08-01')
        expect(sem3.end_date).toBe('2025-12-15')
        expect(sem3.is_active).toBe(true)

        // Semester 1 (2024-08-01)
        const sem1 = semesters[0]
        expect(sem1.name).toBe('Semester 1')
        expect(sem1.start_date).toBe('2024-08-01')
        expect(sem1.end_date).toBe('2024-12-15')
        expect(sem1.is_active).toBe(false)

        // Semester 2 (2025-01-03)
        const sem2 = semesters[1]
        expect(sem2.name).toBe('Semester 2')
        expect(sem2.start_date).toBe('2025-01-03')
        expect(sem2.end_date).toBe('2025-05-15')
        expect(sem2.is_active).toBe(false)

        // Semester 4 (2026-01-03)
        const sem4 = semesters[3]
        expect(sem4.name).toBe('Semester 4')
        expect(sem4.start_date).toBe('2026-01-03')
        expect(sem4.end_date).toBe('2026-05-15')
        expect(sem4.is_active).toBe(false)

        // Semester 8 (2028-01-03)
        const sem8 = semesters[7]
        expect(sem8.name).toBe('Semester 8')
        expect(sem8.start_date).toBe('2028-01-03')
        expect(sem8.end_date).toBe('2028-05-15')
        expect(sem8.is_active).toBe(false)
    })

    it('projects semesters properly for M.Tech starting in Semester 1', () => {
        const semesters = generateProgramSemesters(4, 1, '2026-08-10')

        expect(semesters.length).toBe(4)

        const sem1 = semesters[0]
        expect(sem1.name).toBe('Semester 1')
        expect(sem1.start_date).toBe('2026-08-10') // Exact date
        expect(sem1.end_date).toBe('2026-12-15') // Aligned end
        expect(sem1.is_active).toBe(true)

        const sem2 = semesters[1]
        expect(sem2.name).toBe('Semester 2')
        expect(sem2.start_date).toBe('2027-01-03')
        expect(sem2.end_date).toBe('2027-05-15')
        expect(sem2.is_active).toBe(false)
    })
})
