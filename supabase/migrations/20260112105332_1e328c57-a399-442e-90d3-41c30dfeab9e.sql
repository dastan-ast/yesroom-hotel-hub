-- Create subscription_history table to track changes
CREATE TABLE public.subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  previous_trial_ends_at timestamptz,
  new_trial_ends_at timestamptz,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- SuperAdmin can manage all subscription history
CREATE POLICY "SuperAdmin can manage subscription history"
ON public.subscription_history
FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Hotel owners can view their own subscription history
CREATE POLICY "Hotel owners can view own subscription history"
ON public.subscription_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE hotels.id = subscription_history.hotel_id 
    AND hotels.owner_id = auth.uid()
  )
);