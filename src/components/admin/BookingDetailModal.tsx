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
import { User, Calendar, Phone, BedDouble, CreditCard, Receipt, ShoppingCart, LogOut, AlertTriangle, CalendarPlus, ArrowRightLeft } from 'lucide-react';
import { BookingServicesTab } from './BookingServicesTab';
import { RoomAssignDialog } from './RoomAssignDialog';

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
  room_types: { name: string; price_per_night: number; price_half_day?: number | null } | null;
  is_half_day?: boolean;
  // All assigned rooms (from booking_rooms + room_id)
  allRooms: { id: string; room_number: string; room_type_name: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingIds: string[];
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

export function BookingDetailModal({ open, onOpenChange, bookingIds, hotelId, onUpdate }: Props) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [allBookings, setAllBookings] = useState<BookingDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicesTotals, setServicesTotals] = useState<Record<string, number>>({});
  
  // Prepayment editing (per-booking)
  const [prepaymentValues, setPrepaymentValues] = useState<Record<string, string>>({});
  const [savingPrepayment, setSavingPrepayment] = useState(false);

  // Checkout state
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState('');
  const [checkoutReason, setCheckoutReason] = useState('');
  const [processingCheckout, setProcessingCheckout] = useState(false);

  // Extend stay state
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendBookingId, setExtendBookingId] = useState<string | null>(null);
  const [newCheckoutDate, setNewCheckoutDate] = useState('');
  const [processingExtend, setProcessingExtend] = useState(false);

  // Room change state
  const [roomChangeDialogOpen, setRoomChangeDialogOpen] = useState(false);
  const [roomChangeBookingId, setRoomChangeBookingId] = useState<string | null>(null);

  const isMulti = bookingIds.length > 1;
  const primary = allBookings[0] || null;

  useEffect(() => {
    if (open && bookingIds.length > 0) {
      fetchBookings();
    }
  }, [open, bookingIds]);

  const fetchBookings = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, guest_name, guest_phone, check_in_date, check_out_date,
        status, source, prepayment_amount, prepayment_received, daily_rate,
        guest_count, guest_comment, room_id, room_type_id, is_half_day,
        rooms(room_number),
        room_types(name, price_per_night, price_half_day)
      `)
      .in('id', bookingIds);

    if (data) {
      // Fetch all booking_rooms for these bookings
      const { data: allBookingRooms } = await supabase
        .from('booking_rooms')
        .select('booking_id, room_id, rooms:room_id(id, room_number, room_type_id, room_types(name))')
        .in('booking_id', bookingIds);

      const bookingRoomsMap = new Map<string, { id: string; room_number: string; room_type_name: string }[]>();
      (allBookingRooms || []).forEach((br: any) => {
        if (!bookingRoomsMap.has(br.booking_id)) bookingRoomsMap.set(br.booking_id, []);
        const room = br.rooms;
        if (room) {
          bookingRoomsMap.get(br.booking_id)!.push({
            id: room.id,
            room_number: room.room_number,
            room_type_name: room.room_types?.name || '',
          });
        }
      });

      const enriched = data.map((b: any) => {
        const multiRooms = bookingRoomsMap.get(b.id) || [];
        // If no booking_rooms but has room_id, use that
        if (multiRooms.length === 0 && b.room_id && b.rooms) {
          multiRooms.push({
            id: b.room_id,
            room_number: b.rooms.room_number,
            room_type_name: b.room_types?.name || '',
          });
        }
        return { ...b, allRooms: multiRooms } as BookingDetails;
      });

      setAllBookings(enriched);
      const prepVals: Record<string, string> = {};
      enriched.forEach(b => {
        prepVals[b.id] = (b.prepayment_amount ?? 0).toString();
      });
      setPrepaymentValues(prepVals);
    }
    if (error) console.error('Error fetching bookings:', error);
    setLoading(false);
  };

  const handleSavePrepayment = async (bookingId: string) => {
    const amount = parseFloat(prepaymentValues[bookingId]) || 0;
    setSavingPrepayment(true);

    const { error } = await supabase
      .from('bookings')
      .update({
        prepayment_amount: amount,
        prepayment_received: amount > 0,
      })
      .eq('id', bookingId);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Предоплата сохранена');
      fetchBookings();
      onUpdate?.();
    }

    setSavingPrepayment(false);
  };

  // Calculate per-booking totals
  const getBookingCalc = (booking: BookingDetails) => {
    const nights = differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date));
    const dailyRate = booking.is_half_day
      ? (booking.room_types?.price_half_day ?? (booking.room_types?.price_per_night ?? 0) / 2)
      : (booking.daily_rate ?? booking.room_types?.price_per_night ?? 0);
    const roomCount = Math.max(booking.allRooms.length, 1);
    const stayTotal = booking.is_half_day ? dailyRate * roomCount : nights * dailyRate * roomCount;
    const servicesTotal = servicesTotals[booking.id] || 0;
    const total = stayTotal + servicesTotal;
    const prepayment = parseFloat(prepaymentValues[booking.id]) || 0;
    return { nights, dailyRate, roomCount, stayTotal, servicesTotal, total, prepayment };
  };

  // Grand totals across all bookings
  const grandCalc = allBookings.reduce(
    (acc, b) => {
      const c = getBookingCalc(b);
      acc.stayTotal += c.stayTotal;
      acc.servicesTotal += c.servicesTotal;
      acc.total += c.total;
      acc.prepayment += c.prepayment;
      return acc;
    },
    { stayTotal: 0, servicesTotal: 0, total: 0, prepayment: 0 }
  );
  const balanceDue = grandCalc.total - grandCalc.prepayment;

  // Check if any booking is overdue
  const hasOverdue = allBookings.some(
    b => b.status === 'checked_in' && isBefore(parseISO(b.check_out_date), startOfDay(new Date()))
  );

  // Check if dates differ across bookings
  const hasDifferentDates = allBookings.length > 1 && allBookings.some(
    b => b.check_in_date !== allBookings[0].check_in_date || b.check_out_date !== allBookings[0].check_out_date
  );

  // Open checkout dialog
  const handleStartCheckout = () => {
    setCheckoutAmount(grandCalc.total.toString());
    setCheckoutReason('');
    setCheckoutDialogOpen(true);
  };

  // Confirm checkout for ALL bookings in group
  const handleConfirmCheckout = async () => {
    if (!primary || !user) return;
    setProcessingCheckout(true);

    const finalAmount = parseFloat(checkoutAmount) || 0;
    const amountChanged = finalAmount !== grandCalc.total;

    if (amountChanged) {
      await supabase.from('checkout_adjustments' as any).insert({
        booking_id: primary.id,
        hotel_id: hotelId,
        original_total: grandCalc.total,
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
        entityId: primary.id,
        details: {
          guest_name: primary.guest_name,
          original_total: grandCalc.total,
          adjusted_total: finalAmount,
          reason: checkoutReason,
          booking_count: allBookings.length,
        },
      });
    }

    // Update all bookings and release all rooms
    for (const booking of allBookings) {
      if (booking.status !== 'checked_in') continue;

      const bCalc = getBookingCalc(booking);
      await supabase
        .from('bookings')
        .update({
          status: 'checked_out',
          final_total: amountChanged ? undefined : bCalc.total,
          daily_rate: bCalc.dailyRate,
        })
        .eq('id', booking.id);

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
    }

    logAdminAction({
      hotelId,
      userId: user.id,
      userName: profile?.full_name || '',
      action: 'booking_checked_out',
      entityType: 'booking',
      entityId: primary.id,
      details: { guest_name: primary.guest_name, final_total: finalAmount, booking_count: allBookings.length },
    });

    toast.success('Гость выселен');
    setProcessingCheckout(false);
    setCheckoutDialogOpen(false);
    onOpenChange(false);
    onUpdate?.();
  };

  // Extend stay for a specific booking
  const handleExtendStay = async () => {
    if (!extendBookingId || !user || !newCheckoutDate) return;
    setProcessingExtend(true);

    const booking = allBookings.find(b => b.id === extendBookingId);
    if (!booking) return;

    const { error } = await supabase
      .from('bookings')
      .update({ check_out_date: newCheckoutDate })
      .eq('id', extendBookingId);

    if (error) {
      toast.error(t('common.error'));
    } else {
      logAdminAction({
        hotelId,
        userId: user.id,
        userName: profile?.full_name || '',
        action: 'booking_extended',
        entityType: 'booking',
        entityId: extendBookingId,
        details: {
          guest_name: booking.guest_name,
          old_checkout: booking.check_out_date,
          new_checkout: newCheckoutDate,
        },
      });
      toast.success('Бронирование продлено');
      setExtendDialogOpen(false);
      fetchBookings();
      onUpdate?.();
    }
    setProcessingExtend(false);
  };

  if (loading || allBookings.length === 0) {
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
              {primary.guest_name}
              <Badge className={statusColors[primary.status]} variant="outline">
                {statusLabels[primary.status]}
              </Badge>
              {(() => {
                const totalRooms = isMulti
                  ? allBookings.reduce((s, b) => s + Math.max(b.allRooms.length, 1), 0)
                  : primary.allRooms.length;
                return totalRooms > 1 ? (
                  <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                    <BedDouble className="h-3 w-3 mr-1" />
                    {totalRooms} номеров
                  </Badge>
                ) : null;
              })()}
              {hasOverdue && (
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
                    <span>{primary.guest_phone}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Гостей</Label>
                  <span>{allBookings.reduce((s, b) => s + b.guest_count, 0)}</span>
                </div>
              </div>

              <Separator />

              {/* Per-room details */}
              {allBookings.map((booking, idx) => {
                const bOverdue = booking.status === 'checked_in' && 
                  isBefore(parseISO(booking.check_out_date), startOfDay(new Date()));
                const calc = getBookingCalc(booking);
                const roomsToShow = booking.allRooms.length > 0 ? booking.allRooms : [null];

                return (
                  <div key={booking.id} className="space-y-3">
                    {/* Each room as a separate block */}
                    {roomsToShow.map((room, rIdx) => (
                      <div key={room?.id || `unassigned-${rIdx}`} className="p-3 border rounded-lg space-y-3 bg-muted/20">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <BedDouble className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">
                              {room ? `№ ${room.room_number} (${room.room_type_name})` : 'Номер не назначен'}
                            </span>
                            {bOverdue && (
                              <Badge variant="destructive" className="text-xs animate-pulse">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Просрочен
                              </Badge>
                            )}
                            {booking.is_half_day && (
                              <Badge variant="secondary" className="text-xs">Полсуток</Badge>
                            )}
                          </div>
                          {['approved', 'checked_in'].includes(booking.status) && room && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => {
                                setRoomChangeBookingId(booking.id);
                                setRoomChangeDialogOpen(true);
                              }}
                            >
                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                              Сменить номер
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-muted-foreground text-xs">Заезд</Label>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className={hasDifferentDates ? 'font-medium text-amber-600' : ''}>
                                {format(parseISO(booking.check_in_date), 'dd MMMM yyyy', { locale: ru })}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-muted-foreground text-xs">
                              {booking.is_half_day ? 'Выезд (до 00:00)' : 'Выезд (до 12:00)'}
                            </Label>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className={hasDifferentDates ? 'font-medium text-amber-600' : ''}>
                                {booking.is_half_day
                                  ? format(parseISO(booking.check_in_date), 'dd MMMM yyyy', { locale: ru }) + ' (полсуток)'
                                  : format(parseISO(booking.check_out_date), 'dd MMMM yyyy', { locale: ru })
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Extend button per room for checked_in - only show once per booking on first room */}
                        {rIdx === 0 && booking.status === 'checked_in' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setExtendBookingId(booking.id);
                              setNewCheckoutDate(booking.check_out_date);
                              setExtendDialogOpen(true);
                            }}
                          >
                            <CalendarPlus className="h-4 w-4 mr-1" />
                            Продлить
                          </Button>
                        )}
                      </div>
                    ))}

                    {booking.guest_comment && (
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Комментарий</Label>
                        <p className="text-sm p-2 bg-muted/50 rounded">{booking.guest_comment}</p>
                      </div>
                    )}

                    {/* Prepayment per booking */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Предоплата{isMulti ? ` (${booking.rooms?.room_number || `#${idx + 1}`})` : ''}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={prepaymentValues[booking.id] || ''}
                          onChange={(e) => setPrepaymentValues(prev => ({ ...prev, [booking.id]: e.target.value }))}
                          placeholder="0"
                          className="w-40"
                        />
                        <span className="flex items-center text-muted-foreground">₸</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSavePrepayment(booking.id)}
                          disabled={savingPrepayment}
                        >
                          {savingPrepayment ? '...' : 'Сохранить'}
                        </Button>
                      </div>
                    </div>

                    {idx < allBookings.length - 1 && <Separator />}
                  </div>
                );
              })}

              {/* Checkout button for checked_in bookings */}
              {allBookings.some(b => b.status === 'checked_in') && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {hasOverdue && (
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">
                          Дата выезда прошла. Необходимо выселить гостя или продлить бронирование.
                        </p>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      variant={hasOverdue ? 'destructive' : 'default'}
                      onClick={handleStartCheckout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Выселить{isMulti ? ' (все номера)' : ''}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="mt-4 space-y-6">
              {allBookings.map((booking, idx) => (
                <div key={booking.id}>
                  {(isMulti || booking.allRooms.length > 1) && (
                    <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-primary" />
                      {booking.allRooms.length > 0 ? booking.allRooms.map(r => `№ ${r.room_number}`).join(', ') : `Номер ${idx + 1}`}
                      {booking.room_types?.name && ` — ${booking.room_types.name}`}
                    </h3>
                  )}
                  <BookingServicesTab
                    hotelId={hotelId}
                    bookingId={booking.id}
                    onTotalChange={(total) => setServicesTotals(prev => ({ ...prev, [booking.id]: total }))}
                  />
                  {idx < allBookings.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </TabsContent>

            {/* Bill Tab */}
            <TabsContent value="bill" className="space-y-4 mt-4">
              <div className="p-4 border rounded-lg space-y-4">
                {/* Per-room breakdown */}
                {allBookings.map((booking, idx) => {
                  const calc = getBookingCalc(booking);
                  return (
                    <div key={booking.id} className="space-y-2">
                      {(isMulti || booking.allRooms.length > 1) && (
                        <p className="font-medium text-sm flex items-center gap-2">
                          <BedDouble className="h-4 w-4 text-primary" />
                          {booking.allRooms.length > 0 ? booking.allRooms.map(r => `№ ${r.room_number}`).join(', ') : `Номер ${idx + 1}`}
                          {booking.room_types?.name && ` — ${booking.room_types.name}`}
                        </p>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Проживание ({calc.roomCount > 1 ? `${calc.roomCount} ном. × ` : ''}{calc.nights} {calc.nights === 1 ? 'ночь' : calc.nights < 5 ? 'ночи' : 'ночей'} × {calc.dailyRate.toLocaleString()} ₸)
                        </span>
                        <span>{calc.stayTotal.toLocaleString()} ₸</span>
                      </div>
                      {calc.servicesTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Услуги</span>
                          <span>{calc.servicesTotal.toLocaleString()} ₸</span>
                        </div>
                      )}
                      {calc.prepayment > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Предоплата</span>
                          <span>−{calc.prepayment.toLocaleString()} ₸</span>
                        </div>
                      )}
                      {isMulti && (
                        <div className="flex justify-between text-sm font-medium">
                          <span>Итого по номеру</span>
                          <span>{(calc.total - calc.prepayment).toLocaleString()} ₸</span>
                        </div>
                      )}
                      {idx < allBookings.length - 1 && <Separator className="my-2" />}
                    </div>
                  );
                })}

                <Separator />

                {/* Grand totals */}
                <div className="flex justify-between">
                  <span>Проживание:</span>
                  <span className="font-medium">{grandCalc.stayTotal.toLocaleString()} ₸</span>
                </div>
                {grandCalc.servicesTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Услуги:</span>
                    <span className="font-medium">{grandCalc.servicesTotal.toLocaleString()} ₸</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Общий итог:</span>
                  <span className="font-semibold">{grandCalc.total.toLocaleString()} ₸</span>
                </div>

                {grandCalc.prepayment > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Предоплата:</span>
                    <span>−{grandCalc.prepayment.toLocaleString()} ₸</span>
                  </div>
                )}

                <div className="flex justify-between p-3 bg-primary/10 rounded-lg">
                  <span className="font-semibold">Баланс к оплате:</span>
                  <span className="text-xl font-bold">{balanceDue.toLocaleString()} ₸</span>
                </div>
              </div>

              {/* Checkout from bill tab */}
              {allBookings.some(b => b.status === 'checked_in') && (
                <Button
                  className="w-full"
                  variant={hasOverdue ? 'destructive' : 'default'}
                  onClick={handleStartCheckout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Выселить гостя{isMulti ? ' (все номера)' : ''}
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
              Гость: <strong>{primary?.guest_name}</strong>
              {isMulti && <><br />Номеров: <strong>{allBookings.length}</strong></>}
              <br />
              {isMulti ? 'Все номера будут освобождены.' : 'Номер будет освобождён.'}
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
              {parseFloat(checkoutAmount) !== grandCalc.total && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Сумма изменена (было: {grandCalc.total.toLocaleString()} ₸). Изменение будет отправлено владельцу.
                </p>
              )}
            </div>
            {parseFloat(checkoutAmount) !== grandCalc.total && (
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

      {/* Extend Stay Dialog */}
      <AlertDialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Продление проживания</AlertDialogTitle>
            <AlertDialogDescription>
              Гость: <strong>{primary?.guest_name}</strong>
              {extendBookingId && (() => {
                const b = allBookings.find(x => x.id === extendBookingId);
                return b ? (
                  <>
                    <br />
                    {b.rooms?.room_number && `Номер: ${b.rooms.room_number}`}
                    <br />
                    Текущая дата выезда: {format(parseISO(b.check_out_date), 'dd MMMM yyyy', { locale: ru })}
                  </>
                ) : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">Новая дата выезда</Label>
              <Input
                type="date"
                value={newCheckoutDate}
                onChange={(e) => setNewCheckoutDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtendStay} disabled={processingExtend || !newCheckoutDate}>
              {processingExtend ? '...' : 'Подтвердить продление'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Room Change Dialog */}
      {roomChangeBookingId && (() => {
        const changingBooking = allBookings.find(b => b.id === roomChangeBookingId);
        return (
          <RoomAssignDialog
            open={roomChangeDialogOpen}
            onOpenChange={setRoomChangeDialogOpen}
            bookingId={roomChangeBookingId}
            hotelId={hotelId}
            roomTypeId={changingBooking?.room_type_id}
            checkInDate={changingBooking?.check_in_date}
            checkOutDate={changingBooking?.check_out_date}
            multiRoom={true}
            onSuccess={async () => {
              // Get old room info for logging
              const oldRooms = changingBooking?.allRooms.map(r => r.room_number).join(', ') || 'не назначен';
              
              // Release old rooms
              if (changingBooking?.allRooms && changingBooking.allRooms.length > 0) {
                const oldStatus = changingBooking.status === 'checked_in' ? 'available' : 'available';
                await supabase
                  .from('rooms')
                  .update({ status: oldStatus as any })
                  .in('id', changingBooking.allRooms.map(r => r.id));
              }

              // Log room change for owner notification
              if (user) {
                logAdminAction({
                  hotelId,
                  userId: user.id,
                  userName: profile?.full_name || '',
                  action: 'room_changed',
                  entityType: 'booking',
                  entityId: roomChangeBookingId,
                  details: {
                    guest_name: changingBooking?.guest_name,
                    old_rooms: oldRooms,
                    status: changingBooking?.status,
                  },
                });
              }

              fetchBookings();
              onUpdate?.();
              setRoomChangeBookingId(null);
            }}
          />
        );
      })()}
    </>
  );
}
