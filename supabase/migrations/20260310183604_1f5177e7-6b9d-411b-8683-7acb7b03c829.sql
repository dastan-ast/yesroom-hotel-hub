DROP VIEW IF EXISTS public.hotels_public;

CREATE VIEW public.hotels_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  slug,
  location,
  description,
  logo_url,
  status,
  subscription_status,
  settings,
  property_type,
  created_at,
  updated_at
FROM public.hotels
WHERE status = 'active'
  AND subscription_status IN ('trial', 'active');