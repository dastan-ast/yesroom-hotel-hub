-- Drop and recreate the view to include settings (needed for booking contact info)
DROP VIEW IF EXISTS public.hotels_public;

CREATE VIEW public.hotels_public
WITH (security_invoker=on) AS
SELECT 
  id, 
  name, 
  slug, 
  location, 
  description, 
  logo_url,
  settings,
  status,
  subscription_status,
  created_at, 
  updated_at
FROM public.hotels
WHERE status = 'active' AND subscription_status IN ('trial', 'active');

-- Grant SELECT on the view to public/anon
GRANT SELECT ON public.hotels_public TO anon;
GRANT SELECT ON public.hotels_public TO authenticated;

COMMENT ON VIEW public.hotels_public IS 'Public-safe view of hotels excluding owner_id and trial_ends_at. Use this for public pages.';