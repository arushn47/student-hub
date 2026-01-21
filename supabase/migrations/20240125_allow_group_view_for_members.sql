-- Allow users to view groups they are members of (including pending invitations)
CREATE POLICY "Members can view their groups"
    ON public.assignment_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assignment_group_members m
            WHERE m.group_id = assignment_groups.id
            AND (
                m.user_id = auth.uid() 
                OR 
                m.invited_email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
            )
        )
    );
