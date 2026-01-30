-- Add exam_type column
alter table question_papers 
add column if not exists exam_type text;

-- Optional: Update existing records to have a default type if needed
-- update question_papers set exam_type = 'End Term' where exam_type is null;
