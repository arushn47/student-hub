-- Enable RLS for exam_flashcards
ALTER TABLE public.exam_flashcards ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT (Users can read their own flashcards)
CREATE POLICY "Users can view their own flashcards" ON public.exam_flashcards
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy for INSERT (Users can create their own flashcards)
CREATE POLICY "Users can create their own flashcards" ON public.exam_flashcards
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE (Users can update their own flashcards)
CREATE POLICY "Users can update their own flashcards" ON public.exam_flashcards
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy for DELETE (Users can delete their own flashcards)
CREATE POLICY "Users can delete their own flashcards" ON public.exam_flashcards
    FOR DELETE
    USING (auth.uid() = user_id);

-- Ensure exam_questions also has RLS (Safety check)
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own questions" ON public.exam_questions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own questions" ON public.exam_questions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own questions" ON public.exam_questions
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own questions" ON public.exam_questions
    FOR DELETE
    USING (auth.uid() = user_id);
