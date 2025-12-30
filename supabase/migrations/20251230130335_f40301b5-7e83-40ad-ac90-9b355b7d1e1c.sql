-- 1. Create hotels table
CREATE TABLE public.hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  location TEXT,
  description TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '14 days'),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Enable RLS on hotels
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

-- 3. Add hotel_id to profiles
ALTER TABLE public.profiles ADD COLUMN hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

-- 4. Add hotel_id to room_types
ALTER TABLE public.room_types ADD COLUMN hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE;

-- 5. Add hotel_id to rooms
ALTER TABLE public.rooms ADD COLUMN hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE;

-- 6. Add hotel_id to bookings
ALTER TABLE public.bookings ADD COLUMN hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE;

-- 7. Add hotel_id to clients
ALTER TABLE public.clients ADD COLUMN hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE;

-- 8. Create indexes for hotel_id
CREATE INDEX idx_profiles_hotel_id ON public.profiles(hotel_id);
CREATE INDEX idx_room_types_hotel_id ON public.room_types(hotel_id);
CREATE INDEX idx_rooms_hotel_id ON public.rooms(hotel_id);
CREATE INDEX idx_bookings_hotel_id ON public.bookings(hotel_id);
CREATE INDEX idx_clients_hotel_id ON public.clients(hotel_id);

-- 9. Create helper function to get user's hotel_id
CREATE OR REPLACE FUNCTION public.get_user_hotel_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hotel_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 10. Update has_role function to handle new roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 11. RLS Policies for hotels table

-- SuperAdmin can do everything with hotels
CREATE POLICY "SuperAdmin full access to hotels"
ON public.hotels
FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'));

-- Owners can view their own hotel
CREATE POLICY "Owners can view own hotel"
ON public.hotels
FOR SELECT
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));

-- Owners can update their own hotel
CREATE POLICY "Owners can update own hotel"
ON public.hotels
FOR UPDATE
USING (owner_id = auth.uid());

-- Authenticated users can create hotels (for registration flow)
CREATE POLICY "Authenticated users can create hotels"
ON public.hotels
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Public can view hotels for booking (only active ones)
CREATE POLICY "Public can view active hotels"
ON public.hotels
FOR SELECT
USING (subscription_status IN ('trial', 'active'));

-- 12. Update room_types RLS to include hotel_id filtering
DROP POLICY IF EXISTS "Admins can manage room types" ON public.room_types;
DROP POLICY IF EXISTS "Anyone can view room types" ON public.room_types;

CREATE POLICY "Hotel staff can manage room types"
ON public.room_types
FOR ALL
USING (
  hotel_id = public.get_user_hotel_id(auth.uid()) 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
);

CREATE POLICY "Public can view room types"
ON public.room_types
FOR SELECT
USING (true);

-- 13. Update rooms RLS
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;

CREATE POLICY "Hotel staff can manage rooms"
ON public.rooms
FOR ALL
USING (
  hotel_id = public.get_user_hotel_id(auth.uid()) 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
);

CREATE POLICY "Public can view rooms"
ON public.rooms
FOR SELECT
USING (true);

-- 14. Update bookings RLS
DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

CREATE POLICY "Hotel staff can manage bookings"
ON public.bookings
FOR ALL
USING (
  hotel_id = public.get_user_hotel_id(auth.uid()) 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
);

CREATE POLICY "Public can create bookings"
ON public.bookings
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view own bookings"
ON public.bookings
FOR SELECT
USING (guest_phone IS NOT NULL);

-- 15. Update clients RLS
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;

CREATE POLICY "Hotel staff can manage clients"
ON public.clients
FOR ALL
USING (
  hotel_id = public.get_user_hotel_id(auth.uid()) 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
);

-- 16. Add trigger for hotels updated_at
CREATE TRIGGER update_hotels_updated_at
BEFORE UPDATE ON public.hotels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();