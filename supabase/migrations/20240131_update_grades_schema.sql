-- Safely add category column or create courses table if missing
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'courses') THEN
        -- Table exists, check for column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'category') THEN
            ALTER TABLE public.courses ADD COLUMN category text;
        END IF;
        
        -- Relax credits constraint
        -- We try to DROP known constraint names.
        -- "courses_credits_check" is default.
        -- "credits_valid" was reported by user.
        
        BEGIN
            ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_credits_check;
        EXCEPTION WHEN undefined_object THEN
            NULL;
        END;

        BEGIN
            ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS credits_valid;
        EXCEPTION WHEN undefined_object THEN
            NULL;
        END;

        -- Add new constraint allowing 0 and up to 50
        -- We give it a standard name so we can manage it later
        ALTER TABLE public.courses ADD CONSTRAINT courses_credits_check CHECK (credits >= 0 AND credits <= 50);

    ELSE
        -- Table does not exist, create it with category included
        CREATE TABLE public.courses (
          id uuid NOT NULL DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES auth.users(id),
          name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
          credits integer NOT NULL DEFAULT 3 CHECK (credits >= 0 AND credits <= 50),
          grade text CHECK (grade = ANY (ARRAY['S'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text, 'F'::text, 'P'::text])),
          semester text,
          category text,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now(),
          CONSTRAINT courses_pkey PRIMARY KEY (id)
        );
        
        -- Enable RLS
        ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
        
        -- Add RLS Policy
        CREATE POLICY "Users can manage their own courses" ON public.courses
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Create degree_requirements if missing
CREATE TABLE IF NOT EXISTS public.degree_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  required_credits integer NOT NULL DEFAULT 0 CHECK (required_credits >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT degree_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT degree_requirements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT degree_requirements_user_name_unique UNIQUE (user_id, name)
);

-- Add RLS policies for degree_requirements
ALTER TABLE public.degree_requirements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'degree_requirements' AND policyname = 'Users can view their own degree requirements') THEN
        CREATE POLICY "Users can view their own degree requirements"
            ON public.degree_requirements FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'degree_requirements' AND policyname = 'Users can insert their own degree requirements') THEN
        CREATE POLICY "Users can insert their own degree requirements"
            ON public.degree_requirements FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'degree_requirements' AND policyname = 'Users can update their own degree requirements') THEN
        CREATE POLICY "Users can update their own degree requirements"
            ON public.degree_requirements FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'degree_requirements' AND policyname = 'Users can delete their own degree requirements') THEN
        CREATE POLICY "Users can delete their own degree requirements"
            ON public.degree_requirements FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;
