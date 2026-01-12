import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Hotel {
  id: string;
  name: string;
  subscription_status: string;
  trial_ends_at: string | null;
}

interface SubscriptionDialogProps {
  hotel: Hotel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SubscriptionDialog({ hotel, open, onOpenChange, onSuccess }: SubscriptionDialogProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState('trial');
  const [trialEndsAt, setTrialEndsAt] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hotel) {
      setStatus(hotel.subscription_status);
      setTrialEndsAt(hotel.trial_ends_at ? new Date(hotel.trial_ends_at) : undefined);
      setReason('');
    }
  }, [hotel]);

  const getStatusLabel = (value: string) => {
    const labels: Record<string, string> = {
      trial: 'Пробный',
      active: 'Активный',
      expired: 'Истёк',
      suspended: 'Приостановлен'
    };
    return labels[value] || value;
  };

  const handleSave = async () => {
    if (!hotel || !user) return;

    setLoading(true);
    try {
      // Update hotel subscription
      const { error: updateError } = await supabase
        .from('hotels')
        .update({
          subscription_status: status,
          trial_ends_at: status === 'trial' && trialEndsAt ? trialEndsAt.toISOString() : null
        })
        .eq('id', hotel.id);

      if (updateError) throw updateError;

      // Record in history
      const { error: historyError } = await supabase
        .from('subscription_history')
        .insert({
          hotel_id: hotel.id,
          previous_status: hotel.subscription_status,
          new_status: status,
          previous_trial_ends_at: hotel.trial_ends_at,
          new_trial_ends_at: status === 'trial' && trialEndsAt ? trialEndsAt.toISOString() : null,
          changed_by: user.id,
          reason: reason.trim() || null
        });

      if (historyError) throw historyError;

      toast.success('Подписка успешно обновлена');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast.error('Ошибка при обновлении подписки');
    } finally {
      setLoading(false);
    }
  };

  if (!hotel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Управление подпиской</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-muted-foreground">Отель</Label>
            <p className="font-medium">{hotel.name}</p>
          </div>

          <div>
            <Label className="text-muted-foreground">Текущий статус</Label>
            <div className="mt-1">
              <Badge variant={
                hotel.subscription_status === 'active' ? 'default' :
                hotel.subscription_status === 'trial' ? 'secondary' :
                hotel.subscription_status === 'expired' ? 'destructive' : 'outline'
              }>
                {getStatusLabel(hotel.subscription_status)}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Новый статус</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Пробный</SelectItem>
                <SelectItem value="active">Активный</SelectItem>
                <SelectItem value="expired">Истёк</SelectItem>
                <SelectItem value="suspended">Приостановлен</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'trial' && (
            <div className="space-y-2">
              <Label>Пробный период до</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !trialEndsAt && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {trialEndsAt ? format(trialEndsAt, 'PPP', { locale: ru }) : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={trialEndsAt}
                    onSelect={setTrialEndsAt}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <Label>Причина изменения (опционально)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Укажите причину изменения..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
