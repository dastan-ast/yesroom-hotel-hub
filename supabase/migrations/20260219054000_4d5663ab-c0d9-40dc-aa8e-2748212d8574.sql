-- Allow hotel owners to read roles of users in their hotel
CREATE POLICY "Owners can view hotel staff roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.hotel_id = get_user_hotel_id(auth.uid())
  )
);