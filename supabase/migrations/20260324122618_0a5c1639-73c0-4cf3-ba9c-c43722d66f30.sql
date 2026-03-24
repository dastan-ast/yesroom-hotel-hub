-- Recreate hotels_public view as security definer (security_invoker=false)
-- so anonymous users can browse active hotels without hitting RLS on the base table
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
  settings,
  property_type,
  created_at,
  updated_at
FROM hotels
WHERE status = 'active' AND subscription_status IN ('trial', 'active');

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.hotels_public TO anon, authenticated;