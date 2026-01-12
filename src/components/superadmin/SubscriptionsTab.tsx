import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, AlertTriangle, Clock, CreditCard, History } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SubscriptionDialog } from './SubscriptionDialog';
import { SubscriptionHistoryDialog } from './SubscriptionHistoryDialog';

interface Hotel {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  owner_id: string | null;
}

interface SubscriptionStats {
  total: number;
  trial: number;
  active: number;
  expired: number;
  suspended: number;
  expiringSoon: number;
  alreadyExpired: number;
}

export function SubscriptionsTab() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<SubscriptionStats>({
    total: 0, trial: 0, active: 0, expired: 0, suspended: 0, expiringSoon: 0, alreadyExpired: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyHotelId, setHistoryHotelId] = useState<string | null>(null);

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('trial_ends_at', { ascending: true, nullsFirst: false });

    if (data && !error) {
      setHotels(data);
      calculateStats(data);
    }
    setLoading(false);
  };

  const calculateStats = (data: Hotel[]) => {
    const now = new Date();
    const threeDaysLater = addDays(now, 3);

    const expiringSoon = data.filter(h => {
      if (h.subscription_status !== 'trial' || !h.trial_ends_at) return false;
      const endDate = new Date(h.trial_ends_at);
      return endDate > now && endDate <= threeDaysLater;
    }).length;

    const alreadyExpired = data.filter(h => {
      if (h.subscription_status !== 'trial' || !h.trial_ends_at) return false;
      return new Date(h.trial_ends_at) < now;
    }).length;

    setStats({
      total: data.length,
      trial: data.filter(h => h.subscription_status === 'trial').length,
      active: data.filter(h => h.subscription_status === 'active').length,
      expired: data.filter(h => h.subscription_status === 'expired').length,
      suspended: data.filter(h => h.subscription_status === 'suspended').length,
      expiringSoon,
      alreadyExpired
    });
  };

  const filteredHotels = hotels.filter(hotel => {
    const matchesSearch = hotel.name.toLowerCase().includes(search.toLowerCase()) ||
                         hotel.location?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || hotel.subscription_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDaysRemaining = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null;
    const days = differenceInDays(new Date(trialEndsAt), new Date());
    return days;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      trial: { variant: 'secondary', label: 'Пробный' },
      active: { variant: 'default', label: 'Активный' },
      expired: { variant: 'destructive', label: 'Истёк' },
      suspended: { variant: 'outline', label: 'Приостановлен' }
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getDaysRemainingBadge = (hotel: Hotel) => {
    if (hotel.subscription_status !== 'trial' || !hotel.trial_ends_at) {
      return <span className="text-muted-foreground">—</span>;
    }

    const days = getDaysRemaining(hotel.trial_ends_at);
    if (days === null) return <span className="text-muted-foreground">—</span>;

    if (days < 0) {
      return <Badge variant="destructive">Истёк {Math.abs(days)} дн. назад</Badge>;
    }
    if (days === 0) {
      return <Badge variant="destructive">Истекает сегодня</Badge>;
    }
    if (days <= 3) {
      return <Badge variant="destructive" className="bg-orange-500">{days} дн.</Badge>;
    }
    return <span className="text-muted-foreground">{days} дн.</span>;
  };

  const openEditDialog = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(stats.expiringSoon > 0 || stats.alreadyExpired > 0) && (
        <div className="space-y-3">
          {stats.alreadyExpired > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Требуется внимание</AlertTitle>
              <AlertDescription>
                {stats.alreadyExpired} отел{stats.alreadyExpired === 1 ? 'ь' : stats.alreadyExpired < 5 ? 'я' : 'ей'} с истёкшим пробным периодом, но со статусом "Пробный"
              </AlertDescription>
            </Alert>
          )}
          {stats.expiringSoon > 0 && (
            <Alert className="border-orange-500 bg-orange-500/10">
              <Clock className="h-4 w-4 text-orange-500" />
              <AlertTitle className="text-orange-700">Скоро истекает</AlertTitle>
              <AlertDescription className="text-orange-600">
                {stats.expiringSoon} отел{stats.expiringSoon === 1 ? 'ь' : stats.expiringSoon < 5 ? 'я' : 'ей'} с пробным периодом, истекающим в ближайшие 3 дня
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Всего</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Пробный</p>
            <p className="text-3xl font-bold text-blue-600">{stats.trial}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Активных</p>
            <p className="text-3xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Истекших</p>
            <p className="text-3xl font-bold text-destructive">{stats.expired}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Приостановлено</p>
            <p className="text-3xl font-bold text-muted-foreground">{stats.suspended}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Управление подписками
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="trial">Пробный</SelectItem>
                  <SelectItem value="active">Активный</SelectItem>
                  <SelectItem value="expired">Истёк</SelectItem>
                  <SelectItem value="suspended">Приостановлен</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Отель</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Пробный до</TableHead>
                  <TableHead>Осталось</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHotels.map((hotel) => {
                  const days = getDaysRemaining(hotel.trial_ends_at);
                  const isExpiring = hotel.subscription_status === 'trial' && days !== null && days <= 3;
                  
                  return (
                    <TableRow 
                      key={hotel.id}
                      className={isExpiring ? 'bg-destructive/5' : undefined}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{hotel.name}</p>
                          {hotel.location && (
                            <p className="text-sm text-muted-foreground">{hotel.location}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(hotel.subscription_status)}</TableCell>
                      <TableCell>
                        {hotel.trial_ends_at
                          ? format(new Date(hotel.trial_ends_at), 'dd MMM yyyy', { locale: ru })
                          : '—'}
                      </TableCell>
                      <TableCell>{getDaysRemainingBadge(hotel)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditDialog(hotel)}
                          >
                            Изменить
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHistoryHotelId(hotel.id)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredHotels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Отели не найдены
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SubscriptionDialog
        hotel={selectedHotel}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchHotels}
      />

      <SubscriptionHistoryDialog
        hotelId={historyHotelId}
        open={!!historyHotelId}
        onOpenChange={(open) => !open && setHistoryHotelId(null)}
      />
    </div>
  );
}
