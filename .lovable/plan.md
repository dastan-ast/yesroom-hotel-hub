
# План: Синхронизация с внешним Supabase для SuperAdmin

## Обзор

Создать систему для суперадмина, которая позволит подключить внешний Supabase проект для централизованного управления данными всей платформы.

Внешний проект:
- URL: `https://zzxgrxpikjcrxebxqnfq.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## Что будет создано

### 1. Таблица `platform_settings`

Хранит глобальные настройки платформы, включая подключение к внешнему Supabase:

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| key | TEXT | Уникальный ключ настройки |
| value | JSONB | Значение (URL, ключи, опции) |
| updated_at | TIMESTAMPTZ | Дата обновления |
| updated_by | UUID | Кто обновил |

Пример записи:
```json
{
  "key": "external_supabase",
  "value": {
    "url": "https://zzxgrxpikjcrxebxqnfq.supabase.co",
    "anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "sync_enabled": true,
    "sync_tables": ["hotels", "bookings", "clients", "users"]
  }
}
```

---

### 2. Вкладка "Настройки" в SuperAdmin

Новый компонент `SettingsTab.tsx` с возможностью:

- Ввода URL внешнего Supabase
- Ввода Anon API Key
- Выбора таблиц для синхронизации
- Кнопки тестирования подключения
- Включения/выключения синхронизации

---

### 3. Edge Function `sync-to-external`

Функция для отправки данных во внешний Supabase:

- Принимает тип данных и сами данные
- Читает настройки из `platform_settings`
- Создает клиент внешнего Supabase
- Выполняет upsert по `external_id`
- Логирует результат

---

### 4. Edge Function `test-external-connection`

Функция для проверки подключения:

- Принимает URL и anon key
- Пытается сделать простой запрос
- Возвращает статус подключения

---

## Технические детали

### SQL миграция

```sql
-- Таблица глобальных настроек платформы
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Индекс для быстрого поиска
CREATE UNIQUE INDEX idx_platform_settings_key 
  ON public.platform_settings(key);

-- RLS - только superadmin
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin can manage platform settings"
  ON public.platform_settings FOR ALL
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

-- Триггер updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Вставить начальную настройку
INSERT INTO public.platform_settings (key, value)
VALUES ('external_supabase', '{"url": "", "anon_key": "", "sync_enabled": false, "sync_tables": []}');
```

---

### Edge Function: sync-to-external

Файл: `supabase/functions/sync-to-external/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { table, data } = await req.json();
    
    // Получить настройки
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'external_supabase')
      .single();

    if (!settings?.value?.sync_enabled || !settings?.value?.url) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sync disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Создать клиент внешнего Supabase
    const externalClient = createClient(
      settings.value.url,
      settings.value.anon_key
    );

    // Синхронизировать данные
    const { error } = await externalClient
      .from(table)
      .upsert(data, { onConflict: 'external_id' });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

### Edge Function: test-external-connection

Файл: `supabase/functions/test-external-connection/index.ts`

Проверяет подключение к внешнему Supabase перед сохранением настроек.

---

### UI компонент: SettingsTab.tsx

Файл: `src/components/superadmin/SettingsTab.tsx`

```text
┌──────────────────────────────────────────────────────────────┐
│  Настройки → Внешний Supabase                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Подключение к внешнему Supabase ────────────────────┐   │
│  │                                                       │   │
│  │  Project URL:                                         │   │
│  │  [https://zzxgrxpikjcrxebxqnfq.supabase.co  ]        │   │
│  │                                                       │   │
│  │  Anon API Key:                                        │   │
│  │  [eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   ] 👁     │   │
│  │                                                       │   │
│  │  [Проверить подключение]     ✓ Подключено            │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Синхронизация данных ───────────────────────────────┐   │
│  │                                                       │   │
│  │  [✓] Включить автоматическую синхронизацию          │   │
│  │                                                       │   │
│  │  Таблицы для синхронизации:                          │   │
│  │  [✓] hotels     [✓] bookings                         │   │
│  │  [✓] clients    [✓] room_types                       │   │
│  │  [ ] rooms      [ ] service_catalog                  │   │
│  │                                                       │   │
│  │  [Сохранить настройки]                               │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Интеграция в SuperAdmin.tsx

Добавить вкладку "Настройки" в меню и отображать `SettingsTab` при выборе.

---

## Требования к внешнему Supabase

Во внешнем проекте (`zzxgrxpikjcrxebxqnfq`) должны быть:

1. Таблицы с той же структурой + колонка `external_id` (UNIQUE)
2. RLS политики разрешающие INSERT/UPDATE через anon key
3. Или использовать service_role_key (хранить в Supabase Secrets)

---

## Порядок реализации

| Шаг | Задача | Файлы |
|-----|--------|-------|
| 1 | Создать таблицу platform_settings | SQL миграция |
| 2 | Создать Edge Function test-external-connection | supabase/functions/test-external-connection/index.ts |
| 3 | Создать Edge Function sync-to-external | supabase/functions/sync-to-external/index.ts |
| 4 | Создать UI компонент SettingsTab | src/components/superadmin/SettingsTab.tsx |
| 5 | Добавить вкладку в SuperAdmin.tsx | src/pages/SuperAdmin.tsx |
| 6 | Добавить вызов синхронизации при изменении данных | booking-webhook, ManualBookingDialog и др. |

---

## Безопасность

- Доступ к настройкам только у superadmin (RLS)
- Anon key хранится в БД с защитой RLS
- Для повышенной безопасности можно хранить service_role_key в Supabase Secrets
- Синхронизация выполняется через Edge Function (серверная сторона)
