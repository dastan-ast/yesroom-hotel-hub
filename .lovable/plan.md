
# План: Улучшение поддержки бронирования нескольких номеров

## Обзор проблемы

Текущая реализация имеет несколько ограничений:
- Дополнительные номера хранятся в JSONB `additional_info`, что усложняет запросы
- Параметр `multiRoom` не передаётся компонентам
- Шахматка и checkout не учитывают дополнительные номера
- Нет удобного интерфейса для выбора номеров при создании бронирования

---

## Решение

### Часть 1: Новая таблица `booking_rooms`

Создаём нормализованную таблицу для связи бронирований с несколькими номерами:

```sql
CREATE TABLE public.booking_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booking_id, room_id)
);

-- RLS политики
ALTER TABLE booking_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel staff can manage booking_rooms"
  ON booking_rooms FOR ALL
  USING (hotel_id = get_user_hotel_id(auth.uid()) 
         AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')));
```

---

### Часть 2: Обновление диалога назначения номеров

**Файл:** `src/components/admin/RoomAssignDialog.tsx`

Изменения:
1. Добавить переключатель "Несколько номеров" в заголовок диалога
2. При сохранении записывать в таблицу `booking_rooms` вместо `additional_info`
3. Показывать тип номера рядом с каждым номером для удобства

---

### Часть 3: Обновление BookingsTab

**Файл:** `src/components/admin/BookingsTab.tsx`

Изменения:
1. Передать `multiRoom={true}` в `RoomAssignDialog`
2. Отображать количество назначенных номеров в карточке бронирования
3. При check-in/check-out обновлять все связанные номера

---

### Часть 4: Обновление LiveFeedSidebar

**Файл:** `src/components/admin/LiveFeedSidebar.tsx`

Изменения:
1. Передать `multiRoom={true}` в `RoomAssignDialog`

---

### Часть 5: Обновление CheckoutInvoiceModal

**Файл:** `src/components/admin/CheckoutInvoiceModal.tsx`

Изменения:
1. Загружать все номера из `booking_rooms`
2. Отображать список всех назначенных номеров
3. При выселении освобождать все связанные номера

---

### Часть 6: Обновление ShahmatkaGrid

**Файл:** `src/components/admin/ShahmatkaGrid.tsx`

Изменения:
1. Загружать данные из `booking_rooms` помимо основного `room_id`
2. Отображать все номера бронирования на сетке

---

### Часть 7: ManualBookingDialog с выбором номеров

**Файл:** `src/components/admin/ManualBookingDialog.tsx`

Изменения:
1. Добавить секцию "Назначить номера сразу" после выбора типа номера
2. Загружать доступные номера по выбранным датам
3. Позволить выбрать несколько номеров через чекбоксы
4. При создании бронирования записывать в `booking_rooms`

---

## Технические детали

### Структура booking_rooms

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Первичный ключ |
| booking_id | UUID | FK на bookings |
| room_id | UUID | FK на rooms |
| hotel_id | UUID | FK на hotels (для RLS) |
| created_at | TIMESTAMPTZ | Дата создания |

### Логика получения всех номеров бронирования

```typescript
// Загрузка всех номеров бронирования
const { data: bookingRooms } = await supabase
  .from('booking_rooms')
  .select('room_id, rooms(room_number, room_types(name))')
  .eq('booking_id', bookingId);

// Объединяем с основным room_id для обратной совместимости
const allRoomIds = booking.room_id 
  ? [booking.room_id, ...(bookingRooms || []).map(br => br.room_id)]
  : (bookingRooms || []).map(br => br.room_id);
```

### Изменения в RoomAssignDialog

```typescript
// При сохранении
const roomEntries = selectedRooms.map(roomId => ({
  booking_id: bookingId,
  room_id: roomId,
  hotel_id: hotelId,
}));

await supabase.from('booking_rooms').insert(roomEntries);

// Первый номер записываем в основное поле для совместимости
await supabase
  .from('bookings')
  .update({ room_id: selectedRooms[0], status: 'approved' })
  .eq('id', bookingId);
```

---

## UI/UX

### Диалог назначения номеров
- Заголовок: "Назначить номера"
- Добавить переключатель (Switch): "Несколько номеров"
- Выбранные номера отображаются в нижней части с кнопкой удаления

### Карточка бронирования
- Показывать бейдж: "2 номера" если назначено несколько

### Итоговый счёт (Checkout)
- Секция "Номера:" с перечислением всех номеров

---

## Обратная совместимость

Существующие бронирования с `room_id` продолжат работать. Новая система будет использовать `booking_rooms` параллельно, и при загрузке данных будет объединять оба источника.
