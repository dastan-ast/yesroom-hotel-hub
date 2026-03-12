import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
import { Bell, XCircle, Phone, MessageCircle, DoorOpen, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { RoomAssignDialog } from './RoomAssignDialog';

interface PendingBooking {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  created_at: string;
  room_type_id: string | null;
  room_types: { name: string } | null;
  status: 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'cancelled';
}

interface Props {
  hotelId: string;
  onBookingUpdated?: () => void;
  onBookingClick?: (bookingId: string) => void;
}

// Show bookings within this many days from today
const UPCOMING_DAYS = 3;

export function LiveFeedSidebar({ hotelId, onBookingUpdated, onBookingClick }: Props) {
  const { t } = useTranslation();
  const { isOwner } = useAuth();
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedBookingForAssign, setSelectedBookingForAssign] = useState<PendingBooking | null>(null);
  const [showAll, setShowAll] = useState(false);
  
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bookingToReject, setBookingToReject] = useState<PendingBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<PendingBooking | null>(null);

  useEffect(() => {
    if (hotelId) {
      fetchPendingBookings();
      const channel = supabase
        .channel('pending-bookings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `hotel_id=eq.${hotelId}` }, () => fetchPendingBookings())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [hotelId]);

  const fetchPendingBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('id, guest_name, guest_phone, check_in_date, check_out_date, created_at, room_type_id, room_types(name), status')
      .eq('hotel_id', hotelId)
      .in('status', ['pending', 'approved', 'checked_in'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setBookings(data as PendingBooking[]);
    setLoading(false);
  };

  const today = startOfDay(new Date());

  const isOverdue = (booking: PendingBooking) => {
    if (booking.status === 'checked_in') {
      return startOfDay(new Date(booking.check_out_date)) < today;
    }
    return startOfDay(new Date(booking.check_in_date)) < today;
  };

  const isUpcoming = (booking: PendingBooking) => {
    if (booking.status === 'checked_in') {
      const daysToCheckout = differenceInCalendarDays(new Date(booking.check_out_date), today);
      return daysToCheckout >= 0 && daysToCheckout <= UPCOMING_DAYS;
    }
    const daysToCheckin = differenceInCalendarDays(new Date(booking.check_in_date), today);
    return daysToCheckin >= 0 && daysToCheckin <= UPCOMING_DAYS;
  };

  // Deduplicate by booking id
  const uniqueBookings = useMemo(() => {
    const seen = new Set<string>();
    return bookings.filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [bookings]);

  // Sort: overdue first, then upcoming by nearest date, then rest
  const sortedAndFiltered = useMemo(() => {
    const overdue: PendingBooking[] = [];
    const upcoming: PendingBooking[] = [];
    const rest: PendingBooking[] = [];

    for (const b of uniqueBookings) {
      if (isOverdue(b)) overdue.push(b);
      else if (isUpcoming(b)) upcoming.push(b);
      else rest.push(b);
    }

    // Sort overdue by most overdue first
    overdue.sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());
    
    // Sort upcoming: pending/approved by check_in asc, checked_in by check_out asc
    upcoming.sort((a, b) => {
      const dateA = a.status === 'checked_in' ? new Date(a.check_out_date) : new Date(a.check_in_date);
      const dateB = b.status === 'checked_in' ? new Date(b.check_out_date) : new Date(b.check_in_date);
      return dateA.getTime() - dateB.getTime();
    });

    rest.sort((a, b) => {
      const dateA = a.status === 'checked_in' ? new Date(a.check_out_date) : new Date(a.check_in_date);
      const dateB = b.status === 'checked_in' ? new Date(b.check_out_date) : new Date(b.check_in_date);
      return dateA.getTime() - dateB.getTime();
    });

    return { overdue, upcoming, rest };
  }, [uniqueBookings, today]);

  const visibleOverdue = sortedAndFiltered.overdue;
  const visibleUpcoming = sortedAndFiltered.upcoming;
  const visibleRest = showAll ? sortedAndFiltered.rest : [];
  const hiddenCount = showAll ? 0 : sortedAndFiltered.rest.length;
  const totalVisible = visibleOverdue.length + visibleUpcoming.length;

  const handleOpenAssignDialog = (booking: PendingBooking) => {
    setSelectedBookingForAssign(booking);
    setAssignDialogOpen(true);
  };

  const handleAssignSuccess = () => { fetchPendingBookings(); onBookingUpdated?.(); };

  const handleRejectWithConfirm = (booking: PendingBooking) => {
    setBookingToReject(booking);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!bookingToReject) return;
    const { error } = await supabase.from('bookings').update({ 
      status: 'cancelled',
      additional_info: { cancellation_reason: rejectReason || null, cancelled_at: new Date().toISOString() }
    }).eq('id', bookingToReject.id);
    if (error) { toast.error(t('common.error')); return; }
    toast.success('Заявка отклонена');
    setRejectDialogOpen(false);
    setBookingToReject(null);
    fetchPendingBookings();
    onBookingUpdated?.();
  };

  const handleDeleteWithConfirm = (booking: PendingBooking) => {
    setBookingToDelete(booking);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!bookingToDelete) return;
    await supabase.from('booking_rooms').delete().eq('booking_id', bookingToDelete.id);
    await supabase.from('booking_services').delete().eq('booking_id', bookingToDelete.id);
    const { error } = await supabase.from('bookings').delete().eq('id', bookingToDelete.id);
    if (error) { toast.error(t('common.error')); return; }
    toast.success('Заявка удалена');
    setDeleteDialogOpen(false);
    setBookingToDelete(null);
    fetchPendingBookings();
    onBookingUpdated?.();
  };

  const formatPhone = (phone?: string | null) => (phone ?? '').replace(/[^\d+]/g, '');

  const getStatusLabel = (status: PendingBooking['status']) => {
    if (status === 'pending') return 'Ожидает';
    if (status === 'approved') return 'Подтверждено';
    if (status === 'checked_in') return 'Заселён';
    return 'Отменено';
  };

  const getDaysLabel = (booking: PendingBooking) => {
    if (isOverdue(booking)) return null; // handled by overdue badge
    if (booking.status === 'checked_in') {
      const days = differenceInCalendarDays(new Date(booking.check_out_date), today);
      if (days === 0) return 'Выезд сегодня';
      if (days === 1) return 'Выезд завтра';
      return `Выезд через ${days} дн.`;
    }
    const days = differenceInCalendarDays(new Date(booking.check_in_date), today);
    if (days === 0) return 'Заезд сегодня';
    if (days === 1) return 'Заезд завтра';
    return `Заезд через ${days} дн.`;
  };

  const renderBookingCard = (booking: PendingBooking) => {
    const overdue = isOverdue(booking);
    const daysLabel = getDaysLabel(booking);

    return (
      <div
        key={booking.id}
        className={`p-3 rounded-lg border space-y-2 ${
          overdue ? 'bg-destructive/10 border-destructive/50' : 'bg-muted/50 border-border'
        }`}
      >
      <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 cursor-pointer" onClick={() => onBookingClick?.(booking.id)}>
            <div className="flex items-center gap-1">
              {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              <p className={`font-medium text-sm truncate hover:underline ${overdue ? 'text-destructive' : ''}`}>{booking.guest_name}</p>
            </div>
            {booking.guest_phone ? (
              <a href={`tel:${formatPhone(booking.guest_phone)}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                <Phone className="h-3 w-3" />{booking.guest_phone}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">Телефон не указан</p>
            )}
          </div>
          {booking.guest_phone && (
            <a href={`https://wa.me/${formatPhone(booking.guest_phone).replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700">
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{getStatusLabel(booking.status)}</Badge>
            {daysLabel && <span className={`text-[10px] font-semibold ${overdue ? 'text-destructive' : 'text-primary'}`}>{daysLabel}</span>}
          </div>
          <div className="flex items-center gap-2">
            <p>{booking.room_types?.name || 'Без типа номера'}</p>
            <p>
              {format(new Date(booking.check_in_date), 'dd.MM')} –{' '}
              {format(new Date(booking.check_out_date), 'dd.MM.yy')}
            </p>
          </div>
        </div>

        {(booking.status === 'pending' || booking.status === 'approved' || isOwner) && (
          <div className="flex gap-1.5">
            {(booking.status === 'pending' || booking.status === 'approved') && (
              <>
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleOpenAssignDialog(booking)}>
                  <DoorOpen className="h-3 w-3 mr-1" />Назначить номер
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleRejectWithConfirm(booking)}>
                  <XCircle className="h-3 w-3" />
                </Button>
              </>
            )}
            {isOwner && (
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive hover:text-destructive" onClick={() => handleDeleteWithConfirm(booking)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border rounded-lg h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Активные заявки</h3>
        {totalVisible > 0 && (
          <Badge variant={visibleOverdue.length > 0 ? 'destructive' : 'default'} className="ml-auto">
            {totalVisible}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : totalVisible === 0 && hiddenCount === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Нет активных заявок</div>
        ) : (
          <div className="p-2 space-y-1">
            {visibleOverdue.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase text-destructive px-1 pt-1">Просрочено</p>
                {visibleOverdue.map(renderBookingCard)}
              </>
            )}
            {visibleUpcoming.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase text-primary px-1 pt-2">Ближайшие ({UPCOMING_DAYS} дня)</p>
                {visibleUpcoming.map(renderBookingCard)}
              </>
            )}
            {hiddenCount > 0 && (
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowAll(true)}>
                <ChevronDown className="h-3 w-3 mr-1" /> Показать остальные ({hiddenCount})
              </Button>
            )}
            {visibleRest.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 pt-2">Прочие</p>
                {visibleRest.map(renderBookingCard)}
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowAll(false)}>
                  <ChevronUp className="h-3 w-3 mr-1" /> Свернуть
                </Button>
              </>
            )}
          </div>
        )}
      </ScrollArea>

      {selectedBookingForAssign && (
        <RoomAssignDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen} bookingId={selectedBookingForAssign.id} hotelId={hotelId} roomTypeId={selectedBookingForAssign.room_type_id} checkInDate={selectedBookingForAssign.check_in_date} checkOutDate={selectedBookingForAssign.check_out_date} onSuccess={handleAssignSuccess} multiRoom={true} />
      )}

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить заявку?</AlertDialogTitle>
            <AlertDialogDescription>Гость: <strong>{bookingToReject?.guest_name}</strong><br />Заявка будет отменена.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2"><Textarea placeholder="Причина отклонения (необязательно)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Отклонить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заявку?</AlertDialogTitle>
            <AlertDialogDescription>Гость: <strong>{bookingToDelete?.guest_name}</strong><br />Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
