import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInDays, parseISO, format, isBefore, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { User, Calendar, Phone, BedDouble, CreditCard, Receipt, ShoppingCart, LogOut, AlertTriangle } from 'lucide-react';
import { BookingServicesTab } from './BookingServicesTab';

type BookingStatus = 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'cancelled';

interface BookingDetails {
  id: string;
  guest_name: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  source: string;
  prepayment_amount: number | null;
  prepayment_received: boolean;
  daily_rate: number | null;
  guest_count: number;
  guest_comment: string | null;
  room_id: string | null;
  room_type_id: string | null;
  rooms: { room_number: string } | null;
  room_types: { name: string; price_per_night: number } | null;
  is_half_day?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  hotelId: string;
  onUpdate?: () => void;
}

const statusColors: Record<BookingStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500',
  approved: 'bg-blue-500/20 text-blue-700 border-blue-500',
  checked_in: 'bg-green-500/20 text-green-700 border-green-500',
  checked_out: 'bg-muted text-muted-foreground border-muted-foreground/30',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500',
};

const statusLabels: Record<BookingStatus, string> = {
  pending: 'Ожидает',
  approved: 'Подтверждено',
  checked_in: 'Заселён',
  checked_out: 'Выселен',
  cancelled: 'Отменено',
};

export function BookingDetailModal({ open, onOpenChange, bookingId, hotelId, onUpdate }: Props) {
  const { t } = useTranslation();
  const { user, profile, isOwner } = useAuth();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [servicesTotal, setServicesTotal] = useState(0);
  
  // Prepayment editing
  const [prepaymentValue, setPrepaymentValue] = useState('');
  const [savingPrepayment, setSavingPrepayment] = useState(false);

  // Checkout state
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState('');
  const [checkoutReason, setCheckoutReason] = useState('');
  const [processingCheckout, setProcessingCheckout] = useState(false);

  useEffect(() => {
    if (open && bookingId) {
      fetchBooking();
    }
  }, [open, bookingId]);

  const fetchBooking = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, guest_name, guest_phone, check_in_date, check_out_date,
        status, source, prepayment_amount, prepayment_received, daily_rate,
        guest_count, guest_comment, room_id, room_type_id, is_half_day,
        rooms(room_number),
        room_types(name, price_per_night)
      `)
      .eq('id', bookingId)
      .single();

    if (data) {
      setBooking(data as BookingDetails);
      setPrepaymentValue((data.prepayment_amount ?? 0).toString());
    }
    if (error) console.error('Error fetching booking:', error);
    setLoading(false);
  };

  const handleSavePrepayment = async () => {
    if (!booking) return;

    const amount = parseFloat(prepaymentValue) || 0;
    setSavingPrepayment(true);

    const { error } = await supabase
      .from('bookings')
      .update({
        prepayment_amount: amount,
        prepayment_received: amount > 0,
      })
      .eq('id', booking.id);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Предоплата сохранена');
      fetchBooking();
      onUpdate?.();
    }

    setSavingPrepayment(false);
  };

  // Calculate totals
  const nights = booking
    ? differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date))
    : 0;

  const dailyRate = booking?.daily_rate ?? booking?.room_types?.price_per_night ?? 0;
  const stayTotal = nights * dailyRate;
  const grandTotal = stayTotal + servicesTotal;
  const prepayment = parseFloat(prepaymentValue) || 0;
  const balanceDue = grandTotal - prepayment;

  // Check if booking is overdue
  const isOverdue = booking?.status === 'checked_in' && 
    isBefore(parseISO(booking.check_out_date), startOfDay(new Date()));

  // Open checkout dialog
  const handleStartCheckout = () => {
    setCheckoutAmount(grandTotal.toString());
    setCheckoutReason('');
    setCheckoutDialogOpen(true);
  };

  // Confirm checkout
  const handleConfirmCheckout = async () => {
    if (!booking || !user) return;
    setProcessingCheckout(true);

    const finalAmount = parseFloat(checkoutAmount) || 0;
    const amountChanged = finalAmount !== grandTotal;

    // If amount was changed, log adjustment for owner
    if (amountChanged) {
      await supabase.from('checkout_adjustments' as any).insert({
        booking_id: booking.id,
        hotel_id: hotelId,
        original_total: grandTotal,
        adjusted_total: finalAmount,
        reason: checkoutReason || 'Сумма изменена при выселении',
        adjusted_by: user.id,
        adjusted_by_name: profile?.full_name || '',
        status: 'pending',
      });

      logAdminAction({
        hotelId,
        userId: user.id,
        userName: profile?.full_name || '',
        action: 'checkout_amount_adjusted',
        entityType: 'booking',
        entityId: booking.id,
        details: {
          guest_name: booking.guest_name,
          original_total: grandTotal,
          adjusted_total: finalAmount,
          reason: checkoutReason,
        },
      });
    }

    // Update booking status
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status: 'checked_out',
        final_total: finalAmount,
        daily_rate: dailyRate,
      })
      .eq('id', booking.id);

    if (bookingError) {
      toast.error(t('common.error'));
      setProcessingCheckout(false);
      return;
    }

    // Release room
    if (booking.room_id) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', booking.room_id);
    }

    // Release multi-rooms
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

    logAdminAction({
      hotelId,
      userId: user.id,
      userName: profile?.full_name || '',
      action: 'booking_checked_out',
      entityType: 'booking',
      entityId: booking.id,
      details: { guest_name: booking.guest_name, final_total: finalAmount },
    });

    toast.success('Гость выселен');
    setProcessingCheckout(false);
    setCheckoutDialogOpen(false);
    onOpenChange(false);
    onUpdate?.();
  };

  if (loading || !booking) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {booking.guest_name}
              <Badge className={statusColors[booking.status]} variant="outline">
                {statusLabels[booking.status]}
              </Badge>
              {booking.is_half_day && (
                <Badge variant="secondary" className="text-xs">Полсуток</Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Просрочен
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Информация</TabsTrigger>
              <TabsTrigger value="services">
                <ShoppingCart className="h-4 w-4 mr-1" />
                Услуги
              </TabsTrigger>
              <TabsTrigger value="bill">
                <Receipt className="h-4 w-4 mr-1" />
                Счёт
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Телефон</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{booking.guest_phone}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Гостей</Label>
                  <span>{booking.guest_count}</span>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Заезд (с 12:00)</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(parseISO(booking.check_in_date), 'dd MMMM yyyy', { locale: ru })}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    {booking.is_half_day ? 'Выезд (до 00:00)' : 'Выезд (до 12:00)'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {booking.is_half_day
                        ? format(parseISO(booking.check_in_date), 'dd MMMM yyyy', { locale: ru }) + ' (полсуток)'
                        : format(parseISO(booking.check_out_date), 'dd MMMM yyyy', { locale: ru })
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Номер</Label>
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {booking.rooms?.room_number ? `№ ${booking.rooms.room_number}` : 'Не назначен'}
                    {booking.room_types?.name && ` — ${booking.room_types.name}`}
                  </span>
                </div>
              </div>

              {booking.guest_comment && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Комментарий</Label>
                  <p className="text-sm p-2 bg-muted/50 rounded">{booking.guest_comment}</p>
                </div>
              )}

              <Separator />

              {/* Prepayment Edit */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Предоплата
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={prepaymentValue}
                    onChange={(e) => setPrepaymentValue(e.target.value)}
                    placeholder="0"
                    className="w-40"
                  />
                  <span className="flex items-center text-muted-foreground">₸</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSavePrepayment}
                    disabled={savingPrepayment}
                  >
                    {savingPrepayment ? '...' : 'Сохранить'}
                  </Button>
                </div>
              </div>

              {/* Checkout button for checked_in bookings */}
              {booking.status === 'checked_in' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {isOverdue && (
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">
                          Дата выезда прошла. Необходимо выселить гостя или продлить бронирование.
                        </p>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      variant={isOverdue ? 'destructive' : 'default'}
                      onClick={handleStartCheckout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Выселить гостя
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="mt-4">
              <BookingServicesTab
                hotelId={hotelId}
                bookingId={bookingId}
                onTotalChange={setServicesTotal}
              />
            </TabsContent>

            {/* Bill Preview Tab */}
            <TabsContent value="bill" className="space-y-4 mt-4">
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Проживание ({nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'} × {dailyRate.toLocaleString()} ₸)
                  </span>
                  <span className="font-medium">{stayTotal.toLocaleString()} ₸</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Услуги</span>
                  <span className="font-medium">{servicesTotal.toLocaleString()} ₸</span>
                </div>

                <Separator />

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

                <div className="flex justify-between p-3 bg-primary/10 rounded-lg">
                  <span className="font-semibold">Баланс к оплате:</span>
                  <span className="text-xl font-bold">{balanceDue.toLocaleString()} ₸</span>
                </div>
              </div>

              {/* Checkout from bill tab too */}
              {booking.status === 'checked_in' && (
                <Button
                  className="w-full"
                  variant={isOverdue ? 'destructive' : 'default'}
                  onClick={handleStartCheckout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Выселить гостя
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Checkout Confirmation Dialog */}
      <AlertDialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выселение гостя</AlertDialogTitle>
            <AlertDialogDescription>
              Гость: <strong>{booking.guest_name}</strong>
              <br />
              Номер будет освобождён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">Итоговая сумма (₸)</Label>
              <Input
                type="number"
                value={checkoutAmount}
                onChange={(e) => setCheckoutAmount(e.target.value)}
              />
              {parseFloat(checkoutAmount) !== grandTotal && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Сумма изменена (было: {grandTotal.toLocaleString()} ₸). Изменение будет отправлено владельцу.
                </p>
              )}
            </div>
            {parseFloat(checkoutAmount) !== grandTotal && (
              <div className="space-y-1">
                <Label className="text-sm">Причина изменения</Label>
                <Textarea
                  value={checkoutReason}
                  onChange={(e) => setCheckoutReason(e.target.value)}
                  placeholder="Укажите причину изменения суммы..."
                  rows={2}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCheckout} disabled={processingCheckout}>
              {processingCheckout ? '...' : 'Подтвердить выселение'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
