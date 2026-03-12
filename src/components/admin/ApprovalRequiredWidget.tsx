import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Check, X, DollarSign, BedDouble, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalEvent {
  id: string;
  type: 'checkout_adjustment' | 'activity_critical';
  title: string;
  description: string;
  date: string;
  data?: any;
}

export function ApprovalRequiredWidget({ hotelId }: { hotelId: string }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) return;
    fetchEvents();
  }, [hotelId]);

  const fetchEvents = async () => {
    setLoading(true);
    const result: ApprovalEvent[] = [];

    // 1. Pending checkout adjustments (price changes at checkout)
    const { data: adjustments } = await supabase
      .from('checkout_adjustments')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    adjustments?.forEach((adj: any) => {
      const diff = adj.adjusted_total - adj.original_total;
      const sign = diff < 0 ? '−' : '+';
      result.push({
        id: adj.id,
        type: 'checkout_adjustment',
        title: `Изменение суммы: ${sign}${Math.abs(diff).toLocaleString()} ₸`,
        description: `${adj.adjusted_by_name} • ${adj.original_total.toLocaleString()} → ${adj.adjusted_total.toLocaleString()} ₸${adj.reason ? ` • ${adj.reason}` : ''}`,
        date: adj.created_at,
        data: adj,
      });
    });

    // 2. Critical activity log events (last 24h): price changes, room type changes, discounts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: criticalLogs } = await supabase
      .from('admin_activity_log')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('created_at', oneDayAgo)
      .in('action', ['price_change', 'room_type_change', 'discount_applied', 'rate_override', 'room_reassign'])
      .order('created_at', { ascending: false })
      .limit(10);

    criticalLogs?.forEach((log: any) => {
      const actionLabels: Record<string, string> = {
        price_change: 'Изменение цены',
        room_type_change: 'Смена типа номера',
        discount_applied: 'Применена скидка',
        rate_override: 'Ручная ставка',
        room_reassign: 'Смена номера',
      };
      result.push({
        id: log.id,
        type: 'activity_critical',
        title: actionLabels[log.action] || log.action,
        description: `${log.user_name} • ${JSON.stringify(log.details || {}).slice(0, 80)}`,
        date: log.created_at,
        data: log,
      });
    });

    setEvents(result);
    setLoading(false);
  };

  const handleApprove = async (event: ApprovalEvent) => {
    if (event.type === 'checkout_adjustment') {
      const adj = event.data;
      const { error } = await supabase
        .from('checkout_adjustments')
        .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', adj.id);

      if (error) { toast.error('Ошибка'); return; }

      await supabase.from('bookings').update({ final_total: adj.adjusted_total }).eq('id', adj.booking_id);
      toast.success('Одобрено');
      fetchEvents();
    }
  };

  const handleReject = async (event: ApprovalEvent) => {
    if (event.type === 'checkout_adjustment') {
      const { error } = await supabase
        .from('checkout_adjustments')
        .update({ status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', event.data.id);

      if (error) { toast.error('Ошибка'); return; }
      toast.success('Отклонено');
      fetchEvents();
    }
  };

  if (loading || events.length === 0) return null;

  const approvalEvents = events.filter(e => e.type === 'checkout_adjustment');
  const infoEvents = events.filter(e => e.type === 'activity_critical');

  return (
    <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Требует согласования
          <Badge className="ml-auto bg-amber-500 text-white text-[10px] h-5">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {/* Approval-required items */}
        {approvalEvents.map(event => (
          <div key={event.id} className="p-2.5 bg-background rounded-lg border space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <DollarSign className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{event.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{event.description}</p>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {format(parseISO(event.date), 'HH:mm', { locale: ru })}
              </span>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleApprove(event)}>
                <Check className="h-3 w-3 mr-1" />Одобрить
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-destructive" onClick={() => handleReject(event)}>
                <X className="h-3 w-3 mr-1" />Отклонить
              </Button>
            </div>
          </div>
        ))}

        {/* Info-only critical events */}
        {infoEvents.length > 0 && (
          <>
            {approvalEvents.length > 0 && (
              <p className="text-[10px] font-medium text-muted-foreground pt-1">Критические события (24ч)</p>
            )}
            {infoEvents.slice(0, 5).map(event => (
              <div key={event.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium">{event.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{event.description}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {format(parseISO(event.date), 'HH:mm')}
                </span>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
