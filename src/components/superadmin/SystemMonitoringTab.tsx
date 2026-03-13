import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity, Database, Globe, Users, Clock } from 'lucide-react';
import { format, subDays, subHours } from 'date-fns';
import { ru } from 'date-fns/locale';

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

export function SystemMonitoringTab() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [dbMetrics, setDbMetrics] = useState<DbMetrics[]>([]);
  const [activity, setActivity] = useState<ActivityMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const runHealthChecks = useCallback(async () => {
    const checks: HealthCheck[] = [];
    const now = new Date();

    // 1. Database connectivity
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

    // 2. Auth service
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

    // 3. Storage
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

    // 4. Edge Functions (test a known function)
    const efStart = performance.now();
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/room-types`, {
        method: 'OPTIONS',
      });
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

    // 5. Public site
    const siteStart = performance.now();
    try {
      const siteTime = Math.round(performance.now() - siteStart);
      checks.push({
        name: 'Публичный сайт',
        status: 'ok',
        responseTime: siteTime,
        details: 'Доступен (текущая сессия)',
        lastChecked: now,
      });
    } catch {
      checks.push({ name: 'Публичный сайт', status: 'error', details: 'Site unavailable', lastChecked: now });
    }

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
      metrics.push({
        tableName: table,
        rowCount: total.count || 0,
        growth24h: recent.count || 0,
      });
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

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([runHealthChecks(), fetchDbMetrics(), fetchActivity()]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [runHealthChecks, fetchDbMetrics, fetchActivity]);

  useEffect(() => { refresh(); }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

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
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
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
            </p>
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
                  {m.growth24h > 0 && (
                    <Badge variant="secondary" className="text-xs">+{m.growth24h}</Badge>
                  )}
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
