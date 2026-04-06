import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, X, Loader2, Plus } from 'lucide-react';

interface GalleryUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  folder: string;
  itemId: string;
  hotelId: string;
  maxImages?: number;
}

export function GalleryUpload({ images, onChange, folder, itemId, hotelId, maxImages = 10 }: GalleryUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (files.length > remainingSlots) {
      toast.error(`Можно добавить ещё ${remainingSlots} фото`);
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error('Только изображения разрешены');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Максимальный размер файла — 5MB');
        return;
      }
    }

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${hotelId}/${folder}/${itemId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('hotel-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('hotel-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      onChange([...images, ...uploadedUrls]);
      toast.success(`Загружено ${uploadedUrls.length} фото`);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (index: number) => {
    const url = images[index];
    try {
      const path = url.split('/hotel-images/')[1];
      if (path) {
        await supabase.storage.from('hotel-images').remove([path]);
      }
      const newImages = images.filter((_, i) => i !== index);
      onChange(newImages);
      toast.success('Фото удалено');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления');
    }
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, index) => (
          <div key={url} className="relative group aspect-square">
            <img
              src={url}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover rounded-lg border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
            {index === 0 && (
              <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                Главное
              </span>
            )}
          </div>
        ))}

        {canAddMore && (
          <div
            className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
            onClick={() => !uploading && inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Plus className="h-6 w-6" />
                <span className="text-xs">Добавить</span>
              </>
            )}
          </div>
        )}
      </div>

      {images.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Добавьте до {maxImages} фото. Первое будет главным.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleUpload}
        disabled={uploading}
      />
    </div>
  );
}
