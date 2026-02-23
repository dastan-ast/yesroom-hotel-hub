
-- Add group_id column to bookings for manual grouping
ALTER TABLE public.bookings ADD COLUMN group_id uuid DEFAULT NULL;

-- Index for fast group lookups
CREATE INDEX idx_bookings_group_id ON public.bookings (group_id) WHERE group_id IS NOT NULL;
