-- Add SELECT policy to prevent unauthorized access to booking data
-- Only hotel staff (admin/owner) can view bookings for their hotel
CREATE POLICY "Only hotel staff can view bookings"
ON public.bookings
FOR SELECT
USING (
  hotel_id = get_user_hotel_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);