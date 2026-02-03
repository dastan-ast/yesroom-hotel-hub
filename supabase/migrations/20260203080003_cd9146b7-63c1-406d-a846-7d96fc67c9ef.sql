-- Таблица глобальных настроек платформы
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Индекс для быстрого поиска
CREATE UNIQUE INDEX idx_platform_settings_key 
  ON public.platform_settings(key);

-- RLS - только superadmin
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin can manage platform settings"
  ON public.platform_settings FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Триггер updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Вставить начальную настройку для внешнего Supabase
INSERT INTO public.platform_settings (key, value)
VALUES ('external_supabase', '{"url": "", "anon_key": "", "sync_enabled": false, "sync_tables": ["hotels", "bookings", "clients", "room_types"]}'::jsonb);