-- Создание bucket для изображений отелей
INSERT INTO storage.buckets (id, name, public)
VALUES ('hotel-images', 'hotel-images', true);

-- RLS политики для управления файлами
CREATE POLICY "Hotel staff can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'hotel-images' AND
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Public can view hotel images"
ON storage.objects FOR SELECT
USING (bucket_id = 'hotel-images');

CREATE POLICY "Hotel staff can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'hotel-images' AND
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Hotel staff can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'hotel-images' AND
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);