import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, DoorOpen, Clock, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookingsTab } from '@/components/admin/BookingsTab';
import { RoomsTab } from '@/components/admin/RoomsTab';
import { RoomTypesTab } from '@/components/admin/RoomTypesTab';
import { ClientsTab } from '@/components/admin/ClientsTab';

interface Hotel {
  id: string;
  name: string;
  status?: string;
}

export default function Admin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin, hotelId: userHotelId, loading } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, occupied: 0 });
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [hotelStatus, setHotelStatus] = useState<string | null>(null);

  // For SuperAdmin: fetch all hotels; for others: use their hotelId and check status
  useEffect(() => {
    if (isSuperAdmin) {
      fetchHotels();
    } else if (userHotelId) {
      setSelectedHotelId(userHotelId);
      checkHotelStatus(userHotelId);
    }
  }, [isSuperAdmin, userHotelId]);

  const checkHotelStatus = async (hotelId: string) => {
    const { data } = await supabase
      .from('hotels')
      .select('status')
      .eq('id', hotelId)
      .maybeSingle();
    
    if (data) {
      setHotelStatus(data.status);
      if (data.status === 'pending') {
        navigate('/pending-approval');
      } else if (data.status === 'rejected') {
        navigate('/');
      }
    }
  };

  // Fetch stats when selectedHotelId changes
  useEffect(() => {
    if (selectedHotelId) {
      fetchStats(selectedHotelId);
    }
  }, [selectedHotelId]);

  const fetchHotels = async () => {
    const { data } = await supabase
      .from('hotels')
      .select('id, name')
      .order('name');
    if (data && data.length > 0) {
      setHotels(data);
      setSelectedHotelId(data[0].id);
    }
  };

  const fetchStats = async (hotelId: string) => {
    const { count: total } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('hotel_id', hotelId);
    const { count: pending } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('hotel_id', hotelId)
      .eq('status', 'pending');
    const { count: occupied } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('hotel_id', hotelId)
      .eq('status', 'occupied');
    setStats({ total: total || 0, pending: pending || 0, occupied: occupied || 0 });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/" />;

  // If no hotel selected yet (SuperAdmin loading hotels)
  if (!selectedHotelId && !isSuperAdmin) {
    return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-display font-bold">{t('admin.dashboard')}</h1>
          
          {/* Hotel selector for SuperAdmin */}
          {isSuperAdmin && hotels.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <Select value={selectedHotelId || ''} onValueChange={setSelectedHotelId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Выберите отель" />
                </SelectTrigger>
                <SelectContent>
                  {hotels.map((hotel) => (
                    <SelectItem key={hotel.id} value={hotel.id}>
                      {hotel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

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
        {selectedHotelId ? (
          <Tabs defaultValue="bookings" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="bookings">{t('admin.bookingQueue')}</TabsTrigger>
              <TabsTrigger value="rooms">{t('admin.rooms')}</TabsTrigger>
              <TabsTrigger value="room-types">{t('admin.roomTypes')}</TabsTrigger>
              <TabsTrigger value="clients">{t('admin.clients')}</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings">
              <Card><CardContent className="pt-6"><BookingsTab hotelId={selectedHotelId} /></CardContent></Card>
            </TabsContent>

            <TabsContent value="rooms">
              <Card><CardContent className="pt-6"><RoomsTab hotelId={selectedHotelId} /></CardContent></Card>
            </TabsContent>

            <TabsContent value="room-types">
              <Card><CardContent className="pt-6"><RoomTypesTab hotelId={selectedHotelId} /></CardContent></Card>
            </TabsContent>

            <TabsContent value="clients">
              <Card><CardContent className="pt-6"><ClientsTab hotelId={selectedHotelId} /></CardContent></Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Выберите отель для управления
          </div>
        )}
      </main>
    </div>
  );
}
