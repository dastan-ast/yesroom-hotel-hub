import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, CheckCircle, XCircle, LogIn, LogOut } from 'lucide-react';
import { ManualBookingDialog } from './ManualBookingDialog';

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

  useEffect(() => {
    if (hotelId) {
      fetchBookings();
    }
  }, [hotelId]);

  const fetchBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, room_types(name)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setBookings(data as Booking[]);
    setLoading(false);
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
                      ₸ Предоплата
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {booking.guest_phone} • {booking.room_types?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(booking.check_in_date), 'dd.MM')} —{' '}
                  {format(new Date(booking.check_out_date), 'dd.MM.yyyy')}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {booking.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(booking.id, 'approved')}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {t('admin.approve')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(booking.id, 'cancelled')}>
                      <XCircle className="h-4 w-4 mr-1" />
                      {t('admin.cancel')}
                    </Button>
                  </>
                )}
                {booking.status === 'approved' && (
                  <Button size="sm" onClick={() => updateStatus(booking.id, 'checked_in')}>
                    <LogIn className="h-4 w-4 mr-1" />
                    {t('admin.checkIn')}
                  </Button>
                )}
                {booking.status === 'checked_in' && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(booking.id, 'checked_out')}>
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
    </div>
  );
}
