import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Clock, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AdminMetrics {
  adminId: string;
  adminName: string;
  totalClaimed: number;
  totalConverted: number;
  avgResponseMinutes: number;
  conversionRate: number;
  avgBookingProcessMinutes: number;
}

interface AuditEntry {
  id: string;
  created_at: string;
  user_name: string;
  action: string;
  entity_type: string;
  details: any;
}

interface Props {
  hotelId: string;
}

export function AdminKpiTab({ hotelId }: Props) {
  const [metrics, setMetrics] = useState<AdminMetrics[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [hotelId]);

  const fetchData = async () => {
    setLoading(true);

    // Use server-side RPC for KPI calculations
    const [kpiResult, auditsResult] = await Promise.all([
      supabase.rpc('get_admin_kpi_metrics', { _hotel_id: hotelId }),
      supabase
        .from('admin_activity_log')
        .select('id, created_at, user_name, action, entity_type, details')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (kpiResult.data) {
      const data = kpiResult.data as any;
      setMetrics((data.metrics || []).map((m: any) => ({
        adminId: m.adminId,
        adminName: m.adminName,
        totalClaimed: m.totalClaimed,
        totalConverted: m.totalConverted,
        avgResponseMinutes: m.avgResponseMinutes,
        conversionRate: m.conversionRate,
        avgBookingProcessMinutes: m.avgBookingProcessMinutes,
      })));
    }

    setAuditLogs((auditsResult.data as unknown as AuditEntry[]) || []);
    setLoading(false);
  };

  const formatMinutes = (min: number) => {
    if (min < 1) return '< 1 мин';
    if (min < 60) return `${Math.round(min)} мин`;
    const hours = Math.floor(min / 60);
    const mins = Math.round(min % 60);
    return `${hours}ч ${mins}м`;
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold flex items-center gap-2">
        <BarChart3 className="h-6 w-6" /> KPI Администраторов
      </h2>

      {metrics.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Ср. обработка бронирования</p>
                <p className="text-2xl font-bold">{formatMinutes(metrics[0]?.avgBookingProcessMinutes || 0)}</p>
                <p className="text-xs text-muted-foreground">от создания до заселения</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Ср. время ответа на лид</p>
                <p className="text-2xl font-bold">{formatMinutes(metrics.reduce((s, m) => s + m.avgResponseMinutes, 0) / metrics.length)}</p>
                <p className="text-xs text-muted-foreground">от создания до взятия в работу</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Показатели по администраторам
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет данных. Лиды ещё не обрабатывались.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Администратор</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> Ср. время ответа
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Обработано</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Конверсия
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map(m => (
                  <TableRow key={m.adminId}>
                    <TableCell className="font-medium">{m.adminName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={m.avgResponseMinutes > 15 ? 'destructive' : 'outline'}>
                        {formatMinutes(m.avgResponseMinutes)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{m.totalClaimed}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={m.conversionRate >= 50 ? 'default' : 'secondary'}>
                        {m.conversionRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Журнал аудита
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет записей аудита</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd.MM.yy HH:mm', { locale: ru })}
                    </TableCell>
                    <TableCell className="text-sm">{log.user_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
