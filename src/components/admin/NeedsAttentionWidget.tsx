import { useState, useEffect } from 'react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, LogOut, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttentionItem {
  id: string;
  type: 'overdue_checkin' | 'overdue_checkout' | 'pending_booking' | 'stale_lead';
  title: string;
  subtitle: string;
  date: string;
}

export function NeedsAttentionWidget({ hotelId, onNavigate }: { hotelId: string; onNavigate?: (tab: string) => void }) {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) return;
    fetchAttentionItems();
  }, [hotelId]);

  const fetchAttentionItems = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const result: AttentionItem[] = [];

    // Overdue check-ins: pending/approved where check_in_date < today
    const { data: overdueCheckins } = await supabase
      .from('bookings')
      .select('id, guest_name, check_in_date, status')
      .eq('hotel_id', hotelId)
      .in('status', ['pending', 'approved'])
      .lt('check_in_date', today)
      .order('check_in_date')
      .limit(5);

    overdueCheckins?.forEach(b => {
      result.push({
        id: b.id,
        type: 'overdue_checkin',
        title: b.guest_name,
        subtitle: `Заселение просрочено с ${format(parseISO(b.check_in_date), 'dd MMM', { locale: ru })}`,
        date: b.check_in_date,
      });
    });

    // Overdue check-outs: checked_in where check_out_date < today
    const { data: overdueCheckouts } = await supabase
      .from('bookings')
      .select('id, guest_name, check_out_date, status')
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_in')
      .lt('check_out_date', today)
      .order('check_out_date')
      .limit(5);

    overdueCheckouts?.forEach(b => {
      result.push({
        id: b.id,
        type: 'overdue_checkout',
        title: b.guest_name,
        subtitle: `Выселение просрочено с ${format(parseISO(b.check_out_date), 'dd MMM', { locale: ru })}`,
        date: b.check_out_date,
      });
    });

    // Pending bookings for today
    const { data: todayPending } = await supabase
      .from('bookings')
      .select('id, guest_name, check_in_date, status')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .eq('check_in_date', today)
      .limit(5);

    todayPending?.forEach(b => {
      result.push({
        id: b.id,
        type: 'pending_booking',
        title: b.guest_name,
        subtitle: 'Ожидает подтверждения — заселение сегодня',
        date: b.check_in_date,
      });
    });

    // Stale leads: new leads older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: staleLeads } = await supabase
      .from('leads')
      .select('id, name, phone, created_at, status')
      .eq('hotel_id', hotelId)
      .eq('status', 'new')
      .lt('created_at', oneHourAgo)
      .order('created_at')
      .limit(5);

    staleLeads?.forEach(l => {
      result.push({
        id: l.id,
        type: 'stale_lead',
        title: l.name || l.phone,
        subtitle: `Не обработан с ${format(parseISO(l.created_at), 'dd MMM HH:mm', { locale: ru })}`,
        date: l.created_at,
      });
    });

    setItems(result);
    setLoading(false);
  };

  const iconMap = {
    overdue_checkin: <Clock className="h-3.5 w-3.5 text-destructive" />,
    overdue_checkout: <LogOut className="h-3.5 w-3.5 text-orange-500" />,
    pending_booking: <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />,
    stale_lead: <MessageCircle className="h-3.5 w-3.5 text-blue-500" />,
  };

  const navMap = {
    overdue_checkin: 'bookings',
    overdue_checkout: 'bookings',
    pending_booking: 'bookings',
    stale_lead: 'leads',
  };

  if (loading) return null;
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">✅ Всё под контролем — нет срочных задач</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Требует внимания
          <Badge variant="destructive" className="ml-auto text-[10px] h-5">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {items.slice(0, 8).map(item => (
          <div
            key={`${item.type}-${item.id}`}
            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onNavigate?.(navMap[item.type])}
          >
            <div className="mt-0.5">{iconMap[item.type]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{item.title}</p>
              <p className="text-[10px] text-muted-foreground">{item.subtitle}</p>
            </div>
          </div>
        ))}
        {items.length > 8 && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            +{items.length - 8} ещё…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
