import { useEffect } from 'react';
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

const schema = z.object({
  name: z.string().min(1, 'Обязательное поле'),
  description: z.string().optional(),
  price_per_night: z.coerce.number().min(1, 'Укажите цену'),
  capacity: z.coerce.number().min(1, 'Минимум 1 гость'),
  amenities: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomType: RoomType | null;
  onSave: (data: Partial<RoomType>) => void;
}

export function RoomTypeDialog({ open, onOpenChange, roomType, onSave }: Props) {
  const { t } = useTranslation();
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      price_per_night: 0,
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
          capacity: roomType.capacity,
          amenities: roomType.amenities?.join(', ') || '',
        });
      } else {
        form.reset({
          name: '',
          description: '',
          price_per_night: 0,
          capacity: 2,
          amenities: '',
        });
      }
    }
  }, [open, roomType, form]);

  const handleSubmit = (data: FormData) => {
    onSave({
      name: data.name,
      description: data.description || null,
      price_per_night: data.price_per_night,
      capacity: data.capacity,
      amenities: data.amenities ? data.amenities.split(',').map(s => s.trim()).filter(Boolean) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {roomType ? t('admin.edit') : t('admin.addRoomType')}
          </DialogTitle>
        </DialogHeader>
        
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
                    <Textarea placeholder="Описание типа номера..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
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
      </DialogContent>
    </Dialog>
  );
}
