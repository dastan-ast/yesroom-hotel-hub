
-- Table: leads
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  phone TEXT NOT NULL,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'new',
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  admin_id UUID,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  booking_id UUID,
  notes TEXT
);

-- Table: crm_comments
CREATE TABLE public.crm_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL
);

-- Table: audit_logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS for leads
CREATE POLICY "Hotel staff can manage leads"
  ON public.leads FOR ALL TO authenticated
  USING (
    hotel_id = get_user_hotel_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  )
  WITH CHECK (
    hotel_id = get_user_hotel_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

CREATE POLICY "SuperAdmin can manage all leads"
  ON public.leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- RLS for crm_comments: staff can read/write comments for leads of their hotel
CREATE POLICY "Hotel staff can manage crm_comments"
  ON public.crm_comments FOR ALL TO authenticated
  USING (
    (lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leads WHERE leads.id = crm_comments.lead_id
        AND leads.hotel_id = get_user_hotel_id(auth.uid())
    ))
    OR
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients WHERE clients.id = crm_comments.client_id
        AND clients.hotel_id = get_user_hotel_id(auth.uid())
    ))
  )
  WITH CHECK (
    (lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leads WHERE leads.id = crm_comments.lead_id
        AND leads.hotel_id = get_user_hotel_id(auth.uid())
    ))
    OR
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients WHERE clients.id = crm_comments.client_id
        AND clients.hotel_id = get_user_hotel_id(auth.uid())
    ))
  );

CREATE POLICY "SuperAdmin can manage all crm_comments"
  ON public.crm_comments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- RLS for audit_logs
CREATE POLICY "Hotel staff can insert audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id = get_user_hotel_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

CREATE POLICY "Owner can view audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    hotel_id = get_user_hotel_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  );

CREATE POLICY "SuperAdmin can manage all audit_logs"
  ON public.audit_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Enable realtime for leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
