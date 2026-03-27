-- Adds per-user ordering for notes.
-- sort_order is used to persist drag-and-drop order.

ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS sort_order bigint;

-- Backfill existing notes to preserve the current default order (updated_at desc)
-- within each user.
WITH ranked AS (
  SELECT
    id,
    user_id,
    row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) - 1 AS rn
  FROM public.notes
  WHERE sort_order IS NULL
)
UPDATE public.notes n
SET sort_order = r.rn
FROM ranked r
WHERE n.id = r.id;

-- Keep it non-null going forward.
ALTER TABLE public.notes
ALTER COLUMN sort_order SET NOT NULL;

ALTER TABLE public.notes
ALTER COLUMN sort_order SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS notes_user_pinned_sort_order_idx
ON public.notes (user_id, is_pinned DESC, sort_order ASC);
