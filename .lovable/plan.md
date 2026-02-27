

# CRM-модуль: Лиды, Комментарии, KPI и Аудит

## Обзор

Создание полноценного CRM-модуля для управления лидами (входящими заявками из WhatsApp и других каналов), системы комментариев с единой историей гостя, конвертации лидов в бронирования, а также контроля KPI администраторов и защиты от ручных правок времени.

---

## Этап 1: База данных

### Новые таблицы

**leads**
- `id` (UUID, PK)
- `created_at` (timestamptz, default now())
- `phone` (text, NOT NULL)
- `name` (text, nullable)
- `source` (text, default 'whatsapp')
- `status` (text, default 'new') -- new, in_progress, converted, closed
- `hotel_id` (UUID, NOT NULL)
- `admin_id` (UUID, nullable) -- кто взял в работу
- `claimed_at` (timestamptz, nullable)
- `completed_at` (timestamptz, nullable)
- `booking_id` (UUID, nullable) -- ссылка на созданное бронирование
- `notes` (text, nullable)

**crm_comments**
- `id` (UUID, PK)
- `created_at` (timestamptz, default now())
- `lead_id` (UUID, nullable) -- связь с leads
- `client_id` (UUID, nullable) -- связь с clients для единой истории
- `author_id` (UUID, NOT NULL)
- `author_name` (text, NOT NULL)
- `content` (text, NOT NULL)

**audit_logs** (для контроля ручных правок)
- `id` (UUID, PK)
- `created_at` (timestamptz, default now())
- `hotel_id` (UUID, NOT NULL)
- `user_id` (UUID, NOT NULL)
- `user_name` (text)
- `action` (text) -- например 'manual_time_edit_attempt'
- `entity_type` (text)
- `entity_id` (UUID, nullable)
- `details` (jsonb)

### RLS-политики

- **leads**: Сотрудники отеля (admin/owner) могут SELECT/INSERT/UPDATE/DELETE только свои `hotel_id`. SuperAdmin -- полный доступ.
- **crm_comments**: Сотрудники отеля могут читать/создавать комментарии для лидов своего отеля. SuperAdmin -- полный доступ.
- **audit_logs**: INSERT для admin/owner своего отеля. SELECT только для owner и superadmin.

### Realtime

Включить realtime для таблицы `leads` для обновления списка в реальном времени.

---

## Этап 2: Интерфейс модуля "Лиды"

### Новый файл: `src/components/admin/LeadsTab.tsx`

**Макет**: Двухколоночный layout.

- **Левая колонка** -- список лидов с фильтрами (Новые / В работе / Конвертированные / Закрытые).
  - Каждый лид показывает: имя/телефон (размыт если не взят), источник, время создания, SLA-таймер.
  - SLA-индикатор: если лид в статусе `new` более 15 минут -- красная подсветка и мигающий бейдж.
  - Сортировка: новые сверху, просроченные по SLA -- самые первые.

- **Правая колонка** -- карточка выбранного лида:
  - Контактные данные (телефон размыт до "Взять в работу").
  - Кнопка **"Взять в работу"** -- записывает `claimed_at = now()`, `admin_id = currentUser.id`, меняет статус на `in_progress`.
  - История комментариев (из `crm_comments`) с полем для добавления нового.
  - Кнопка **"Создать бронь"** -- открывает `ManualBookingDialog` с предзаполненным телефоном.
  - Кнопка **"Закрыть лид"** -- статус `closed`, `completed_at = now()`.

### Интеграция в AdminDashboard

- Добавить пункт меню "Лиды" (иконка `MessageCircle`) в `allMenuItems` с permission `bookings`.
- Рендерить `<LeadsTab hotelId={hotelId} />` при `activeTab === 'leads'`.

---

## Этап 3: Конвертация и Единая история

### Конвертация лида в бронь

В `LeadsTab`, при нажатии "Создать бронь":
1. Открывается `ManualBookingDialog` с пропсом `prefillPhone`.
2. В `ManualBookingDialog` -- если `prefillPhone` передан, автоматически подставлять в поле телефона.
3. После успешного создания брони -- callback в `LeadsTab` обновляет лид: `status = 'converted'`, `completed_at = now()`, `booking_id = createdId`.

### Вкладка "История" в BookingDetailModal

В `BookingDetailModal` добавить вкладку "История" (рядом с "Информация" и "Услуги"):
- Загружает комментарии из `crm_comments` по `client_id` бронирования.
- Показывает хронологический список: автор, дата, текст.
- Поле для добавления нового комментария.

---

## Этап 4: Контроль KPI и блокировка ручного ввода

### Автоматическое время заселения/выселения

- В `BookingDetailModal` при check-in и checkout -- время фиксируется автоматически через `new Date().toISOString()` и сохраняется в `additional_info` бронирования (`checked_in_at`, `checked_out_at`).
- Убрать любые поля ручного ввода времени для check-in/checkout (в текущей реализации их нет, но добавить запись времени).

### Аудит ручных правок

- При любом UPDATE бронирования, если изменяются поля `check_in_date` или `check_out_date` для бронирований со статусом `checked_in` или `checked_out` -- создавать запись в `audit_logs` с деталями изменения.

### Раздел "KPI Админов" (только для Owner)

Новый файл: `src/components/admin/AdminKpiTab.tsx`

- Доступен только владельцу (ownerOnly).
- Таблица администраторов с метриками:
  - **Среднее время ответа** = AVG(`claimed_at - created_at`) по лидам, взятым данным админом.
  - **Количество обработанных лидов** за период.
  - **Конверсия** = converted / total claimed.
- Список всех записей из `audit_logs` с фильтрацией по отелю -- ручные правки времени.

### Интеграция в AdminDashboard

- Добавить пункт "KPI Админов" (иконка `BarChart3`) в меню, `ownerOnly: true`.
- Рендерить `<AdminKpiTab hotelId={hotelId} />`.

---

## Технические детали

### Новые файлы
1. `src/components/admin/LeadsTab.tsx` -- основной UI лидов
2. `src/components/admin/AdminKpiTab.tsx` -- KPI-дашборд для владельца

### Изменяемые файлы
1. `src/pages/AdminDashboard.tsx` -- добавить пункты меню и рендеринг новых табов
2. `src/components/admin/ManualBookingDialog.tsx` -- добавить проп `prefillPhone`
3. `src/components/admin/BookingDetailModal.tsx` -- вкладка "История", запись времени check-in/checkout в `additional_info`, аудит правок дат

### Миграция БД
Одна SQL-миграция создающая 3 таблицы (`leads`, `crm_comments`, `audit_logs`) с RLS-политиками и realtime.

