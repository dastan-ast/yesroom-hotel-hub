-- Drop the old constraint and replace with one that allows same-day for half-day bookings
ALTER TABLE public.bookings DROP CONSTRAINT valid_dates;
ALTER TABLE public.bookings ADD CONSTRAINT valid_dates CHECK (
  (is_half_day = true AND check_out_date >= check_in_date) OR
  (is_half_day = false AND check_out_date > check_in_date)
);