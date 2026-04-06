import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/activityLog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, DoorOpen } from 'lucide-react';
import { RoomTypeDialog } from './RoomTypeDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  price_weekend: number | null;
  price_half_day: number | null;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
  images: string[] | null;
  roomCount?: number;
}

export function RoomTypesTab({ hotelId }: { hotelId: string }) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [quickAddTypeId, setQuickAddTypeId] = useState<string | null>(null);
  const [quickRoomNumber, setQuickRoomNumber] = useState('');
  const [quickFloor, setQuickFloor] = useState(1);
  const [quickAdding, setQuickAdding] = useState(false);

  useEffect(() => {
    if (hotelId) {
      fetchRoomTypes();
    }
  }, [hotelId]);

  const fetchRoomTypes = async () => {
    setLoading(true);
    const [typesRes, roomsRes] = await Promise.all([
      supabase.from('room_types').select('*').eq('hotel_id', hotelId).order('price_per_night', { ascending: true }),
      supabase.from('rooms').select('id, room_type_id').eq('hotel_id', hotelId),
    ]);
    
    if (typesRes.error) {
      toast.error(t('common.error'));
    } else {
      const roomCounts: Record<string, number> = {};
      (roomsRes.data || []).forEach((r: any) => {
        roomCounts[r.room_type_id] = (roomCounts[r.room_type_id] || 0) + 1;
      });
      setRoomTypes((typesRes.data || []).map((rt: any) => ({ ...rt, roomCount: roomCounts[rt.id] || 0 })));
    }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingType(null);
    setDialogOpen(true);
  };

  const handleEdit = (roomType: RoomType) => {
    setEditingType(roomType);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('room_types').delete().eq('id', id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('common.success'));
      fetchRoomTypes();
    }
  };

  const handleSave = async (data: Partial<RoomType>) => {
    if (editingType) {
      const { error } = await supabase
        .from('room_types')
        .update({
          name: data.name,
          description: data.description,
          price_per_night: data.price_per_night,
          price_weekend: data.price_weekend ?? null,
          price_half_day: data.price_half_day ?? null,
          capacity: data.capacity,
          amenities: data.amenities,
          image_url: data.image_url,
          images: data.images,
        } as any)
        .eq('id', editingType.id);
      if (error) {
        toast.error(t('common.error'));
        return;
      }
    } else {
      const insertData = {
        name: data.name!,
        price_per_night: data.price_per_night!,
        price_weekend: data.price_weekend ?? null,
        price_half_day: data.price_half_day ?? null,
        description: data.description,
        capacity: data.capacity,
        amenities: data.amenities,
        image_url: data.image_url,
        images: data.images || [],
        hotel_id: hotelId,
      };
      const { error } = await supabase.from('room_types').insert([insertData] as any);
      if (error) {
        toast.error(t('common.error'));
        return;
      }
    }

    // Log action for owner visibility
    if (user) {
      logAdminAction({
        hotelId,
        userId: user.id,
        userName: profile?.full_name || '',
        action: editingType ? 'room_type_updated' : 'room_type_created',
        entityType: 'room_type',
        entityId: editingType?.id,
        details: {
          name: data.name,
          price_per_night: data.price_per_night,
          price_half_day: data.price_half_day,
        },
      });
    }

    toast.success(t('common.success'));
    setDialogOpen(false);
    fetchRoomTypes();
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.roomTypes')}</h2>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.addRoomType')}
        </Button>
      </div>

      {roomTypes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Типы номеров не добавлены
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Фото</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Будни</TableHead>
              <TableHead>Выходные</TableHead>
              <TableHead>Полсутки</TableHead>
              <TableHead>Вместимость</TableHead>
              <TableHead>Номеров</TableHead>
              <TableHead>Удобства</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roomTypes.map((type) => {
              const photoCount = type.images?.length || (type.image_url ? 1 : 0);
              const primaryImage = type.images?.[0] || type.image_url;
              return (
                <TableRow key={type.id}>
                  <TableCell>
                    {primaryImage ? (
                      <div className="relative w-10 h-10">
                        <img src={primaryImage} alt="" className="w-10 h-10 object-cover rounded" />
                        {photoCount > 1 && (
                          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center">
                            {photoCount}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">—</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell>{type.price_per_night?.toLocaleString()} ₸</TableCell>
                <TableCell>{type.price_weekend ? `${type.price_weekend.toLocaleString()} ₸` : <span className="text-muted-foreground text-xs">= будни</span>}</TableCell>
                <TableCell>{type.price_half_day ? `${type.price_half_day.toLocaleString()} ₸` : <span className="text-muted-foreground text-xs">50%</span>}</TableCell>
                <TableCell>{type.capacity} чел.</TableCell>
                <TableCell>{type.roomCount ?? 0}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {type.amenities?.join(', ') || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(type)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(type.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <RoomTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        roomType={editingType}
        onSave={handleSave}
      />
    </div>
  );
}
