
-- Table to store checkout amount adjustments that need owner approval
CREATE TABLE public.checkout_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  original_total NUMERIC NOT NULL DEFAULT 0,
  adjusted_total NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  adjusted_by UUID NOT NULL,
  adjusted_by_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view adjustments for their hotel"
  ON public.checkout_adjustments FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can create adjustments for their hotel"
  ON public.checkout_adjustments FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owner can update adjustments"
  ON public.checkout_adjustments FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM profiles WHERE user_id = auth.uid()));
