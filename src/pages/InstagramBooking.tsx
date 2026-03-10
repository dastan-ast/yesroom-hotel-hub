import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePhoneMask } from '@/hooks/usePhoneMask';
import { useUtmParams } from '@/hooks/useUtmParams';
import { BookingSuccess } from '@/components/BookingSuccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Building2, Phone, User, Send } from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
  logo_url: string | null;
  settings: any;
}

export default function InstagramBooking() {
  const { hotelSlug } = useParams();
  const phoneMask = usePhoneMask();
  const utmData = useUtmParams();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [guestName, setGuestName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchHotel = async () => {
      if (!hotelSlug) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from('hotels_public')
        .select('id, name, logo_url, settings')
        .eq('slug', hotelSlug)
        .maybeSingle() as any;
      if (error || !data) { setNotFound(true); } else { setHotel(data); }
      setLoading(false);
    };
    fetchHotel();
  }, [hotelSlug]);

  useEffect(() => {
    if (checkIn && (!checkOut || checkOut <= checkIn)) {
      setCheckOut(addDays(checkIn, 1));
    }
  }, [checkIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneMask.value || phoneMask.getRawPhone().length < 11) {
      toast.error('Введите номер телефона');
      return;
    }
    if (!hotel) return;

    setIsSubmitting(true);
    try {
      const bookingData: any = {
        guest_phone: phoneMask.value,
        guest_name: guestName.trim() || 'Гость из Instagram',
        source: 'web' as const,
        status: 'pending' as const,
        hotel_id: hotel.id,
        guest_comment: 'Источник: Instagram',
        check_in_date: checkIn ? format(checkIn, 'yyyy-MM-dd') : format(today, 'yyyy-MM-dd'),
        check_out_date: checkOut ? format(checkOut, 'yyyy-MM-dd') : format(addDays(today, 1), 'yyyy-MM-dd'),
      };

      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;

      // Create lead with instagram source
      await supabase.from('leads').insert({
        hotel_id: hotel.id,
        phone: phoneMask.value,
        name: guestName.trim() || null,
        source: 'instagram',
        status: 'new',
      });

      setIsSuccess(true);
    } catch {
      toast.error('Ошибка. Попробуйте позже');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !hotel) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Отель не найден</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <BookingSuccess
            hotelSettings={hotel.settings as { kaspi_id?: string; whatsapp_phone?: string } | null}
            hotelName={hotel.name}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 to-background flex flex-col">
      {/* Header */}
      <div className="pt-8 pb-4 px-6 text-center">
        {hotel.logo_url ? (
          <img
            src={hotel.logo_url}
            alt={hotel.name}
            className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3 shadow-md"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
        )}
        <h1 className="text-xl font-bold">{hotel.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Быстрое бронирование</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-6 pb-8 space-y-4 max-w-sm mx-auto w-full">
        {/* Phone - Required */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" />
            Телефон <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="+7 (777) 123-45-67"
            value={phoneMask.value}
            onChange={(e) => phoneMask.handleChange(e.target.value)}
            className="h-12 text-base"
            required
            autoFocus
          />
        </div>

        {/* Name - Optional */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            Имя <span className="text-muted-foreground text-xs">(необязательно)</span>
          </label>
          <Input
            placeholder="Как к вам обращаться?"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="h-12 text-base"
          />
        </div>

        {/* Dates - Optional */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Заезд
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full h-12 justify-start text-left font-normal',
                    !checkIn && 'text-muted-foreground'
                  )}
                >
                  {checkIn ? format(checkIn, 'dd.MM.yy') : 'Выбрать'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkIn}
                  onSelect={setCheckIn}
                  disabled={(date) => date < today}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Выезд
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full h-12 justify-start text-left font-normal',
                    !checkOut && 'text-muted-foreground'
                  )}
                >
                  {checkOut ? format(checkOut, 'dd.MM.yy') : 'Выбрать'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkOut}
                  onSelect={setCheckOut}
                  disabled={(date) => date <= (checkIn || today)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Даты можно уточнить позже — мы свяжемся с вами
        </p>

        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
          ) : (
            <>
              <Send className="h-4 w-4" />
              Отправить заявку
            </>
          )}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center leading-tight">
          Нажимая кнопку, вы соглашаетесь на обработку персональных данных
        </p>
      </form>
    </div>
  );
}
