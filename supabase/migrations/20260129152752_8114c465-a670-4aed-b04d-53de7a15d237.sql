-- Fix profiles table RLS policies - require explicit authentication
-- Drop existing permissive policies and replace with stricter ones

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "SuperAdmin can manage all profiles" ON public.profiles;

-- Recreate with explicit authentication requirement
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Hotel admins can view hotel staff profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL 
    AND has_role(auth.uid(), 'admin'::app_role) 
    AND hotel_id = get_user_hotel_id(auth.uid())
  );

CREATE POLICY "Hotel owners can view hotel staff profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL 
    AND has_role(auth.uid(), 'owner'::app_role) 
    AND hotel_id = get_user_hotel_id(auth.uid())
  );

CREATE POLICY "SuperAdmin can manage all profiles" 
  ON public.profiles 
  FOR ALL 
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'superadmin'::app_role));

-- Fix clients table RLS policies - add explicit authentication and hotel validation
DROP POLICY IF EXISTS "Hotel staff can manage clients" ON public.clients;
DROP POLICY IF EXISTS "SuperAdmin can manage all clients" ON public.clients;

-- Recreate with explicit authentication requirement
CREATE POLICY "Hotel staff can manage clients" 
  ON public.clients 
  FOR ALL 
  USING (
    auth.uid() IS NOT NULL 
    AND hotel_id IS NOT NULL
    AND hotel_id = get_user_hotel_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND hotel_id IS NOT NULL
    AND hotel_id = get_user_hotel_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

CREATE POLICY "SuperAdmin can manage all clients" 
  ON public.clients 
  FOR ALL 
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'superadmin'::app_role));