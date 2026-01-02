-- Fix 1: Secure the update_user_role_to_owner RPC function
-- Add authorization checks to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.update_user_role_to_owner(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to update their own role
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only update own role';
  END IF;
  
  -- Verify user actually owns a hotel before granting owner role
  IF NOT EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: must own a hotel to become owner';
  END IF;
  
  UPDATE public.user_roles SET role = 'owner'
  WHERE user_id = _user_id;
END;
$$;

-- Fix 2: Remove the broken RLS policy that exposes all booking data
DROP POLICY IF EXISTS "Public can view own bookings" ON public.bookings;