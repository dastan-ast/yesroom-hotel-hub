
# План: Финансовая логика и управление услугами

## Обзор текущего состояния

### Существующие компоненты:
- **service_charges** — таблица для записи дополнительных услуг (description, amount, booking_id)
- **ServiceLogTab** — журнал услуг с быстрыми кнопками (Завтрак, Мини-бар, Уборка)
- **BookingsTab** — управление бронированиями с действиями Check-in/Check-out
- **ShahmatkaGrid** — 7-дневная сетка номеров (фильтрует только активные статусы)
- **room_types.price_per_night** — базовая цена за ночь

### Что требуется:
1. Справочник услуг с настраиваемыми ценами
2. Добавление услуг прямо в карточке бронирования
3. Итоговый счёт при выселении
4. История бронирований в Шахматке

---

## Изменения базы данных

### 1. Новая таблица: service_catalog

```sql
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Только персонал отеля
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel staff can manage service_catalog"
ON public.service_catalog FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
);
```

### 2. Новая таблица: booking_services

```sql
CREATE TABLE public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id uuid REFERENCES service_catalog(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  total_price numeric GENERATED ALWAYS AS (unit_price * quantity) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- RLS: Только персонал отеля
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel staff can manage booking_services"
ON public.booking_services FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
);
```

### 3. Расширение таблицы bookings

```sql
-- Добавить колонки для финального расчёта
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS prepayment_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_rate numeric,
ADD COLUMN IF NOT EXISTS final_total numeric;
```

---

## Новые компоненты UI

### 1. ServiceCatalogTab.tsx
**Расположение:** `src/components/admin/ServiceCatalogTab.tsx`

**Функционал:**
- Таблица услуг: название, цена по умолчанию, статус
- Кнопка "Добавить услугу"
- Диалог создания/редактирования услуги
- Удаление услуги (soft delete через is_active)

**UI:**
```text
+------------------------------------------+
| Справочник услуг          [+ Добавить]   |
+------------------------------------------+
| Название        | Цена      | Действия   |
| Завтрак         | 2 000 ₸   | ✏️ 🗑️      |
| Мини-бар        | 3 000 ₸   | ✏️ 🗑️      |
| Уборка номера   | 1 500 ₸   | ✏️ 🗑️      |
+------------------------------------------+
```

### 2. BookingServicesTab.tsx
**Расположение:** `src/components/admin/BookingServicesTab.tsx`

**Функционал:**
- Выбор услуги из каталога
- Автозаполнение цены (с возможностью изменить)
- Указание количества
- Живой подсчёт итога
- Список добавленных услуг

**UI:**
```text
+------------------------------------------+
| Услуги                                   |
+------------------------------------------+
| [Выберите услугу ▼] | Цена: [2000] | x[1]|
|                      [+ Добавить]        |
+------------------------------------------+
| • Завтрак x2           4 000 ₸      [🗑️] |
| • Мини-бар x1          3 000 ₸      [🗑️] |
+------------------------------------------+
| ИТОГО услуг:           7 000 ₸           |
+------------------------------------------+
```

### 3. CheckoutInvoiceModal.tsx
**Расположение:** `src/components/admin/CheckoutInvoiceModal.tsx`

**Триггер:** Клик на кнопку "Выселить" в BookingsTab

**Содержимое:**
```text
+------------------------------------------+
| ИТОГОВЫЙ СЧЁТ                      [X]   |
+------------------------------------------+
| Гость: Иванов Иван Иванович              |
| Номер: 101 (Стандарт)                    |
| Период: 15.01 — 18.01.2026 (3 ночи)      |
+------------------------------------------+
| ПРОЖИВАНИЕ                               |
| 3 ночи × 15 000 ₸           = 45 000 ₸   |
+------------------------------------------+
| УСЛУГИ                                   |
| Завтрак × 2                 =  4 000 ₸   |
| Мини-бар × 1                =  3 000 ₸   |
| Итого услуг:                   7 000 ₸   |
+------------------------------------------+
| ОБЩИЙ ИТОГ:                   52 000 ₸   |
| Предоплата:                  -20 000 ₸   |
| ═══════════════════════════════════════  |
| БАЛАНС К ОПЛАТЕ:              32 000 ₸   |
+------------------------------------------+
|              [Подтвердить и закрыть]     |
+------------------------------------------+
```

