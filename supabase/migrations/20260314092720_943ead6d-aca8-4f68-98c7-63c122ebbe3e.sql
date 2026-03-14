
-- Uptime check history
CREATE TABLE public.uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  response_time_ms integer,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uptime_checks_created ON uptime_checks (created_at DESC);
CREATE INDEX idx_uptime_checks_service ON uptime_checks (service_name, created_at DESC);

-- Alert configuration
CREATE TABLE public.alert_config (
  id integer PRIMARY KEY CHECK (id = 1),
  telegram_chat_id text,
  is_enabled boolean NOT NULL DEFAULT false,
  alert_on_error boolean NOT NULL DEFAULT true,
  alert_on_warning boolean NOT NULL DEFAULT false,
  alert_on_recovery boolean NOT NULL DEFAULT true,
  last_alert_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO alert_config (id, is_enabled) VALUES (1, false);

-- Alert history
CREATE TABLE public.alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  alert_type text NOT NULL,
  message text NOT NULL,
  sent_via text NOT NULL DEFAULT 'telegram',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_history_created ON alert_history (created_at DESC);

-- RLS
ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

-- Only superadmins can access
CREATE POLICY "Superadmins can read uptime_checks"
  ON public.uptime_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmins can manage alert_config"
  ON public.alert_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmins can read alert_history"
  ON public.alert_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Service role needs full access for edge functions
CREATE POLICY "Service role full access uptime_checks"
  ON public.uptime_checks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access alert_config"
  ON public.alert_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access alert_history"
  ON public.alert_history FOR ALL TO service_role USING (true) WITH CHECK (true);
