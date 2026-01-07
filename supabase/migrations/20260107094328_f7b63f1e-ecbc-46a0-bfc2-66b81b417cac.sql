-- Функция для автоматического создания/связывания клиента при бронировании
CREATE OR REPLACE FUNCTION public.handle_booking_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- Ищем существующего клиента по телефону и hotel_id
  SELECT id INTO v_client_id
  FROM clients
  WHERE phone = NEW.guest_phone
    AND hotel_id = NEW.hotel_id
  LIMIT 1;

  -- Если клиент не найден - создаём нового
  IF v_client_id IS NULL THEN
    INSERT INTO clients (full_name, phone, hotel_id)
    VALUES (NEW.guest_name, NEW.guest_phone, NEW.hotel_id)
    RETURNING id INTO v_client_id;
  END IF;

  -- Связываем бронирование с клиентом
  NEW.client_id := v_client_id;

  RETURN NEW;
END;
$$;

-- Триггер срабатывает ДО вставки бронирования
CREATE TRIGGER on_booking_insert_create_client
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_booking_client();