-- Add status column for hotel approval workflow
ALTER TABLE public.hotels 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'active', 'rejected'));

-- Update existing hotels to 'active' status (grandfathered in)
UPDATE public.hotels SET status = 'active' WHERE status = 'pending';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_hotels_status ON public.hotels(status);

-- Update RLS policy to only show active hotels to public
DROP POLICY IF EXISTS "Public can view active hotels" ON public.hotels;
CREATE POLICY "Public can view active hotels" 
ON public.hotels 
FOR SELECT 
USING (
  status = 'active' AND 
  subscription_status IN ('trial', 'active')
);