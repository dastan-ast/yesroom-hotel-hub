-- Create security definer function to check hotel status (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_hotel_active_for_public(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotels
    WHERE id = _hotel_id
      AND status = 'active'
      AND subscription_status IN ('trial', 'active')
  )
$$;

-- Drop old policy that has RLS bypass issue
DROP POLICY IF EXISTS "Public can view room types for active hotels" ON public.room_types;

-- Create new policy using security definer function
CREATE POLICY "Public can view room types for active hotels"
ON public.room_types
FOR SELECT
USING (is_hotel_active_for_public(hotel_id));