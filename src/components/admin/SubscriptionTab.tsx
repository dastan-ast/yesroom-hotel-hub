import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, ArrowRight, Loader2, History } from 'lucide-react';

interface SubscriptionTabProps {
  hotelId: string;
}

interface HotelSubscription {
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
}

interface HistoryRecord {
  id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
  new_trial_ends_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  trial: 'Пробный',
  active: 'Активный',
  expired: 'Истёк',
  suspended: 'Приостановлен',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  trial: 'secondary',
  active: 'default',
  expired: 'destructive',
  suspended: 'outline',
};

export function SubscriptionTab({ hotelId }: SubscriptionTabProps) {
  const [hotel, setHotel] = useState<HotelSubscription | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [hotelId]);

  const fetchData = async () => {
    setLoading(true);
    const [hotelRes, historyRes] = await Promise.all([
      supabase
        .from('hotels')
        .select('subscription_status, trial_ends_at, created_at')
        .eq('id', hotelId)
        .maybeSingle(),
      supabase
        .from('subscription_history')
        .select('id, previous_status, new_status, reason, created_at, new_trial_ends_at')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (hotelRes.data) setHotel(hotelRes.data);
    if (historyRes.data) setHistory(historyRes.data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hotel) return null;

  const fmt = (d: string) => format(new Date(d), 'dd MMM yyyy', { locale: ru });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Подписка
          </CardTitle>
          <CardDescription>Текущий статус и информация о подписке</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Статус</p>
              <Badge variant={STATUS_VARIANTS[hotel.subscription_status] || 'outline'} className="mt-1">
                {STATUS_LABELS[hotel.subscription_status] || hotel.subscription_status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Дата регистрации</p>
              <p className="font-medium mt-1">{fmt(hotel.created_at)}</p>
            </div>
            {hotel.trial_ends_at && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {hotel.subscription_status === 'trial' ? 'Пробный период до' : 'Действует до'}
                </p>
                <p className="font-medium mt-1">{fmt(hotel.trial_ends_at)}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button asChild>
              <Link to="/pricing">
                Посмотреть тарифы
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contacts">Связаться для оплаты</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История изменений
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Изменений пока нет</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Изменение</TableHead>
                  <TableHead>Причина</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">{fmt(h.created_at)}</TableCell>
                    <TableCell>
                      {h.previous_status && (
                        <Badge variant="outline" className="mr-1">
                          {STATUS_LABELS[h.previous_status] || h.previous_status}
                        </Badge>
                      )}
                      →{' '}
                      <Badge variant={STATUS_VARIANTS[h.new_status] || 'outline'}>
                        {STATUS_LABELS[h.new_status] || h.new_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{h.reason || '—'}</TableCell>
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
