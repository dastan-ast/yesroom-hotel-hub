-- Fix public booking insert policy: use security-definer function to avoid RLS recursion on hotels table
DROP POLICY IF EXISTS "Public can create bookings for active hotels" ON public.bookings;

CREATE POLICY "Public can create bookings for active hotels"
ON public.bookings
FOR INSERT
WITH CHECK (
  hotel_id IS NOT NULL
  AND is_hotel_active_for_public(hotel_id)
);