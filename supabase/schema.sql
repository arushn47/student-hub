-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  type text NOT NULL DEFAULT 'info'::text CHECK (type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'maintenance'::text])),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.api_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT api_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.assignment_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid,
  invited_email text,
  role text DEFAULT 'member'::text CHECK (role = ANY (ARRAY['owner'::text, 'member'::text])),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])),
  invited_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone,
  CONSTRAINT assignment_group_members_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.assignment_groups(id),
  CONSTRAINT assignment_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.assignment_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignment_groups_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_groups_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT assignment_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  course text,
  due_date timestamp with time zone,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['assigned'::text, 'missing'::text, 'done'::text])),
  grade text,
  is_group boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  group_id uuid,
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.assignment_groups(id)
);
CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_schedule_id uuid,
  date date NOT NULL,
  status text DEFAULT 'present'::text CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  semester text,
  semester_id uuid,
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT attendance_records_class_schedule_id_fkey FOREIGN KEY (class_schedule_id) REFERENCES public.class_schedules(id)
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
  semester_id uuid,
  CONSTRAINT class_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT class_schedules_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT class_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  credits integer NOT NULL DEFAULT 3 CHECK (credits >= 0 AND credits <= 50),
  grade text CHECK (grade = ANY (ARRAY['S'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text, 'F'::text, 'P'::text])),
  semester text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category text,
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.degree_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  required_credits integer NOT NULL DEFAULT 0 CHECK (required_credits >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT degree_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT degree_requirements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.exam_flashcards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  user_id uuid NOT NULL,
  front text NOT NULL,
  back text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_flashcards_pkey PRIMARY KEY (id),
  CONSTRAINT exam_flashcards_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.exam_modules(id),
  CONSTRAINT exam_flashcards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.exam_module_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_module_files_pkey PRIMARY KEY (id),
  CONSTRAINT exam_module_files_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.exam_modules(id),
  CONSTRAINT exam_module_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.exam_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  module_number integer NOT NULL,
  file_path text,
  file_name text,
  summary text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_modules_pkey PRIMARY KEY (id),
  CONSTRAINT exam_modules_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.exam_subjects(id),
  CONSTRAINT exam_modules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.exam_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  user_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  is_most_likely boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  visual_search_query text,
  CONSTRAINT exam_questions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_questions_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.exam_modules(id),
  CONSTRAINT exam_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.exam_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  total_modules integer NOT NULL DEFAULT 5,
  questions_per_module integer DEFAULT 1,
  marks_per_question integer DEFAULT 10,
  created_at timestamp with time zone DEFAULT now(),
  syllabus_path text,
  exam_type text DEFAULT 'endterm'::text,
  important_questions text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text])),
  CONSTRAINT exam_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT exam_subjects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
CREATE TABLE public.google_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  picture text,
  tokens jsonb NOT NULL,
  services ARRAY DEFAULT '{}'::text[],
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT google_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT google_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.group_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_messages_pkey PRIMARY KEY (id),
  CONSTRAINT group_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.assignment_groups(id),
  CONSTRAINT group_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  ai_explanations jsonb DEFAULT '{}'::jsonb,
  ai_quizzes jsonb DEFAULT '{}'::jsonb,
  sort_order bigint NOT NULL DEFAULT 0,
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
  google_tokens jsonb,
  google_connected boolean DEFAULT false,
  plan text NOT NULL DEFAULT 'free'::text,
  subscription_status text DEFAULT 'inactive'::text,
  role text NOT NULL DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text])),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.question_papers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  college text NOT NULL,
  subject text NOT NULL,
  semester text,
  year integer,
  file_url text,
  uploaded_by uuid NOT NULL,
  downloads integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  exam_type text,
  slot text,
  page_count integer,
  file_urls jsonb,
  CONSTRAINT question_papers_pkey PRIMARY KEY (id),
  CONSTRAINT question_papers_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);
CREATE TABLE public.reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(TRIM(BOTH FROM title)) > 0),
  remind_at timestamp with time zone NOT NULL,
  type text NOT NULL DEFAULT 'custom'::text CHECK (type = ANY (ARRAY['task'::text, 'event'::text, 'custom'::text])),
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reminders_pkey PRIMARY KEY (id),
  CONSTRAINT reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
CREATE TABLE public.saved_citations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  citation_apa text,
  citation_mla text,
  citation_chicago text,
  source_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT saved_citations_pkey PRIMARY KEY (id),
  CONSTRAINT saved_citations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.semester_breaks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  break_type text DEFAULT 'holiday'::text,
  CONSTRAINT semester_breaks_pkey PRIMARY KEY (id),
  CONSTRAINT semester_breaks_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id)
);
CREATE TABLE public.semesters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT semesters_pkey PRIMARY KEY (id),
  CONSTRAINT semesters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.shared_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['note'::text, 'task'::text, 'reminder'::text])),
  content_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  title text,
  is_public boolean DEFAULT false,
  CONSTRAINT shared_content_pkey PRIMARY KEY (id),
  CONSTRAINT shared_content_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.shared_content_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  shared_content_id uuid NOT NULL,
  user_id uuid,
  email text,
  permission text NOT NULL CHECK (permission = ANY (ARRAY['view'::text, 'edit'::text, 'admin'::text])),
  CONSTRAINT shared_content_access_pkey PRIMARY KEY (id),
  CONSTRAINT shared_content_access_shared_content_id_fkey FOREIGN KEY (shared_content_id) REFERENCES public.shared_content(id),
  CONSTRAINT shared_content_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  google_task_id text,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.user_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  activity_count integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_activity_pkey PRIMARY KEY (id),
  CONSTRAINT user_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);