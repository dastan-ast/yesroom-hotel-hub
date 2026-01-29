import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coffee, TrendingUp, Calendar, ArrowRight } from 'lucide-react';

interface ServiceStat {
  service_name: string;
  total_quantity: number;
  total_revenue: number;
}

interface Props {
  hotelId: string;
  onNavigate?: (tab: string) => void;
}

export function ServiceStatsWidget({ hotelId, onNavigate }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{
    totalRevenue: number;
    totalCount: number;
    popularServices: ServiceStat[];
  }>({ totalRevenue: 0, totalCount: 0, popularServices: [] });
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) {
      fetchStats();
    }
  }, [hotelId, period]);

  const fetchStats = async () => {
    setLoading(true);
    
    const daysBack = period === 'week' ? 7 : 30;
    const startDate = startOfDay(subDays(new Date(), daysBack)).toISOString();
    const endDate = endOfDay(new Date()).toISOString();

    // Fetch all services for the period
    const { data: servicesData } = await supabase
      .from('booking_services')
      .select('service_name, unit_price, quantity, total_price')
      .eq('hotel_id', hotelId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (servicesData) {
      // Calculate totals
      let totalRevenue = 0;
      let totalCount = 0;
      const serviceMap: Record<string, { quantity: number; revenue: number }> = {};

      servicesData.forEach(service => {
        const revenue = service.total_price ?? (service.unit_price * service.quantity);
        totalRevenue += revenue;
        totalCount += service.quantity;

        if (!serviceMap[service.service_name]) {
          serviceMap[service.service_name] = { quantity: 0, revenue: 0 };
        }
        serviceMap[service.service_name].quantity += service.quantity;
        serviceMap[service.service_name].revenue += revenue;
      });

      // Get top 5 services by quantity
      const popularServices: ServiceStat[] = Object.entries(serviceMap)
        .map(([name, data]) => ({
          service_name: name,
          total_quantity: data.quantity,
          total_revenue: data.revenue,
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 5);

      setStats({ totalRevenue, totalCount, popularServices });
    }
    setLoading(false);
  };

  const periodLabel = period === 'week' ? 'За 7 дней' : 'За 30 дней';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coffee className="h-5 w-5 text-primary" />
            Услуги
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={period === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPeriod('week')}
            >
              7 дн
            </Button>
            <Button
              variant={period === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPeriod('month')}
            >
              30 дн
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-4 text-center text-muted-foreground text-sm">
            {t('common.loading')}
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Выручка</p>
                <p className="text-xl font-bold text-primary">
                  {stats.totalRevenue.toLocaleString()} ₸
                </p>
                <p className="text-xs text-muted-foreground">{periodLabel}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Оказано услуг</p>
                <p className="text-xl font-bold">{stats.totalCount}</p>
                <p className="text-xs text-muted-foreground">{periodLabel}</p>
              </div>
            </div>

            {/* Popular services */}
            {stats.popularServices.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Популярные услуги
                </p>
                <div className="space-y-2">
                  {stats.popularServices.map((service, index) => (
                    <div 
                      key={service.service_name} 
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <span className="truncate max-w-[120px]">{service.service_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>×{service.total_quantity}</span>
                        <span className="font-medium text-foreground">
                          {service.total_revenue.toLocaleString()} ₸
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.popularServices.length === 0 && (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Нет данных за этот период
              </div>
            )}

            {/* Link to service log */}
            {onNavigate && (
              <Button 
                variant="ghost" 
                className="w-full justify-between" 
                onClick={() => onNavigate('services')}
              >
                <span>Журнал услуг</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
