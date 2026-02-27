import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

    // Fetch all leads with admin_id for this hotel
    const { data: leads } = await supabase
      .from('leads' as any)
      .select('admin_id, claimed_at, created_at, status')
      .eq('hotel_id', hotelId)
      .not('admin_id', 'is', null);

    // Fetch admin profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('hotel_id', hotelId);

    const profileMap = new Map<string, string>();
    (profiles || []).forEach(p => profileMap.set(p.user_id, p.full_name || 'Неизвестный'));

    // Calculate metrics per admin
    const adminMap = new Map<string, { claimed: number; converted: number; responseTimes: number[] }>();
    
    ((leads as any[]) || []).forEach(lead => {
      if (!lead.admin_id) return;
      if (!adminMap.has(lead.admin_id)) {
        adminMap.set(lead.admin_id, { claimed: 0, converted: 0, responseTimes: [] });
      }
      const m = adminMap.get(lead.admin_id)!;
      m.claimed++;
      if (lead.status === 'converted') m.converted++;
      if (lead.claimed_at && lead.created_at) {
        const diff = (new Date(lead.claimed_at).getTime() - new Date(lead.created_at).getTime()) / 60000;
        if (diff >= 0) m.responseTimes.push(diff);
      }
    });

    const metricsArr: AdminMetrics[] = [];
    adminMap.forEach((val, adminId) => {
      const avg = val.responseTimes.length > 0
        ? val.responseTimes.reduce((a, b) => a + b, 0) / val.responseTimes.length
        : 0;
      metricsArr.push({
        adminId,
        adminName: profileMap.get(adminId) || 'Неизвестный',
        totalClaimed: val.claimed,
        totalConverted: val.converted,
        avgResponseMinutes: Math.round(avg * 10) / 10,
        conversionRate: val.claimed > 0 ? Math.round((val.converted / val.claimed) * 100) : 0,
      });
    });

    metricsArr.sort((a, b) => a.avgResponseMinutes - b.avgResponseMinutes);
    setMetrics(metricsArr);

    // Fetch audit logs
    const { data: audits } = await supabase
      .from('audit_logs' as any)
      .select('id, created_at, user_name, action, entity_type, details')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(50);

    setAuditLogs((audits as unknown as AuditEntry[]) || []);
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

      {/* Metrics table */}
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

      {/* Audit log */}
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
