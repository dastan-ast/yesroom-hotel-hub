import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { AlertTriangle, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Adjustment {
  id: string;
  booking_id: string;
  original_total: number;
  adjusted_total: number;
  reason: string | null;
  adjusted_by_name: string;
  status: string;
  created_at: string;
}

export function CheckoutAdjustmentsWidget({ hotelId }: { hotelId: string }) {
  const { user } = useAuth();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) fetchAdjustments();
  }, [hotelId]);

  const fetchAdjustments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('checkout_adjustments' as any)
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) setAdjustments(data as unknown as Adjustment[]);
    setLoading(false);
  };

  const handleReview = async (id: string, newStatus: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('checkout_adjustments' as any)
      .update({
        status: newStatus,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Ошибка');
    } else {
      toast.success(newStatus === 'approved' ? 'Одобрено' : 'Отклонено');
      fetchAdjustments();
    }
  };

  if (loading || adjustments.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Изменения сумм при выселении ({adjustments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {adjustments.map((adj) => (
          <div key={adj.id} className="p-3 bg-background rounded-lg border space-y-2">
            <div className="flex justify-between items-start">
              <div className="text-sm">
                <span className="text-muted-foreground">Сотрудник:</span>{' '}
                <span className="font-medium">{adj.adjusted_by_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(adj.created_at), 'dd MMM HH:mm', { locale: ru })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="line-through text-muted-foreground">{adj.original_total.toLocaleString()} ₸</span>
              <span>→</span>
              <span className="font-semibold">{adj.adjusted_total.toLocaleString()} ₸</span>
              <Badge variant="outline" className={
                adj.adjusted_total < adj.original_total 
                  ? 'text-red-600 border-red-300' 
                  : 'text-green-600 border-green-300'
              }>
                {adj.adjusted_total < adj.original_total ? '−' : '+'}{Math.abs(adj.adjusted_total - adj.original_total).toLocaleString()} ₸
              </Badge>
            </div>
            {adj.reason && (
              <p className="text-xs text-muted-foreground">Причина: {adj.reason}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReview(adj.id, 'approved')}>
                <Check className="h-3 w-3 mr-1" />
                Одобрить
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleReview(adj.id, 'rejected')}>
                <X className="h-3 w-3 mr-1" />
                Отклонить
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
