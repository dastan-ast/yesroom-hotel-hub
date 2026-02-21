
-- 1. Make guest_phone nullable in bookings
ALTER TABLE public.bookings ALTER COLUMN guest_phone DROP NOT NULL;

-- 2. Make phone nullable in clients
ALTER TABLE public.clients ALTER COLUMN phone DROP NOT NULL;

-- 3. Update trigger: search by LOWER(full_name) + LOWER(phone), case-insensitive
CREATE OR REPLACE FUNCTION public.handle_booking_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
BEGIN
  IF NEW.guest_phone IS NOT NULL AND NEW.guest_phone != '' THEN
    -- Search by full_name + phone (case-insensitive)
    SELECT id INTO v_client_id
    FROM clients
    WHERE LOWER(full_name) = LOWER(NEW.guest_name)
      AND LOWER(phone) = LOWER(NEW.guest_phone)
      AND hotel_id = NEW.hotel_id
    LIMIT 1;
  ELSE
    -- Search by name only when phone is NULL/empty
    SELECT id INTO v_client_id
    FROM clients
    WHERE LOWER(full_name) = LOWER(NEW.guest_name)
      AND (phone IS NULL OR phone = '')
      AND hotel_id = NEW.hotel_id
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (full_name, phone, hotel_id)
    VALUES (NEW.guest_name, NULLIF(NEW.guest_phone, ''), NEW.hotel_id)
    RETURNING id INTO v_client_id;
  END IF;

  NEW.client_id := v_client_id;
  RETURN NEW;
END;
$function$;
