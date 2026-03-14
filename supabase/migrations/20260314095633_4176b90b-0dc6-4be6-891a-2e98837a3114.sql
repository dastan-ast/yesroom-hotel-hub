
-- Drop existing weak policies
DROP POLICY IF EXISTS "Owner can update adjustments" ON public.checkout_adjustments;
DROP POLICY IF EXISTS "Staff can create adjustments for their hotel" ON public.checkout_adjustments;
DROP POLICY IF EXISTS "Staff can view adjustments for their hotel" ON public.checkout_adjustments;

-- Recreate with role checks
CREATE POLICY "Staff can view adjustments for their hotel"
ON public.checkout_adjustments FOR SELECT
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Staff can create adjustments for their hotel"
ON public.checkout_adjustments FOR INSERT
TO authenticated
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Owner can update adjustments"
ON public.checkout_adjustments FOR UPDATE
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

-- SuperAdmin full access
CREATE POLICY "SuperAdmin can manage all checkout_adjustments"
ON public.checkout_adjustments FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
