import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const ALL_MODULES = [
  'dashboard',
  'bookings',
  'shahmatka',
  'rooms',
  'room_types',
  'clients',
  'services',
  'service_catalog',
  'leads',
  'analytics',
  'kpi_admins',
  'integrations',
  'settings',
  'staff',
] as const;

export type ModuleId = typeof ALL_MODULES[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard: 'Дашборд',
  bookings: 'Бронирования',
  shahmatka: 'Шахматка',
  rooms: 'Номера',
  room_types: 'Типы номеров',
  clients: 'Клиенты',
  services: 'Журнал услуг',
  service_catalog: 'Справочник услуг',
  leads: 'Лиды',
  analytics: 'Аналитика',
  kpi_admins: 'KPI Админов',
  integrations: 'Интеграции',
  settings: 'Настройки',
  staff: 'Персонал',
};

// Default permissions for new admins
export const DEFAULT_ADMIN_PERMISSIONS: ModuleId[] = [
  'dashboard',
  'bookings',
  'shahmatka',
  'rooms',
  'clients',
  'services',
];

// Permissions presets
export const PERMISSION_PRESETS = [
  {
    id: 'full',
    label: 'Полный доступ',
    permissions: ALL_MODULES.filter(m => m !== 'staff') as ModuleId[],
  },
  {
    id: 'basic',
    label: 'Базовый',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  },
  {
    id: 'readonly',
    label: 'Только просмотр',
    permissions: ['dashboard', 'shahmatka'] as ModuleId[],
  },
];

interface UsePermissionsReturn {
  permissions: string[];
  loading: boolean;
  hasPermission: (key: string) => boolean;
  canAccessModule: (moduleId: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, role, isOwner, isSuperAdmin } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Owner and SuperAdmin have all permissions
    if (isOwner || isSuperAdmin) {
      setPermissions([...ALL_MODULES]);
      setLoading(false);
      return;
    }

    // Admin - fetch from database
    if (role === 'admin') {
      try {
        const { data, error } = await supabase
          .from('staff_permissions')
          .select('permissions')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching permissions:', error);
          setPermissions([]);
        } else {
          setPermissions(data?.permissions || []);
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setPermissions([]);
      }
    } else {
      setPermissions([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPermissions();
  }, [user, role, isOwner, isSuperAdmin]);

  const hasPermission = (key: string): boolean => {
    if (isOwner || isSuperAdmin) return true;
    return permissions.includes(key);
  };

  const canAccessModule = (moduleId: string): boolean => {
    // Staff module is owner-only
    if (moduleId === 'staff') {
      return isOwner || isSuperAdmin;
    }
    return hasPermission(moduleId);
  };

  const refreshPermissions = async () => {
    setLoading(true);
    await fetchPermissions();
  };

  return {
    permissions,
    loading,
    hasPermission,
    canAccessModule,
    refreshPermissions,
  };
}