**Логика:**
1. Рассчитать количество ночей: `differenceInDays(check_out, check_in)`
2. Получить daily_rate из room_types или bookings.daily_rate
3. Сумма проживания = ночи × тариф
4. Сумма услуг = SUM(booking_services.total_price)
5. Общий итог = проживание + услуги
6. Баланс = итог - предоплата

**Действие "Подтвердить":**
- Обновить booking.status = 'checked_out'
- Сохранить booking.final_total
- Освободить room.status = 'available'

### 4. BookingDetailModal.tsx
**Расположение:** `src/components/admin/BookingDetailModal.tsx`

**Назначение:** Детальный просмотр бронирования с вкладками

**Вкладки:**
- **Информация** — данные гостя, даты, номер
- **Услуги** — BookingServicesTab (добавление услуг)
- **Счёт** — предпросмотр итогового счёта

---

## Изменения существующих компонентов

### 1. AdminDashboard.tsx
- Добавить пункт меню "Справочник услуг" с иконкой `BookOpen`
- Рендерить `ServiceCatalogTab` для этой вкладки

### 2. BookingsTab.tsx
- Изменить кнопку "Выселить": вместо прямого действия открывать `CheckoutInvoiceModal`
- Добавить кнопку "Подробнее" для открытия `BookingDetailModal`

### 3. ShahmatkaGrid.tsx
- Убрать фильтр `.in('status', ['pending', 'approved', 'checked_in'])`
- Включить все статусы для отображения истории
- Добавить стили для завершённых бронирований:
  - `checked_out`: `opacity-50` + серый фон
  - `cancelled`: `opacity-40` + красная штриховка

### 4. ServiceLogTab.tsx
- Интегрировать с service_catalog для выбора услуг
- Заменить hardcoded quickItems на данные из каталога

---

## Миграция данных

### Перенос из service_charges в booking_services
```sql
-- Миграция существующих записей (опционально)
INSERT INTO booking_services (hotel_id, booking_id, service_name, unit_price, quantity)
SELECT hotel_id, booking_id, description, amount, 1
FROM service_charges;
```

---

## Порядок реализации

| Этап | Задача | Файлы |
|------|--------|-------|
| 1 | Миграция БД: service_catalog, booking_services | SQL миграция |
| 2 | ServiceCatalogTab | Новый компонент |
| 3 | Интеграция в AdminDashboard | AdminDashboard.tsx |
| 4 | BookingServicesTab | Новый компонент |
| 5 | CheckoutInvoiceModal | Новый компонент |
| 6 | BookingDetailModal с вкладками | Новый компонент |
| 7 | Обновить BookingsTab | Существующий компонент |
| 8 | Обновить ShahmatkaGrid (история) | Существующий компонент |
| 9 | Обновить ServiceLogTab | Существующий компонент |

---

## Технические детали

### Расчёт количества ночей
```typescript
import { differenceInDays, parseISO } from 'date-fns';

const nights = differenceInDays(
  parseISO(booking.check_out_date), 
  parseISO(booking.check_in_date)
);
```

### Типы данных
```typescript
interface ServiceCatalogItem {
  id: string;
  hotel_id: string;
  name: string;
  default_price: number;
  is_active: boolean;
}

interface BookingService {
  id: string;
  booking_id: string;
  service_id: string | null;
  service_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  created_at: string;
}

interface CheckoutData {
  nights: number;
  dailyRate: number;
  stayTotal: number;
  servicesTotal: number;
  grandTotal: number;
  prepayment: number;
  balanceDue: number;
}
```

### RLS для новых таблиц
- Все новые таблицы защищены RLS
- Доступ только для owner/admin текущего hotel_id
- Используются существующие функции `get_user_hotel_id` и `has_role`

---

## Результат

После реализации:
1. Администраторы смогут настраивать каталог услуг отеля
2. При заселённом госте можно добавлять услуги прямо в бронирование
3. При выселении автоматически формируется итоговый счёт
4. Шахматка показывает полную историю бронирований
5. Все расчёты используют NUMERIC для точности
6. Интерфейс полностью на русском языке
