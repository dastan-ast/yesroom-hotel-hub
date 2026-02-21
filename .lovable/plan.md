
# План: 3 задачи — Выселение с корректировкой, Цена полсуток, Шахматка 7 дней

## Задача 1: Корректировка суммы при выселении (уже работает — улучшения)

Текущее состояние: функционал уже реализован. В `BookingDetailModal` администратор может изменить сумму при выселении, указать причину, запись сохраняется в `checkout_adjustments`, владелец видит виджет `CheckoutAdjustmentsWidget` на дашборде.

Что нужно доработать:
- Убедиться что `CheckoutAdjustmentsWidget` отображается на дашборде владельца (уже импортирован в `AdminDashboard.tsx`)
- Добавить уведомление-бейдж на вкладку "Дашборд" в сайдбаре если есть pending adjustments — владелец сразу видит что что-то ожидает

### Изменения:
**`src/pages/AdminDashboard.tsx`**:
- Добавить запрос pending adjustments count при загрузке (только для owner)
- Показывать бейдж-счётчик рядом с "Дашборд" в сайдбаре если есть ожидающие корректировки

---

## Задача 2: Цена на полсуточное проживание

Текущее состояние: в `room_types` есть только `price_per_night`. Нет отдельной цены для полсуток.

### 2.1 Миграция БД
Добавить колонку `price_half_day` в таблицу `room_types`:

```sql
ALTER TABLE public.room_types 
ADD COLUMN price_half_day numeric DEFAULT NULL;
```

### 2.2 Форма типа номера (`RoomTypeDialog.tsx`)
- Добавить новое поле "Цена за полсутки (тенге)" в форму
- Поле необязательное (nullable) — если не заполнено, используется 50% от цены за ночь

### 2.3 Таблица типов номеров (`RoomTypesTab.tsx`)
- Добавить столбец "Цена/полсутки" в таблицу

### 2.4 Логика расчёта (`BookingDetailModal.tsx`)
- В `getBookingCalc`: если `booking.is_half_day` — использовать `room_types.price_half_day` (или 50% от `price_per_night` как fallback) вместо `dailyRate * nights`

### 2.5 Логирование изменений
- В `RoomTypesTab.handleSave` — добавить `logAdminAction` при создании/редактировании типа номера, включая цену полсуток в details. Владелец увидит это в журнале действий.

---

## Задача 3: Шахматка — 7 дней и оптимизация

### 3.1 Сетка 7 дней вместо 10 (`ShahmatkaGrid.tsx`)
- `Array.from({ length: 7 })` вместо 10
- `addDays(startDate, 7)` в `fetchData` и навигации
- Навигация: шаг `+/-7` дней

### 3.2 Оптимизация ширины ячеек
- Увеличить `min-w` ячеек: `min-w-[130px] sm:min-w-[150px]` (было 100/120) — больше места на 7 колонках
- Увеличить ширину колонки номера: `w-20` (было `w-16`)
- В колонке номера показать тип комнаты мелким текстом под номером

### 3.3 Группировка по этажам
- Добавить строку-разделитель этажа перед первым номером каждого этажа:
```tsx
<tr><td colSpan={8} className="bg-slate-100 text-xs font-bold px-3 py-1">Этаж {floor}</td></tr>
```

---

## Файлы для изменения

| Файл | Что |
|------|-----|
| `src/pages/AdminDashboard.tsx` | Бейдж pending adjustments на дашборде в сайдбаре |
| `src/components/admin/RoomTypeDialog.tsx` | Поле `price_half_day` |
| `src/components/admin/RoomTypesTab.tsx` | Столбец "Цена/полсутки" + логирование |
| `src/components/admin/BookingDetailModal.tsx` | Расчёт с учётом `price_half_day` |
| `src/components/admin/ShahmatkaGrid.tsx` | 7 дней, оптимизация ячеек, группировка по этажам |
| **Миграция БД** | `ALTER TABLE room_types ADD COLUMN price_half_day numeric` |

## Технические детали

**Расчёт полсуточной цены:**
```typescript
const dailyRate = booking.is_half_day
  ? (booking.room_types?.price_half_day ?? (booking.room_types?.price_per_night ?? 0) / 2)
  : (booking.daily_rate ?? booking.room_types?.price_per_night ?? 0);
```

**Группировка по этажам в шахматке:**
```typescript
const groupedByFloor = useMemo(() => {
  const map = new Map<number, Room[]>();
  rooms.forEach(r => {
    if (!map.has(r.floor)) map.set(r.floor, []);
    map.get(r.floor)!.push(r);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
}, [rooms]);
```

**Бейдж корректировок (только для owner):**
```typescript
const [pendingAdjustments, setPendingAdjustments] = useState(0);
useEffect(() => {
  if (isOwner && hotelId) {
    supabase.from('checkout_adjustments')
      .select('id', { count: 'exact' })
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .then(({ count }) => setPendingAdjustments(count || 0));
  }
}, [isOwner, hotelId]);
```
