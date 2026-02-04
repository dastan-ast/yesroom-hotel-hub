import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { usePhoneMask } from '@/hooks/usePhoneMask';
import { syncBookingToExternal } from '@/lib/syncBooking';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const schema = z.object({
  guest_name: z.string().min(1, 'Обязательное поле'),
  room_type_id: z.string().min(1, 'Выберите тип'),
  check_in_date: z.date({ required_error: 'Укажите дату' }),
  check_out_date: z.date({ required_error: 'Укажите дату' }),
  source: z.enum(['manual', 'web', 'booking']),
  prepayment_received: z.boolean(),
  prepayment_amount: z.number().min(0).optional(),
  guest_comment: z.string().optional(),
  guest_count: z.number().min(1).max(10).optional(),
});

type FormData = z.infer<typeof schema>;

interface RoomType {
  id: string;
  name: string;
  price_per_night: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  hotelId: string;
}

export function ManualBookingDialog({ open, onOpenChange, onSuccess, hotelId }: Props) {
  const { t } = useTranslation();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const phoneMask = usePhoneMask();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      guest_name: '',
      room_type_id: '',
      source: 'manual',
      prepayment_received: false,
      prepayment_amount: 0,
      guest_comment: '',
      guest_count: 1,
    },
  });

  const watchPrepayment = form.watch('prepayment_received');

  useEffect(() => {
    if (open && hotelId) {
      fetchRoomTypes();
      form.reset({
        guest_name: '',
        room_type_id: '',
        source: 'manual',
        prepayment_received: false,
        prepayment_amount: 0,
        guest_comment: '',
        guest_count: 1,
      });
      phoneMask.setValue('');
    }
  }, [open, hotelId, form]);

  const fetchRoomTypes = async () => {
    const { data } = await supabase
      .from('room_types')
      .select('id, name, price_per_night')
      .eq('hotel_id', hotelId);
    if (data) setRoomTypes(data);
  };

  const handleSubmit = async (data: FormData) => {
    if (!phoneMask.value) {
      toast.error('Укажите телефон');
      return;
    }

    setLoading(true);
    
    const { data: booking, error } = await supabase.from('bookings').insert({
      guest_name: data.guest_name,
      guest_phone: phoneMask.value,
      room_type_id: data.room_type_id,
      check_in_date: format(data.check_in_date, 'yyyy-MM-dd'),
      check_out_date: format(data.check_out_date, 'yyyy-MM-dd'),
      source: data.source,
      prepayment_received: data.prepayment_received,
      prepayment_amount: data.prepayment_received ? (data.prepayment_amount || 0) : 0,
      guest_comment: data.guest_comment || null,
      guest_count: data.guest_count || 1,
      status: 'pending',
      hotel_id: hotelId,
    }).select('id').single();

    setLoading(false);

    if (error || !booking) {
      toast.error(t('common.error'));
      return;
    }

    // Синхронизация с внешним Supabase (асинхронно)
    syncBookingToExternal(booking.id).catch(console.error);

    toast.success(t('common.success'));
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.newBooking')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.guestName')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Иванов Иван Иванович" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('booking.phone')}</label>
              <Input 
                placeholder="+7 (777) 123-45-67" 
                value={phoneMask.value}
                onChange={(e) => phoneMask.handleChange(e.target.value)}
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
                        <SelectValue placeholder={t('booking.selectRoom')} />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="check_in_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('booking.checkIn')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd.MM.yyyy') : 'Выбрать'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="check_out_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('booking.checkOut')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd.MM.yyyy') : 'Выбрать'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.source')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manual">{t('admin.manual')}</SelectItem>
                      <SelectItem value="web">{t('admin.web')}</SelectItem>
                      <SelectItem value="booking">{t('admin.bookingCom')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guest_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Количество гостей</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={1} 
                      max={10} 
                      {...field} 
                      value={field.value || 1}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prepayment_received"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('admin.prepayment')}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {watchPrepayment && (
              <FormField
                control={form.control}
                name="prepayment_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сумма предоплаты (₸)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        placeholder="0"
                        {...field} 
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="guest_comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.comment')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('booking.commentPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('common.loading') : t('admin.save')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
