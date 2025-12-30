import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Check, X, Building2, MapPin, Calendar } from 'lucide-react';

interface PendingHotel {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  created_at: string;
  owner_id: string | null;
  owner_name?: string;
  owner_email?: string;
}

export function HotelRequestsTab() {
  const [pendingHotels, setPendingHotels] = useState<PendingHotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingHotels();
  }, []);

  const fetchPendingHotels = async () => {
    setLoading(true);
    const { data: hotels, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить заявки',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    // Fetch owner profiles
    if (hotels && hotels.length > 0) {
      const ownerIds = hotels.map(h => h.owner_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ownerIds);

      const hotelsWithOwners = hotels.map(hotel => ({
        ...hotel,
        owner_name: profiles?.find(p => p.user_id === hotel.owner_id)?.full_name || 'Неизвестно'
      }));

      setPendingHotels(hotelsWithOwners);
    } else {
      setPendingHotels([]);
    }
    
    setLoading(false);
  };

  const handleApprove = async (hotelId: string) => {
    const { error } = await supabase
      .from('hotels')
      .update({ status: 'active' })
      .eq('id', hotelId);

    if (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось одобрить отель',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Отель одобрен',
      description: 'Владелец теперь может управлять отелем'
    });
    fetchPendingHotels();
  };

  const handleReject = async (hotelId: string) => {
    const { error } = await supabase
      .from('hotels')
      .update({ status: 'rejected' })
      .eq('id', hotelId);

    if (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отклонить отель',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Отель отклонён',
      description: 'Заявка была отклонена'
    });
    fetchPendingHotels();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Заявки на регистрацию отелей
          {pendingHotels.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingHotels.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingHotels.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Нет ожидающих заявок</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Владелец</TableHead>
                <TableHead>Дата заявки</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingHotels.map((hotel) => (
                <TableRow key={hotel.id}>
                  <TableCell>
                    <div className="font-medium">{hotel.name}</div>
                    {hotel.description && (
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {hotel.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {hotel.location ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {hotel.location}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{hotel.owner_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(hotel.created_at), 'dd MMM yyyy', { locale: ru })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprove(hotel.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(hotel.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Отклонить
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
