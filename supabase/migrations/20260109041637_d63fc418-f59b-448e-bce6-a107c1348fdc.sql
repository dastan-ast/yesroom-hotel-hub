-- Add images array column for room type gallery
ALTER TABLE public.room_types 
ADD COLUMN images text[] DEFAULT '{}';

-- Migrate existing image_url to images array
UPDATE public.room_types 
SET images = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_url != '';