import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, differenceInDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { calculateStayPrice, formatPriceRange } from '@/lib/pricingUtils';
import { supabase } from '@/integrations/supabase/client';
import { BookingSuccess } from '@/components/BookingSuccess';
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

interface HotelSettings {
  kaspi_id?: string;
  whatsapp_phone?: string;
}

interface BookingFormProps {
  hotelId?: string;
}

export function BookingForm({ hotelId }: BookingFormProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [hotelSettings, setHotelSettings] = useState<HotelSettings | null>(null);
  const [hotelName, setHotelName] = useState<string>('');
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
    const fetchData = async () => {
      // Fetch room types
      let query = supabase.from('room_types').select('id, name, price_per_night');
      if (hotelId) {
        query = query.eq('hotel_id', hotelId);
      }
      const { data } = await query;
      if (data) setRoomTypes(data);

      // Fetch hotel settings if hotelId exists
      if (hotelId) {
        const { data: hotelData } = await supabase
          .from('hotels_public')
          .select('name, settings')
          .eq('id', hotelId)
          .maybeSingle() as any;
        if (hotelData) {
          setHotelName(hotelData.name);
          setHotelSettings(hotelData.settings as HotelSettings | null);
        }
      }
    };
    fetchData();
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
      // Error details logged server-side only for security
      toast.error(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="max-w-md mx-auto animate-scale-in">
        <CardContent className="pt-8">
          <BookingSuccess 
            hotelSettings={hotelSettings}
            hotelName={hotelName}
          />
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
                          {type.name}
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
