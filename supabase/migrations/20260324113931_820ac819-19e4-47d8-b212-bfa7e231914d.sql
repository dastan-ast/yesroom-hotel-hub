
-- Add DELETE policy for superadmin on hotels (needed for hotel deletion)
DROP POLICY IF EXISTS "SuperAdmin can delete hotels" ON public.hotels;
CREATE POLICY "SuperAdmin can delete hotels"
ON public.hotels FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));
