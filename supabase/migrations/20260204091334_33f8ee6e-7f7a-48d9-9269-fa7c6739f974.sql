-- Fix PUBLIC_DATA_EXPOSURE: Remove public SELECT from rooms and room_types tables
-- These tables contain sensitive business data (pricing strategy, inventory, occupancy)

-- 1. Drop the overly permissive public SELECT policies
DROP POLICY IF EXISTS "Public can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Public can view room types" ON public.room_types;

-- 2. Create a secure public view for room_types that only exposes
--    room types for active hotels with valid subscriptions (for public booking pages)
CREATE OR REPLACE VIEW public.room_types_public
WITH (security_invoker = on) AS
SELECT 
  rt.id,
  rt.hotel_id,
  rt.name,
  rt.description,
  rt.price_per_night,
  rt.capacity,
  rt.amenities,
  rt.image_url,
  rt.images
FROM public.room_types rt
INNER JOIN public.hotels h ON h.id = rt.hotel_id
WHERE h.status = 'active'
  AND h.subscription_status IN ('trial', 'active');

-- 3. Add a comment explaining the view's purpose
COMMENT ON VIEW public.room_types_public IS 
'Secure public view for room types. Only exposes room types from active hotels with valid subscriptions. Used by public booking pages.';

-- 4. Create staff-only SELECT policies for room_types (to replace the public one)
CREATE POLICY "Hotel staff can view room types"
ON public.room_types
FOR SELECT
USING (
  (hotel_id = get_user_hotel_id(auth.uid())) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "SuperAdmin can view all room types"
ON public.room_types
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- 5. Create staff-only SELECT policy for rooms (to replace the public one)
CREATE POLICY "Hotel staff can view rooms"
ON public.rooms
FOR SELECT
USING (
  (hotel_id = get_user_hotel_id(auth.uid())) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "SuperAdmin can view all rooms"
ON public.rooms
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role));