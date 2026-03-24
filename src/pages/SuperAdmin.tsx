import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, CreditCard, Settings, Search, LogOut, ClipboardCheck, FileText, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { UsersTab } from '@/components/superadmin/UsersTab';
import { HotelRequestsTab } from '@/components/superadmin/HotelRequestsTab';
import { HotelsManagementTab } from '@/components/superadmin/HotelsManagementTab';
import { SubscriptionsTab } from '@/components/superadmin/SubscriptionsTab';
import { SettingsTab } from '@/components/superadmin/SettingsTab';
import { SystemReportsTab } from '@/components/superadmin/SystemReportsTab';
import { SystemMonitoringTab } from '@/components/superadmin/SystemMonitoringTab';

interface Hotel {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  owner_id: string | null;
}

export default function SuperAdmin() {
  const { t } = useTranslation();
  const { user, isSuperAdmin, loading, signOut } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, trial: 0, active: 0, expired: 0, pending: 0 });
  const [activeTab, setActiveTab] = useState<'requests' | 'hotels' | 'users' | 'subscriptions' | 'settings' | 'reports' | 'monitoring'>('requests');

  useEffect(() => {
    if (isSuperAdmin) {
      fetchHotels();
    }
  }, [isSuperAdmin]);

  const fetchHotels = async () => {
    const { data } = await supabase
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setHotels(data);
      setStats({
        total: data.length,
        trial: data.filter(h => h.subscription_status === 'trial').length,
        active: data.filter(h => h.subscription_status === 'active').length,
        expired: data.filter(h => h.subscription_status === 'expired').length,
        pending: data.filter(h => (h as any).status === 'pending').length
      });
    }
  };

  const updateHotelStatus = async (hotelId: string, status: string) => {
    await supabase
      .from('hotels')
      .update({ subscription_status: status })
      .eq('id', hotelId);
    fetchHotels();
  };

  const filteredHotels = hotels.filter(hotel => {
    const matchesSearch = hotel.name.toLowerCase().includes(search.toLowerCase()) ||
                         hotel.location?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || hotel.subscription_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      trial: { variant: 'secondary', label: 'Пробный' },
      active: { variant: 'default', label: 'Активный' },
      expired: { variant: 'destructive', label: 'Истёк' },
      suspended: { variant: 'outline', label: 'Приостановлен' }
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display font-semibold">YesRoom</p>
                <p className="text-xs text-muted-foreground">Super Admin</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={activeTab === 'requests'}
                  onClick={() => setActiveTab('requests')}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>Заявки</span>
                  {stats.pending > 0 && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                      {stats.pending}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={activeTab === 'hotels'}
                  onClick={() => setActiveTab('hotels')}
                >
                  <Building2 className="h-4 w-4" />
                  <span>Отели</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'users'}
                  onClick={() => setActiveTab('users')}
                >
                  <Users className="h-4 w-4" />
                  <span>Пользователи</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'subscriptions'}
                  onClick={() => setActiveTab('subscriptions')}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Подписки</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'settings'}
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings className="h-4 w-4" />
                  <span>Настройки</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'reports'}
                  onClick={() => setActiveTab('reports')}
                >
                  <FileText className="h-4 w-4" />
                  <span>Отчёты</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'monitoring'}
                  onClick={() => setActiveTab('monitoring')}
                >
                  <Activity className="h-4 w-4" />
                  <span>Мониторинг</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <div className="mt-auto p-4 border-t">
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>
        </Sidebar>

        <SidebarInset className="flex-1">
          <header className="h-14 border-b flex items-center gap-4 px-6">
            <SidebarTrigger />
            <h1 className="font-display font-semibold">Управление платформой</h1>
          </header>

          <main className="p-6 space-y-6">
            {activeTab === 'requests' && <HotelRequestsTab />}
            
            {activeTab === 'hotels' && (
              <>
                {/* Stats */}
                <div className="grid sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Всего отелей</p>
                      <p className="text-3xl font-bold">{stats.total}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Пробный период</p>
                      <p className="text-3xl font-bold text-blue-600">{stats.trial}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Активных</p>
                      <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Истекших</p>
                      <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Hotels Table */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 justify-between">
                      <CardTitle>Зарегистрированные отели</CardTitle>
                      <div className="flex gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Поиск..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 w-64"
                          />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Статус" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Все</SelectItem>
                            <SelectItem value="trial">Пробный</SelectItem>
                            <SelectItem value="active">Активный</SelectItem>
                            <SelectItem value="expired">Истёк</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Название</TableHead>
                          <TableHead>Адрес</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Пробный до</TableHead>
                          <TableHead>Создан</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHotels.map((hotel) => (
                          <TableRow key={hotel.id}>
                            <TableCell className="font-medium">{hotel.name}</TableCell>
                            <TableCell>{hotel.location || '—'}</TableCell>
                            <TableCell>{getStatusBadge(hotel.subscription_status)}</TableCell>
                            <TableCell>
                              {hotel.trial_ends_at 
                                ? format(new Date(hotel.trial_ends_at), 'dd MMM yyyy', { locale: ru })
                                : '—'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(hotel.created_at), 'dd.MM.yyyy', { locale: ru })}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={hotel.subscription_status}
                                onValueChange={(value) => updateHotelStatus(hotel.id, value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="trial">Пробный</SelectItem>
                                  <SelectItem value="active">Активный</SelectItem>
                                  <SelectItem value="expired">Истёк</SelectItem>
                                  <SelectItem value="suspended">Приостановлен</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredHotels.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Отели не найдены
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'users' && <UsersTab />}

            {activeTab === 'subscriptions' && <SubscriptionsTab />}

            {activeTab === 'settings' && <SettingsTab />}

            {activeTab === 'reports' && <SystemReportsTab />}

            {activeTab === 'monitoring' && <SystemMonitoringTab />}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
