import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset, SidebarFooter } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, DoorOpen, Clock, LayoutDashboard, BedDouble, Users, Building2, Settings, LogOut, ChevronRight, Grid3X3, Bell, Coffee, Key, HelpCircle, BookOpen } from 'lucide-react';
import { BookingsTab } from '@/components/admin/BookingsTab';
import { RoomsTab } from '@/components/admin/RoomsTab';
import { RoomTypesTab } from '@/components/admin/RoomTypesTab';
import { ClientsTab } from '@/components/admin/ClientsTab';
import { ShahmatkaGrid } from '@/components/admin/ShahmatkaGrid';
import { LiveFeedSidebar } from '@/components/admin/LiveFeedSidebar';
import { ServiceLogTab } from '@/components/admin/ServiceLogTab';
import { ServiceCatalogTab } from '@/components/admin/ServiceCatalogTab';
import { ApiKeysTab } from '@/components/admin/ApiKeysTab';
import { HotelSettingsTab } from '@/components/admin/HotelSettingsTab';
import { HelpTab } from '@/components/admin/HelpTab';
import { ServiceStatsWidget } from '@/components/admin/ServiceStatsWidget';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, loading, hotelId, signOut, profile } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState({ total: 0, pending: 0, occupied: 0 });
  const [hotelName, setHotelName] = useState('');
  const [hotelStatus, setHotelStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLiveFeed, setShowLiveFeed] = useState(true);

  useEffect(() => {
    if (isAdmin && hotelId) {
      fetchStats();
      fetchHotelInfo();
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

  const fetchHotelInfo = async () => {
    if (!hotelId) return;
    const { data } = await supabase
      .from('hotels')
      .select('name, status')
      .eq('id', hotelId)
      .maybeSingle();
    if (data) {
      setHotelName(data.name);
      setHotelStatus(data.status);
      
      // Redirect if hotel is pending or rejected
      if (data.status === 'pending') {
        navigate('/pending-approval');
      } else if (data.status === 'rejected') {
        navigate('/');
      }
    }
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
    { id: 'dashboard', icon: LayoutDashboard, label: t('admin.dashboard') },
    { id: 'bookings', icon: CalendarDays, label: t('admin.bookingQueue') },
    { id: 'shahmatka', icon: Grid3X3, label: t('admin.shahmatka') },
    { id: 'rooms', icon: DoorOpen, label: t('admin.rooms') },
    { id: 'room-types', icon: BedDouble, label: t('admin.roomTypes') },
    { id: 'clients', icon: Users, label: t('admin.clients') },
    { id: 'services', icon: Coffee, label: 'Журнал услуг' },
    { id: 'service-catalog', icon: BookOpen, label: 'Справочник услуг' },
    { id: 'integrations', icon: Key, label: 'Интеграции' },
    { id: 'settings', icon: Settings, label: 'Настройки отеля' },
    { id: 'help', icon: HelpCircle, label: 'Справка' },
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
                    {item.id === 'bookings' && stats.pending > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                        {stats.pending}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-2 border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  <span>{t('nav.logout')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            <header className="h-14 border-b flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{hotelName}</span>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-foreground font-medium">
                    {menuItems.find(m => m.id === activeTab)?.label}
                  </span>
                </div>
              </div>
              <Button
                variant={showLiveFeed ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowLiveFeed(!showLiveFeed)}
                className="gap-2"
              >
                <Bell className="h-4 w-4" />
                {stats.pending > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {stats.pending}
                  </span>
                )}
              </Button>
            </header>

            <main className="flex-1 flex">
              <div className="flex-1 p-6 overflow-auto">
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
                          <h3 className="font-semibold mb-4">{t('admin.bookingQueue')}</h3>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" onClick={() => setActiveTab('bookings')}>
                              <CalendarDays className="h-4 w-4 mr-2" />
                              {t('admin.bookingQueue')}
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('shahmatka')}>
                              <Grid3X3 className="h-4 w-4 mr-2" />
                              {t('admin.shahmatka')}
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('rooms')}>
                              <DoorOpen className="h-4 w-4 mr-2" />
                              {t('admin.rooms')}
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('clients')}>
                              <Users className="h-4 w-4 mr-2" />
                              {t('admin.clients')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <ServiceStatsWidget hotelId={hotelId} onNavigate={setActiveTab} />
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

                {activeTab === 'shahmatka' && (
                  <Card>
                    <CardContent className="pt-6">
                      <ShahmatkaGrid hotelId={hotelId} />
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

                {activeTab === 'services' && (
                  <Card>
                    <CardContent className="pt-6">
                      <ServiceLogTab hotelId={hotelId} />
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'service-catalog' && (
                  <Card>
                    <CardContent className="pt-6">
                      <ServiceCatalogTab hotelId={hotelId} />
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'integrations' && (
                  <ApiKeysTab hotelId={hotelId} />
                )}

                {activeTab === 'settings' && (
                  <HotelSettingsTab hotelId={hotelId} />
                )}

                {activeTab === 'help' && (
                  <HelpTab />
                )}
              </div>

              {/* Live Feed Sidebar */}
              {showLiveFeed && (
                <div className="w-80 border-l p-4 hidden lg:block">
                  <LiveFeedSidebar hotelId={hotelId} onBookingUpdated={fetchStats} />
                </div>
              )}
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
