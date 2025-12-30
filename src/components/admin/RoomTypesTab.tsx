import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { RoomTypeDialog } from './RoomTypeDialog';

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
}

export function RoomTypesTab() {
  const { t } = useTranslation();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  const fetchRoomTypes = async () => {
    const { data, error } = await supabase
      .from('room_types')
      .select('*')
      .order('price_per_night', { ascending: true });
    
    if (error) {
      toast.error(t('common.error'));
    } else {
      setRoomTypes(data || []);
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
        .update(data)
        .eq('id', editingType.id);
      if (error) {
        toast.error(t('common.error'));
        return;
      }
    } else {
      const { error } = await supabase.from('room_types').insert([data as any]);
      if (error) {
        toast.error(t('common.error'));
        return;
      }
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
              <TableHead>Название</TableHead>
              <TableHead>Цена/ночь</TableHead>
              <TableHead>Вместимость</TableHead>
              <TableHead>Удобства</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roomTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell>{type.price_per_night?.toLocaleString()} ₸</TableCell>
                <TableCell>{type.capacity} чел.</TableCell>
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
            ))}
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
