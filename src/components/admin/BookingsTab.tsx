import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Plus, CheckCircle, XCircle, LogIn, LogOut, Phone, MessageCircle, DoorOpen, RotateCcw, Eye } from 'lucide-react';
import { ManualBookingDialog } from './ManualBookingDialog';
import { GuestHistoryModal } from './GuestHistoryModal';
import { RoomAssignDialog } from './RoomAssignDialog';
import { CheckoutInvoiceModal } from './CheckoutInvoiceModal';
import { BookingDetailModal } from './BookingDetailModal';

type BookingStatus = 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'cancelled';

interface Booking {
  id: string;
  guest_name: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  source: string;
  prepayment_received: boolean;
  room_types: { name: string } | null;
  room_id: string | null;
  room_type_id: string | null;
  additional_info: Record<string, any> | null;
}

const statusColors: Record<BookingStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500',
  approved: 'bg-blue-500/20 text-blue-700 border-blue-500',
  checked_in: 'bg-green-500/20 text-green-700 border-green-500',
  checked_out: 'bg-muted text-muted-foreground border-muted-foreground/30',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500',
};

export function BookingsTab({ hotelId }: { hotelId: string }) {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Undo check-in dialog state
  const [undoCheckInDialogOpen, setUndoCheckInDialogOpen] = useState(false);
  const [bookingToUndoCheckIn, setBookingToUndoCheckIn] = useState<Booking | null>(null);

  // Checkout invoice modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [bookingToCheckout, setBookingToCheckout] = useState<Booking | null>(null);

  // Booking detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [bookingToView, setBookingToView] = useState<Booking | null>(null);

  useEffect(() => {
    if (hotelId) {
      fetchBookings();
    }
  }, [hotelId]);

  const fetchBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, room_types(name), room_id, room_type_id, additional_info')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setBookings(data as Booking[]);
    setLoading(false);
  };

  const handleCheckIn = async (booking: Booking) => {
    if (!booking.room_id) {
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
      .eq('id', booking.room_id);

    if (roomError) {
      toast.error(t('common.error'));
      return;
    }

    toast.success(t('common.success'));
    fetchBookings();
  };

  // Open checkout modal instead of direct checkout
  const handleOpenCheckout = (booking: Booking) => {
    setBookingToCheckout(booking);
    setCheckoutModalOpen(true);
  };

  // Open detail modal
  const handleOpenDetail = (booking: Booking) => {
    setBookingToView(booking);
    setDetailModalOpen(true);
  };

  const handleQuickApprove = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'approved' })
      .eq('id', bookingId);

    if (error) {
      toast.error(t('common.error'));
      return;
    }

    toast.success('Бронирование подтверждено (без номера)');
    fetchBookings();
  };

  // Cancel booking with confirmation
  const handleCancelWithConfirm = (booking: Booking) => {
    setBookingToCancel(booking);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const confirmCancellation = async () => {
    if (!bookingToCancel) return;

    // Build updated additional_info with cancellation reason
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

    // Release room if assigned
    if (bookingToCancel.room_id) {
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'available' })
        .eq('id', bookingToCancel.room_id);

      if (roomError) {
        toast.error('Ошибка при освобождении номера');
      }
    }

    toast.success('Бронирование отменено');
    setCancelDialogOpen(false);
    setBookingToCancel(null);
    setCancelReason('');
    fetchBookings();
  };

  // Undo check-in
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

    // Return room to booked status
    if (bookingToUndoCheckIn.room_id) {
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'booked' })
        .eq('id', bookingToUndoCheckIn.room_id);

      if (roomError) {
        toast.error('Ошибка при обновлении статуса номера');
      }
    }

    toast.success('Заселение отменено');
    setUndoCheckInDialogOpen(false);
    setBookingToUndoCheckIn(null);
    fetchBookings();
  };

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

  const formatPhone = (phone: string) => phone.replace(/[^\d+]/g, '');

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.bookingQueue')}</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.newBooking')}
        </Button>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t('admin.noBookings')}</div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">{booking.guest_name}</span>
                  <Badge className={statusColors[booking.status]} variant="outline">
                    {getStatusLabel(booking.status)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {getSourceLabel(booking.source)}
                  </Badge>
                  {booking.prepayment_received && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      ₸ {t('admin.prepayment')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <button
                    onClick={() => setHistoryPhone(booking.guest_phone)}
                    className="hover:text-primary flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {booking.guest_phone}
                  </button>
                  <a
                    href={`https://wa.me/${formatPhone(booking.guest_phone).replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  <span>• {booking.room_types?.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(booking.check_in_date), 'dd.MM')} —{' '}
                  {format(new Date(booking.check_out_date), 'dd.MM.yyyy')}
                </p>
              </div>
                <div className="flex gap-2 flex-wrap">
                  {/* View detail button for all statuses */}
                  <Button size="sm" variant="ghost" onClick={() => handleOpenDetail(booking)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {booking.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => {
                        setSelectedBooking(booking);
                        setAssignDialogOpen(true);
                      }}>
                        <DoorOpen className="h-4 w-4 mr-1" />
                        Назначить номер
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleQuickApprove(booking.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t('admin.approve')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCancelWithConfirm(booking)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Отменить
                      </Button>
                    </>
                  )}
                  {booking.status === 'approved' && !booking.room_id && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setSelectedBooking(booking);
                      setAssignDialogOpen(true);
                    }}>
                      <DoorOpen className="h-4 w-4 mr-1" />
                      Назначить номер
                    </Button>
                  )}
                  {booking.status === 'approved' && (
                    <>
                      <Button size="sm" onClick={() => handleCheckIn(booking)}>
                        <LogIn className="h-4 w-4 mr-1" />
                        {t('admin.checkIn')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCancelWithConfirm(booking)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Отменить
                      </Button>
                    </>
                  )}
                  {booking.status === 'checked_in' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenCheckout(booking)}>
                        <LogOut className="h-4 w-4 mr-1" />
                        {t('admin.checkOut')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleUndoCheckInWithConfirm(booking)}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Отменить заселение
                      </Button>
                    </>
                  )}
                </div>
            </div>
          ))}
        </div>
      )}

      <ManualBookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchBookings}
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
          onSuccess={fetchBookings}
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

      {/* Checkout Invoice Modal */}
      {bookingToCheckout && (
        <CheckoutInvoiceModal
          open={checkoutModalOpen}
          onOpenChange={setCheckoutModalOpen}
          bookingId={bookingToCheckout.id}
          hotelId={hotelId}
          onSuccess={fetchBookings}
        />
      )}

      {/* Booking Detail Modal */}
      {bookingToView && (
        <BookingDetailModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          bookingId={bookingToView.id}
          hotelId={hotelId}
          onUpdate={fetchBookings}
        />
      )}
    </div>
  );
}
