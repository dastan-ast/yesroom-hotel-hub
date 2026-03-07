import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInDays, parseISO, format } from 'date-fns';
import { calculateStayPrice } from '@/lib/pricingUtils';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Receipt, User, Calendar, BedDouble, CheckCircle, Percent, Minus } from 'lucide-react';

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
  const { user, profile } = useAuth();
  const [allBookings, setAllBookings] = useState<BookingDetails[]>([]);
  const [allServices, setAllServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Discount state
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('');

  // Adjustment state
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    if (open && bookingIds.length > 0) {
      fetchData();
      setDiscountEnabled(false);
      setDiscountValue('');
      setDiscountType('percent');
      setAdjustmentReason('');
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

  const getBookingCalc = (booking: BookingDetails) => {
    const nights = differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date));
    const dailyRate = booking.daily_rate ?? booking.room_types?.price_per_night ?? 0;
    const stayTotal = nights * dailyRate;
    const bookingServices = allServices.filter(s => s.booking_id === booking.id);
    const servicesTotal = bookingServices.reduce((sum, s) => sum + (s.total_price || 0), 0);
    return { nights, dailyRate, stayTotal, servicesTotal, total: stayTotal + servicesTotal };
  };

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

  // Calculate discount
  const parsedDiscountValue = parseFloat(discountValue) || 0;
  let discountAmount = 0;
  if (discountEnabled && parsedDiscountValue > 0) {
    if (discountType === 'percent') {
      discountAmount = Math.round(grandTotals.total * (Math.min(parsedDiscountValue, 100) / 100));
    } else {
      discountAmount = Math.min(parsedDiscountValue, grandTotals.total);
    }
  }

  const totalAfterDiscount = grandTotals.total - discountAmount;
  const balanceDue = totalAfterDiscount - grandTotals.prepayment;
  const hasAdjustment = discountAmount > 0;

  const handleConfirmCheckout = async () => {
    if (allBookings.length === 0) return;

    // If there's a discount, require a reason
    if (hasAdjustment && !adjustmentReason.trim()) {
      toast.error('Укажите причину скидки');
      return;
    }

    setProcessing(true);

    for (const booking of allBookings) {
      const calc = getBookingCalc(booking);

      // Proportional discount per booking
      const bookingShare = grandTotals.total > 0 ? calc.total / grandTotals.total : 0;
      const bookingDiscount = Math.round(discountAmount * bookingShare);
      const bookingFinalTotal = calc.total - bookingDiscount;

      // If adjusted, save to checkout_adjustments for owner review
      if (hasAdjustment) {
        await supabase.from('checkout_adjustments').insert({
          booking_id: booking.id,
          hotel_id: hotelId,
          original_total: calc.total,
          adjusted_total: bookingFinalTotal,
          adjusted_by: user?.id || '',
          adjusted_by_name: profile?.full_name || 'Сотрудник',
          reason: adjustmentReason.trim(),
          status: 'pending',
        });
      }

      // Update booking: use original total by default, owner approval will update later
      await supabase
        .from('bookings')
        .update({
          status: 'checked_out',
          final_total: hasAdjustment ? calc.total : calc.total, // always original until approved
          daily_rate: calc.dailyRate,
        })
        .eq('id', booking.id);

      // Release room
      if (booking.room_id) {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', booking.room_id);
      }

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

    toast.success(hasAdjustment ? 'Гость выселен. Скидка отправлена на одобрение владельцу.' : 'Гость выселен');
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BedDouble className="h-4 w-4 text-primary" />
                    {booking.rooms
                      ? `№ ${booking.rooms.room_number} ${booking.room_types?.name ? `(${booking.room_types.name})` : ''}`
                      : 'Номер не назначен'}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {format(parseISO(booking.check_in_date), 'dd MMMM', { locale: ru })} —{' '}
                    {format(parseISO(booking.check_out_date), 'dd MMMM yyyy', { locale: ru })}
                    <span className="ml-1">({calc.nights} {calc.nights === 1 ? 'ночь' : calc.nights < 5 ? 'ночи' : 'ночей'})</span>
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>
                    {calc.nights} {calc.nights === 1 ? 'ночь' : calc.nights < 5 ? 'ночи' : 'ночей'} × {calc.dailyRate.toLocaleString()} ₸
                  </span>
                  <span className="font-medium">{calc.stayTotal.toLocaleString()} ₸</span>
                </div>

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
          </div>

          <Separator />

          {/* Discount Section */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center justify-between">
              <Label htmlFor="discount-toggle" className="text-sm font-medium cursor-pointer">
                Применить скидку
              </Label>
              <Switch
                id="discount-toggle"
                checked={discountEnabled}
                onCheckedChange={setDiscountEnabled}
              />
            </div>

            {discountEnabled && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={discountType === 'percent' ? 'default' : 'outline'}
                    onClick={() => setDiscountType('percent')}
                    className="flex-1"
                  >
                    <Percent className="h-3.5 w-3.5 mr-1" />
                    Процент
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={discountType === 'fixed' ? 'default' : 'outline'}
                    onClick={() => setDiscountType('fixed')}
                    className="flex-1"
                  >
                    <Minus className="h-3.5 w-3.5 mr-1" />
                    Сумма ₸
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? '100' : String(grandTotals.total)}
                    placeholder={discountType === 'percent' ? 'Введите %' : 'Введите сумму'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-8 text-right">
                    {discountType === 'percent' ? '%' : '₸'}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Скидка:</span>
                    <span>−{discountAmount.toLocaleString()} ₸</span>
                  </div>
                )}

                <Textarea
                  placeholder="Причина скидки (обязательно)..."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            )}
          </div>

          {/* Prepayment */}
          {grandTotals.prepayment > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Предоплата:</span>
              <span>−{grandTotals.prepayment.toLocaleString()} ₸</span>
            </div>
          )}

          {/* Balance Due */}
          <div className="p-4 bg-primary/10 rounded-lg space-y-1">
            {hasAdjustment && (
              <div className="flex justify-between text-sm">
                <span>Итого со скидкой:</span>
                <span className="font-medium">{totalAfterDiscount.toLocaleString()} ₸</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-semibold">Баланс к оплате:</span>
              <span className="text-2xl font-bold">{balanceDue.toLocaleString()} ₸</span>
            </div>
            {hasAdjustment && (
              <p className="text-xs text-muted-foreground">
                ⚠ Скидка будет отправлена на одобрение владельцу. До подтверждения в аналитику попадёт полная сумма.
              </p>
            )}
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
