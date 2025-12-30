import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type BookingStatus = 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'cancelled';

interface Booking {
  id: string;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  room_types: { name: string } | null;
  total_price: number | null;
}

interface Client {
  id: string;
  full_name: string;
  phone: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

const statusColors: Record<BookingStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700',
  approved: 'bg-blue-500/20 text-blue-700',
  checked_in: 'bg-green-500/20 text-green-700',
  checked_out: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/20 text-red-700',
};

export function ClientHistoryDialog({ open, onOpenChange, client }: Props) {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && client) {
      fetchBookings();
    }
  }, [open, client]);

  const fetchBookings = async () => {
    if (!client) return;
    setLoading(true);
    
    const { data } = await supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date, status, total_price, room_types(name)')
      .eq('client_id', client.id)
      .order('check_in_date', { ascending: false });
    
    setBookings((data as Booking[]) || []);
    setLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>История бронирований: {client?.full_name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
        ) : bookings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Нет бронирований
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {bookings.map((booking) => (
              <div key={booking.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{booking.room_types?.name}</span>
                  <Badge className={statusColors[booking.status]} variant="secondary">
                    {getStatusLabel(booking.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(booking.check_in_date), 'dd.MM.yyyy')} —{' '}
                  {format(new Date(booking.check_out_date), 'dd.MM.yyyy')}
                </p>
                {booking.total_price && (
                  <p className="text-sm font-medium mt-1">
                    {booking.total_price.toLocaleString()} ₸
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
