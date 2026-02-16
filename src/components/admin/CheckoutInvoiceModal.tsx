import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Receipt, User, Calendar, BedDouble, CheckCircle } from 'lucide-react';

interface BookingService {
  id: string;
  booking_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

interface BookingDetails {
  id: string;
  guest_name: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  prepayment_amount: number | null;
  daily_rate: number | null;
  room_id: string | null;
  room_type_id: string | null;
  rooms: { room_number: string } | null;
  room_types: { name: string; price_per_night: number } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingIds: string[];
  hotelId: string;
  onSuccess: () => void;
}

export function CheckoutInvoiceModal({ open, onOpenChange, bookingIds, hotelId, onSuccess }: Props) {
  const { t } = useTranslation();
  const [allBookings, setAllBookings] = useState<BookingDetails[]>([]);
  const [allServices, setAllServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open && bookingIds.length > 0) {
      fetchData();
    }
  }, [open, bookingIds]);

  const fetchData = async () => {
    setLoading(true);

    const [bookingsRes, servicesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(`
          id, guest_name, guest_phone, check_in_date, check_out_date,
          prepayment_amount, daily_rate, room_id, room_type_id,
          rooms(room_number),
          room_types(name, price_per_night)
        `)
        .in('id', bookingIds),
      supabase
        .from('booking_services')
        .select('id, booking_id, service_name, unit_price, quantity, total_price')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: true }),
    ]);

    if (bookingsRes.data) setAllBookings(bookingsRes.data as BookingDetails[]);
    if (servicesRes.data) setAllServices(servicesRes.data as BookingService[]);
    setLoading(false);
  };

  // Per-booking calculations
  const getBookingCalc = (booking: BookingDetails) => {
    const nights = differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date));
    const dailyRate = booking.daily_rate ?? booking.room_types?.price_per_night ?? 0;
    const stayTotal = nights * dailyRate;
    const bookingServices = allServices.filter(s => s.booking_id === booking.id);
    const servicesTotal = bookingServices.reduce((sum, s) => sum + (s.total_price || 0), 0);
    return { nights, dailyRate, stayTotal, servicesTotal, total: stayTotal + servicesTotal };
  };

  // Grand totals
  const grandTotals = allBookings.reduce(
    (acc, b) => {
      const c = getBookingCalc(b);
      acc.stayTotal += c.stayTotal;
      acc.servicesTotal += c.servicesTotal;
      acc.total += c.total;
      acc.prepayment += (b.prepayment_amount ?? 0);
      return acc;
    },
    { stayTotal: 0, servicesTotal: 0, total: 0, prepayment: 0 }
  );
  const balanceDue = grandTotals.total - grandTotals.prepayment;

  const handleConfirmCheckout = async () => {
    if (allBookings.length === 0) return;
    setProcessing(true);

    for (const booking of allBookings) {
      const calc = getBookingCalc(booking);
      
      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'checked_out',
          final_total: calc.total,
          daily_rate: calc.dailyRate,
        })
        .eq('id', booking.id);

      // Release room
      if (booking.room_id) {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', booking.room_id);
      }

      // Release any booking_rooms (backward compat)
      const { data: bookingRooms } = await supabase
        .from('booking_rooms')
        .select('room_id')
        .eq('booking_id', booking.id);
      if (bookingRooms && bookingRooms.length > 0) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .in('id', bookingRooms.map(br => br.room_id));
      }
    }

    toast.success('Гость выселен');
    setProcessing(false);
    onOpenChange(false);
    onSuccess();
  };

  if (loading || allBookings.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
        </DialogContent>
      </Dialog>
    );
  }

  const primary = allBookings[0];
  const isMulti = allBookings.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Итоговый счёт
            {isMulti && (
              <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                <BedDouble className="h-3 w-3 mr-1" />
                {allBookings.length} номеров
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Guest Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{primary.guest_name}</span>
            </div>
          </div>

          <Separator />

          {/* Per-room breakdown */}
          {allBookings.map((booking) => {
            const calc = getBookingCalc(booking);
            const bookingServices = allServices.filter(s => s.booking_id === booking.id);

            return (
              <div key={booking.id} className="space-y-2 p-3 border rounded-lg bg-muted/20">
                {/* Room header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BedDouble className="h-4 w-4 text-primary" />
                    {booking.rooms
                      ? `№ ${booking.rooms.room_number} ${booking.room_types?.name ? `(${booking.room_types.name})` : ''}`
                      : 'Номер не назначен'}
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {format(parseISO(booking.check_in_date), 'dd MMMM', { locale: ru })} —{' '}
                    {format(parseISO(booking.check_out_date), 'dd MMMM yyyy', { locale: ru })}
                    <span className="ml-1">({calc.nights} {calc.nights === 1 ? 'ночь' : calc.nights < 5 ? 'ночи' : 'ночей'})</span>
                  </span>
                </div>

                {/* Stay cost */}
                <div className="flex justify-between text-sm">
                  <span>
                    {calc.nights} {calc.nights === 1 ? 'ночь' : calc.nights < 5 ? 'ночи' : 'ночей'} × {calc.dailyRate.toLocaleString()} ₸
                  </span>
                  <span className="font-medium">{calc.stayTotal.toLocaleString()} ₸</span>
                </div>

                {/* Services for this booking */}
                {bookingServices.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-dashed">
                    {bookingServices.map((service) => (
                      <div key={service.id} className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {service.service_name}
                          {service.quantity > 1 && ` × ${service.quantity}`}
                        </span>
                        <span>{(service.total_price || 0).toLocaleString()} ₸</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Room subtotal */}
                <div className="flex justify-between text-sm font-medium pt-1 border-t">
                  <span>Итого по номеру:</span>
                  <span>{(calc.stayTotal + calc.servicesTotal).toLocaleString()} ₸</span>
                </div>
              </div>
            );
          })}

          <Separator />

          {/* Grand Totals */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Проживание:</span>
              <span>{grandTotals.stayTotal.toLocaleString()} ₸</span>
            </div>
            {grandTotals.servicesTotal > 0 && (
              <div className="flex justify-between">
                <span>Услуги:</span>
                <span>{grandTotals.servicesTotal.toLocaleString()} ₸</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Общий итог:</span>
              <span>{grandTotals.total.toLocaleString()} ₸</span>
            </div>
            {grandTotals.prepayment > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Предоплата:</span>
                <span>−{grandTotals.prepayment.toLocaleString()} ₸</span>
              </div>
            )}
          </div>

          {/* Balance Due */}
          <div className="p-4 bg-primary/10 rounded-lg flex justify-between items-center">
            <span className="font-semibold">Баланс к оплате:</span>
            <span className="text-2xl font-bold">{balanceDue.toLocaleString()} ₸</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleConfirmCheckout} disabled={processing}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {processing ? t('common.loading') : 'Подтвердить и закрыть'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
