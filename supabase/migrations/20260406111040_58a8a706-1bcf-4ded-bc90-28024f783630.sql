
-- 1. Fix rooms public policy: only expose available rooms, hide status/notes
DROP POLICY IF EXISTS "Public can view rooms for active hotels" ON public.rooms;
CREATE POLICY "Public can view rooms for active hotels"
  ON public.rooms FOR SELECT
  TO public
  USING (is_hotel_active_for_public(hotel_id) AND status = 'available');

-- 2. Fix storage policies: scope by hotel_id in path
DROP POLICY IF EXISTS "Hotel staff can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Hotel staff can update images" ON storage.objects;
DROP POLICY IF EXISTS "Hotel staff can delete images" ON storage.objects;

CREATE POLICY "Hotel staff can upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hotel-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
  );

CREATE POLICY "Hotel staff can update images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'hotel-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'hotel-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
  );

CREATE POLICY "Hotel staff can delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'hotel-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
  );

-- 3. Remove external creds from platform_settings if present
-- (We'll handle this in code by removing url/anon_key fields from settings UI)

-- 4. Remove leads from realtime publication to prevent cross-hotel subscription
ALTER PUBLICATION supabase_realtime DROP TABLE public.leads;
