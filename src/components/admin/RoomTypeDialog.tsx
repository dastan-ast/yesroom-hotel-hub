import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { GalleryUpload } from './GalleryUpload';

const schema = z.object({
  name: z.string().min(1, 'Обязательное поле'),
  description: z.string().optional(),
  price_per_night: z.coerce.number().min(1, 'Укажите цену'),
  price_weekend: z.coerce.number().optional().or(z.literal('')),
  price_half_day: z.coerce.number().optional().or(z.literal('')),
  capacity: z.coerce.number().min(1, 'Минимум 1 гость'),
  amenities: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  price_weekend: number | null;
  price_half_day: number | null;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
  images: string[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomType: RoomType | null;
  onSave: (data: Partial<RoomType>) => void;
}

export function RoomTypeDialog({ open, onOpenChange, roomType, onSave }: Props) {
  const { t } = useTranslation();
  const [images, setImages] = useState<string[]>([]);
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      price_per_night: 0,
      price_weekend: '',
      price_half_day: '',
      capacity: 2,
      amenities: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (roomType) {
        form.reset({
          name: roomType.name,
          description: roomType.description || '',
          price_per_night: roomType.price_per_night,
          price_half_day: roomType.price_half_day ?? '',
          capacity: roomType.capacity,
          amenities: roomType.amenities?.join(', ') || '',
        });
        // Use images array, fallback to image_url for backward compatibility
        const existingImages = roomType.images?.length 
          ? roomType.images 
          : roomType.image_url 
            ? [roomType.image_url] 
            : [];
        setImages(existingImages);
      } else {
        form.reset({
          name: '',
          description: '',
          price_per_night: 0,
          price_half_day: '',
          capacity: 2,
          amenities: '',
        });
        setImages([]);
      }
    }
  }, [open, roomType, form]);

  const handleSubmit = (data: FormData) => {
    const halfDay = typeof data.price_half_day === 'number' && data.price_half_day > 0 ? data.price_half_day : null;
    onSave({
      name: data.name,
      description: data.description || null,
      price_per_night: data.price_per_night,
      price_half_day: halfDay,
      capacity: data.capacity,
      amenities: data.amenities ? data.amenities.split(',').map(s => s.trim()).filter(Boolean) : null,
      image_url: images[0] || null,
      images: images,
    });
  };

  // Generate a temporary ID for new room types
  const itemId = roomType?.id || `new-${Date.now()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {roomType ? t('admin.edit') : t('admin.addRoomType')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Фото номера</p>
            <GalleryUpload
              images={images}
              onChange={setImages}
              folder="room-types"
              itemId={itemId}
              maxImages={10}
            />
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input placeholder="Стандарт" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Описание типа номера..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="price_per_night"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.price')} (₸)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price_half_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Полсутки (₸)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50% от ночи" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Вместимость</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="amenities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Удобства (через запятую)</FormLabel>
                    <FormControl>
                      <Input placeholder="Wi-Fi, ТВ, Кондиционер" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">{t('admin.save')}</Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
