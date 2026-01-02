-- Add constraint to prevent past check-in dates for web bookings
-- Staff/manual bookings can still use past dates for historical records
ALTER TABLE public.bookings ADD CONSTRAINT check_in_not_past_for_web
  CHECK (
    source != 'web' OR check_in_date >= CURRENT_DATE
  );