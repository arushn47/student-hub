-- Fix RLS infinite recursion by simplifying policies
-- The issue: assignment_groups policy checks assignment_group_members, 
-- which might check assignment_groups, causing recursion

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own groups" ON public.assignment_groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.assignment_groups;
DROP POLICY IF EXISTS "Owners can update groups" ON public.assignment_groups;
DROP POLICY IF EXISTS "Owners can delete groups" ON public.assignment_groups;

-- Recreate simpler policies that don't cause recursion
-- Users can see groups they created
CREATE POLICY "Users can view groups they created"
    ON public.assignment_groups FOR SELECT
    USING (created_by = auth.uid());

-- Users can see groups for assignments they own
CREATE POLICY "Users can view groups for their assignments"
    ON public.assignment_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.id = assignment_groups.assignment_id AND a.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create groups"
    ON public.assignment_groups FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update groups"
    ON public.assignment_groups FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Owners can delete groups"
    ON public.assignment_groups FOR DELETE
    USING (created_by = auth.uid());

-- Also simplify assignment_group_members policies
DROP POLICY IF EXISTS "Users can view group members" ON public.assignment_group_members;

-- Users can see their own memberships
CREATE POLICY "Users can view own memberships"
    ON public.assignment_group_members FOR SELECT
    USING (user_id = auth.uid());

-- Users can see invitations to their email (lookup by comparing with profiles)
CREATE POLICY "Users can view invitations by email"
    ON public.assignment_group_members FOR SELECT
    USING (
        invited_email IN (
            SELECT email FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Group creators can see all members of their groups
CREATE POLICY "Creators can view group members"
    ON public.assignment_group_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assignment_groups g
            WHERE g.id = group_id AND g.created_by = auth.uid()
        )
    );
