-- Create shared_content table for real-time collaboration
CREATE TABLE IF NOT EXISTS public.shared_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Content Reference
  content_type TEXT NOT NULL CHECK (content_type IN ('note', 'task', 'reminder')),
  content_id UUID NOT NULL, -- Logical ID of the content, but we might link to actual tables? 
  -- Actually, for real-time sharing, it's better if the content itself lives in its original table 
  -- (e.g. notes) and we just track access here.
  -- BUT the original tables (notes) are RLS-protected for the owner.
  -- So we need a way to bypass that for shared users.
  
  -- Simpler Approach: 
  -- Keep content in `notes`, `tasks`, etc.
  -- Use `shared_content` to map (content_id, user_id, permission).
  -- UPDATE RLS on `notes` etc. to check `shared_content`.
  
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, -- Optional denormalized title for easy listing
  
  -- Metadata
  is_public BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.shared_content_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  shared_content_id UUID NOT NULL REFERENCES public.shared_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, -- For pending invites
  
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'admin')),
  
  CONSTRAINT unique_user_share UNIQUE (shared_content_id, user_id),
  CONSTRAINT unique_email_share UNIQUE (shared_content_id, email)
);

-- Enable RLS
ALTER TABLE public.shared_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_content_access ENABLE ROW LEVEL SECURITY;

-- Shared Content Policies
CREATE POLICY "Users can view their own shared content"
  ON public.shared_content FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own shared content"
  ON public.shared_content FOR INSERT
  WITH CHECK (owner_id = auth.uid());
  
CREATE POLICY "Users can delete their own shared content"
  ON public.shared_content FOR DELETE
  USING (owner_id = auth.uid());

-- Access Policies
CREATE POLICY "Users can view access they are part of"
  ON public.shared_content_access FOR SELECT
  USING (
    user_id = auth.uid() 
    OR 
    email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.shared_content WHERE id = shared_content_id AND owner_id = auth.uid())
  );

CREATE POLICY "Owners can manage access"
  ON public.shared_content_access FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.shared_content WHERE id = shared_content_id AND owner_id = auth.uid())
  );
  
-- Important: We need a way for the 'notes' table to know it's shared.
-- We will add a 'shared_id' column to 'notes', 'tasks', etc. later or use a join policy.
-- For now, let's create the base structure.
