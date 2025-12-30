import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, DoorOpen, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookingsTab } from '@/components/admin/BookingsTab';
import { RoomsTab } from '@/components/admin/RoomsTab';
import { RoomTypesTab } from '@/components/admin/RoomTypesTab';
import { ClientsTab } from '@/components/admin/ClientsTab';

export default function Admin() {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, occupied: 0 });

  useEffect(() => {
    if (isAdmin) fetchStats();
  }, [isAdmin]);

  const fetchStats = async () => {
    const { count: total } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    const { count: pending } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: occupied } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied');
    setStats({ total: total || 0, pending: pending || 0, occupied: occupied || 0 });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin) return <Navigate to="/" />;

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
            <Clock className="h-8 w-8 text-yellow-500" />
            <div><p className="text-sm text-muted-foreground">{t('admin.pendingBookings')}</p><p className="text-2xl font-bold">{stats.pending}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-4">
            <DoorOpen className="h-8 w-8 text-green-500" />
            <div><p className="text-sm text-muted-foreground">{t('admin.occupiedRooms')}</p><p className="text-2xl font-bold">{stats.occupied}</p></div>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="bookings">{t('admin.bookingQueue')}</TabsTrigger>
            <TabsTrigger value="rooms">{t('admin.rooms')}</TabsTrigger>
            <TabsTrigger value="room-types">{t('admin.roomTypes')}</TabsTrigger>
            <TabsTrigger value="clients">{t('admin.clients')}</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <Card><CardContent className="pt-6"><BookingsTab /></CardContent></Card>
          </TabsContent>

          <TabsContent value="rooms">
            <Card><CardContent className="pt-6"><RoomsTab /></CardContent></Card>
          </TabsContent>

          <TabsContent value="room-types">
            <Card><CardContent className="pt-6"><RoomTypesTab /></CardContent></Card>
          </TabsContent>

          <TabsContent value="clients">
            <Card><CardContent className="pt-6"><ClientsTab /></CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
