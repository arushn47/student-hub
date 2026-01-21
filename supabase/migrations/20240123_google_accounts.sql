-- Multi-Account Google Support
-- This migration creates a separate table to store multiple Google accounts per user

-- Create google_accounts table
CREATE TABLE IF NOT EXISTS public.google_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    tokens JSONB NOT NULL,
    -- Services this account is used for: 'tasks', 'calendar', 'classroom'
    services TEXT[] DEFAULT '{}',
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own google accounts"
    ON public.google_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own google accounts"
    ON public.google_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google accounts"
    ON public.google_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google accounts"
    ON public.google_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_google_accounts_user_id ON public.google_accounts(user_id);
CREATE INDEX idx_google_accounts_services ON public.google_accounts USING GIN(services);

-- Migrate existing google tokens from profiles to google_accounts
INSERT INTO public.google_accounts (user_id, email, tokens, services, is_primary)
SELECT 
    p.id as user_id,
    COALESCE(u.email, 'unknown@gmail.com') as email,
    p.google_tokens as tokens,
    ARRAY['tasks', 'calendar']::text[] as services,
    true as is_primary
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.google_tokens IS NOT NULL 
  AND p.google_connected = true
  AND NOT EXISTS (
    SELECT 1 FROM public.google_accounts ga WHERE ga.user_id = p.id
  );

-- Add comment
COMMENT ON TABLE public.google_accounts IS 'Stores multiple Google accounts per user for different services';
