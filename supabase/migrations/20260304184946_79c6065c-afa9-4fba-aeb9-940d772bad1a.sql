
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_check_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;
