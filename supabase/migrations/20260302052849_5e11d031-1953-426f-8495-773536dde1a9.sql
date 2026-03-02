-- Allow public users to count rooms for active hotels (needed for availability check)
CREATE POLICY "Public can view rooms for active hotels"
  ON public.rooms
  FOR SELECT
  USING (is_hotel_active_for_public(hotel_id));