-- Announcements table for admin broadcasts
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'maintenance')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- Feature flags table for toggling features 
CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_pkey PRIMARY KEY (id),
  CONSTRAINT feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- RLS for announcements: everyone can read active ones, only admin can write (via service role)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active announcements" ON public.announcements
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RLS for feature_flags: everyone can read, only admin can write (via service role)
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read feature flags" ON public.feature_flags
  FOR SELECT USING (true);

-- Seed default feature flags
INSERT INTO public.feature_flags (name, description, is_enabled) VALUES
  ('ai_chat', 'AI Study Buddy chat feature', true),
  ('google_sync', 'Google Calendar/Classroom sync', true),
  ('exam_prep', 'AI-powered exam preparation', true),
  ('group_assignments', 'Collaborative group assignments', true),
  ('budget_tracker', 'Student budget tracking', true),
  ('question_papers', 'Question paper sharing', true)
ON CONFLICT (name) DO NOTHING;
