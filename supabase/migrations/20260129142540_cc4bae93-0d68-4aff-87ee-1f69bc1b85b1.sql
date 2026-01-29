-- ==========================================
-- Table: staff_invitations
-- ==========================================
CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  permissions text[] NOT NULL DEFAULT '{}',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Unique constraint: no duplicate pending invites for same email in same hotel
CREATE UNIQUE INDEX idx_staff_invitations_unique_pending 
ON public.staff_invitations (hotel_id, email) 
WHERE status = 'pending';

-- Index for token lookups
CREATE INDEX idx_staff_invitations_token ON public.staff_invitations (token);

-- Enable RLS
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can manage invitations for their hotel
CREATE POLICY "Owners can manage invitations"
ON public.staff_invitations FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  has_role(auth.uid(), 'owner'::app_role)
);

-- Policy: SuperAdmin can manage all invitations
CREATE POLICY "SuperAdmin can manage all invitations"
ON public.staff_invitations FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Policy: Anyone can view valid pending invitations (for token verification)
CREATE POLICY "Anyone can verify pending invitation by token"
ON public.staff_invitations FOR SELECT
USING (
  status = 'pending' AND
  expires_at > now()
);

-- ==========================================
-- Function: accept_invitation
-- ==========================================
CREATE OR REPLACE FUNCTION public.accept_invitation(
  _token uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM staff_invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();
  
  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
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
$$;