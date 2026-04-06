import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  currentUrl: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
  folder: string;
  itemId: string;
  hotelId: string;
}

export function ImageUpload({ currentUrl, onUpload, onRemove, folder, itemId, hotelId }: ImageUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Только изображения разрешены');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Максимальный размер файла — 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${hotelId}/${folder}/${itemId}/image.${fileExt}`;

      // Delete old file if exists
      if (currentUrl) {
        const oldPath = currentUrl.split('/hotel-images/')[1];
        if (oldPath) {
          await supabase.storage.from('hotel-images').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('hotel-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('hotel-images')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
      toast.success('Фото загружено');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    
    setUploading(true);
    try {
      const path = currentUrl.split('/hotel-images/')[1];
      if (path) {
        await supabase.storage.from('hotel-images').remove([path]);
      }
      onRemove();
      toast.success('Фото удалено');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {currentUrl ? (
        <div className="relative group">
          <img
            src={currentUrl}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <>
              <Upload className="h-8 w-8" />
              <span className="text-sm">Нажмите для загрузки</span>
              <span className="text-xs">JPG, PNG, WebP до 5MB</span>
            </>
          )}
        </div>
      )}
      
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
        disabled={uploading}
      />
      
      {currentUrl && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Заменить фото
        </Button>
      )}
    </div>
  );
}
