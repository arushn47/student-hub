-- Add visual_search_query column to exam_questions table
ALTER TABLE public.exam_questions 
ADD COLUMN IF NOT EXISTS visual_search_query text;
