-- ============================================================
-- Airtight Row-Level Security (RLS) Policies for Academic Data
-- Ensures students can NEVER view, mutate, or leak another student's records.
-- Run in Supabase Dashboard -> SQL Editor if not already active.
-- ============================================================

-- 1. COURSES (Grades & CGPA Data)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own courses" ON public.courses;
CREATE POLICY "Users can only view their own courses"
    ON public.courses FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own courses" ON public.courses;
CREATE POLICY "Users can only insert their own courses"
    ON public.courses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own courses" ON public.courses;
CREATE POLICY "Users can only update their own courses"
    ON public.courses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own courses" ON public.courses;
CREATE POLICY "Users can only delete their own courses"
    ON public.courses FOR DELETE
    USING (auth.uid() = user_id);

-- 2. DEGREE REQUIREMENTS (Curriculum targets)
ALTER TABLE public.degree_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own degree requirements" ON public.degree_requirements;
CREATE POLICY "Users can only view their own degree requirements"
    ON public.degree_requirements FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only mutate their own degree requirements" ON public.degree_requirements;
CREATE POLICY "Users can only mutate their own degree requirements"
    ON public.degree_requirements FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. ASSIGNMENTS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own assignments" ON public.assignments;
CREATE POLICY "Users can only view their own assignments"
    ON public.assignments FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only mutate their own assignments" ON public.assignments;
CREATE POLICY "Users can only mutate their own assignments"
    ON public.assignments FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. NOTES
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own notes" ON public.notes;
CREATE POLICY "Users can only view their own notes"
    ON public.notes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only mutate their own notes" ON public.notes;
CREATE POLICY "Users can only mutate their own notes"
    ON public.notes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own tasks" ON public.tasks;
CREATE POLICY "Users can only view their own tasks"
    ON public.tasks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only mutate their own tasks" ON public.tasks;
CREATE POLICY "Users can only mutate their own tasks"
    ON public.tasks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. CLASS SCHEDULES & ATTENDANCE
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own class schedules" ON public.class_schedules;
CREATE POLICY "Users can only view their own class schedules"
    ON public.class_schedules FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only mutate their own class schedules" ON public.class_schedules;
CREATE POLICY "Users can only mutate their own class schedules"
    ON public.class_schedules FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only view their own attendance records" ON public.attendance_records;
CREATE POLICY "Users can only view their own attendance records"
    ON public.attendance_records FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only mutate their own attendance records" ON public.attendance_records;
CREATE POLICY "Users can only mutate their own attendance records"
    ON public.attendance_records FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. EXAM PREP (Subjects & Modules)
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own exam subjects" ON public.exam_subjects;
CREATE POLICY "Users can only view their own exam subjects"
    ON public.exam_subjects FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only mutate their own exam subjects" ON public.exam_subjects;
CREATE POLICY "Users can only mutate their own exam subjects"
    ON public.exam_subjects FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only view modules for their own subjects" ON public.exam_modules;
CREATE POLICY "Users can only view modules for their own subjects"
    ON public.exam_modules FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_subjects
            WHERE exam_subjects.id = exam_modules.subject_id
            AND exam_subjects.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can only mutate modules for their own subjects" ON public.exam_modules;
CREATE POLICY "Users can only mutate modules for their own subjects"
    ON public.exam_modules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_subjects
            WHERE exam_subjects.id = exam_modules.subject_id
            AND exam_subjects.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_subjects
            WHERE exam_subjects.id = exam_modules.subject_id
            AND exam_subjects.user_id = auth.uid()
        )
    );

