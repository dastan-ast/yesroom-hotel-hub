-- Add CHECK constraints for input validation on bookings table
-- This prevents bypassing client-side validation via direct API calls

-- Validate guest_name length (2-100 characters)
ALTER TABLE public.bookings ADD CONSTRAINT guest_name_length 
  CHECK (length(guest_name) >= 2 AND length(guest_name) <= 100);

-- Validate guest_phone length (10-20 characters)
ALTER TABLE public.bookings ADD CONSTRAINT guest_phone_length 
  CHECK (length(guest_phone) >= 10 AND length(guest_phone) <= 20);

-- Validate guest_comment length (max 500 characters)
ALTER TABLE public.bookings ADD CONSTRAINT guest_comment_length 
  CHECK (guest_comment IS NULL OR length(guest_comment) <= 500);

-- Validate guest_count range (1-10)
ALTER TABLE public.bookings ADD CONSTRAINT guest_count_range 
  CHECK (guest_count >= 1 AND guest_count <= 10);

-- Validate dates: check_out must be after check_in
ALTER TABLE public.bookings ADD CONSTRAINT valid_dates 
  CHECK (check_out_date > check_in_date);

-- Validate reasonable stay length (max 365 days)
ALTER TABLE public.bookings ADD CONSTRAINT reasonable_stay 
  CHECK (check_out_date - check_in_date <= 365);