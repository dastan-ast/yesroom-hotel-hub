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
  service_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

interface BookingRoom {
  room_id: string;
  rooms: {
    room_number: string;
    room_types: { name: string } | null;
  } | null;
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
  bookingId: string;
  hotelId: string;
  onSuccess: () => void;
}

export function CheckoutInvoiceModal({ open, onOpenChange, bookingId, hotelId, onSuccess }: Props) {
  const { t } = useTranslation();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [services, setServices] = useState<BookingService[]>([]);
  const [bookingRooms, setBookingRooms] = useState<BookingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open && bookingId) {
      fetchData();
    }
  }, [open, bookingId]);

  const fetchData = async () => {
    setLoading(true);

    const [bookingRes, servicesRes, bookingRoomsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(`
          id, guest_name, guest_phone, check_in_date, check_out_date,
          prepayment_amount, daily_rate, room_id, room_type_id,
          rooms(room_number),
          room_types(name, price_per_night)
        `)
        .eq('id', bookingId)
        .single(),
      supabase
        .from('booking_services')
        .select('id, service_name, unit_price, quantity, total_price')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true }),
      supabase
        .from('booking_rooms')
        .select('room_id, rooms(room_number, room_types(name))')
        .eq('booking_id', bookingId),
    ]);

    if (bookingRes.data) setBooking(bookingRes.data as BookingDetails);
    if (servicesRes.data) setServices(servicesRes.data);
    if (bookingRoomsRes.data) setBookingRooms(bookingRoomsRes.data as BookingRoom[]);
    setLoading(false);
  };

  // Get all room IDs (from booking_rooms + main room_id for backward compatibility)
  const getAllRoomIds = (): string[] => {
    const roomIds = new Set<string>();
    
    // Add rooms from booking_rooms table
    bookingRooms.forEach(br => {
      if (br.room_id) roomIds.add(br.room_id);
    });
    
    // Add main room_id for backward compatibility
    if (booking?.room_id && !roomIds.has(booking.room_id)) {
      roomIds.add(booking.room_id);
    }
    
    return Array.from(roomIds);
  };

  // Get display info for all rooms
  const getAllRoomsDisplay = () => {
    const displayRooms: { room_number: string; room_type: string }[] = [];
    
    // Rooms from booking_rooms
    bookingRooms.forEach(br => {
      if (br.rooms) {
        displayRooms.push({
          room_number: br.rooms.room_number,
          room_type: br.rooms.room_types?.name || '',
        });
      }
    });
    
    // If no booking_rooms but has main room_id (backward compatibility)
    if (displayRooms.length === 0 && booking?.rooms) {
      displayRooms.push({
        room_number: booking.rooms.room_number,
        room_type: booking.room_types?.name || '',
      });
    }
    
    return displayRooms;
  };

  // Calculate totals
  const nights = booking
    ? differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date))
    : 0;

  const dailyRate = booking?.daily_rate ?? booking?.room_types?.price_per_night ?? 0;
  const allRooms = getAllRoomsDisplay();
  const roomCount = Math.max(allRooms.length, 1);
  // Room count multiplier for backward compat with old booking_rooms entries
  const stayTotal = nights * dailyRate * roomCount;
  const servicesTotal = services.reduce((sum, s) => sum + (s.total_price || 0), 0);
  const grandTotal = stayTotal + servicesTotal;
  const prepayment = booking?.prepayment_amount ?? 0;
  const balanceDue = grandTotal - prepayment;

  const handleConfirmCheckout = async () => {
    if (!booking) return;

    setProcessing(true);

    // Update booking status and save final total
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status: 'checked_out',
        final_total: grandTotal,
        daily_rate: dailyRate,
      })
      .eq('id', bookingId);

    if (bookingError) {
      toast.error(t('common.error'));
      setProcessing(false);
      return;
    }

    // Release all rooms
    const allRoomIds = getAllRoomIds();
    if (allRoomIds.length > 0) {
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'available' })
        .in('id', allRoomIds);

      if (roomError) {
        toast.error('Ошибка при освобождении номеров');
      }
    }

    toast.success('Гость выселен');
    setProcessing(false);
    onOpenChange(false);
    onSuccess();
  };

  if (loading || !booking) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Итоговый счёт
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Guest Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{booking.guest_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BedDouble className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                {allRooms.length > 0 ? (
                  allRooms.map((room, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      №{room.room_number} {room.room_type && `(${room.room_type})`}
                    </Badge>
                  ))
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(parseISO(booking.check_in_date), 'dd MMMM', { locale: ru })} —{' '}
                {format(parseISO(booking.check_out_date), 'dd MMMM yyyy', { locale: ru })}
                <span className="text-muted-foreground ml-1">({nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'})</span>
              </span>
            </div>
          </div>

          <Separator />

          {/* Stay Calculation */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Проживание</h4>
            <div className="flex justify-between">
              <span>
                {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'} × {dailyRate.toLocaleString()} ₸
                {roomCount > 1 && ` × ${roomCount} номера`}
              </span>
              <span className="font-medium">{stayTotal.toLocaleString()} ₸</span>
            </div>
          </div>

          {/* Services */}
          {services.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Услуги</h4>
                {services.map((service) => (
                  <div key={service.id} className="flex justify-between text-sm">
                    <span>
                      {service.service_name}
                      {service.quantity > 1 && ` × ${service.quantity}`}
                    </span>
                    <span>{(service.total_price || 0).toLocaleString()} ₸</span>
                  </div>
                ))}
                <div className="flex justify-between font-medium pt-1 border-t border-dashed">
                  <span>Итого услуг:</span>
                  <span>{servicesTotal.toLocaleString()} ₸</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Общий итог:</span>
              <span className="font-semibold">{grandTotal.toLocaleString()} ₸</span>
            </div>
            {prepayment > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Предоплата:</span>
                <span>−{prepayment.toLocaleString()} ₸</span>
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
