DROP VIEW IF EXISTS public.hotels_public;

CREATE VIEW public.hotels_public
WITH (security_invoker=false) AS
SELECT 
  id,
  name,
  slug,
  location,
  description,
  logo_url,
  status,
  subscription_status,
  property_type,
  created_at,
  updated_at
FROM hotels
WHERE status = 'active' AND subscription_status IN ('trial', 'active');

GRANT SELECT ON public.hotels_public TO anon, authenticated;