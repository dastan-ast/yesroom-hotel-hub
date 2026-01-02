-- Fix clients table RLS policies
-- Drop existing RESTRICTIVE policies and replace with PERMISSIVE ones
-- This ensures ONLY authenticated hotel staff and superadmins can access client data

-- Drop existing policies
DROP POLICY IF EXISTS "Hotel staff can manage clients" ON public.clients;
DROP POLICY IF EXISTS "SuperAdmin can manage all clients" ON public.clients;

-- Create PERMISSIVE policies for proper access control
-- Hotel staff can manage clients for their hotel
CREATE POLICY "Hotel staff can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
)
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- SuperAdmin can manage all clients
CREATE POLICY "SuperAdmin can manage all clients"
ON public.clients
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));