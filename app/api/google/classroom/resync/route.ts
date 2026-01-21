import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClassroomClient } from '@/lib/google'
import { getGoogleTokensForService } from '@/lib/google-accounts'

// POST: Re-sync all assignment statuses from Google Classroom
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

        // Get all courses
        const coursesResponse = await classroomClient.courses.list({
            studentId: 'me',
            courseStates: ['ACTIVE'],
        })
        const courses = coursesResponse.data.courses || []

        // Build a map of coursework title+course -> status
        const statusMap = new Map<string, 'assigned' | 'missing' | 'done'>()

        for (const course of courses) {
            if (!course.id) continue

            try {
                const courseworkResponse = await classroomClient.courses.courseWork.list({
                    courseId: course.id,
                    pageSize: 100,
                })

                const coursework = courseworkResponse.data.courseWork || []

                for (const work of coursework) {
                    if (!work.id || !work.title) continue

                    try {
                        const submissionsResponse = await classroomClient.courses.courseWork.studentSubmissions.list({
                            courseId: course.id,
                            courseWorkId: work.id,
                            userId: 'me',
                        })
                        const submissions = submissionsResponse.data.studentSubmissions || []

                        let status: 'assigned' | 'missing' | 'done' = 'assigned'
                        if (submissions.length > 0) {
                            const submission = submissions[0]
                            if (submission.assignedGrade !== null && submission.assignedGrade !== undefined) {
                                status = 'done'
                            } else if (submission.state === 'TURNED_IN' || submission.state === 'RETURNED') {
                                status = 'done'
                            } else {
                                // Check if assignment is overdue
                                if (work.dueDate) {
                                    const dueDate = new Date(
                                        work.dueDate.year!,
                                        (work.dueDate.month! - 1),
                                        work.dueDate.day!,
                                        work.dueTime?.hours || 23,
                                        work.dueTime?.minutes || 59
                                    )
                                    if (new Date() > dueDate) {
                                        status = 'missing'
                                    }
                                }
                            }
                        }

                        // Key: title|courseName
                        const key = `${work.title}|${course.name || ''}`
                        statusMap.set(key, status)
                    } catch {
                        // Skip if can't get submission
                    }
                }
            } catch (e) {
                console.error(`Failed to get coursework for ${course.name}:`, e)
            }
        }

        // Get all user's assignments
        const { data: assignments } = await supabase
            .from('assignments')
            .select('id, title, course, status')
            .eq('user_id', user.id)

        if (!assignments) {
            return NextResponse.json({ error: 'No assignments found' }, { status: 404 })
        }

        let updatedCount = 0

        for (const assignment of assignments) {
            const key = `${assignment.title}|${assignment.course || ''}`
            const newStatus = statusMap.get(key)

            if (newStatus && newStatus !== assignment.status) {
                const { error } = await supabase
                    .from('assignments')
                    .update({ status: newStatus })
                    .eq('id', assignment.id)

                if (!error) {
                    updatedCount++
                }
            }
        }

        return NextResponse.json({
            success: true,
            updated: updatedCount,
            message: `Updated ${updatedCount} assignments with correct status`,
        })

    } catch (error) {
        console.error('Resync error:', error)
        return NextResponse.json({ error: 'Failed to resync assignments' }, { status: 500 })
    }
}
