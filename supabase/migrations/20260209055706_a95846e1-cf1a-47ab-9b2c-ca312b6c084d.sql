
-- Public read access for pricing_plans in platform_settings
CREATE POLICY "Public can read pricing_plans"
ON public.platform_settings
FOR SELECT
USING (key = 'pricing_plans');

-- Insert default pricing plans
INSERT INTO public.platform_settings (key, value)
VALUES ('pricing_plans', '[
  {"name": "Базовый", "price": 15000, "period": "месяц", "features": ["До 10 номеров", "Бронирования", "Шахматка", "1 сотрудник"], "highlighted": false},
  {"name": "Стандарт", "price": 30000, "period": "месяц", "features": ["До 30 номеров", "Бронирования", "Шахматка", "Аналитика", "5 сотрудников", "Интеграции"], "highlighted": true},
  {"name": "Премиум", "price": 50000, "period": "месяц", "features": ["Безлимит номеров", "Все функции", "Безлимит сотрудников", "Приоритетная поддержка", "API доступ"], "highlighted": false}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
