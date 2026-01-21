-- Group Assignments Feature
-- Allows users to create assignment groups and collaborate with others

-- Assignment Groups table
CREATE TABLE IF NOT EXISTS public.assignment_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members table
CREATE TABLE IF NOT EXISTS public.assignment_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    -- For invitations to non-users (by email)
    invited_email TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    UNIQUE(group_id, user_id),
    UNIQUE(group_id, invited_email)
);

-- Enable RLS
ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignment_groups
-- Users can view groups they created or are members of
CREATE POLICY "Users can view their own groups"
    ON public.assignment_groups FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.assignment_group_members
            WHERE group_id = assignment_groups.id AND user_id = auth.uid()
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

-- RLS Policies for assignment_group_members
CREATE POLICY "Users can view group members"
    ON public.assignment_group_members FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.assignment_groups g
            WHERE g.id = group_id AND g.created_by = auth.uid()
        ) OR
        -- Users can see invitations to their email
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.email = invited_email
        )
    );

CREATE POLICY "Group owners can invite members"
    ON public.assignment_group_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assignment_groups g
            WHERE g.id = group_id AND g.created_by = auth.uid()
        )
    );

CREATE POLICY "Members can update their own status"
    ON public.assignment_group_members FOR UPDATE
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.email = invited_email
        )
    );

CREATE POLICY "Owners can remove members"
    ON public.assignment_group_members FOR DELETE
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.assignment_groups g
            WHERE g.id = group_id AND g.created_by = auth.uid()
        )
    );

-- Indexes
CREATE INDEX idx_assignment_groups_assignment_id ON public.assignment_groups(assignment_id);
CREATE INDEX idx_assignment_groups_created_by ON public.assignment_groups(created_by);
CREATE INDEX idx_group_members_group_id ON public.assignment_group_members(group_id);
CREATE INDEX idx_group_members_user_id ON public.assignment_group_members(user_id);
CREATE INDEX idx_group_members_invited_email ON public.assignment_group_members(invited_email);

-- Update assignments table to link to group
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.assignment_groups(id);

-- Group Messages table for chat
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for messages
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_messages
CREATE POLICY "Group members can view messages"
    ON public.group_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assignment_group_members m
            WHERE m.group_id = group_messages.group_id
              AND m.user_id = auth.uid()
              AND m.status = 'accepted'
        )
    );

CREATE POLICY "Group members can send messages"
    ON public.group_messages FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.assignment_group_members m
            WHERE m.group_id = group_messages.group_id
              AND m.user_id = auth.uid()
              AND m.status = 'accepted'
        )
    );

-- Index for faster message queries
CREATE INDEX idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX idx_group_messages_created_at ON public.group_messages(created_at DESC);

-- Enable realtime for group_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
