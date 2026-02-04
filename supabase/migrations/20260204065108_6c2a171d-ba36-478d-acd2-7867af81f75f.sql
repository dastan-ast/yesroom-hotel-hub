-- Fix accept_invitation function to add proper authorization checks
CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation RECORD;
BEGIN
  -- SECURITY: Verify caller is the target user (prevent privilege escalation)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be authenticated';
  END IF;
  
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only accept invitation for yourself';
  END IF;

  -- Find the invitation
  SELECT * INTO v_invitation
  FROM staff_invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();
  
  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- SECURITY: Verify email matches invitation (prevent accepting invitations for other users)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id 
    AND LOWER(email) = LOWER(v_invitation.email)
  ) THEN
    RAISE EXCEPTION 'Email mismatch: invitation is for a different email address';
  END IF;
  
  -- Update user role to admin
  UPDATE user_roles SET role = 'admin' WHERE user_id = _user_id;
  
  -- Link user to hotel
  UPDATE profiles SET hotel_id = v_invitation.hotel_id WHERE user_id = _user_id;
  
  -- Create/update permissions
  INSERT INTO staff_permissions (hotel_id, user_id, permissions)
  VALUES (v_invitation.hotel_id, _user_id, v_invitation.permissions)
  ON CONFLICT (hotel_id, user_id) DO UPDATE SET permissions = EXCLUDED.permissions;
  
  -- Mark invitation as accepted
  UPDATE staff_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;
END;
$function$;