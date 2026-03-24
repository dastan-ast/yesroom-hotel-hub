import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Building2, Users, CreditCard, Settings, LogOut, ClipboardCheck, FileText, Activity } from 'lucide-react';

import { UsersTab } from '@/components/superadmin/UsersTab';
import { HotelRequestsTab } from '@/components/superadmin/HotelRequestsTab';
import { HotelsManagementTab } from '@/components/superadmin/HotelsManagementTab';
import { SubscriptionsTab } from '@/components/superadmin/SubscriptionsTab';
import { SettingsTab } from '@/components/superadmin/SettingsTab';
import { SystemReportsTab } from '@/components/superadmin/SystemReportsTab';
import { SystemMonitoringTab } from '@/components/superadmin/SystemMonitoringTab';

export default function SuperAdmin() {
  const { t } = useTranslation();
  const { user, isSuperAdmin, loading, signOut } = useAuth();
  const [stats, setStats] = useState({ pending: 0 });
  const [activeTab, setActiveTab] = useState<'requests' | 'hotels' | 'users' | 'subscriptions' | 'settings' | 'reports' | 'monitoring'>('requests');

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('hotels').select('status').then(({ data }) => {
        if (data) setStats({ pending: data.filter(h => h.status === 'pending').length });
      });
    }
  }, [isSuperAdmin]);

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
            
            {activeTab === 'hotels' && <HotelsManagementTab />}

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
