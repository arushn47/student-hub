-- Add role column to profiles table for RBAC
ALTER TABLE public.profiles
ADD COLUMN role text NOT NULL DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

-- Set the initial admin account
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'arushmenon.7@gmail.com';

-- Create index for role lookups (admin checks)
CREATE INDEX idx_profiles_role ON public.profiles (role);

-- RLS: prevent users from changing their own role (only service role can)
CREATE POLICY "Users cannot update their own role"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
USING (true)
WITH CHECK (
  role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
);
