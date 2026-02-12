
-- Create admin_activity_log table
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_admin_activity_log_hotel_created ON public.admin_activity_log(hotel_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Hotel staff can view logs for their hotel
CREATE POLICY "Hotel staff can view activity logs"
ON public.admin_activity_log
FOR SELECT
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- Hotel staff can insert logs for their hotel
CREATE POLICY "Hotel staff can insert activity logs"
ON public.admin_activity_log
FOR INSERT
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- SuperAdmin full access
CREATE POLICY "SuperAdmin can manage all activity logs"
ON public.admin_activity_log
FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
