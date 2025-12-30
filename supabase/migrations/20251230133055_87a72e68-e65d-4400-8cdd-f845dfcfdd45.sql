-- Add RLS policy for SuperAdmin to manage all clients
CREATE POLICY "SuperAdmin can manage all clients"
ON public.clients FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Add RLS policy for SuperAdmin to manage all profiles (for assigning hotel_id)
CREATE POLICY "SuperAdmin can manage all profiles"
ON public.profiles FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Add RLS policy for SuperAdmin to manage all user_roles
CREATE POLICY "SuperAdmin can manage all user_roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role));