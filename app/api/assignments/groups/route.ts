import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Get user's pending group invitations
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user's email
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single()

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        // Get pending invitations (by user_id or by email)
        const { data: invitations, error } = await supabase
            .from('assignment_group_members')
            .select(`
                *,
                group:assignment_groups(
                    id,
                    name,
                    created_by,
                    assignment:assignments!assignment_groups_assignment_id_fkey(id, title, course, due_date)
                )
            `)
            .or(`user_id.eq.${user.id},invited_email.eq.${profile.email}`)
            .eq('status', 'pending')

        if (error) {
            console.error('Error fetching invitations:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ invitations })
    } catch (error) {
        console.error('Get invitations error:', error)
        return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }
}

// POST: Invite a user to a group assignment
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { assignmentId, inviteEmail } = body

        if (!assignmentId || !inviteEmail) {
            return NextResponse.json({ error: 'assignmentId and inviteEmail are required' }, { status: 400 })
        }

        // Check if assignment exists and user owns it
        const { data: assignment } = await supabase
            .from('assignments')
            .select('*')
            .eq('id', assignmentId)
            .eq('user_id', user.id)
            .single()

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found or not owned by you' }, { status: 404 })
        }

        // Check if group exists for this assignment, or create one
        let { data: group } = await supabase
            .from('assignment_groups')
            .select('*')
            .eq('assignment_id', assignmentId)
            .single()

        if (!group) {
            // Create group
            const { data: newGroup, error: groupError } = await supabase
                .from('assignment_groups')
                .insert({
                    assignment_id: assignmentId,
                    created_by: user.id,
                    name: `${assignment.title} Group`,
                })
                .select()
                .single()

            if (groupError) {
                console.error('Error creating group:', groupError)
                return NextResponse.json({ error: groupError.message }, { status: 500 })
            }
            group = newGroup

            // Add owner as member
            await supabase
                .from('assignment_group_members')
                .insert({
                    group_id: group.id,
                    user_id: user.id,
                    role: 'owner',
                    status: 'accepted',
                    joined_at: new Date().toISOString(),
                })

            // Update assignment with group_id
            await supabase
                .from('assignments')
                .update({ group_id: group.id, is_group: true })
                .eq('id', assignmentId)
        }

        // Check if user is already invited
        const { data: existingInvite } = await supabase
            .from('assignment_group_members')
            .select('id')
            .eq('group_id', group.id)
            .eq('invited_email', inviteEmail)
            .single()

        if (existingInvite) {
            return NextResponse.json({ error: 'User already invited' }, { status: 400 })
        }

        // Check if user exists with this email
        const { data: invitedUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', inviteEmail)
            .single()

        // Create invitation
        const { data: invite, error } = await supabase
            .from('assignment_group_members')
            .insert({
                group_id: group.id,
                user_id: invitedUser?.id || null,
                invited_email: inviteEmail,
                role: 'member',
                status: 'pending',
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating invite:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            invite,
            message: `Invitation sent to ${inviteEmail}`
        })

    } catch (error) {
        console.error('Invite error:', error)
        return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
    }
}

// PATCH: Accept or decline an invitation
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { inviteId, action } = body // action: 'accept' | 'decline'

        if (!inviteId || !action) {
            return NextResponse.json({ error: 'inviteId and action are required' }, { status: 400 })
        }

        if (!['accept', 'decline'].includes(action)) {
            return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 })
        }

        // Get user's email
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single()

        // Verify invite belongs to user
        const { data: invite } = await supabase
            .from('assignment_group_members')
            .select('*, group:assignment_groups(id, assignment_id)')
            .eq('id', inviteId)
            .or(`user_id.eq.${user.id},invited_email.eq.${profile?.email}`)
            .single()

        if (!invite) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
        }

        // If group join failed, fetch it directly
        let groupData = invite.group
        if (!groupData && invite.group_id) {
            const { data: fetchedGroup } = await supabase
                .from('assignment_groups')
                .select('id, assignment_id')
                .eq('id', invite.group_id)
                .single()
            groupData = fetchedGroup
        }

        if (action === 'accept') {
            // Accept invitation
            await supabase
                .from('assignment_group_members')
                .update({
                    status: 'accepted',
                    user_id: user.id, // Link to user if was email-only invite
                    joined_at: new Date().toISOString(),
                })
                .eq('id', inviteId)

            // Create a copy of the assignment for this user (only if we have group data)
            if (groupData?.assignment_id) {
                const { data: originalAssignment, error: fetchError } = await supabase
                    .from('assignments')
                    .select('*')
                    .eq('id', groupData.assignment_id)
                    .single()

                if (fetchError) {
                    console.error('Error fetching original assignment:', fetchError)
                }

                if (originalAssignment) {
                    // Check if user already has this assignment
                    const { data: existingAssignment } = await supabase
                        .from('assignments')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('group_id', invite.group_id)
                        .single()

                    if (!existingAssignment) {
                        const { error: insertError } = await supabase
                            .from('assignments')
                            .insert({
                                user_id: user.id,
                                title: originalAssignment.title,
                                course: originalAssignment.course,
                                due_date: originalAssignment.due_date,
                                notes: originalAssignment.notes,
                                status: 'assigned',
                                is_group: true,
                                group_id: invite.group_id,
                            })

                        if (insertError) {
                            console.error('Error creating assignment copy:', insertError)
                            return NextResponse.json({
                                success: true,
                                message: 'Invitation accepted but assignment copy failed',
                                error: insertError.message
                            })
                        }
                    }
                }
            } else {
                console.log('No group data found, skipping assignment copy. invite.group_id:', invite.group_id)
            }

            return NextResponse.json({ success: true, message: 'Invitation accepted' })
        } else {
            // Decline invitation
            await supabase
                .from('assignment_group_members')
                .update({ status: 'declined' })
                .eq('id', inviteId)

            return NextResponse.json({ success: true, message: 'Invitation declined' })
        }

    } catch (error) {
        console.error('Accept/decline error:', error)
        return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 })
    }
}
