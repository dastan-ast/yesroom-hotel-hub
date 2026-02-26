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
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { User, Calendar, Phone, BedDouble, CreditCard, Receipt, ShoppingCart, LogOut, AlertTriangle, CalendarPlus, ArrowRightLeft, LogIn, Clock, CheckCircle } from 'lucide-react';
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
  room_types: { name: string; price_per_night: number; price_half_day?: number | null } | null;
  is_half_day?: boolean;
  allRooms: { id: string; room_number: string; room_type_name: string }[];
}

interface InlineRoom {
  id: string;
  room_number: string;
  floor: number;
  room_types: { name: string } | null;
  hasConflict?: boolean;
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

  // Discount state
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  // Extend stay state
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendBookingId, setExtendBookingId] = useState<string | null>(null);
  const [newCheckoutDate, setNewCheckoutDate] = useState('');
  const [processingExtend, setProcessingExtend] = useState(false);

  // Inline room assignment state
  const [inlineRooms, setInlineRooms] = useState<InlineRoom[]>([]);
  const [inlineSelectedRoom, setInlineSelectedRoom] = useState<string | null>(null);
  const [loadingInlineRooms, setLoadingInlineRooms] = useState(false);
  const [assigningRoom, setAssigningRoom] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Room change mode - which booking is changing rooms
  const [roomChangeBookingId, setRoomChangeBookingId] = useState<string | null>(null);

  const isMulti = bookingIds.length > 1;
  const primary = allBookings[0] || null;

  useEffect(() => {
    if (open && bookingIds.length > 0) {
      fetchBookings();
    }
    if (!open) {
      setRoomChangeBookingId(null);
      setInlineSelectedRoom(null);
      setInlineRooms([]);
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

      // Auto-load rooms for bookings needing assignment
      const needsRoom = enriched.find(b => 
        ['pending', 'approved'].includes(b.status) && b.allRooms.length === 0
      );
      if (needsRoom) {
        fetchInlineRooms(needsRoom);
      }
    }
    if (error) console.error('Error fetching bookings:', error);
    setLoading(false);
  };

  // Fetch available rooms inline
  const fetchInlineRooms = async (booking: BookingDetails) => {
    setLoadingInlineRooms(true);
    setInlineSelectedRoom(null);

    let query = supabase
      .from('rooms')
      .select('id, room_number, floor, room_types(name), status')
      .eq('hotel_id', hotelId)
      .neq('status', 'maintenance')
      .order('floor')
      .order('room_number');

    if (booking.room_type_id) {
      query = query.eq('room_type_id', booking.room_type_id);
    }

    const { data: allRooms } = await query;

    if (!allRooms) {
      setInlineRooms([]);
      setLoadingInlineRooms(false);
      return;
    }

    const { data: conflictingBookings } = await supabase
      .from('bookings')
      .select('room_id')
      .eq('hotel_id', hotelId)
      .neq('id', booking.id)
      .not('room_id', 'is', null)
      .in('status', ['approved', 'checked_in'])
      .lt('check_in_date', booking.check_out_date)
      .gt('check_out_date', booking.check_in_date);

    const { data: conflictingBookingRooms } = await supabase
      .from('booking_rooms')
      .select('room_id, bookings!inner(check_in_date, check_out_date, status)')
      .eq('hotel_id', hotelId)
      .neq('booking_id', booking.id);

    const conflictingRoomIds = new Set<string>();
    (conflictingBookings || []).forEach((b: any) => {
      if (b.room_id) conflictingRoomIds.add(b.room_id);
    });
    (conflictingBookingRooms || []).forEach((br: any) => {
      const b = br.bookings;
      if (!b) return;
      if (!['approved', 'checked_in'].includes(b.status)) return;
      if (b.check_in_date < booking.check_out_date && b.check_out_date > booking.check_in_date) {
        conflictingRoomIds.add(br.room_id);
      }
    });

    const roomsWithStatus: InlineRoom[] = allRooms.map(room => ({
      ...room,
      hasConflict: conflictingRoomIds.has(room.id),
    }));

    roomsWithStatus.sort((a, b) => {
      if (a.hasConflict && !b.hasConflict) return 1;
      if (!a.hasConflict && b.hasConflict) return -1;
      return 0;
    });

    setInlineRooms(roomsWithStatus);
    setLoadingInlineRooms(false);
  };

  // Inline room assignment + auto-approve
  const handleInlineAssignRoom = async (booking: BookingDetails) => {
    if (!inlineSelectedRoom) {
      toast.error('Выберите номер');
      return;
    }
    setAssigningRoom(true);

    // Clear existing booking_rooms
    await supabase.from('booking_rooms').delete().eq('booking_id', booking.id);

    // Insert new room assignment
    const { error: brError } = await supabase.from('booking_rooms').insert({
      booking_id: booking.id,
      room_id: inlineSelectedRoom,
      hotel_id: hotelId,
    });

    if (brError) {
      toast.error(t('common.error'));
      setAssigningRoom(false);
      return;
    }

    // Update booking: set room_id and auto-approve if pending
    const newStatus = booking.status === 'pending' ? 'approved' : booking.status;
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ room_id: inlineSelectedRoom, status: newStatus })
      .eq('id', booking.id);

    if (bookingError) {
      toast.error(t('common.error'));
      setAssigningRoom(false);
      return;
    }

    // Mark room as booked
    await supabase.from('rooms').update({ status: 'booked' }).eq('id', inlineSelectedRoom);

    if (user) {
      logAdminAction({
        hotelId,
        userId: user.id,
        userName: profile?.full_name || '',
        action: booking.status === 'pending' ? 'booking_approved_with_room' : 'room_assigned',
        entityType: 'booking',
        entityId: booking.id,
        details: { guest_name: booking.guest_name },
      });
    }

    toast.success('Номер назначен');
    setInlineSelectedRoom(null);
    setInlineRooms([]);
    setRoomChangeBookingId(null);
    await fetchBookings();
    onUpdate?.();
    setAssigningRoom(false);
  };

  // Inline check-in
  const handleInlineCheckIn = async (booking: BookingDetails) => {
    setCheckingIn(true);
    const roomIdsToOccupy: string[] = [];
    
    if (booking.room_id) roomIdsToOccupy.push(booking.room_id);
    
    const { data: bookingRooms } = await supabase
      .from('booking_rooms')
      .select('room_id')
      .eq('booking_id', booking.id);
    
    if (bookingRooms) {
      for (const br of bookingRooms) {
        if (!roomIdsToOccupy.includes(br.room_id)) roomIdsToOccupy.push(br.room_id);
      }
    }

    if (roomIdsToOccupy.length === 0) {
      toast.error('Номер не назначен');
      setCheckingIn(false);
      return;
    }

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'checked_in' })
      .eq('id', booking.id);

    if (bookingError) {
      toast.error(t('common.error'));
      setCheckingIn(false);
      return;
    }

    await supabase.from('rooms').update({ status: 'occupied' }).in('id', roomIdsToOccupy);

    if (user) {
      logAdminAction({
        hotelId,
        userId: user.id,
        userName: profile?.full_name || '',
        action: 'booking_checked_in',
        entityType: 'booking',
        entityId: booking.id,
        details: { guest_name: booking.guest_name, rooms_count: roomIdsToOccupy.length },
      });
    }

    toast.success('Гость заселён');
    await fetchBookings();
    onUpdate?.();
    setCheckingIn(false);
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

  const hasOverdue = allBookings.some(
    b => b.status === 'checked_in' && isBefore(parseISO(b.check_out_date), startOfDay(new Date()))
  );

  const hasDifferentDates = allBookings.length > 1 && allBookings.some(
    b => b.check_in_date !== allBookings[0].check_in_date || b.check_out_date !== allBookings[0].check_out_date
  );

  // Calculate discount
  const parsedDiscountValue = parseFloat(discountValue) || 0;
  let discountAmount = 0;
  if (discountEnabled && parsedDiscountValue > 0) {
    if (discountType === 'percent') {
      discountAmount = Math.round(grandCalc.total * (Math.min(parsedDiscountValue, 100) / 100));
    } else {
      discountAmount = Math.min(parsedDiscountValue, grandCalc.total);
    }
  }
  const totalAfterDiscount = grandCalc.total - discountAmount;

  const handleStartCheckout = () => {
    setCheckoutAmount(totalAfterDiscount.toString());
    setCheckoutReason('');
    setDiscountEnabled(false);
    setDiscountValue('');
    setDiscountType('percent');
    setCheckoutDialogOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!primary || !user) return;

    // If discount applied, require a reason
    if (discountEnabled && discountAmount > 0 && !checkoutReason.trim()) {
      toast.error('Укажите причину скидки');
      return;
    }

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

  // Determine the current step for each booking
  const getBookingStep = (booking: BookingDetails): 'assign_room' | 'check_in' | 'active' | 'done' => {
    if (['checked_out', 'cancelled'].includes(booking.status)) return 'done';
    if (booking.status === 'checked_in') return 'active';
    if (['pending', 'approved'].includes(booking.status) && booking.allRooms.length === 0) return 'assign_room';
    if (booking.status === 'approved' && booking.allRooms.length > 0) return 'check_in';
    return 'done';
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

  // Check if any booking needs the linear flow (room assignment or check-in)
  const needsLinearFlow = allBookings.some(b => ['assign_room', 'check_in'].includes(getBookingStep(b)));

  return (
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

          {/* Step indicator for linear flow */}
          {needsLinearFlow && (
            <div className="flex items-center gap-2 px-1">
              {['Назначить номер', 'Заселить'].map((stepLabel, i) => {
                const currentBooking = allBookings.find(b => ['assign_room', 'check_in'].includes(getBookingStep(b))) || allBookings[0];
                const step = getBookingStep(currentBooking);
                const stepIndex = step === 'assign_room' ? 0 : step === 'check_in' ? 1 : 2;
                const isActive = i === stepIndex;
                const isDone = i < stepIndex;

                return (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <div className={`h-0.5 w-6 ${isDone ? 'bg-primary' : 'bg-muted'}`} />}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isDone ? <CheckCircle className="h-3 w-3" /> : <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]">{i + 1}</span>}
                      {stepLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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

              {/* Per-booking details */}
              {allBookings.map((booking, idx) => {
                const bOverdue = booking.status === 'checked_in' && 
                  isBefore(parseISO(booking.check_out_date), startOfDay(new Date()));
                const calc = getBookingCalc(booking);
                const step = getBookingStep(booking);
                const roomsToShow = booking.allRooms.length > 0 ? booking.allRooms : [null];
                const isChangingRoom = roomChangeBookingId === booking.id;

                return (
                  <div key={booking.id} className="space-y-3">
                    {/* Room info blocks */}
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
                                if (isChangingRoom) {
                                  setRoomChangeBookingId(null);
                                  setInlineRooms([]);
                                  setInlineSelectedRoom(null);
                                } else {
                                  setRoomChangeBookingId(booking.id);
                                  fetchInlineRooms(booking);
                                }
                              }}
                            >
                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                              {isChangingRoom ? 'Отмена' : 'Сменить номер'}
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

                        {/* Extend button for checked_in */}
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

                    {/* ===== INLINE ROOM ASSIGNMENT ===== */}
                    {(step === 'assign_room' || isChangingRoom) && (
                      <div className="p-4 border-2 border-primary/30 rounded-lg bg-primary/5 space-y-3">
                        <Label className="font-medium flex items-center gap-2">
                          <BedDouble className="h-4 w-4 text-primary" />
                          {isChangingRoom ? 'Сменить номер' : 'Назначить номер'}
                        </Label>
                        
                        {loadingInlineRooms ? (
                          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                        ) : inlineRooms.length === 0 ? (
                          <>
                            <p className="text-sm text-muted-foreground">Нет подходящих номеров</p>
                            {!loadingInlineRooms && step === 'assign_room' && (
                              <Button size="sm" variant="outline" onClick={() => fetchInlineRooms(booking)}>
                                Обновить список
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-2">
                              {inlineRooms.filter(r => !r.hasConflict).map(room => (
                                <div
                                  key={room.id}
                                  onClick={() => setInlineSelectedRoom(room.id === inlineSelectedRoom ? null : room.id)}
                                  className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all text-center ${
                                    inlineSelectedRoom === room.id
                                      ? 'border-primary bg-primary/10'
                                      : 'border-muted hover:border-primary/50'
                                  }`}
                                >
                                  <div className="font-medium text-sm">{room.room_number}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {room.room_types?.name} • эт. {room.floor}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                disabled={!inlineSelectedRoom || assigningRoom}
                                onClick={() => {
                                  if (isChangingRoom) {
                                    handleRoomChange(booking);
                                  } else {
                                    handleInlineAssignRoom(booking);
                                  }
                                }}
                              >
                                {assigningRoom ? '...' : isChangingRoom ? 'Сменить' : 'Назначить номер'}
                              </Button>
                              {isChangingRoom && (
                                <Button variant="outline" onClick={() => {
                                  setRoomChangeBookingId(null);
                                  setInlineRooms([]);
                                  setInlineSelectedRoom(null);
                                }}>
                                  Отмена
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* ===== INLINE CHECK-IN ACTIONS ===== */}
                    {step === 'check_in' && !isChangingRoom && (
                      <div className="p-4 border-2 border-green-500/30 rounded-lg bg-green-500/5 space-y-3">
                        <p className="text-sm font-medium text-green-700">
                          Номер назначен. Заселить гостя?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={checkingIn}
                            onClick={() => handleInlineCheckIn(booking)}
                          >
                            <LogIn className="h-4 w-4 mr-1" />
                            {checkingIn ? '...' : 'Заселить'}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              toast.info('Статус: Подтверждено. Заселить можно позже.');
                              onOpenChange(false);
                            }}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Заселить позже
                          </Button>
                        </div>
                      </div>
                    )}

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

              {/* Checkout section for checked_in bookings — inline */}
              {allBookings.some(b => b.status === 'checked_in') && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {hasOverdue && (
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">
                          Дата выезда прошла. Необходимо выселить гостя или продлить бронирование.
                        </p>
                      </div>
                    )}

                    {/* Inline checkout form */}
                    {checkoutDialogOpen ? (
                      <div className="p-4 border-2 border-destructive/30 rounded-lg bg-destructive/5 space-y-3">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <LogOut className="h-4 w-4" />
                          Выселение гостя
                        </p>

                        {/* Discount Section */}
                        <div className="space-y-2 p-3 border rounded-lg bg-background">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="discount-toggle-inline" className="text-sm font-medium cursor-pointer">
                              Применить скидку
                            </Label>
                            <Switch
                              id="discount-toggle-inline"
                              checked={discountEnabled}
                              onCheckedChange={setDiscountEnabled}
                            />
                          </div>
                          {discountEnabled && (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={discountType === 'percent' ? 'default' : 'outline'}
                                  onClick={() => setDiscountType('percent')}
                                  className="flex-1"
                                >
                                  %
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={discountType === 'fixed' ? 'default' : 'outline'}
                                  onClick={() => setDiscountType('fixed')}
                                  className="flex-1"
                                >
                                  ₸
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max={discountType === 'percent' ? '100' : String(grandCalc.total)}
                                  placeholder={discountType === 'percent' ? 'Введите %' : 'Введите сумму'}
                                  value={discountValue}
                                  onChange={(e) => {
                                    setDiscountValue(e.target.value);
                                    // Recalculate checkout amount
                                    const v = parseFloat(e.target.value) || 0;
                                    let disc = 0;
                                    if (v > 0) {
                                      disc = discountType === 'percent'
                                        ? Math.round(grandCalc.total * (Math.min(v, 100) / 100))
                                        : Math.min(v, grandCalc.total);
                                    }
                                    setCheckoutAmount((grandCalc.total - disc).toString());
                                  }}
                                  className="flex-1"
                                />
                                <span className="text-sm text-muted-foreground w-8 text-right">
                                  {discountType === 'percent' ? '%' : '₸'}
                                </span>
                              </div>
                              {discountAmount > 0 && (
                                <div className="flex justify-between text-sm text-destructive">
                                  <span>Скидка:</span>
                                  <span>−{discountAmount.toLocaleString()} ₸</span>
                                </div>
                              )}
                              <Textarea
                                placeholder="Причина скидки (обязательно)..."
                                value={checkoutReason}
                                onChange={(e) => setCheckoutReason(e.target.value)}
                                rows={2}
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-sm">Итоговая сумма (₸)</Label>
                          <Input
                            type="number"
                            value={checkoutAmount}
                            onChange={(e) => setCheckoutAmount(e.target.value)}
                          />
                          {parseFloat(checkoutAmount) !== grandCalc.total && !discountEnabled && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Сумма изменена (было: {grandCalc.total.toLocaleString()} ₸). Изменение будет отправлено владельцу.
                            </p>
                          )}
                        </div>
                        {parseFloat(checkoutAmount) !== grandCalc.total && !discountEnabled && (
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
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            variant="destructive"
                            onClick={handleConfirmCheckout}
                            disabled={processingCheckout}
                          >
                            {processingCheckout ? '...' : 'Подтвердить выселение'}
                          </Button>
                          <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : extendDialogOpen ? (
                      <div className="p-4 border-2 border-primary/30 rounded-lg bg-primary/5 space-y-3">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <CalendarPlus className="h-4 w-4" />
                          Продление проживания
                        </p>
                        {extendBookingId && (() => {
                          const b = allBookings.find(x => x.id === extendBookingId);
                          return b ? (
                            <p className="text-sm text-muted-foreground">
                              {b.rooms?.room_number && `Номер: ${b.rooms.room_number} · `}
                              Текущий выезд: {format(parseISO(b.check_out_date), 'dd MMMM yyyy', { locale: ru })}
                            </p>
                          ) : null;
                        })()}
                        <div className="space-y-1">
                          <Label className="text-sm">Новая дата выезда</Label>
                          <Input
                            type="date"
                            value={newCheckoutDate}
                            onChange={(e) => setNewCheckoutDate(e.target.value)}
                            min={format(new Date(), 'yyyy-MM-dd')}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={handleExtendStay}
                            disabled={processingExtend || !newCheckoutDate}
                          >
                            {processingExtend ? '...' : 'Подтвердить продление'}
                          </Button>
                          <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          variant={hasOverdue ? 'destructive' : 'default'}
                          onClick={handleStartCheckout}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Выселить{isMulti ? ' (все номера)' : ''}
                        </Button>
                      </div>
                    )}
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

              {allBookings.some(b => b.status === 'checked_in') && !checkoutDialogOpen && !extendDialogOpen && (
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
  );

  // Room change handler (reusing inline room picker)
  async function handleRoomChange(booking: BookingDetails) {
    if (!inlineSelectedRoom || !user) return;
    setAssigningRoom(true);

    // Release old rooms
    if (booking.allRooms.length > 0) {
      const oldStatus = booking.status === 'checked_in' ? 'available' : 'available';
      await supabase
        .from('rooms')
        .update({ status: oldStatus as any })
        .in('id', booking.allRooms.map(r => r.id));
    }

    // Clear existing booking_rooms
    await supabase.from('booking_rooms').delete().eq('booking_id', booking.id);

    // Insert new
    await supabase.from('booking_rooms').insert({
      booking_id: booking.id,
      room_id: inlineSelectedRoom,
      hotel_id: hotelId,
    });

    // Update booking room_id
    await supabase
      .from('bookings')
      .update({ room_id: inlineSelectedRoom })
      .eq('id', booking.id);

    // Mark new room
    const newRoomStatus = booking.status === 'checked_in' ? 'occupied' : 'booked';
    await supabase.from('rooms').update({ status: newRoomStatus }).eq('id', inlineSelectedRoom);

    const oldRooms = booking.allRooms.map(r => r.room_number).join(', ') || 'не назначен';
    logAdminAction({
      hotelId,
      userId: user.id,
      userName: profile?.full_name || '',
      action: 'room_changed',
      entityType: 'booking',
      entityId: booking.id,
      details: { guest_name: booking.guest_name, old_rooms: oldRooms, status: booking.status },
    });

    toast.success('Номер изменён');
    setRoomChangeBookingId(null);
    setInlineSelectedRoom(null);
    setInlineRooms([]);
    await fetchBookings();
    onUpdate?.();
    setAssigningRoom(false);
  }
}
