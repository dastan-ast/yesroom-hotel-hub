-- Create a secure RPC function for superadmin role assignment
-- This replaces direct table updates with server-side validation

CREATE OR REPLACE FUNCTION public.assign_user_role(
  _target_user_id uuid,
  _new_role app_role,
  _hotel_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superadmins can assign roles
  IF NOT has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: only superadmins can assign roles';
  END IF;
  
  -- Cannot modify superadmin roles
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = _target_user_id AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Cannot modify superadmin roles';
  END IF;
  
  -- Cannot assign superadmin role through this function
  IF _new_role = 'superadmin' THEN
    RAISE EXCEPTION 'Cannot assign superadmin role through this function';
  END IF;
  
  -- If assigning owner or admin role, hotel_id is required
  IF _new_role IN ('owner', 'admin') AND _hotel_id IS NULL THEN
    RAISE EXCEPTION 'Hotel ID is required for owner/admin roles';
  END IF;
  
  -- Verify hotel exists if hotel_id is provided
  IF _hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels WHERE id = _hotel_id) THEN
    RAISE EXCEPTION 'Hotel does not exist';
  END IF;
  
  -- Update user role
  UPDATE user_roles SET role = _new_role WHERE user_id = _target_user_id;
  
  -- Update profile hotel_id
  UPDATE profiles SET hotel_id = _hotel_id WHERE user_id = _target_user_id;
  
  -- If assigning owner role, update hotel owner_id
  IF _new_role = 'owner' THEN
    UPDATE hotels SET owner_id = _target_user_id WHERE id = _hotel_id;
  END IF;
END;
$$;