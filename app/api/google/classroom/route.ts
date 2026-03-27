import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClassroomClient } from '@/lib/google'
import { getGoogleTokensForService } from '@/lib/google-accounts'

// GET: Fetch courses and coursework from Google Classroom
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { tokens } = await getGoogleTokensForService(user.id, 'classroom')

        if (!tokens) {
            return NextResponse.json({ error: 'No Google account connected for Classroom' }, { status: 400 })
        }

        const classroomClient = getClassroomClient(tokens)

        // Get all courses the user is enrolled in
        const coursesResponse = await classroomClient.courses.list({
            courseStates: ['ACTIVE'],
            pageSize: 20,
        })

        const courses = coursesResponse.data.courses || []
        console.log('Found courses:', courses.map(c => c.name))

        // Fetch coursework (assignments) from each course
        interface ClassroomAssignment {
            id: string | null | undefined
            title: string | null | undefined
            description: string | null | undefined
            dueDate: string | null
            courseName: string | null | undefined
            courseId: string | null | undefined
            alternateLink: string | null | undefined
            state: string | null | undefined
            maxPoints: number | null | undefined
        }

        const allAssignments: ClassroomAssignment[] = []

        for (const course of courses) {
            if (!course.id) continue

            try {
                const courseworkResponse = await classroomClient.courses.courseWork.list({
                    courseId: course.id,
                    pageSize: 50,
                    orderBy: 'dueDate asc',
                })

                const coursework = courseworkResponse.data.courseWork || []

                for (const work of coursework) {
                    let dueDate: string | null = null
                    if (work.dueDate) {
                        // Google returns dueDate as { year, month, day }
                        const { year, month, day } = work.dueDate
                        if (year && month && day) {
                            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        }
                    }

                    allAssignments.push({
                        id: work.id,
                        title: work.title,
                        description: work.description,
                        dueDate,
                        courseName: course.name,
                        courseId: course.id,
                        alternateLink: work.alternateLink,
                        state: work.state,
                        maxPoints: work.maxPoints,
                    })
                }
            } catch (e) {
                console.error(`Failed to fetch coursework for ${course.name}:`, e)
            }
        }

        console.log('Total assignments fetched:', allAssignments.length)

        return NextResponse.json({
            courses: courses.map(c => ({ id: c.id, name: c.name })),
            assignments: allAssignments,
        })
    } catch (error: unknown) {
        console.error('Classroom fetch error:', error)

        const errorObj = error as { code?: number; message?: string }
        const msg = errorObj.message || (error instanceof Error ? error.message : '')

        // Token expired / revoked
        if (msg.includes('invalid_grant') || errorObj.code === 401) {
            return NextResponse.json({
                error: 'Your Google session has expired. Please reconnect your Google account in Settings.',
                needsReconnect: true
            }, { status: 401 })
        }

        // Insufficient scope
        if (errorObj.code === 403 || msg.includes('scope')) {
            return NextResponse.json({
                error: 'Please reconnect Google in Settings to enable Classroom access',
                needsReconnect: true
            }, { status: 403 })
        }

        return NextResponse.json({ error: 'Failed to fetch from Classroom' }, { status: 500 })
    }
}

// POST: Import assignments from Google Classroom to local database
export async function POST() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { tokens } = await getGoogleTokensForService(user.id, 'classroom')

        if (!tokens) {
            return NextResponse.json({ error: 'No Google account connected for Classroom' }, { status: 400 })
        }

        const classroomClient = getClassroomClient(tokens)

        // Get courses
        const coursesResponse = await classroomClient.courses.list({
            courseStates: ['ACTIVE'],
            pageSize: 20,
        })

        const courses = coursesResponse.data.courses || []
        let importedCount = 0

        for (const course of courses) {
            if (!course.id) continue

            try {
                const courseworkResponse = await classroomClient.courses.courseWork.list({
                    courseId: course.id,
                    pageSize: 50,
                })

                const coursework = courseworkResponse.data.courseWork || []

                for (const work of coursework) {
                    let dueDate: string | null = null
                    if (work.dueDate) {
                        const { year, month, day } = work.dueDate
                        if (year && month && day) {
                            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        }
                    }

                    // Check submission state
                    let status: 'assigned' | 'missing' | 'done' = 'assigned'
                    try {
                        const submissionsResponse = await classroomClient.courses.courseWork.studentSubmissions.list({
                            courseId: course.id!,
                            courseWorkId: work.id!,
                            userId: 'me',
                        })
                        const submissions = submissionsResponse.data.studentSubmissions || []
                        if (submissions.length > 0) {
                            const submission = submissions[0]
                            // Map Google Classroom state to our status
                            if (submission.assignedGrade !== null && submission.assignedGrade !== undefined) {
                                status = 'done'
                            } else if (submission.state === 'TURNED_IN' || submission.state === 'RETURNED') {
                                status = 'done'
                            } else if (submission.state === 'CREATED') {
                                // Check if assignment is overdue
                                if (dueDate && new Date() > new Date(dueDate)) {
                                    status = 'missing'
                                } else {
                                    status = 'assigned'
                                }
                            }
                        }
                    } catch {
                        // If we can't get submission state, default to assigned
                        console.log(`Could not get submission state for ${work.title}`)
                    }

                    // Check if already imported (by matching title + course + due date)
                    let existingQuery = supabase
                        .from('assignments')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('title', work.title || 'Untitled')

                    if (course.name) {
                        existingQuery = existingQuery.eq('course', course.name)
                    } else {
                        existingQuery = existingQuery.is('course', null)
                    }

                    if (dueDate) {
                        existingQuery = existingQuery.eq('due_date', dueDate)
                    }

                    const { data: existing } = await existingQuery.maybeSingle()

                    if (!existing) {
                        // Insert new assignment
                        const { error } = await supabase
                            .from('assignments')
                            .insert({
                                user_id: user.id,
                                title: work.title || 'Untitled Assignment',
                                course: course.name || null,
                                due_date: dueDate,
                                status: status,
                                notes: work.description || null,
                                is_group: false,
                            })

                        if (!error) {
                            importedCount++
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to import from ${course.name}:`, e)
            }
        }

        return NextResponse.json({
            success: true,
            imported: importedCount,
            message: `Imported ${importedCount} new assignments from Google Classroom`,
        })
    } catch (error: unknown) {
        console.error('Classroom import error:', error)

        const errorObj = error as { code?: number; message?: string }
        const msg = errorObj.message || (error instanceof Error ? error.message : '')

        // Token expired / revoked
        if (msg.includes('invalid_grant') || errorObj.code === 401) {
            return NextResponse.json({
                error: 'Your Google session has expired. Please reconnect your Google account in Settings.',
                needsReconnect: true
            }, { status: 401 })
        }

        // Insufficient scope
        if (errorObj.code === 403 || msg.includes('scope')) {
            return NextResponse.json({
                error: 'Please reconnect Google in Settings to enable Classroom access',
                needsReconnect: true
            }, { status: 403 })
        }

        return NextResponse.json({ error: 'Failed to import from Classroom' }, { status: 500 })
    }
}
