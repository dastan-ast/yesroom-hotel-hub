-- 1. Create service_catalog table
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for service_catalog
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policy for service_catalog
CREATE POLICY "Hotel staff can manage service_catalog"
ON public.service_catalog FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
)
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- SuperAdmin policy for service_catalog
CREATE POLICY "SuperAdmin can manage all service_catalog"
ON public.service_catalog FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- 2. Create booking_services table
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
  created_by uuid
);

-- Enable RLS for booking_services
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

-- RLS policy for booking_services
CREATE POLICY "Hotel staff can manage booking_services"
ON public.booking_services FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
)
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- SuperAdmin policy for booking_services
CREATE POLICY "SuperAdmin can manage all booking_services"
ON public.booking_services FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- 3. Extend bookings table with financial columns
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS prepayment_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_rate numeric,
ADD COLUMN IF NOT EXISTS final_total numeric;

-- 4. Create updated_at trigger for service_catalog
CREATE TRIGGER update_service_catalog_updated_at
BEFORE UPDATE ON public.service_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();