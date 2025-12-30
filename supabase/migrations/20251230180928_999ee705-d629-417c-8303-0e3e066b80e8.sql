-- Create a SECURITY DEFINER function to allow users to become owners when creating a hotel
CREATE OR REPLACE FUNCTION public.update_user_role_to_owner(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles
  SET role = 'owner'
  WHERE user_id = _user_id;
END;
$$;