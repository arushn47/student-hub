import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Log user activity for today
export async function POST() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const today = new Date().toISOString().split('T')[0]

        // Upsert activity for today (increment count if exists)
        const { error } = await supabase
            .from('user_activity')
            .upsert(
                {
                    user_id: user.id,
                    activity_date: today,
                    activity_count: 1,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'user_id,activity_date',
                    ignoreDuplicates: false
                }
            )

        if (error) {
            // If upsert fails, try to increment existing record
            const { error: updateError } = await supabase.rpc('increment_activity', {
                p_user_id: user.id,
                p_date: today
            })

            if (updateError) {
                console.error('Activity log error:', updateError)
            }
        }

        return NextResponse.json({ success: true, date: today })
    } catch (error) {
        console.error('Activity log error:', error)
        return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 })
    }
}

// GET: Get user's current streak
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get recent activity ordered by date desc
        const { data: activities, error } = await supabase
            .from('user_activity')
            .select('activity_date')
            .eq('user_id', user.id)
            .order('activity_date', { ascending: false })
            .limit(365) // Max 1 year

        if (error) {
            throw error
        }

        if (!activities || activities.length === 0) {
            return NextResponse.json({ streak: 0, lastActive: null })
        }

        // Calculate streak
        let streak = 0
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        // Check if user was active today or yesterday (streak continues)
        const lastActiveDate = new Date(activities[0].activity_date)
        lastActiveDate.setHours(0, 0, 0, 0)

        const isActiveToday = lastActiveDate.getTime() === today.getTime()
        const isActiveYesterday = lastActiveDate.getTime() === yesterday.getTime()

        if (!isActiveToday && !isActiveYesterday) {
            // Streak broken
            return NextResponse.json({
                streak: 0,
                lastActive: activities[0].activity_date,
                message: 'Streak broken! Log in to start a new one.'
            })
        }

        // Count consecutive days
        let checkDate = isActiveToday ? today : yesterday

        for (const activity of activities) {
            const activityDate = new Date(activity.activity_date)
            activityDate.setHours(0, 0, 0, 0)

            if (activityDate.getTime() === checkDate.getTime()) {
                streak++
                checkDate.setDate(checkDate.getDate() - 1)
            } else if (activityDate.getTime() < checkDate.getTime()) {
                // Gap in activity = streak ends
                break
            }
        }

        return NextResponse.json({
            streak,
            lastActive: activities[0].activity_date,
            isActiveToday
        })
    } catch (error) {
        console.error('Streak calculation error:', error)
        return NextResponse.json({ error: 'Failed to get streak' }, { status: 500 })
    }
}
