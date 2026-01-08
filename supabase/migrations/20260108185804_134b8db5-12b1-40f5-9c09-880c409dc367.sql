-- Add new booking sources for bots
ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'telegram';
ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'whatsapp';

-- Create table for hotel API keys
CREATE TABLE public.hotel_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL, -- First 8 chars for display
  name TEXT NOT NULL DEFAULT 'Bot Integration',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(api_key_hash)
);

-- Add external tracking columns to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS external_source_data JSONB DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE public.hotel_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for hotel_api_keys
CREATE POLICY "Hotel owners can manage their API keys"
ON public.hotel_api_keys
FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  hotel_id = get_user_hotel_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "SuperAdmin can manage all API keys"
ON public.hotel_api_keys
FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Create index for faster API key lookups
CREATE INDEX idx_hotel_api_keys_hash ON public.hotel_api_keys(api_key_hash) WHERE is_active = true;