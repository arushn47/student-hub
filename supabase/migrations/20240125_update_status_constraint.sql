-- Drop the old constraint
ALTER TABLE public.assignments 
DROP CONSTRAINT IF EXISTS assignments_status_check;

-- 1. Migrate existing data to new statuses
UPDATE public.assignments 
SET status = 'assigned' 
WHERE status IN ('pending', 'in-progress', 'CREATED');

UPDATE public.assignments 
SET status = 'done' 
WHERE status IN ('submitted', 'graded', 'TURNED_IN', 'RETURNED');

-- 2. Add the new constraint with simplified statuses
ALTER TABLE public.assignments 
ADD CONSTRAINT assignments_status_check 
CHECK (status IN ('assigned', 'missing', 'done'));
