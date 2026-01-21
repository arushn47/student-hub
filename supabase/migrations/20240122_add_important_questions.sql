-- Add important_questions column to exam_subjects
ALTER TABLE public.exam_subjects 
ADD COLUMN IF NOT EXISTS important_questions text;
