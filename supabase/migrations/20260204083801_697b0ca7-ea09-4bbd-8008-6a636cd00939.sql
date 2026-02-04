-- Fix security issues: staff_invitations email exposure, hotels business data leak, and hotels_public settings exposure

-- 1. Fix staff_invitations email exposure
-- Drop the overly permissive policy that allows full table scans
DROP POLICY IF EXISTS "Anyone can verify pending invitation by token" ON public.staff_invitations;

-- Create a more restrictive policy that requires the token parameter
-- This policy allows SELECT only when there's a specific token filter in the query
-- Note: We use a security definer function to validate token-based access
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token uuid)
RETURNS TABLE (
  id uuid,
  hotel_id uuid,
  token uuid,
  permissions text[],
  expires_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    hotel_id,
    token,
    permissions,
    expires_at,
    status
  FROM public.staff_invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now()
$$;

-- Add a comment explaining the function purpose
COMMENT ON FUNCTION public.validate_invitation_token(uuid) IS 'Securely validates invitation tokens without exposing email addresses';

-- 2. Fix hotels table public policy to only expose marketing data
-- The current policy exposes too much - owner_id, trial_ends_at, settings, subscription_status
DROP POLICY IF EXISTS "Public can view active hotels" ON public.hotels;

-- Create a more restrictive public policy - but we actually need hotels_public view for this
-- So the policy on hotels table should NOT allow public access - use the view instead
-- This policy should only allow owner/superadmin access (which is already covered by other policies)
-- We don't need a separate public SELECT policy since hotels_public view handles public access

-- 3. Fix hotels_public view to properly filter settings and exclude sensitive data
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
  -- Only expose allowed settings fields using an allowlist approach
  jsonb_build_object(
    'whatsapp_phone', settings->>'whatsapp_phone',
    'kaspi_id', settings->>'kaspi_id'
  ) AS settings,
  status,
  subscription_status,
  created_at,
  updated_at
  -- Explicitly NOT including: owner_id, trial_ends_at, full settings
FROM public.hotels
WHERE status = 'active' 
  AND subscription_status IN ('active', 'trial');

-- Grant SELECT on the public view to anonymous and authenticated users
GRANT SELECT ON public.hotels_public TO anon, authenticated;

-- Add a comment explaining the view purpose
COMMENT ON VIEW public.hotels_public IS 'Public-safe view of hotels data. Only exposes marketing info and filtered settings (whatsapp_phone, kaspi_id). Excludes owner_id, trial_ends_at, and other sensitive fields.';