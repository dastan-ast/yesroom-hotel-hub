import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText } from 'lucide-react';

interface LogEntry {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  details: Record<string, any>;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  booking_created: 'Создание брони',
  booking_approved: 'Подтверждение',
  booking_checked_in: 'Заселение',
  booking_checked_out: 'Выселение',
  booking_cancelled: 'Отмена',
  booking_deleted: 'Удаление брони',
  booking_undo_checkin: 'Отмена заселения',
  service_added: 'Услуга добавлена',
  service_removed: 'Услуга удалена',
  client_created: 'Клиент создан',
  client_updated: 'Клиент обновлён',
};

const entityColors: Record<string, string> = {
  booking: 'bg-blue-500/20 text-blue-700 border-blue-500',
  service: 'bg-emerald-500/20 text-emerald-700 border-emerald-500',
  client: 'bg-violet-500/20 text-violet-700 border-violet-500',
};

export function ActivityLogTab({ hotelId }: { hotelId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, [hotelId, filter]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('admin_activity_log' as any)
      .select('id, user_name, action, entity_type, details, created_at')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      query = query.eq('entity_type', filter);
    }

    const { data } = await query;
    setLogs((data as unknown as LogEntry[]) || []);
    setLoading(false);
  };

  const getDetails = (log: LogEntry) => {
    const d = log.details || {};
    const parts: string[] = [];
    if (d.guest_name) parts.push(d.guest_name);
    if (d.room_number) parts.push(`№${d.room_number}`);
    if (d.service_name) parts.push(d.service_name);
    if (d.amount) parts.push(`${Number(d.amount).toLocaleString()} ₸`);
    if (d.client_name) parts.push(d.client_name);
    return parts.join(' · ') || '—';
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Журнал действий</h2>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все действия</SelectItem>
            <SelectItem value="booking">Бронирования</SelectItem>
            <SelectItem value="service">Услуги</SelectItem>
            <SelectItem value="client">Клиенты</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-lg">
          Нет записей
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd.MM HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium">{log.user_name || '—'}</TableCell>
                  <TableCell>{actionLabels[log.action] || log.action}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={entityColors[log.entity_type] || ''}>
                      {log.entity_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {getDetails(log)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
