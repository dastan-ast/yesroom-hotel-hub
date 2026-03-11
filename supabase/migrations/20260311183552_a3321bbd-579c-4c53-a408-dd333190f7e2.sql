CREATE INDEX IF NOT EXISTS idx_bookings_hotel_status_checkin ON public.bookings (hotel_id, status, check_in_date);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_status_checkout ON public.bookings (hotel_id, status, check_out_date);
CREATE INDEX IF NOT EXISTS idx_leads_hotel_status_created ON public.leads (hotel_id, status, created_at);