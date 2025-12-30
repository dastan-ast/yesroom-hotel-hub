import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CalendarDays, Users, DoorOpen, Clock, CheckCircle, XCircle, LogIn, LogOut } from 'lucide-react';

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

export default function Admin() {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, occupied: 0 });

  useEffect(() => {
    if (isAdmin) {
      fetchBookings();
      fetchStats();
    }
  }, [isAdmin]);

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, room_types(name)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setBookings(data as Booking[]);
  };

  const fetchStats = async () => {
    const { count: total } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    const { count: pending } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: occupied } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied');
    setStats({ total: total || 0, pending: pending || 0, occupied: occupied || 0 });
  };

  const updateStatus = async (id: string, status: BookingStatus) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) { toast.error(t('common.error')); return; }
    toast.success(t('common.success'));
    fetchBookings();
    fetchStats();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin) return <Navigate to="/" />;

  const statusColors: Record<BookingStatus, string> = {
    pending: 'status-pending',
    approved: 'status-approved',
    checked_in: 'status-checked-in',
    checked_out: 'status-checked-out',
    cancelled: 'status-cancelled',
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-8">{t('admin.dashboard')}</h1>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Card><CardContent className="pt-6 flex items-center gap-4">
            <CalendarDays className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">{t('admin.totalBookings')}</p><p className="text-2xl font-bold">{stats.total}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-4">
            <Clock className="h-8 w-8 text-warning" />
            <div><p className="text-sm text-muted-foreground">{t('admin.pendingBookings')}</p><p className="text-2xl font-bold">{stats.pending}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-4">
            <DoorOpen className="h-8 w-8 text-success" />
            <div><p className="text-sm text-muted-foreground">{t('admin.occupiedRooms')}</p><p className="text-2xl font-bold">{stats.occupied}</p></div>
          </CardContent></Card>
        </div>

        {/* Booking Queue */}
        <Card>
          <CardHeader><CardTitle>{t('admin.bookingQueue')}</CardTitle></CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t('admin.noBookings')}</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{booking.guest_name}</span>
                        <Badge className={statusColors[booking.status]}>{t(`admin.${booking.status.replace('_', '')}` as any)}</Badge>
                        {booking.prepayment_received && <Badge variant="outline" className="text-green-600">₸</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{booking.guest_phone} • {booking.room_types?.name}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(booking.check_in_date), 'dd.MM')} - {format(new Date(booking.check_out_date), 'dd.MM.yyyy')}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {booking.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => updateStatus(booking.id, 'approved')}><CheckCircle className="h-4 w-4 mr-1" />{t('admin.approve')}</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus(booking.id, 'cancelled')}><XCircle className="h-4 w-4 mr-1" />{t('admin.cancel')}</Button>
                        </>
                      )}
                      {booking.status === 'approved' && <Button size="sm" onClick={() => updateStatus(booking.id, 'checked_in')}><LogIn className="h-4 w-4 mr-1" />{t('admin.checkIn')}</Button>}
                      {booking.status === 'checked_in' && <Button size="sm" variant="secondary" onClick={() => updateStatus(booking.id, 'checked_out')}><LogOut className="h-4 w-4 mr-1" />{t('admin.checkOut')}</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
