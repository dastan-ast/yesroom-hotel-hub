-- Create staff_permissions table
CREATE TABLE public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can manage staff permissions for their hotel
CREATE POLICY "Owners can manage staff permissions"
ON public.staff_permissions FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  has_role(auth.uid(), 'owner'::app_role)
);

-- Policy: Staff can read their own permissions
CREATE POLICY "Staff can read own permissions"
ON public.staff_permissions FOR SELECT
USING (user_id = auth.uid());

-- Policy: SuperAdmin full access
CREATE POLICY "SuperAdmin can manage all staff_permissions"
ON public.staff_permissions FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_staff_permissions_updated_at
BEFORE UPDATE ON public.staff_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC function to check permission
CREATE OR REPLACE FUNCTION public.check_permission(
  _user_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- SuperAdmin и Owner имеют все права
    WHEN has_role(_user_id, 'superadmin'::app_role) THEN true
    WHEN has_role(_user_id, 'owner'::app_role) THEN true
    -- Администратор проверяется по таблице permissions
    WHEN has_role(_user_id, 'admin'::app_role) THEN EXISTS (
      SELECT 1 FROM staff_permissions
      WHERE user_id = _user_id
        AND _permission = ANY(permissions)
    )
    ELSE false
  END
$$;

-- Update assign_user_role to auto-create default permissions for admins
CREATE OR REPLACE FUNCTION public.assign_user_role(_target_user_id uuid, _new_role app_role, _hotel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- If assigning admin role, create default permissions
  IF _new_role = 'admin' THEN
    INSERT INTO staff_permissions (hotel_id, user_id, permissions)
    VALUES (_hotel_id, _target_user_id, 
      ARRAY['dashboard', 'bookings', 'shahmatka', 'rooms', 'clients', 'services']
    )
    ON CONFLICT (hotel_id, user_id) DO NOTHING;
  END IF;
END;
$function$;