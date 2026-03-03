import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/activityLog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
import { Plus, CheckCircle, XCircle, LogIn, LogOut, Phone, MessageCircle, DoorOpen, RotateCcw, Eye, Trash2, Search, AlertTriangle, BedDouble, Merge } from 'lucide-react';
import { ManualBookingDialog } from './ManualBookingDialog';
import { GuestHistoryModal } from './GuestHistoryModal';
import { RoomAssignDialog } from './RoomAssignDialog';
import { CheckoutInvoiceModal } from './CheckoutInvoiceModal';
import { BookingDetailModal } from './BookingDetailModal';
import { checkRoomAvailability } from '@/lib/checkRoomAvailability';

type BookingStatus = 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'cancelled';

interface Booking {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  source: string;
  prepayment_received: boolean;
  room_types: { name: string } | null;
  room_id: string | null;
  room_type_id: string | null;
  additional_info: Record<string, any> | null;
  group_id: string | null;
}

/** A grouped booking card representing 1+ bookings for same guest */
interface BookingGroup {
  key: string;
  primary: Booking;
  bookings: Booking[];
  roomCount: number;
  hasDifferentDates: boolean;
  isGrouped: boolean;
}

const statusColors: Record<BookingStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500',
  approved: 'bg-blue-500/20 text-blue-700 border-blue-500',
  checked_in: 'bg-green-500/20 text-green-700 border-green-500',
  checked_out: 'bg-muted text-muted-foreground border-muted-foreground/30',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500',
};

// Status priority for sorting (lower = higher priority)
const statusPriority: Record<BookingStatus, number> = {
  pending: 0,
  approved: 1,
  checked_in: 2,
  checked_out: 3,
  cancelled: 4,
};

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'approved', 'checked_in'];

