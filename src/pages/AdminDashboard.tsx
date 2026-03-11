import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, DoorOpen, Clock, LayoutDashboard, BedDouble, Users, Building2, Settings, LogOut, ChevronRight, Grid3X3, Bell, Coffee, Key, HelpCircle, Shield, BarChart3, CreditCard, MessageCircle, List, BookOpen } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { StaffTab } from '@/components/admin/StaffTab';
import { ServiceStatsWidget } from '@/components/admin/ServiceStatsWidget';
import { ExecutiveDashboard } from '@/components/admin/ExecutiveDashboard';
import { SubscriptionBanner } from '@/components/admin/SubscriptionBanner';
import { SubscriptionTab } from '@/components/admin/SubscriptionTab';
import { ActivityLogTab } from '@/components/admin/ActivityLogTab';
import { CheckoutAdjustmentsWidget } from '@/components/admin/CheckoutAdjustmentsWidget';
import { LeadsTab } from '@/components/admin/LeadsTab';
import { AdminKpiTab } from '@/components/admin/AdminKpiTab';


export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, isOwner, loading, hotelId, signOut, profile } = useAuth();
  const { canAccessModule, loading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const [stats, setStats] = useState({ total: 0, pending: 0, occupied: 0 });
  const [hotelName, setHotelName] = useState('');
  const [hotelStatus, setHotelStatus] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('trial');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLiveFeed, setShowLiveFeed] = useState(true);
  const [pendingAdjustments, setPendingAdjustments] = useState(0);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // All menu items with permission mapping
  const allMenuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('admin.dashboard'), permission: 'dashboard' },
    { id: 'analytics', icon: BarChart3, label: 'Аналитика', permission: 'dashboard' },
    
    { id: 'leads', icon: MessageCircle, label: 'Лиды', permission: 'bookings' },
    { id: 'bookings', icon: CalendarDays, label: t('admin.bookingQueue'), permission: 'bookings' },
    { id: 'rooms', icon: DoorOpen, label: t('admin.rooms'), permission: 'rooms' },
    { id: 'room-types', icon: BedDouble, label: t('admin.roomTypes'), permission: 'room_types' },
    { id: 'clients', icon: Users, label: t('admin.clients'), permission: 'clients' },
    { id: 'services', icon: Coffee, label: 'Услуги', permission: 'services' },
    { id: 'integrations', icon: Key, label: 'Интеграции', permission: 'integrations' },
    { id: 'settings', icon: Settings, label: 'Настройки отеля', permission: 'settings' },
    { id: 'staff', icon: Shield, label: 'Персонал', permission: 'staff', ownerOnly: true },
    { id: 'subscription', icon: CreditCard, label: 'Подписка', permission: null, ownerOnly: true },
    { id: 'admin-kpi', icon: BarChart3, label: 'KPI Админов', permission: null, ownerOnly: true },
    { id: 'help', icon: HelpCircle, label: 'Справка', permission: null },
  ];

  // Filter menu items based on permissions
  const menuItems = allMenuItems.filter(item => {
    if (item.permission === null) return true;
    if (item.ownerOnly && !isOwner) return false;
    return canAccessModule(item.permission);
  });

  useEffect(() => {
    if (isAdmin && hotelId) {
      fetchStats();
      fetchHotelInfo();
    }
  }, [isAdmin, hotelId]);

  // Fetch pending checkout adjustments count for owner
  useEffect(() => {
    if (isOwner && hotelId) {
      supabase.from('checkout_adjustments')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('status', 'pending')
        .then(({ count }) => setPendingAdjustments(count || 0));
    }
  }, [isOwner, hotelId]);

  // If current tab is not accessible, switch to first available
  useEffect(() => {
    if (loading || permissionsLoading) return;
    const currentItem = allMenuItems.find(m => m.id === activeTab);
    if (currentItem && currentItem.permission && !canAccessModule(currentItem.permission)) {
      const firstAvailable = menuItems[0];
      if (firstAvailable) {
        setActiveTab(firstAvailable.id);
      }
    }
  }, [activeTab, canAccessModule, loading, permissionsLoading]);

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
      .select('name, status, subscription_status, trial_ends_at')
      .eq('id', hotelId)
      .maybeSingle();
    if (data) {
      setHotelName(data.name);
      setHotelStatus(data.status);
      setSubscriptionStatus(data.subscription_status);
      setTrialEndsAt(data.trial_ends_at);
      
      if (data.status === 'pending') {
        navigate('/pending-approval');
      } else if (data.status === 'rejected') {
        navigate('/');
      }
    }
  };

  if (loading || permissionsLoading) {
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

  return (
    <SidebarProvider defaultOpen={false}>
      <AdminDashboardContent
        hotelName={hotelName}
        profile={profile}
        menuItems={menuItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        pendingAdjustments={pendingAdjustments}
        handleSignOut={handleSignOut}
        isOwner={isOwner}
        hotelId={hotelId}
        showLiveFeed={showLiveFeed}
        setShowLiveFeed={setShowLiveFeed}
        subscriptionStatus={subscriptionStatus}
        trialEndsAt={trialEndsAt}
        canAccessModule={canAccessModule}
        fetchStats={fetchStats}
        t={t}
      />
    </SidebarProvider>
  );
}

function AdminDashboardContent({
  hotelName, profile, menuItems, activeTab, setActiveTab, stats, pendingAdjustments,
  handleSignOut, isOwner, hotelId, showLiveFeed, setShowLiveFeed,
  subscriptionStatus, trialEndsAt, canAccessModule, fetchStats, t,
}: any) {
  const { setOpen } = useSidebar();

  const handleMenuClick = (id: string) => {
    setActiveTab(id);
    setOpen(false);
  };

  return (
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
              {menuItems.map((item: any) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={activeTab === item.id}
                    onClick={() => handleMenuClick(item.id)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.id === 'bookings' && stats.pending > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                        {stats.pending}
                      </span>
                    )}
                    {item.id === 'dashboard' && pendingAdjustments > 0 && (
                      <span className="ml-auto bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {pendingAdjustments}
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
                <SidebarMenuButton onClick={handleSignOut}>
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
              <div className="flex items-center gap-3">
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
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                    {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="text-sm">
                    <p className="font-medium leading-none">{profile?.full_name || 'Пользователь'}</p>
                    <p className="text-xs text-muted-foreground">{isOwner ? 'Владелец' : 'Администратор'}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  title="Выйти и сменить пользователя"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <main className="flex-1 flex" onClick={() => setOpen(false)}>
              <div className="flex-1 p-6 overflow-auto">
                {isOwner && (
                  <SubscriptionBanner
                    subscriptionStatus={subscriptionStatus}
                    trialEndsAt={trialEndsAt}
                  />
                )}
                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    <h1 className="text-2xl font-display font-bold">{t('admin.dashboard')}</h1>
                    
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => canAccessModule('bookings') && setActiveTab('bookings')}>
                        <CardContent className="pt-6 flex items-center gap-4">
                          <CalendarDays className="h-8 w-8 text-primary" />
                          <div>
                            <p className="text-sm text-muted-foreground">{t('admin.totalBookings')}</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => canAccessModule('bookings') && setActiveTab('bookings')}>
                        <CardContent className="pt-6 flex items-center gap-4">
                          <Clock className="h-8 w-8 text-warning" />
                          <div>
                            <p className="text-sm text-muted-foreground">{t('admin.pendingBookings')}</p>
                            <p className="text-2xl font-bold">{stats.pending}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => canAccessModule('rooms') && setActiveTab('rooms')}>
                        <CardContent className="pt-6 flex items-center gap-4">
                          <DoorOpen className="h-8 w-8 text-success" />
                          <div>
                            <p className="text-sm text-muted-foreground">{t('admin.occupiedRooms')}</p>
                            <p className="text-2xl font-bold">{stats.occupied}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Owner: checkout amount adjustments */}
                    {isOwner && hotelId && (
                      <CheckoutAdjustmentsWidget hotelId={hotelId} />
                    )}

                    <div className="grid lg:grid-cols-2 gap-6">
                      <Card>
                        <CardContent className="pt-6">
                          <h3 className="font-semibold mb-4">{t('admin.bookingQueue')}</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {canAccessModule('bookings') && (
                              <Button variant="outline" onClick={() => setActiveTab('bookings')}>
                                <CalendarDays className="h-4 w-4 mr-2" />
                                {t('admin.bookingQueue')}
                              </Button>
                            )}
                            {canAccessModule('shahmatka') && (
                              <Button variant="outline" onClick={() => setActiveTab('shahmatka')}>
                                <Grid3X3 className="h-4 w-4 mr-2" />
                                {t('admin.shahmatka')}
                              </Button>
                            )}
                            {canAccessModule('rooms') && (
                              <Button variant="outline" onClick={() => setActiveTab('rooms')}>
                                <DoorOpen className="h-4 w-4 mr-2" />
                                {t('admin.rooms')}
                              </Button>
                            )}
                            {canAccessModule('clients') && (
                              <Button variant="outline" onClick={() => setActiveTab('clients')}>
                                <Users className="h-4 w-4 mr-2" />
                                {t('admin.clients')}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      
                      {canAccessModule('services') && (
                        <ServiceStatsWidget hotelId={hotelId} onNavigate={setActiveTab} />
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'analytics' && (
                  <ExecutiveDashboard hotelId={hotelId} />
                )}


                {activeTab === 'leads' && (
                  <LeadsTab hotelId={hotelId} />
                )}
                {activeTab === 'bookings' && (
                  <BookingsWithShahmatka hotelId={hotelId} />
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
                  <ServiceLogWithCatalog hotelId={hotelId} />
                )}

                {activeTab === 'integrations' && (
                  <ApiKeysTab hotelId={hotelId} />
                )}

                {activeTab === 'settings' && (
                  <HotelSettingsTab hotelId={hotelId} />
                )}

                {activeTab === 'staff' && (
                  <Card>
                    <CardContent className="pt-6">
                      <StaffTab hotelId={hotelId} hotelName={hotelName} />
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'subscription' && (
                  <SubscriptionTab hotelId={hotelId} />
                )}

                

                {activeTab === 'admin-kpi' && (
                  <AdminKpiTab hotelId={hotelId} />
                )}

                {activeTab === 'help' && (
                  <HelpTab />
                )}
              </div>

              {showLiveFeed && (
                <div className="w-80 border-l p-4 hidden lg:block">
                  <LiveFeedSidebar hotelId={hotelId} onBookingUpdated={fetchStats} />
                </div>
              )}
            </main>
          </div>
        </SidebarInset>
      </div>
  );
}

/** Unified Bookings + Shahmatka with List/Grid toggle */
function BookingsWithShahmatka({ hotelId }: { hotelId: string }) {
  const [viewMode, setViewMode] = useState<string>('list');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)} size="sm">
          <ToggleGroupItem value="list" className="gap-1.5">
            <List className="h-4 w-4" />
            Список
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" className="gap-1.5">
            <Grid3X3 className="h-4 w-4" />
            Сетка
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Card>
        <CardContent className="pt-6">
          {viewMode === 'list' ? (
            <BookingsTab hotelId={hotelId} />
          ) : (
            <ShahmatkaGrid hotelId={hotelId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Services tab with embedded catalog toggle */
function ServiceLogWithCatalog({ hotelId }: { hotelId: string }) {
  const [showCatalog, setShowCatalog] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <ToggleGroup type="single" value={showCatalog ? 'catalog' : 'log'} onValueChange={(v) => v && setShowCatalog(v === 'catalog')} size="sm">
            <ToggleGroupItem value="log" className="gap-1.5">
              <Coffee className="h-4 w-4" />
              Журнал
            </ToggleGroupItem>
            <ToggleGroupItem value="catalog" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              Справочник
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {showCatalog ? (
          <ServiceCatalogTab hotelId={hotelId} />
        ) : (
          <ServiceLogTab hotelId={hotelId} />
        )}
      </CardContent>
    </Card>
  );
}
