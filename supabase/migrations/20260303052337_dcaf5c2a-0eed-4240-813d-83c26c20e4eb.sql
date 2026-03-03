
-- ============================================================
-- FIX: Convert public-facing RLS policies from RESTRICTIVE to PERMISSIVE
-- Without at least one PERMISSIVE policy, PostgreSQL denies ALL access.
-- RESTRICTIVE policies can only narrow access granted by PERMISSIVE ones.
-- ============================================================

-- 1. BOOKINGS: Fix public INSERT policy
DROP POLICY IF EXISTS "Public can create bookings for active hotels" ON public.bookings;
CREATE POLICY "Public can create bookings for active hotels"
ON public.bookings
FOR INSERT
TO public
WITH CHECK (
  hotel_id IS NOT NULL
  AND is_hotel_active_for_public(hotel_id)
);

-- 2. BOOKINGS: Fix staff policies to be PERMISSIVE
DROP POLICY IF EXISTS "Hotel staff can manage bookings" ON public.bookings;
CREATE POLICY "Hotel staff can manage bookings"
ON public.bookings
FOR ALL
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

DROP POLICY IF EXISTS "Only hotel staff can view bookings" ON public.bookings;
CREATE POLICY "Only hotel staff can view bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- 3. ROOM_TYPES: Fix public SELECT policy
DROP POLICY IF EXISTS "Public can view room types for active hotels" ON public.room_types;
CREATE POLICY "Public can view room types for active hotels"
ON public.room_types
FOR SELECT
TO public
USING (is_hotel_active_for_public(hotel_id));

DROP POLICY IF EXISTS "Hotel staff can manage room types" ON public.room_types;
CREATE POLICY "Hotel staff can manage room types"
ON public.room_types
FOR ALL
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

DROP POLICY IF EXISTS "Hotel staff can view room types" ON public.room_types;
CREATE POLICY "Hotel staff can view room types"
ON public.room_types
FOR SELECT
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

DROP POLICY IF EXISTS "SuperAdmin can view all room types" ON public.room_types;
CREATE POLICY "SuperAdmin can view all room types"
ON public.room_types
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- 4. ROOMS: Fix public SELECT policy
DROP POLICY IF EXISTS "Public can view rooms for active hotels" ON public.rooms;
CREATE POLICY "Public can view rooms for active hotels"
ON public.rooms
FOR SELECT
TO public
USING (is_hotel_active_for_public(hotel_id));

DROP POLICY IF EXISTS "Hotel staff can manage rooms" ON public.rooms;
CREATE POLICY "Hotel staff can manage rooms"
ON public.rooms
FOR ALL
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

DROP POLICY IF EXISTS "Hotel staff can view rooms" ON public.rooms;
CREATE POLICY "Hotel staff can view rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

DROP POLICY IF EXISTS "SuperAdmin can view all rooms" ON public.rooms;
CREATE POLICY "SuperAdmin can view all rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- 5. CLIENTS: Fix policies to be PERMISSIVE (needed for handle_booking_client trigger)
DROP POLICY IF EXISTS "Hotel staff can manage clients" ON public.clients;
CREATE POLICY "Hotel staff can manage clients"
ON public.clients
FOR ALL
TO authenticated
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

DROP POLICY IF EXISTS "SuperAdmin can manage all clients" ON public.clients;
CREATE POLICY "SuperAdmin can manage all clients"
ON public.clients
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'superadmin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'superadmin'::app_role)
);

-- 6. Also create missing triggers for booking client auto-linking
CREATE TRIGGER handle_booking_client_trigger
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_client();

CREATE TRIGGER validate_web_booking_date_trigger
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_web_booking_date();
