import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset, SidebarFooter } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, DoorOpen, Clock, LayoutDashboard, BedDouble, Users, Building2, Settings, LogOut, ChevronRight } from 'lucide-react';
import { BookingsTab } from '@/components/admin/BookingsTab';
import { RoomsTab } from '@/components/admin/RoomsTab';
import { RoomTypesTab } from '@/components/admin/RoomTypesTab';
import { ClientsTab } from '@/components/admin/ClientsTab';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, isAdmin, loading, hotelId, signOut, profile } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState({ total: 0, pending: 0, occupied: 0 });
  const [hotelName, setHotelName] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (isAdmin && hotelId) {
      fetchStats();
      fetchHotelName();
    }
  }, [isAdmin, hotelId]);

  const fetchStats = async () => {
    if (!hotelId) return;
    
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

  const fetchHotelName = async () => {
    if (!hotelId) return;
    const { data } = await supabase
      .from('hotels')
      .select('name')
      .eq('id', hotelId)
      .single();
    if (data) setHotelName(data.name);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!hotelId) {
    return <Navigate to="/onboarding" replace />;
  }

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Дашборд' },
    { id: 'bookings', icon: CalendarDays, label: t('admin.bookingQueue') },
    { id: 'rooms', icon: DoorOpen, label: t('admin.rooms') },
    { id: 'room-types', icon: BedDouble, label: t('admin.roomTypes') },
    { id: 'clients', icon: Users, label: t('admin.clients') },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold truncate">{hotelName || 'YesRoom'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.full_name}</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={activeTab === item.id}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-2 border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings className="h-4 w-4" />
                  <span>Настройки</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  <span>{t('nav.logout')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1">
          <header className="h-14 border-b flex items-center gap-4 px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{hotelName}</span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">
                {menuItems.find(m => m.id === activeTab)?.label}
              </span>
            </div>
          </header>

          <main className="p-6">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-display font-bold">{t('admin.dashboard')}</h1>
                
                <div className="grid sm:grid-cols-3 gap-4">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('bookings')}>
                    <CardContent className="pt-6 flex items-center gap-4">
                      <CalendarDays className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t('admin.totalBookings')}</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('bookings')}>
                    <CardContent className="pt-6 flex items-center gap-4">
                      <Clock className="h-8 w-8 text-yellow-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t('admin.pendingBookings')}</p>
                        <p className="text-2xl font-bold">{stats.pending}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('rooms')}>
                    <CardContent className="pt-6 flex items-center gap-4">
                      <DoorOpen className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t('admin.occupiedRooms')}</p>
                        <p className="text-2xl font-bold">{stats.occupied}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-4">Быстрые действия</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => setActiveTab('bookings')}>
                          <CalendarDays className="h-4 w-4 mr-2" />
                          Бронирования
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('rooms')}>
                          <DoorOpen className="h-4 w-4 mr-2" />
                          Номера
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('room-types')}>
                          <BedDouble className="h-4 w-4 mr-2" />
                          Типы номеров
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('clients')}>
                          <Users className="h-4 w-4 mr-2" />
                          Клиенты
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'bookings' && (
              <Card>
                <CardContent className="pt-6">
                  <BookingsTab hotelId={hotelId} />
                </CardContent>
              </Card>
            )}

            {activeTab === 'rooms' && (
              <Card>
                <CardContent className="pt-6">
                  <RoomsTab hotelId={hotelId} />
                </CardContent>
              </Card>
            )}

            {activeTab === 'room-types' && (
              <Card>
                <CardContent className="pt-6">
                  <RoomTypesTab hotelId={hotelId} />
                </CardContent>
              </Card>
            )}

            {activeTab === 'clients' && (
              <Card>
                <CardContent className="pt-6">
                  <ClientsTab hotelId={hotelId} />
                </CardContent>
              </Card>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
