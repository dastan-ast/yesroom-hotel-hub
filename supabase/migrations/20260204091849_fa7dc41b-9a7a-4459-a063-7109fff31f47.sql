-- Fix: Allow public viewing of room types for active hotels only
-- This is necessary for the public booking flow while still protecting 
-- inactive/suspended hotel data from competitors

-- Add conditional public SELECT policy for room_types
-- Only allows viewing room types for active hotels with valid subscriptions
CREATE POLICY "Public can view room types for active hotels"
ON public.room_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = room_types.hotel_id
      AND h.status = 'active'
      AND h.subscription_status IN ('trial', 'active')
  )
);

-- Drop the security view as we now use conditional RLS instead
DROP VIEW IF EXISTS public.room_types_public;