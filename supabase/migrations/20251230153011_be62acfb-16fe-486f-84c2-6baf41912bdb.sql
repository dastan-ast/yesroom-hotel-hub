-- Add guest_count column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN guest_count integer NOT NULL DEFAULT 1;

-- Add constraint to ensure guest_count is positive
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_guest_count_positive CHECK (guest_count > 0);