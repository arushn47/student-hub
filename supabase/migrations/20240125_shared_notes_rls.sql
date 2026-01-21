-- Enable RLS access for Shared Notes
-- Users should be able to SELECT notes that are shared with them via 'shared_content'

CREATE POLICY "Users can view shared notes"
    ON public.notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.shared_content sc
            JOIN public.shared_content_access sca ON sc.id = sca.shared_content_id
            WHERE sc.content_type = 'note'
            AND sc.content_id = notes.id
            AND (
                sca.user_id = auth.uid()
                OR
                sca.email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
            )
        )
    );

CREATE POLICY "Users can update shared notes (if edit permission)"
    ON public.notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.shared_content sc
            JOIN public.shared_content_access sca ON sc.id = sca.shared_content_id
            WHERE sc.content_type = 'note'
            AND sc.content_id = notes.id
            AND sca.permission = 'edit'
            AND (
                sca.user_id = auth.uid()
                OR
                sca.email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
            )
        )
    );
