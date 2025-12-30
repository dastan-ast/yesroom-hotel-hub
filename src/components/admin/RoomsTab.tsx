import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { RoomDialog } from './RoomDialog';
import { cn } from '@/lib/utils';

type RoomStatus = 'available' | 'booked' | 'occupied' | 'maintenance';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  status: RoomStatus;
  room_type_id: string;
  notes: string | null;
  room_types?: { name: string; price_per_night: number } | null;
}

interface RoomType {
  id: string;
  name: string;
  price_per_night: number;
}

const statusColors: Record<RoomStatus, string> = {
  available: 'bg-green-500/20 border-green-500 text-green-700',
  booked: 'bg-yellow-500/20 border-yellow-500 text-yellow-700',
  occupied: 'bg-red-500/20 border-red-500 text-red-700',
  maintenance: 'bg-muted border-muted-foreground/30 text-muted-foreground',
};

export function RoomsTab({ hotelId }: { hotelId: string }) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (hotelId) {
      fetchData();
    }
  }, [hotelId]);

  const fetchData = async () => {
    setLoading(true);
    const [roomsRes, typesRes] = await Promise.all([
      supabase
        .from('rooms')
        .select('*, room_types(name, price_per_night)')
        .eq('hotel_id', hotelId)
        .order('floor')
        .order('room_number'),
      supabase
        .from('room_types')
        .select('id, name, price_per_night')
        .eq('hotel_id', hotelId),
    ]);

    if (roomsRes.data) setRooms(roomsRes.data as Room[]);
    if (typesRes.data) setRoomTypes(typesRes.data);
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingRoom(null);
    setDialogOpen(true);
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setDialogOpen(true);
  };

  const handleStatusChange = async (room: Room, newStatus: RoomStatus) => {
    const { error } = await supabase
      .from('rooms')
      .update({ status: newStatus })
      .eq('id', room.id);
    
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('common.success'));
      fetchData();
    }
  };

  const handleSave = async (data: Partial<Room>) => {
    if (editingRoom) {
      const { error } = await supabase
        .from('rooms')
        .update(data)
        .eq('id', editingRoom.id);
      if (error) {
        toast.error(t('common.error'));
        return;
      }
    } else {
      const insertData = {
        room_number: data.room_number!,
        room_type_id: data.room_type_id!,
        floor: data.floor,
        status: data.status,
        notes: data.notes,
        hotel_id: hotelId,
      };
      const { error } = await supabase.from('rooms').insert([insertData]);
      if (error) {
        toast.error(t('common.error'));
        return;
      }
    }
    toast.success(t('common.success'));
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('common.success'));
      fetchData();
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  // Group rooms by floor
  const roomsByFloor = rooms.reduce((acc, room) => {
    if (!acc[room.floor]) acc[room.floor] = [];
    acc[room.floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  const floors = Object.keys(roomsByFloor).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.rooms')}</h2>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.addRoom')}
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500" />
          <span>{t('admin.available')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500" />
          <span>{t('admin.booked')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500" />
          <span>{t('admin.occupied')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted border border-muted-foreground/30" />
          <span>{t('admin.maintenance')}</span>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Номера не добавлены
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map((floor) => (
            <div key={floor}>
              <h3 className="text-lg font-medium mb-3">{t('admin.floor')} {floor}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {roomsByFloor[floor].map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleEdit(room)}
                    className={cn(
                      'p-3 rounded-lg border-2 cursor-pointer transition-all hover:scale-105',
                      statusColors[room.status]
                    )}
                  >
                    <div className="text-lg font-bold">{room.room_number}</div>
                    <div className="text-xs opacity-75">{room.room_types?.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <RoomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        room={editingRoom}
        roomTypes={roomTypes}
        onSave={handleSave}
        onDelete={editingRoom ? () => handleDelete(editingRoom.id) : undefined}
        onStatusChange={editingRoom ? (status) => handleStatusChange(editingRoom, status) : undefined}
      />
    </div>
  );
}
