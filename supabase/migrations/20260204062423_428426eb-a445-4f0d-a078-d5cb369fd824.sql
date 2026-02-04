-- Fix hotels_public view to only expose safe settings fields (allowlist approach)
-- This addresses: hotels_settings_exposure, hotels_public_no_rls

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
  -- Only expose specific safe fields from settings (allowlist approach)
  jsonb_build_object(
    'whatsapp_phone', settings->>'whatsapp_phone',
    'kaspi_id', settings->>'kaspi_id'
  ) AS settings,
  status, 
  subscription_status, 
  created_at, 
  updated_at
FROM public.hotels
WHERE status = 'active' 
  AND subscription_status IN ('active', 'trial');

-- Grant SELECT on the view to public (anon and authenticated)
GRANT SELECT ON public.hotels_public TO anon, authenticated;