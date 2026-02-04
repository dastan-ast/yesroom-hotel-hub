
# Исправление видимости отелей и номеров для публичных посетителей

## Найденная проблема

RLS политика на таблице `room_types` содержит критическую ошибку:

```sql
CREATE POLICY "Public can view room types for active hotels"
ON public.room_types FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = room_types.hotel_id
      AND h.status = 'active'
      AND h.subscription_status IN ('trial', 'active')
  )
);
```

**Проблема**: Подзапрос к таблице `hotels` также проходит через RLS! У таблицы `hotels` нет публичной политики SELECT - только для владельцев и суперадминов. Поэтому для анонимного пользователя `EXISTS` всегда возвращает `false`.

**Результат**: Анонимные пользователи не видят типы номеров, фильтр в `Index.tsx` отсеивает все отели, и отображается "0 отелей найдено".

## Решение

Создать security definer функцию для проверки статуса отеля, которая обходит RLS:

### 1. Создать функцию проверки активности отеля

```sql
CREATE OR REPLACE FUNCTION public.is_hotel_active_for_public(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotels
    WHERE id = _hotel_id
      AND status = 'active'
      AND subscription_status IN ('trial', 'active')
  )
$$;
```

### 2. Обновить RLS политику на room_types

```sql
-- Удалить старую политику
DROP POLICY IF EXISTS "Public can view room types for active hotels" ON public.room_types;

-- Создать новую политику с использованием security definer функции
CREATE POLICY "Public can view room types for active hotels"
ON public.room_types
FOR SELECT
USING (is_hotel_active_for_public(hotel_id));
```

## Технические детали

| Аспект | Описание |
|--------|----------|
| **Корневая причина** | RLS на hotels блокирует подзапросы из политик других таблиц |
| **Затронутые пользователи** | Все анонимные посетители сайта |
| **Риск безопасности** | Низкий - функция только проверяет статус, не раскрывая данные |
| **Время исправления** | Немедленно после применения миграции |

## Что будет исправлено

- Главная страница (`/`) покажет доступные отели с ценами
- Страница отеля (`/hotels/:slug`) покажет типы номеров
- Форма бронирования будет работать корректно
