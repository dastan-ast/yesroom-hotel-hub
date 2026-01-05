import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, CheckCircle, XCircle, LogIn, LogOut, Phone, MessageCircle, DoorOpen } from 'lucide-react';
import { ManualBookingDialog } from './ManualBookingDialog';
import { GuestHistoryModal } from './GuestHistoryModal';
import { RoomAssignDialog } from './RoomAssignDialog';

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

  useEffect(() => {
    if (hotelId) {
      fetchBookings();
    }
  }, [hotelId]);

  const fetchBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, room_types(name), room_id, room_type_id')
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

  const handleCheckOut = async (booking: Booking) => {
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'checked_out' })
      .eq('id', booking.id);

    if (bookingError) {
      toast.error(t('common.error'));
      return;
    }

    if (booking.room_id) {
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'available' })
        .eq('id', booking.room_id);

      if (roomError) {
        toast.error(t('common.error'));
        return;
      }
    }

    toast.success(t('common.success'));
    fetchBookings();
  };

  const updateStatus = async (id: string, status: BookingStatus) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) {
      toast.error(t('common.error'));
      return;
    }
    toast.success(t('common.success'));
    fetchBookings();
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
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(booking.id, 'cancelled')}>
                      <XCircle className="h-4 w-4 mr-1" />
                      {t('admin.cancel')}
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
                  <Button size="sm" onClick={() => handleCheckIn(booking)}>
                    <LogIn className="h-4 w-4 mr-1" />
                    {t('admin.checkIn')}
                  </Button>
                )}
                {booking.status === 'checked_in' && (
                  <Button size="sm" variant="secondary" onClick={() => handleCheckOut(booking)}>
                    <LogOut className="h-4 w-4 mr-1" />
                    {t('admin.checkOut')}
                  </Button>
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
    </div>
  );
}
