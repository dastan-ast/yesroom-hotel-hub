-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;

-- Create a more restrictive policy that validates hotel exists and is active
CREATE POLICY "Public can create bookings for active hotels"
ON public.bookings
FOR INSERT
WITH CHECK (
  hotel_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM hotels 
    WHERE id = hotel_id 
    AND status = 'active'
    AND subscription_status IN ('trial', 'active')
  )
);