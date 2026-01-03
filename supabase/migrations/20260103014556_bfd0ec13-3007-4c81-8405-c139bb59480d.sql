-- Add additional_info JSONB column to bookings table for children, city, street
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS additional_info jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining structure
COMMENT ON COLUMN public.bookings.additional_info IS 'Stores children_count, children_ages array, city, street';

-- Add index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_bookings_additional_info ON public.bookings USING gin (additional_info);