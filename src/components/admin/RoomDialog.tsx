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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

type RoomStatus = 'available' | 'booked' | 'occupied' | 'maintenance';

const schema = z.object({
  room_number: z.string().min(1, 'Обязательное поле'),
  floor: z.coerce.number().min(1, 'Минимум 1 этаж'),
  room_type_id: z.string().min(1, 'Выберите тип'),
  status: z.enum(['available', 'booked', 'occupied', 'maintenance']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Room {
  id: string;
  room_number: string;
  floor: number;
  status: RoomStatus;
  room_type_id: string;
  notes: string | null;
}

interface RoomType {
  id: string;
  name: string;
  price_per_night: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  roomTypes: RoomType[];
  onSave: (data: Partial<Room>) => void;
  onDelete?: () => void;
  onStatusChange?: (status: RoomStatus) => void;
}

export function RoomDialog({ open, onOpenChange, room, roomTypes, onSave, onDelete, onStatusChange }: Props) {
  const { t } = useTranslation();
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      room_number: '',
      floor: 1,
      room_type_id: '',
      status: 'available',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (room) {
        form.reset({
          room_number: room.room_number,
          floor: room.floor,
          room_type_id: room.room_type_id,
          status: room.status,
          notes: room.notes || '',
        });
      } else {
        form.reset({
          room_number: '',
          floor: 1,
          room_type_id: roomTypes[0]?.id || '',
          status: 'available',
          notes: '',
        });
      }
    }
  }, [open, room, roomTypes, form]);

  const handleSubmit = (data: FormData) => {
    onSave({
      room_number: data.room_number,
      floor: data.floor,
      room_type_id: data.room_type_id,
      status: data.status,
      notes: data.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {room ? `Номер ${room.room_number}` : t('admin.addRoom')}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="room_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.roomNumber')}</FormLabel>
                    <FormControl>
                      <Input placeholder="101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.floor')}</FormLabel>
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
              name="room_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.roomType')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} — {type.price_per_night.toLocaleString()} ₸
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {room && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.status')}</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      onStatusChange?.(val as RoomStatus);
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">{t('admin.available')}</SelectItem>
                        <SelectItem value="booked">{t('admin.booked')}</SelectItem>
                        <SelectItem value="occupied">{t('admin.occupied')}</SelectItem>
                        <SelectItem value="maintenance">{t('admin.maintenance')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Заметки</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Заметки о номере..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-between">
              {room && onDelete && (
                <Button type="button" variant="destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('admin.delete')}
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">{t('admin.save')}</Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
