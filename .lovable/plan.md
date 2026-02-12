
# 1. Логирование действий администраторов + 2. Динамический поиск клиентов при бронировании

## Задача 1: Лог действий администраторов

### Новая таблица `admin_activity_log`

Создаём таблицу для записи всех ключевых действий:

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid | PK |
| hotel_id | uuid | Отель |
| user_id | uuid | Кто выполнил |
| user_name | text | Имя (снапшот) |
| action | text | Тип действия (booking_created, booking_checked_in, service_added, и т.д.) |
| entity_type | text | Тип сущности (booking, service, client) |
| entity_id | uuid | ID сущности |
| details | jsonb | Подробности (имя гостя, сумма, номер комнаты и т.д.) |
| created_at | timestamptz | Время |

RLS: доступ только для staff того же отеля + superadmin.

### Какие действия логируются

- **Бронирования**: создание, подтверждение, заселение, выселение, отмена, удаление
- **Услуги**: добавление, удаление (из BookingServicesTab и ServiceLogTab)
- **Клиенты**: создание, редактирование

### Реализация

Создаётся хелпер-функция `logAdminAction()` которая вызывается из существующих обработчиков в:
- `BookingsTab.tsx` -- все смены статуса + удаление
- `ManualBookingDialog.tsx` -- создание бронирования
- `BookingServicesTab.tsx` -- добавление/удаление услуг
- `ServiceLogTab.tsx` -- добавление/удаление услуг
- `ClientsTab.tsx` -- создание/редактирование клиента

### Просмотр логов

Новая вкладка "Журнал действий" в AdminDashboard -- таблица с фильтрами по типу действия и дате.

---

## Задача 2: Динамический поиск клиентов при бронировании

### Что меняется в ManualBookingDialog

При вводе имени гостя (`guest_name`):
- После 2+ символов запускается debounced-поиск по таблице `clients` (по full_name и phone)
- Под полем ввода появляется выпадающий список совпадений (имя, телефон, кол-во визитов)
- При клике на клиента -- автозаполнение полей: имя, телефон

### Техническая реализация

1. Добавляем состояние `clientSuggestions` и `showSuggestions`
2. При изменении `guest_name` -- debounce 300мс -- запрос `clients` с `ilike` по `full_name` и `phone`
3. Результаты отображаются в абсолютно позиционированном списке под полем ввода
4. При выборе клиента: `form.setValue('guest_name', client.full_name)` и `phoneMask.setValue(client.phone)`
5. Клик вне списка -- закрытие

---

## Файлы

| Файл | Действие |
|------|----------|
| Миграция SQL | Создание таблицы `admin_activity_log` + RLS |
| `src/lib/activityLog.ts` | Новый -- хелпер `logAdminAction()` |
| `src/components/admin/ActivityLogTab.tsx` | Новый -- вкладка просмотра логов |
| `src/components/admin/ManualBookingDialog.tsx` | Добавить поиск клиентов с автозаполнением |
| `src/components/admin/BookingsTab.tsx` | Добавить вызовы логирования |
| `src/components/admin/BookingServicesTab.tsx` | Добавить вызовы логирования |
| `src/components/admin/ServiceLogTab.tsx` | Добавить вызовы логирования |
| `src/components/admin/ClientsTab.tsx` | Добавить вызовы логирования |
| `src/pages/AdminDashboard.tsx` | Добавить вкладку "Журнал действий" |
