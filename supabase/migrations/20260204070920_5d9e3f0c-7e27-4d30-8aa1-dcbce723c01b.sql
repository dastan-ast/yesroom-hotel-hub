-- Create booking_rooms table for multi-room bookings
CREATE TABLE public.booking_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booking_id, room_id)
);

-- Enable RLS
ALTER TABLE public.booking_rooms ENABLE ROW LEVEL SECURITY;

-- RLS policy for hotel staff
CREATE POLICY "Hotel staff can manage booking_rooms"
  ON public.booking_rooms FOR ALL
  USING (
    hotel_id = get_user_hotel_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  )
  WITH CHECK (
    hotel_id = get_user_hotel_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

-- RLS policy for superadmin
CREATE POLICY "SuperAdmin can manage all booking_rooms"
  ON public.booking_rooms FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_booking_rooms_booking_id ON public.booking_rooms(booking_id);
CREATE INDEX idx_booking_rooms_room_id ON public.booking_rooms(room_id);
CREATE INDEX idx_booking_rooms_hotel_id ON public.booking_rooms(hotel_id);