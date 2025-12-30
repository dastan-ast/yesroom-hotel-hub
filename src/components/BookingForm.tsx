import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const bookingSchema = z.object({
  guestName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  guestPhone: z.string().min(10, 'Phone must be at least 10 characters').max(20),
  checkInDate: z.date({ required_error: 'Check-in date is required' }),
  checkOutDate: z.date({ required_error: 'Check-out date is required' }),
  roomTypeId: z.string().min(1, 'Please select a room type'),
  guestCount: z.number().min(1).max(10).default(1),
  comment: z.string().max(500).optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface RoomType {
  id: string;
  name: string;
  price_per_night: number;
}

interface BookingFormProps {
  hotelId?: string;
}

export function BookingForm({ hotelId }: BookingFormProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestName: '',
      guestPhone: '',
      roomTypeId: searchParams.get('roomType') || '',
      guestCount: 1,
      comment: '',
    },
  });

  useEffect(() => {
    const fetchRoomTypes = async () => {
      let query = supabase.from('room_types').select('id, name, price_per_night');
      if (hotelId) {
        query = query.eq('hotel_id', hotelId);
      }
      const { data } = await query;
      if (data) setRoomTypes(data);
    };
    fetchRoomTypes();
  }, [hotelId]);

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        guest_name: data.guestName,
        guest_phone: data.guestPhone,
        check_in_date: format(data.checkInDate, 'yyyy-MM-dd'),
        check_out_date: format(data.checkOutDate, 'yyyy-MM-dd'),
        room_type_id: data.roomTypeId,
        guest_comment: data.comment || null,
        guest_count: data.guestCount,
        source: 'web',
        status: 'pending',
        hotel_id: hotelId || null,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success(t('booking.success'));
    } catch (error) {
      console.error('Booking error:', error);
      toast.error(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="max-w-md mx-auto animate-scale-in">
        <CardContent className="pt-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-display font-semibold mb-3">{t('booking.success')}</h2>
          <p className="text-muted-foreground">{t('booking.successMessage')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="font-display">{t('booking.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.guestName')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Иван Иванов" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guestPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.phone')}</FormLabel>
                  <FormControl>
                    <Input placeholder="+7 (777) 123-45-67" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="checkInDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('booking.checkIn')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Выберите</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkOutDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('booking.checkOut')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Выберите</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date <= (form.watch('checkInDate') || new Date())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.roomType')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('booking.selectRoom')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} - {type.price_per_night.toLocaleString()} ₸
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.comment')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('booking.commentPlaceholder')}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('booking.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
