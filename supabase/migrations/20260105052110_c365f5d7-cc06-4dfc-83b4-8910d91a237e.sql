-- Create service_charges table for extra charges (breakfast, minibar, etc.)
CREATE TABLE public.service_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.service_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Hotel staff can manage service charges for their hotel
CREATE POLICY "Hotel staff can manage service charges"
ON public.service_charges
FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
)
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- RLS Policy: SuperAdmin can manage all service charges
CREATE POLICY "SuperAdmin can manage all service_charges"
ON public.service_charges
FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Create index for better performance
CREATE INDEX idx_service_charges_booking_id ON public.service_charges(booking_id);
CREATE INDEX idx_service_charges_hotel_id ON public.service_charges(hotel_id);