export function BookingsTab({ hotelId }: { hotelId: string }) {
  const { t } = useTranslation();
  const { isOwner, user, profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Undo check-in dialog state
  const [undoCheckInDialogOpen, setUndoCheckInDialogOpen] = useState(false);
  const [bookingToUndoCheckIn, setBookingToUndoCheckIn] = useState<Booking | null>(null);

  // Checkout invoice modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // Booking detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailBookingIds, setDetailBookingIds] = useState<string[]>([]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);

  // Multi-select merge state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    if (hotelId) {
      fetchBookings();
    }
  }, [hotelId]);

  const fetchBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, room_types(name), room_id, room_type_id, additional_info, group_id')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setBookings(data as Booking[]);
    setSelectedIds(new Set());
    setLoading(false);
  };

  const handleManualBookingSuccess = async (createdBookingIds: string[]) => {
    await fetchBookings();

    if (createdBookingIds.length > 0) {
      setDetailBookingIds(createdBookingIds);
      setDetailModalOpen(true);
    }
  };

  // --- Merge logic ---
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmMerge = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;

    const groupId = ids[0]; // use first selected booking's ID as group_id
    const primaryBooking = bookings.find(b => b.id === groupId);
    if (!primaryBooking) return;

    // Normalize guest_name and guest_phone across the group
    const { error } = await supabase
      .from('bookings')
      .update({
        group_id: groupId,
        guest_name: primaryBooking.guest_name,
        guest_phone: primaryBooking.guest_phone,
      })
      .in('id', ids);

    if (error) {
      toast.error(t('common.error'));
      return;
    }

    toast.success(`${ids.length} бронирований объединены`);
    logAdminAction({
      hotelId,
      userId: user!.id,
      userName: profile?.full_name || '',
      action: 'bookings_merged',
      entityType: 'booking',
      entityId: groupId,
      details: { merged_ids: ids, guest_name: primaryBooking.guest_name },
    });
    setMergeDialogOpen(false);
    setSelectedIds(new Set());
    fetchBookings();
  };

  const handleCheckIn = async (booking: Booking) => {
    const roomIdsToOccupy: string[] = [];
    
    if (booking.room_id) {
      roomIdsToOccupy.push(booking.room_id);
    }
    
    const { data: bookingRooms } = await supabase
      .from('booking_rooms')
      .select('room_id')
      .eq('booking_id', booking.id);
    
    if (bookingRooms) {
      for (const br of bookingRooms) {
        if (!roomIdsToOccupy.includes(br.room_id)) {
          roomIdsToOccupy.push(br.room_id);
        }
      }
    }

    if (roomIdsToOccupy.length === 0) {
      toast.error('Номер не назначен');
      return;
    }

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'checked_in' })
      .eq('id', booking.id);

    if (bookingError) {
      toast.error(t('common.error'));
      return;
    }

    const { error: roomError } = await supabase
      .from('rooms')
      .update({ status: 'occupied' })
      .in('id', roomIdsToOccupy);

    if (roomError) {
      toast.error(t('common.error'));
      return;
    }

    toast.success(roomIdsToOccupy.length > 1 
      ? `Гость заселён в ${roomIdsToOccupy.length} номеров` 
      : t('common.success')
    );
    logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'booking_checked_in', entityType: 'booking', entityId: booking.id, details: { guest_name: booking.guest_name, rooms_count: roomIdsToOccupy.length } });
    fetchBookings();
  };

  const handleCheckInGroup = async (group: BookingGroup) => {
    let totalRooms = 0;
    for (const booking of group.bookings) {
      if (booking.status !== 'approved') continue;
      
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

      if (roomIdsToOccupy.length === 0) continue;

      await supabase.from('bookings').update({ status: 'checked_in' }).eq('id', booking.id);
      await supabase.from('rooms').update({ status: 'occupied' }).in('id', roomIdsToOccupy);
      totalRooms += roomIdsToOccupy.length;
    }
    toast.success(`Гость заселён в ${totalRooms} номеров`);
    logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'booking_checked_in', entityType: 'booking', entityId: group.primary.id, details: { guest_name: group.primary.guest_name, grouped: group.bookings.length, rooms_count: totalRooms } });
    fetchBookings();
  };

  const [checkoutBookingIds, setCheckoutBookingIds] = useState<string[]>([]);

  const handleOpenCheckoutGroup = (group: BookingGroup) => {
    const checkedInIds = group.bookings
      .filter(b => b.status === 'checked_in')
      .map(b => b.id);
    setCheckoutBookingIds(checkedInIds);
    setCheckoutModalOpen(true);
  };

  const handleOpenDetail = (group: BookingGroup) => {
    setDetailBookingIds(group.bookings.map(b => b.id));
    setDetailModalOpen(true);
  };

  const [availabilityWarningOpen, setAvailabilityWarningOpen] = useState(false);
  const [availabilityWarningMsg, setAvailabilityWarningMsg] = useState('');
  const [pendingApproveAction, setPendingApproveAction] = useState<(() => Promise<void>) | null>(null);

  const handleQuickApprove = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking && booking.room_type_id) {
      const result = await checkRoomAvailability(
        hotelId,
        booking.room_type_id,
        booking.check_in_date,
        booking.check_out_date,
        booking.id
      );
      if (!result.available) {
        setAvailabilityWarningMsg(
          `На даты ${booking.check_in_date} — ${booking.check_out_date} все номера типа "${booking.room_types?.name || ''}" заняты (${result.totalRooms} из ${result.totalRooms}). Подтвердить всё равно?`
        );
        setPendingApproveAction(() => async () => {
          await doApprove(bookingId);
        });
        setAvailabilityWarningOpen(true);
        return;
      }
    }
    await doApprove(bookingId);
  };

  const doApprove = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'approved' })
      .eq('id', bookingId);

    if (error) {
      toast.error(t('common.error'));
      return;
    }

    toast.success('Бронирование подтверждено');
    logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'booking_approved', entityType: 'booking', entityId: bookingId, details: {} });
    fetchBookings();
  };

  const handleQuickApproveGroup = async (group: BookingGroup) => {
    for (const booking of group.bookings) {
      if (booking.status === 'pending') {
        await supabase.from('bookings').update({ status: 'approved' }).eq('id', booking.id);
      }
    }
    toast.success('Все бронирования подтверждены');
    fetchBookings();
  };

  const handleCancelWithConfirm = (booking: Booking) => {
    setBookingToCancel(booking);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const confirmCancellation = async () => {
    if (!bookingToCancel) return;

    const updatedAdditionalInfo = {
      ...(bookingToCancel.additional_info || {}),
      cancellation_reason: cancelReason || null,
      cancelled_at: new Date().toISOString(),
    };

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        additional_info: updatedAdditionalInfo
      })
      .eq('id', bookingToCancel.id);

    if (bookingError) {
      toast.error(t('common.error'));
      return;
    }

    if (bookingToCancel.room_id) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', bookingToCancel.room_id);
    }

    toast.success('Бронирование отменено');
    logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'booking_cancelled', entityType: 'booking', entityId: bookingToCancel.id, details: { guest_name: bookingToCancel.guest_name, reason: cancelReason || null } });
    setCancelDialogOpen(false);
    setBookingToCancel(null);
    setCancelReason('');
    fetchBookings();
  };

  const handleUndoCheckInWithConfirm = (booking: Booking) => {
    setBookingToUndoCheckIn(booking);
    setUndoCheckInDialogOpen(true);
  };

  const confirmUndoCheckIn = async () => {
    if (!bookingToUndoCheckIn) return;

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'approved' })
      .eq('id', bookingToUndoCheckIn.id);

    if (bookingError) {
      toast.error(t('common.error'));
      return;
    }

    if (bookingToUndoCheckIn.room_id) {
      await supabase.from('rooms').update({ status: 'booked' }).eq('id', bookingToUndoCheckIn.room_id);
    }

    toast.success('Заселение отменено');
    logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'booking_undo_checkin', entityType: 'booking', entityId: bookingToUndoCheckIn.id, details: { guest_name: bookingToUndoCheckIn.guest_name } });
    setUndoCheckInDialogOpen(false);
    setBookingToUndoCheckIn(null);
    fetchBookings();
  };

  const handleDeleteWithConfirm = (booking: Booking) => {
    if (booking.status === 'checked_in') {
      toast.error('Сначала выселите гостя');
      return;
    }
    setBookingToDelete(booking);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!bookingToDelete) return;

    await supabase.from('booking_rooms').delete().eq('booking_id', bookingToDelete.id);
    await supabase.from('booking_services').delete().eq('booking_id', bookingToDelete.id);

    if (bookingToDelete.room_id) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', bookingToDelete.room_id);
    }

    const { error } = await supabase.from('bookings').delete().eq('id', bookingToDelete.id);

    if (error) {
      toast.error(t('common.error'));
      return;
    }

    toast.success('Бронирование удалено');
    logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'booking_deleted', entityType: 'booking', entityId: bookingToDelete.id, details: { guest_name: bookingToDelete.guest_name } });
    setDeleteDialogOpen(false);
    setBookingToDelete(null);
    fetchBookings();
  };

  const isOverdue = (booking: Booking) => {
    if (booking.status !== 'checked_in') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOut = new Date(booking.check_out_date);
    checkOut.setHours(0, 0, 0, 0);
    return checkOut < today;
  };

  const isGroupOverdue = (group: BookingGroup) => group.bookings.some(isOverdue);

  // Group bookings ONLY by group_id (manual grouping). No auto-grouping.
  const groupedBookings = useMemo((): BookingGroup[] => {
    const groups: BookingGroup[] = [];
    const byGroupId = new Map<string, Booking[]>();

    for (const booking of bookings) {
      if (booking.group_id) {
        if (!byGroupId.has(booking.group_id)) byGroupId.set(booking.group_id, []);
        byGroupId.get(booking.group_id)!.push(booking);
      } else {
        // Individual booking — no grouping
        groups.push({
          key: booking.id,
          primary: booking,
          bookings: [booking],
          roomCount: 1,
          hasDifferentDates: false,
          isGrouped: false,
        });
      }
    }

    for (const [gid, bks] of byGroupId.entries()) {
      const hasDifferentDates = bks.some(b => 
        b.check_in_date !== bks[0].check_in_date || b.check_out_date !== bks[0].check_out_date
      );
      groups.push({
        key: gid,
        primary: bks[0],
        bookings: bks,
        roomCount: bks.length,
        hasDifferentDates,
        isGrouped: bks.length > 1,
      });
    }

    return groups;
  }, [bookings]);

  // Filtered and sorted groups
  const filteredGroups = useMemo(() => {
    let result = [...groupedBookings];

    if (statusFilter !== 'all') {
      result = result.filter(g => g.primary.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(g => 
        g.primary.guest_name.toLowerCase().includes(query) ||
        (g.primary.guest_phone || '').includes(query)
      );
    }

    result.sort((a, b) => {
      const aOverdue = isGroupOverdue(a) ? -1 : 0;
      const bOverdue = isGroupOverdue(b) ? -1 : 0;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return statusPriority[a.primary.status] - statusPriority[b.primary.status];
    });

    return result;
  }, [groupedBookings, statusFilter, searchQuery]);

  const overdueCount = useMemo(() => bookings.filter(isOverdue).length, [bookings]);

  const pendingCount = useMemo(() => bookings.filter(b => b.status === 'pending').length, [bookings]);

  const totalPages = Math.ceil(filteredGroups.length / PAGE_SIZE);
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getStatusLabel = (status: BookingStatus) => {
    const labels: Record<BookingStatus, string> = {
      pending: t('admin.pending'),
      approved: t('admin.approved'),
      checked_in: t('admin.checkedIn'),
      checked_out: t('admin.checkedOut'),
      cancelled: t('admin.cancelled'),
    };
    return labels[status];
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      manual: t('admin.manual'),
      web: t('admin.web'),
      booking: t('admin.bookingCom'),
    };
    return labels[source] || source;
  };

  const formatPhone = (phone: string | null | undefined) => (phone || '').replace(/[^\d+]/g, '');

  const getRoomTypeNames = (group: BookingGroup) => {
    const names = group.bookings
      .map(b => b.room_types?.name)
      .filter(Boolean);
    if (names.length === 0) return null;
    const unique = [...new Set(names)];
    return unique.join(', ');
  };

  const getDateDisplay = (group: BookingGroup) => {
    if (!group.isGrouped || !group.hasDifferentDates) {
      return `${format(new Date(group.primary.check_in_date), 'dd.MM')} — ${format(new Date(group.primary.check_out_date), 'dd.MM.yyyy')}`;
    }
    const allCheckIns = group.bookings.map(b => b.check_in_date);
    const allCheckOuts = group.bookings.map(b => b.check_out_date);
    const minIn = allCheckIns.sort()[0];
    const maxOut = allCheckOuts.sort().reverse()[0];
    return `${format(new Date(minIn), 'dd.MM')} — ${format(new Date(maxOut), 'dd.MM.yyyy')}`;
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">{t('admin.bookingQueue')}</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.newBooking')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {([
          { value: 'all' as const, label: 'Все', badge: undefined as number | undefined },
          { value: 'pending' as const, label: 'Ожидает', badge: pendingCount as number | undefined },
          { value: 'approved' as const, label: 'Подтверждено', badge: undefined as number | undefined },
          { value: 'checked_in' as const, label: 'Заселён', badge: undefined as number | undefined },
          { value: 'checked_out' as const, label: 'Выселен', badge: undefined as number | undefined },
          { value: 'cancelled' as const, label: 'Отменено', badge: undefined as number | undefined },
        ]).map(({ value, label, badge }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              statusFilter === value
                ? value === 'all'
                  ? 'bg-foreground text-background border-foreground'
                  : value === 'pending'
                  ? 'bg-yellow-500 text-white border-yellow-500'
                  : value === 'approved'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : value === 'checked_in'
                  ? 'bg-green-500 text-white border-green-500'
                  : value === 'checked_out'
                  ? 'bg-muted-foreground text-background border-muted-foreground'
                  : 'bg-destructive text-destructive-foreground border-destructive'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
            )}
          >
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="ml-1.5 bg-white/30 rounded-full px-1.5">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <span className="text-sm font-medium text-destructive">
            {overdueCount} {overdueCount === 1 ? 'гость' : overdueCount < 5 ? 'гостя' : 'гостей'} просрочили дату выезда! Необходимо выселить или продлить.
          </span>
        </div>
      )}

      {/* Floating merge button */}
      {selectedIds.size >= 2 && (
        <div className="sticky top-2 z-30 flex justify-center">
          <Button 
            onClick={() => setMergeDialogOpen(true)}
            className="shadow-lg gap-2"
          >
            <Merge className="h-4 w-4" />
            Объединить выбранные ({selectedIds.size})
          </Button>
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {bookings.length === 0 ? t('admin.noBookings') : 'Нет бронирований по заданным фильтрам'}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedGroups.map((group) => {
            const overdue = isGroupOverdue(group);
            const primary = group.primary;

            return (
              <div
                key={group.key}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-4",
                  overdue
                    ? "bg-destructive/5 border-destructive/40 ring-1 ring-destructive/20"
                    : "bg-card",
                  !group.isGrouped && selectedIds.has(primary.id) && "ring-2 ring-primary/50"
                )}
              >
                {/* Checkbox for non-grouped active bookings */}
                {!group.isGrouped && ACTIVE_STATUSES.includes(primary.status) && (
                  <div className="flex items-center shrink-0">
                    <Checkbox
                      checked={selectedIds.has(primary.id)}
                      onCheckedChange={() => toggleSelect(primary.id)}
                    />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{primary.guest_name}</span>
                    <Badge className={statusColors[primary.status]} variant="outline">
                      {getStatusLabel(primary.status)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getSourceLabel(primary.source)}
                    </Badge>
                    {group.isGrouped && (
                      <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                        <BedDouble className="h-3 w-3 mr-1" />
                        {group.roomCount} номеров
                      </Badge>
                    )}
                    {primary.prepayment_received && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        ₸ {t('admin.prepayment')}
                      </Badge>
                    )}
                    {overdue && (
                      <Badge variant="destructive" className="text-xs animate-pulse">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Просрочен
                      </Badge>
                    )}
                    {group.hasDifferentDates && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                        Разные даты
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {primary.guest_phone ? (
                      <>
                        <button
                          onClick={() => setHistoryPhone(primary.guest_phone)}
                          className="hover:text-primary flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {primary.guest_phone}
                        </button>
                        <a
                          href={`https://wa.me/${formatPhone(primary.guest_phone).replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">Без телефона</span>
                    )}
                    {getRoomTypeNames(group) && (
                      <span>• {getRoomTypeNames(group)}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getDateDisplay(group)}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => handleOpenDetail(group)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {primary.status === 'pending' && (
                    <>
                      {!group.isGrouped && (
                        <Button size="sm" onClick={() => {
                          setSelectedBooking(primary);
                          setAssignDialogOpen(true);
                        }}>
                          <DoorOpen className="h-4 w-4 mr-1" />
                          Назначить номер
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => 
                        group.isGrouped ? handleQuickApproveGroup(group) : handleQuickApprove(primary.id)
                      }>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t('admin.approve')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCancelWithConfirm(primary)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Отменить
                      </Button>
                    </>
                  )}
                  {primary.status === 'approved' && !primary.room_id && !group.isGrouped && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setSelectedBooking(primary);
                      setAssignDialogOpen(true);
                    }}>
                      <DoorOpen className="h-4 w-4 mr-1" />
                      Назначить номер
                    </Button>
                  )}
                  {primary.status === 'approved' && (
                    <>
                      <Button size="sm" onClick={() => 
                        group.isGrouped ? handleCheckInGroup(group) : handleCheckIn(primary)
                      }>
                        <LogIn className="h-4 w-4 mr-1" />
                        {t('admin.checkIn')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCancelWithConfirm(primary)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Отменить
                      </Button>
                    </>
                  )}
                  {primary.status === 'checked_in' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenCheckoutGroup(group)}>
                        <LogOut className="h-4 w-4 mr-1" />
                        {t('admin.checkOut')}
                      </Button>
                      {!group.isGrouped && (
                        <Button size="sm" variant="outline" onClick={() => handleUndoCheckInWithConfirm(primary)}>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Отменить заселение
                        </Button>
                      )}
                    </>
                  )}
                  {isOwner && primary.status !== 'checked_in' && !group.isGrouped && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteWithConfirm(primary)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <PaginationItem key={page}>
                <button
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'h-9 w-9 text-sm rounded-md border transition-colors',
                    page === currentPage
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-accent'
                  )}
                >
                  {page}
                </button>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <ManualBookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleManualBookingSuccess}
        hotelId={hotelId}
      />

      <GuestHistoryModal
        open={!!historyPhone}
        onOpenChange={(open) => !open && setHistoryPhone(null)}
        phone={historyPhone || ''}
        hotelId={hotelId}
      />

      {selectedBooking && (
        <RoomAssignDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          bookingId={selectedBooking.id}
          hotelId={hotelId}
          roomTypeId={selectedBooking.room_type_id}
          checkInDate={selectedBooking.check_in_date}
          checkOutDate={selectedBooking.check_out_date}
          onSuccess={fetchBookings}
          multiRoom={true}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить бронирование?</AlertDialogTitle>
            <AlertDialogDescription>
              Гость: <strong>{bookingToCancel?.guest_name}</strong>
              <br />
              Номер будет освобождён для новых бронирований.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Причина отмены (необязательно)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancellation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Отменить бронирование
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Check-in Confirmation Dialog */}
      <AlertDialog open={undoCheckInDialogOpen} onOpenChange={setUndoCheckInDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заселение?</AlertDialogTitle>
            <AlertDialogDescription>
              Гость: <strong>{bookingToUndoCheckIn?.guest_name}</strong>
              <br />
              Статус бронирования будет возвращён на "Подтверждено", номер останется за гостем.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUndoCheckIn}>
              Отменить заселение
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Объединить бронирования?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите объединить {selectedIds.size} бронирований? Они будут сгруппированы для единого управления и выставления счетов. Имя и телефон будут нормализованы по первому выбранному бронированию.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge}>
              Объединить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Checkout Invoice Modal */}
      {checkoutBookingIds.length > 0 && (
        <CheckoutInvoiceModal
          open={checkoutModalOpen}
          onOpenChange={(open) => {
            setCheckoutModalOpen(open);
            if (!open) setCheckoutBookingIds([]);
          }}
          bookingIds={checkoutBookingIds}
          hotelId={hotelId}
          onSuccess={fetchBookings}
        />
      )}

      {/* Booking Detail Modal */}
      {detailBookingIds.length > 0 && (
        <BookingDetailModal
          open={detailModalOpen}
          onOpenChange={(open) => {
            setDetailModalOpen(open);
            if (!open) setDetailBookingIds([]);
          }}
          bookingIds={detailBookingIds}
          hotelId={hotelId}
          onUpdate={fetchBookings}
        />
      )}

      {/* Delete Confirmation Dialog (Owner only) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить бронирование?</AlertDialogTitle>
            <AlertDialogDescription>
              Гость: <strong>{bookingToDelete?.guest_name}</strong>
              <br />
              Это действие нельзя отменить. Запись будет полностью удалена из системы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Room Availability Warning Dialog */}
      <AlertDialog open={availabilityWarningOpen} onOpenChange={setAvailabilityWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Нет свободных номеров
            </AlertDialogTitle>
            <AlertDialogDescription>{availabilityWarningMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingApproveAction(null)}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setAvailabilityWarningOpen(false);
              if (pendingApproveAction) {
                await pendingApproveAction();
                setPendingApproveAction(null);
              }
            }}>
              Подтвердить всё равно
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
