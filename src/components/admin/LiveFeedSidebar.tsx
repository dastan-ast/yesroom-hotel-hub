import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Bell, CheckCircle, XCircle, Phone, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingBooking {
  id: string;
  guest_name: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  created_at: string;
  room_types: { name: string } | null;
}

interface Props {
  hotelId: string;
  onBookingUpdated?: () => void;
}

export function LiveFeedSidebar({ hotelId, onBookingUpdated }: Props) {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) {
      fetchPendingBookings();
      
      // Set up realtime subscription
      const channel = supabase
        .channel('pending-bookings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `hotel_id=eq.${hotelId}`,
          },
          () => {
            fetchPendingBookings();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [hotelId]);

  const fetchPendingBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('id, guest_name, guest_phone, check_in_date, check_out_date, created_at, room_types(name)')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .eq('source', 'web')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setBookings(data as PendingBooking[]);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'approved' }).eq('id', id);
    if (error) {
      toast.error(t('common.error'));
      return;
    }
    toast.success('Бронирование подтверждено');
    fetchPendingBookings();
    onBookingUpdated?.();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      toast.error(t('common.error'));
      return;
    }
    toast.success('Бронирование отменено');
    fetchPendingBookings();
    onBookingUpdated?.();
  };

  const formatPhone = (phone: string) => phone.replace(/[^\d+]/g, '');

  return (
    <div className="bg-card border rounded-lg h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Новые заявки</h3>
        {bookings.length > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {bookings.length}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {t('common.loading')}
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Нет новых заявок
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {bookings.map(booking => (
              <div
                key={booking.id}
                className="p-3 bg-muted/50 rounded-lg border border-yellow-500/30 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{booking.guest_name}</p>
                    <a
                      href={`tel:${formatPhone(booking.guest_phone)}`}
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Phone className="h-3 w-3" />
                      {booking.guest_phone}
                    </a>
                  </div>
                  <a
                    href={`https://wa.me/${formatPhone(booking.guest_phone).replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>{booking.room_types?.name}</p>
                  <p>
                    {format(new Date(booking.check_in_date), 'dd.MM')} –{' '}
                    {format(new Date(booking.check_out_date), 'dd.MM.yy')}
                  </p>
                </div>

                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => handleApprove(booking.id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('admin.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-2"
                    onClick={() => handleReject(booking.id)}
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
