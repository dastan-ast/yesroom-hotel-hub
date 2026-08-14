import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity, Database, Users, Bell, BellOff, Send, History } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  responseTime?: number;
  details?: string;
  lastChecked: Date;
}

interface DbMetrics {
  tableName: string;
  rowCount: number;
  growth24h: number;
}

interface ActivityMetric {
  period: string;
  bookings: number;
  leads: number;
  users: number;
}

interface AlertConfig {
  telegram_chat_id: string | null;
  is_enabled: boolean;
  alert_on_error: boolean;
  alert_on_warning: boolean;
  alert_on_recovery: boolean;
  last_alert_at: string | null;
}

interface UptimeRecord {
  id: string;
  service_name: string;
  status: string;
  response_time_ms: number | null;
  details: string | null;
  created_at: string;
}

interface AlertRecord {
  id: string;
  service_name: string;
  alert_type: string;
  message: string;
  created_at: string;
}

export function SystemMonitoringTab() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [dbMetrics, setDbMetrics] = useState<DbMetrics[]>([]);
  const [activity, setActivity] = useState<ActivityMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Alert config state
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    telegram_chat_id: null,
    is_enabled: false,
    alert_on_error: true,
    alert_on_warning: false,
    alert_on_recovery: true,
    last_alert_at: null,
  });
  const [chatIdInput, setChatIdInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // History state
  const [uptimeHistory, setUptimeHistory] = useState<UptimeRecord[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const runHealthChecks = useCallback(async () => {
    const checks: HealthCheck[] = [];
    const now = new Date();

    const dbStart = performance.now();
    try {
      const { error } = await supabase.from('hotels').select('id', { count: 'exact', head: true });
      const dbTime = Math.round(performance.now() - dbStart);
      checks.push({
        name: 'База данных',
        status: error ? 'error' : dbTime > 2000 ? 'warning' : 'ok',
        responseTime: dbTime,
        details: error ? error.message : `${dbTime}ms`,
        lastChecked: now,
      });
    } catch {
      checks.push({ name: 'База данных', status: 'error', details: 'Connection failed', lastChecked: now });
    }

    const authStart = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const authTime = Math.round(performance.now() - authStart);
      checks.push({
        name: 'Аутентификация',
        status: error ? 'error' : authTime > 2000 ? 'warning' : 'ok',
        responseTime: authTime,
        details: error ? error.message : `${authTime}ms`,
        lastChecked: now,
      });
    } catch {
      checks.push({ name: 'Аутентификация', status: 'error', details: 'Auth service unavailable', lastChecked: now });
    }

    const storageStart = performance.now();
    try {
      const { error } = await supabase.storage.from('hotel-images').list('', { limit: 1 });
      const storageTime = Math.round(performance.now() - storageStart);
      checks.push({
        name: 'Файловое хранилище',
        status: error ? 'warning' : storageTime > 3000 ? 'warning' : 'ok',
        responseTime: storageTime,
        details: error ? error.message : `${storageTime}ms`,
        lastChecked: now,
      });
    } catch {
      checks.push({ name: 'Файловое хранилище', status: 'error', details: 'Storage unavailable', lastChecked: now });
    }

    const efStart = performance.now();
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/room-types`, { method: 'OPTIONS' });
      const efTime = Math.round(performance.now() - efStart);
      checks.push({
        name: 'Edge Functions',
        status: resp.ok || resp.status === 204 ? 'ok' : 'warning',
        responseTime: efTime,
        details: `HTTP ${resp.status}, ${efTime}ms`,
        lastChecked: now,
      });
    } catch {
      checks.push({ name: 'Edge Functions', status: 'warning', details: 'CORS or unavailable', lastChecked: now });
    }

    checks.push({
      name: 'Публичный сайт',
      status: 'ok',
      responseTime: 0,
      details: 'Доступен (текущая сессия)',
      lastChecked: now,
    });

    setHealthChecks(checks);
  }, []);

  const fetchDbMetrics = useCallback(async () => {
    const tables = ['hotels', 'bookings', 'rooms', 'room_types', 'clients', 'leads', 'profiles'] as const;
    const metrics: DbMetrics[] = [];
    const yesterday = subDays(new Date(), 1).toISOString();

    for (const table of tables) {
      const [total, recent] = await Promise.all([
        supabase.from(table).select('id', { count: 'exact', head: true }),
        supabase.from(table).select('id', { count: 'exact', head: true }).gte('created_at', yesterday),
      ]);
      metrics.push({ tableName: table, rowCount: total.count || 0, growth24h: recent.count || 0 });
    }
    setDbMetrics(metrics);
  }, []);

  const fetchActivity = useCallback(async () => {
    const periods = [
      { label: 'Сегодня', from: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() },
      { label: 'Вчера', from: subDays(new Date(new Date().setHours(0, 0, 0, 0)), 1).toISOString(), to: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() },
      { label: '7 дней', from: subDays(new Date(), 7).toISOString() },
      { label: '30 дней', from: subDays(new Date(), 30).toISOString() },
    ];

    const results: ActivityMetric[] = [];
    for (const p of periods) {
      let bQ = supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', p.from);
      let lQ = supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', p.from);
      let uQ = supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', p.from);
      if (p.to) {
        bQ = bQ.lt('created_at', p.to);
        lQ = lQ.lt('created_at', p.to);
        uQ = uQ.lt('created_at', p.to);
      }
      const [b, l, u] = await Promise.all([bQ, lQ, uQ]);
      results.push({ period: p.label, bookings: b.count || 0, leads: l.count || 0, users: u.count || 0 });
    }
    setActivity(results);
  }, []);

  const fetchAlertConfig = useCallback(async () => {
    const { data } = await supabase
      .from('alert_config')
      .select('*')
      .eq('id', 1)
      .single();
    if (data) {
      setAlertConfig({
        telegram_chat_id: data.telegram_chat_id,
        is_enabled: data.is_enabled,
        alert_on_error: data.alert_on_error,
        alert_on_warning: data.alert_on_warning,
        alert_on_recovery: data.alert_on_recovery,
        last_alert_at: data.last_alert_at,
      });
      setChatIdInput(data.telegram_chat_id || '');
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    const [uptime, alerts] = await Promise.all([
      supabase
        .from('uptime_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('alert_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setUptimeHistory((uptime.data || []) as UptimeRecord[]);
    setAlertHistory((alerts.data || []) as AlertRecord[]);
  }, []);

  const saveAlertConfig = async () => {
    setSavingConfig(true);
    const { error } = await supabase
      .from('alert_config')
      .update({
        telegram_chat_id: chatIdInput || null,
        is_enabled: alertConfig.is_enabled,
        alert_on_error: alertConfig.alert_on_error,
        alert_on_warning: alertConfig.alert_on_warning,
        alert_on_recovery: alertConfig.alert_on_recovery,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      toast.error('Ошибка сохранения: ' + error.message);
    } else {
      toast.success('Настройки алертов сохранены');
    }
    setSavingConfig(false);
  };

  const testAlert = async () => {
    if (!chatIdInput) {
      toast.error('Укажите Chat ID');
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('uptime-monitor');
      if (error) throw error;
      toast.success('Тестовый мониторинг запущен');
    } catch (e: any) {
      toast.error('Ошибка: ' + e.message);
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([runHealthChecks(), fetchDbMetrics(), fetchActivity(), fetchAlertConfig(), fetchHistory()]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [runHealthChecks, fetchDbMetrics, fetchActivity, fetchAlertConfig, fetchHistory]);

  useEffect(() => { refresh(); }, []);
  // Автообновление отключено для экономии ресурсов — обновление вручную кнопкой


  const statusIcon = (status: string) => {
    if (status === 'ok') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === 'warning') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const overallStatus = healthChecks.length === 0 ? 'loading' :
    healthChecks.every(c => c.status === 'ok') ? 'ok' :
    healthChecks.some(c => c.status === 'error') ? 'error' : 'warning';

  const tableLabels: Record<string, string> = {
    hotels: 'Отели', bookings: 'Бронирования', rooms: 'Номера',
    room_types: 'Типы номеров', clients: 'Клиенты', leads: 'Лиды', profiles: 'Профили',
  };

  const serviceLabels: Record<string, string> = {
    database: '🗄 БД', auth: '🔐 Auth', storage: '📦 Storage', edge_functions: '⚡ EF',
  };

  const alertTypeLabels: Record<string, { label: string; color: string }> = {
    error: { label: 'Сбой', color: 'text-destructive' },
    warning: { label: 'Предупреждение', color: 'text-yellow-500' },
    recovery: { label: 'Восстановление', color: 'text-green-500' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Мониторинг системы</h2>
          <p className="text-muted-foreground">
            Обновлено: {format(lastRefresh, 'HH:mm:ss', { locale: ru })}
            {' · '}Авто-обновление каждые 60 сек
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="h-4 w-4 mr-2" />
            {showHistory ? 'Скрыть историю' : 'История'}
          </Button>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <Card className={overallStatus === 'ok' ? 'border-green-500/50 bg-green-500/5' : overallStatus === 'error' ? 'border-destructive/50 bg-destructive/5' : 'border-yellow-500/50 bg-yellow-500/5'}>
        <CardContent className="pt-6 flex items-center gap-4">
          {overallStatus === 'ok' ? <CheckCircle2 className="h-10 w-10 text-green-500" /> :
           overallStatus === 'error' ? <XCircle className="h-10 w-10 text-destructive" /> :
           <AlertTriangle className="h-10 w-10 text-yellow-500" />}
          <div>
            <p className="text-lg font-semibold">
              {overallStatus === 'ok' ? 'Все системы работают нормально' :
               overallStatus === 'error' ? 'Обнаружены критические проблемы' :
               'Есть предупреждения'}
            </p>
            <p className="text-sm text-muted-foreground">
              {healthChecks.filter(c => c.status === 'ok').length}/{healthChecks.length} сервисов в норме
              {alertConfig.is_enabled && <span className="ml-2">· 🔔 Алерты включены</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Alerts Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {alertConfig.is_enabled ? <Bell className="h-4 w-4 text-green-500" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            Алерты в Telegram
          </CardTitle>
          <CardDescription>
            Получайте уведомления при сбоях и восстановлении сервисов
            {alertConfig.last_alert_at && (
              <span className="ml-2">· Последний алерт: {format(new Date(alertConfig.last_alert_at), 'dd.MM HH:mm', { locale: ru })}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="chatId" className="text-sm">Telegram Chat ID</Label>
              <Input
                id="chatId"
                placeholder="-1001234567890 или ваш user ID"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Отправьте /start боту, затем перейдите на api.telegram.org/bot{'<TOKEN>'}/getUpdates для получения chat_id
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={alertConfig.is_enabled}
                onCheckedChange={(v) => setAlertConfig(prev => ({ ...prev, is_enabled: v }))}
              />
              <Label className="text-sm">Включить</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={alertConfig.alert_on_error}
                onCheckedChange={(v) => setAlertConfig(prev => ({ ...prev, alert_on_error: v }))}
              />
              <Label className="text-sm">🔴 Сбои</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={alertConfig.alert_on_warning}
                onCheckedChange={(v) => setAlertConfig(prev => ({ ...prev, alert_on_warning: v }))}
              />
              <Label className="text-sm">🟡 Предупр.</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={alertConfig.alert_on_recovery}
                onCheckedChange={(v) => setAlertConfig(prev => ({ ...prev, alert_on_recovery: v }))}
              />
              <Label className="text-sm">🟢 Восст.</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveAlertConfig} disabled={savingConfig} size="sm">
              {savingConfig ? 'Сохранение...' : 'Сохранить настройки'}
            </Button>
            <Button variant="outline" size="sm" onClick={testAlert}>
              <Send className="h-4 w-4 mr-2" />
              Тестовый запуск
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Проверка сервисов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {healthChecks.map(check => (
              <div key={check.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {statusIcon(check.status)}
                  <div>
                    <p className="font-medium text-sm">{check.name}</p>
                    <p className="text-xs text-muted-foreground">{check.details}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {check.responseTime !== undefined && (
                    <Badge variant={check.responseTime < 500 ? 'secondary' : check.responseTime < 2000 ? 'outline' : 'destructive'}>
                      {check.responseTime}ms
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Uptime & Alert History */}
      {showHistory && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">📊 История проверок (последние 50)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {uptimeHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных. Запустите мониторинг для сбора истории.</p>
                ) : uptimeHistory.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <span className={r.status === 'ok' ? 'text-green-500' : r.status === 'warning' ? 'text-yellow-500' : 'text-destructive'}>●</span>
                      <span className="font-medium">{serviceLabels[r.service_name] || r.service_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {r.response_time_ms != null && <span>{r.response_time_ms}ms</span>}
                      <span>{format(new Date(r.created_at), 'dd.MM HH:mm:ss')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">🔔 История алертов (последние 20)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {alertHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Алерты ещё не отправлялись.</p>
                ) : alertHistory.map(a => {
                  const typeInfo = alertTypeLabels[a.alert_type] || { label: a.alert_type, color: '' };
                  return (
                    <div key={a.id} className="p-2 bg-muted/50 rounded space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                          {typeInfo.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(a.created_at), 'dd.MM HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs whitespace-pre-line">{a.message}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DB Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Метрики базы данных
          </CardTitle>
          <CardDescription>Количество записей и рост за 24ч</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dbMetrics.map(m => (
              <div key={m.tableName} className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{tableLabels[m.tableName] || m.tableName}</span>
                  {m.growth24h > 0 && <Badge variant="secondary" className="text-xs">+{m.growth24h}</Badge>}
                </div>
                <p className="text-2xl font-bold">{m.rowCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">записей</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Активность пользователей
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-muted-foreground">Период</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Бронирования</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Лиды</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Новые пользователи</th>
                </tr>
              </thead>
              <tbody>
                {activity.map(a => (
                  <tr key={a.period} className="border-b last:border-0">
                    <td className="py-2 font-medium">{a.period}</td>
                    <td className="py-2 text-right">{a.bookings}</td>
                    <td className="py-2 text-right">{a.leads}</td>
                    <td className="py-2 text-right">{a.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
