-- Create a public view for hotels that excludes sensitive fields
CREATE VIEW public.hotels_public
WITH (security_invoker=on) AS
SELECT 
  id, 
  name, 
  slug, 
  location, 
  description, 
  logo_url,
  status,
  subscription_status,
  created_at, 
  updated_at
FROM public.hotels
WHERE status = 'active' AND subscription_status IN ('trial', 'active');

-- Grant SELECT on the view to public/anon
GRANT SELECT ON public.hotels_public TO anon;
GRANT SELECT ON public.hotels_public TO authenticated;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.hotels_public IS 'Public-safe view of hotels excluding owner_id, trial_ends_at, and settings. Use this for public pages.';