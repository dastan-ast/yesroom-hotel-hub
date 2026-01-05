-- Drop the old global unique constraint
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_number_key;

-- Add new composite unique constraint (unique per hotel)
ALTER TABLE public.rooms ADD CONSTRAINT rooms_hotel_room_unique UNIQUE (hotel_id, room_number);