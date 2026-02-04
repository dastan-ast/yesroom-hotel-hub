-- Пересоздать view hotels_public БЕЗ security_invoker (по умолчанию будет security_definer)
-- Это позволит view обходить RLS базовой таблицы hotels

DROP VIEW IF EXISTS public.hotels_public;

CREATE VIEW public.hotels_public AS
SELECT 
  id,
  name,
  slug,
  location,
  description,
  logo_url,
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

-- Разрешить SELECT для всех (anon, authenticated)
GRANT SELECT ON public.hotels_public TO anon, authenticated;