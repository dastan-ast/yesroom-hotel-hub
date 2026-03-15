
-- 1. FIX: user_roles_admin_escalation
-- Remove dangerous "Admins can manage roles" policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Replace with scoped policy: admins can only VIEW roles of users in their hotel
CREATE POLICY "Admins can view hotel staff roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_id IN (
    SELECT p.user_id FROM profiles p
    WHERE p.hotel_id = get_user_hotel_id(auth.uid())
  )
);

-- 2. FIX: profiles_hotel_id_unrestricted_update
-- Drop existing permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate: users can update own profile BUT cannot change hotel_id
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  AND (
    -- hotel_id must remain unchanged (prevent self-assignment)
    hotel_id IS NOT DISTINCT FROM (SELECT p.hotel_id FROM profiles p WHERE p.user_id = auth.uid())
    -- OR user is superadmin
    OR has_role(auth.uid(), 'superadmin'::app_role)
  )
);

-- Also lock down INSERT to prevent setting arbitrary hotel_id
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  AND hotel_id IS NULL
);

-- 3. FIX: crm_comments_missing_role_check
DROP POLICY IF EXISTS "Hotel staff can manage crm_comments" ON public.crm_comments;

CREATE POLICY "Hotel staff can manage crm_comments"
ON public.crm_comments FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  AND (
    (lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM leads WHERE leads.id = crm_comments.lead_id
      AND leads.hotel_id = get_user_hotel_id(auth.uid())
    ))
    OR
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM clients WHERE clients.id = crm_comments.client_id
      AND clients.hotel_id = get_user_hotel_id(auth.uid())
    ))
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  AND (
    (lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM leads WHERE leads.id = crm_comments.lead_id
      AND leads.hotel_id = get_user_hotel_id(auth.uid())
    ))
    OR
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM clients WHERE clients.id = crm_comments.client_id
      AND clients.hotel_id = get_user_hotel_id(auth.uid())
    ))
  )
);

-- 4. FIX: bookings_public_insert_arbitrary_fields
DROP POLICY IF EXISTS "Public can create bookings for active hotels" ON public.bookings;

CREATE POLICY "Public can create bookings for active hotels"
ON public.bookings FOR INSERT
TO public
WITH CHECK (
  hotel_id IS NOT NULL
  AND is_hotel_active_for_public(hotel_id)
  AND status = 'pending'::booking_status
  AND prepayment_received = false
  AND (prepayment_amount IS NULL OR prepayment_amount = 0)
  AND daily_rate IS NULL
  AND final_total IS NULL
  AND approved_at IS NULL
  AND actual_check_out_at IS NULL
  AND created_by IS NULL
);
