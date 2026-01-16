-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.api_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT api_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  content text NOT NULL CHECK (char_length(TRIM(BOTH FROM content)) > 0),
  conversation_id uuid DEFAULT gen_random_uuid(),
  model text DEFAULT 'gemini-2.0-flash'::text,
  tokens_used integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.class_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  short_name text CHECK (short_name IS NULL OR char_length(short_name) <= 20),
  instructor text,
  location text,
  color text NOT NULL DEFAULT '#6366f1'::text CHECK (color ~* '^#[0-9A-Fa-f]{6}$'::text),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  term text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT class_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT class_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  credits integer NOT NULL DEFAULT 3 CHECK (credits > 0 AND credits <= 10),
  grade text CHECK (grade = ANY (ARRAY['S'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text, 'F'::text, 'P'::text])),
  semester text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  description text NOT NULL CHECK (char_length(TRIM(BOTH FROM description)) > 0),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  category text NOT NULL DEFAULT 'Other'::text CHECK (category = ANY (ARRAY['Food'::text, 'Transport'::text, 'Coffee'::text, 'Shopping'::text, 'Education'::text, 'Entertainment'::text, 'Other'::text])),
  expense_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.flashcard_decks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  description text,
  color text DEFAULT 'purple'::text,
  card_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT flashcard_decks_pkey PRIMARY KEY (id),
  CONSTRAINT flashcard_decks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.flashcards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL,
  user_id uuid NOT NULL,
  front text NOT NULL CHECK (char_length(TRIM(BOTH FROM front)) > 0),
  back text NOT NULL CHECK (char_length(TRIM(BOTH FROM back)) > 0),
  ease_factor numeric DEFAULT 2.5,
  interval_days integer DEFAULT 0,
  repetitions integer DEFAULT 0,
  next_review timestamp with time zone DEFAULT now(),
  last_reviewed timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT flashcards_pkey PRIMARY KEY (id),
  CONSTRAINT flashcards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.flashcard_decks(id),
  CONSTRAINT flashcards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(TRIM(BOTH FROM title)) > 0),
  content text CHECK (content IS NULL OR char_length(content) <= 500000),
  plain_text text,
  folder text DEFAULT 'default'::text CHECK (char_length(folder) <= 100),
  tags ARRAY DEFAULT '{}'::text[],
  is_pinned boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.pomodoro_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_type text NOT NULL DEFAULT 'focus'::text CHECK (session_type = ANY (ARRAY['focus'::text, 'shortBreak'::text, 'longBreak'::text])),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  completed boolean DEFAULT false,
  task_id uuid,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  CONSTRAINT pomodoro_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT pomodoro_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT pomodoro_sessions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
  full_name text CHECK (full_name IS NULL OR char_length(full_name) >= 1 AND char_length(full_name) <= 100),
  avatar_url text CHECK (avatar_url IS NULL OR avatar_url ~* '^https?://'::text),
  preferences jsonb DEFAULT '{"theme": "system", "daily_motivation": true, "notifications_enabled": true}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  monthly_budget numeric DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  type text NOT NULL DEFAULT 'file'::text CHECK (type = ANY (ARRAY['pdf'::text, 'link'::text, 'image'::text, 'video'::text, 'file'::text])),
  url text,
  file_path text,
  file_size integer,
  course text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT resources_pkey PRIMARY KEY (id),
  CONSTRAINT resources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(TRIM(BOTH FROM title)) > 0),
  description text CHECK (description IS NULL OR char_length(description) <= 5000),
  status text NOT NULL DEFAULT 'todo'::text CHECK (status = ANY (ARRAY['todo'::text, 'in-progress'::text, 'done'::text])),
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  due_date timestamp with time zone,
  reminder_at timestamp with time zone,
  parent_task_id uuid,
  position integer DEFAULT 0,
  estimated_minutes integer CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  actual_minutes integer CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
  completed_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id)
);