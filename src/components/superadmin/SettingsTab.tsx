import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Database, RefreshCw, CheckCircle2, XCircle, Eye, EyeOff, Loader2, Upload, Clock, AlertCircle } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface ExternalSupabaseSettings {
  url: string;
  anon_key: string;
  sync_enabled: boolean;
  sync_tables: string[];
  last_sync_at?: string;
  last_sync_results?: SyncResults;
}

interface SyncResults {
  [table: string]: {
    count: number;
    success: boolean;
    error?: string;
  };
}

const AVAILABLE_TABLES = [
  { id: 'hotels', label: 'Отели' },
  { id: 'bookings', label: 'Бронирования' },
  { id: 'clients', label: 'Клиенты' },
  { id: 'room_types', label: 'Типы номеров' },
  { id: 'rooms', label: 'Номера' },
  { id: 'service_catalog', label: 'Каталог услуг' },
];

export function SettingsTab() {
  const [settings, setSettings] = useState<ExternalSupabaseSettings>({
    url: '',
    anon_key: '',
    sync_enabled: false,
    sync_tables: ['hotels', 'bookings', 'clients', 'room_types'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'external_supabase')
        .single();

      if (error) throw error;

      if (data?.value) {
        const value = data.value as unknown as ExternalSupabaseSettings;
        setSettings({
          url: value.url || '',
          anon_key: value.anon_key || '',
          sync_enabled: value.sync_enabled || false,
          sync_tables: value.sync_tables || ['hotels', 'bookings', 'clients', 'room_types'],
          last_sync_at: value.last_sync_at,
          last_sync_results: value.last_sync_results,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!settings.url || !settings.anon_key) {
      toast.error('Введите URL и API Key');
      return;
    }

    setTesting(true);
    setConnectionStatus('unknown');

    try {
      const response = await supabase.functions.invoke('test-external-connection', {
        body: { url: settings.url, anon_key: settings.anon_key },
      });

      if (response.error) throw response.error;

      if (response.data?.success) {
        setConnectionStatus('success');
        toast.success('Подключение успешно!');
      } else {
        setConnectionStatus('error');
        toast.error(response.data?.error || 'Не удалось подключиться');
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setConnectionStatus('error');
      toast.error(error.message || 'Ошибка подключения');
    } finally {
      setTesting(false);
    }
  };

  const syncAllData = async () => {
    if (!settings.sync_enabled) {
      toast.error('Включите синхронизацию перед отправкой данных');
      return;
    }

    if (!settings.url || !settings.anon_key) {
      toast.error('Настройте подключение к внешнему Supabase');
      return;
    }

    setSyncing(true);
    const results: SyncResults = {};

    try {
      for (const table of settings.sync_tables) {
        setSyncProgress(`Синхронизация: ${AVAILABLE_TABLES.find(t => t.id === table)?.label || table}...`);

        // Fetch data from local table - use type assertion for dynamic table name
        const { data, error: fetchError } = await supabase
          .from(table as 'hotels')
          .select('*');

        if (fetchError) {
          console.error(`Error fetching ${table}:`, fetchError);
          results[table] = { count: 0, success: false, error: fetchError.message };
          continue;
        }

        if (!data || data.length === 0) {
          results[table] = { count: 0, success: true };
          continue;
        }

        // Send to external Supabase via Edge Function
        const response = await supabase.functions.invoke('sync-to-external', {
          body: { 
            table, 
            data,
            operation: 'upsert'
          }
        });

        if (response.error) {
          console.error(`Sync error for ${table}:`, response.error);
          results[table] = { count: 0, success: false, error: response.error.message };
        } else if (response.data?.success === false) {
          results[table] = { count: 0, success: false, error: response.data.error || response.data.message };
        } else {
          results[table] = { count: response.data?.synced || data.length, success: true };
        }
      }

      // Update settings with sync results
      const updatedSettings = {
        ...settings,
        last_sync_at: new Date().toISOString(),
        last_sync_results: results,
      };

      await supabase
        .from('platform_settings')
        .update({
          value: JSON.parse(JSON.stringify(updatedSettings)) as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'external_supabase');

      setSettings(updatedSettings);

      // Check if all syncs were successful
      const allSuccess = Object.values(results).every(r => r.success);
      const totalSynced = Object.values(results).reduce((sum, r) => sum + r.count, 0);

      if (allSuccess) {
        toast.success(`Синхронизация завершена! Отправлено ${totalSynced} записей`);
      } else {
        const failedTables = Object.entries(results)
          .filter(([_, r]) => !r.success)
          .map(([t]) => AVAILABLE_TABLES.find(at => at.id === t)?.label || t);
        toast.error(`Ошибки синхронизации: ${failedTables.join(', ')}`);
      }

    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Ошибка синхронизации');
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const saveSettings = async () => {
    setSaving(true);

    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          value: JSON.parse(JSON.stringify(settings)) as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'external_supabase');

      if (error) throw error;

      toast.success('Настройки сохранены');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const handleTableToggle = (tableId: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      sync_tables: checked 
        ? [...prev.sync_tables, tableId]
        : prev.sync_tables.filter(t => t !== tableId)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Подключение к внешнему Supabase
          </CardTitle>
          <CardDescription>
            Настройте синхронизацию данных с внешним Supabase проектом для централизованного управления
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Project URL</Label>
              <Input
                id="supabase-url"
                placeholder="https://your-project.supabase.co"
                value={settings.url}
                onChange={(e) => setSettings(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="anon-key">Anon API Key</Label>
              <div className="relative">
                <Input
                  id="anon-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={settings.anon_key}
                  onChange={(e) => setSettings(prev => ({ ...prev, anon_key: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={testConnection}
                disabled={testing || !settings.url || !settings.anon_key}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Проверить подключение
              </Button>
              
              {connectionStatus === 'success' && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Подключено</span>
                </div>
              )}
              
              {connectionStatus === 'error' && (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Ошибка подключения</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium">Автоматическая синхронизация</h4>
                <p className="text-sm text-muted-foreground">
                  Данные будут автоматически отправляться во внешний Supabase
                </p>
              </div>
              <Switch
                checked={settings.sync_enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, sync_enabled: checked }))}
              />
            </div>

            <div className="space-y-3">
              <Label>Таблицы для синхронизации:</Label>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_TABLES.map((table) => (
                  <div key={table.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={table.id}
                      checked={settings.sync_tables.includes(table.id)}
                      onCheckedChange={(checked) => handleTableToggle(table.id, !!checked)}
                    />
                    <label
                      htmlFor={table.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {table.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Сохранить настройки
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Sync Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ручная синхронизация
          </CardTitle>
          <CardDescription>
            Отправьте все данные из выбранных таблиц во внешний Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={syncAllData} 
            disabled={syncing || !settings.sync_enabled || !settings.url || !settings.anon_key}
            className="w-full"
            size="lg"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {syncProgress || 'Синхронизация...'}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Синхронизировать все данные
              </>
            )}
          </Button>

          {!settings.sync_enabled && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Включите синхронизацию выше для отправки данных
            </p>
          )}

          {/* Last Sync Results */}
          {settings.last_sync_at && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Последняя синхронизация: {new Date(settings.last_sync_at).toLocaleString('ru-RU')}
              </div>

              {settings.last_sync_results && (
                <div className="space-y-2">
                  {Object.entries(settings.last_sync_results).map(([table, result]) => {
                    const tableLabel = AVAILABLE_TABLES.find(t => t.id === table)?.label || table;
                    return (
                      <div key={table} className="flex items-center justify-between text-sm">
                        <span>{tableLabel}</span>
                        {result.success ? (
                          <span className="text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {result.count} записей
                          </span>
                        ) : (
                          <span className="text-destructive flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {result.error || 'Ошибка'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Требования к внешнему Supabase</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Для корректной работы синхронизации во внешнем проекте должны быть:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Таблицы с такой же структурой + колонка <code className="bg-muted px-1 py-0.5 rounded">external_id</code> (UNIQUE)</li>
            <li>RLS политики, разрешающие INSERT/UPDATE через anon key</li>
            <li>Или использовать service_role_key для полного доступа</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
