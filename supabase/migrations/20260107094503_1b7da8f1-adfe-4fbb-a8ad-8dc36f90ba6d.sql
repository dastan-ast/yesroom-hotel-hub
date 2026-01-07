-- Временно отключаем constraint для обновления существующих бронирований
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_in_not_past_for_web;

-- Обновляем client_id для существующих бронирований
UPDATE bookings 
SET client_id = (
  SELECT c.id 
  FROM clients c 
  WHERE c.phone = bookings.guest_phone 
    AND c.hotel_id = bookings.hotel_id 
  LIMIT 1
)
WHERE client_id IS NULL 
  AND hotel_id IS NOT NULL;

-- Восстанавливаем constraint только для INSERT (не для UPDATE)
-- Создаём триггер вместо check constraint для более гибкой проверки
CREATE OR REPLACE FUNCTION public.validate_web_booking_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Проверяем только для новых веб-бронирований
  IF TG_OP = 'INSERT' AND NEW.source = 'web' AND NEW.check_in_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Check-in date cannot be in the past for web bookings';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_web_booking_check_in
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_web_booking_date();