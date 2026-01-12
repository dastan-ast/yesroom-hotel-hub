import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight } from 'lucide-react';

interface HistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: string;
  previous_trial_ends_at: string | null;
  new_trial_ends_at: string | null;
  reason: string | null;
  created_at: string;
}

interface SubscriptionHistoryDialogProps {
  hotelId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionHistoryDialog({ hotelId, open, onOpenChange }: SubscriptionHistoryDialogProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hotelId && open) {
      fetchHistory();
    }
  }, [hotelId, open]);

  const fetchHistory = async () => {
    if (!hotelId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('subscription_history')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setHistory(data);
    }
    setLoading(false);
  };

  const getStatusLabel = (status: string | null) => {
    if (!status) return '—';
    const labels: Record<string, string> = {
      trial: 'Пробный',
      active: 'Активный',
      expired: 'Истёк',
      suspended: 'Приостановлен'
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      trial: 'secondary',
      active: 'default',
      expired: 'destructive',
      suspended: 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{getStatusLabel(status)}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>История изменений подписки</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              История изменений пуста
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(entry.previous_status)}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      {getStatusBadge(entry.new_status)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                    </span>
                  </div>
                  
                  {(entry.previous_trial_ends_at || entry.new_trial_ends_at) && (
                    <div className="text-sm text-muted-foreground">
                      Пробный период: {' '}
                      {entry.previous_trial_ends_at 
                        ? format(new Date(entry.previous_trial_ends_at), 'dd.MM.yyyy')
                        : '—'
                      }
                      {' → '}
                      {entry.new_trial_ends_at 
                        ? format(new Date(entry.new_trial_ends_at), 'dd.MM.yyyy')
                        : '—'
                      }
                    </div>
                  )}
                  
                  {entry.reason && (
                    <p className="text-sm bg-muted/50 rounded p-2 mt-2">
                      {entry.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
