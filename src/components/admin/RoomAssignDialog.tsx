import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  room_types: { name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  hotelId: string;
  roomTypeId?: string | null;
  onSuccess?: () => void;
}

export function RoomAssignDialog({ open, onOpenChange, bookingId, hotelId, roomTypeId, onSuccess }: Props) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && hotelId) {
      fetchAvailableRooms();
    }
  }, [open, hotelId, roomTypeId]);

  const fetchAvailableRooms = async () => {
    setLoading(true);
    
    let query = supabase
      .from('rooms')
      .select('id, room_number, floor, room_types(name)')
      .eq('hotel_id', hotelId)
      .eq('status', 'available')
      .order('floor')
      .order('room_number');

    // If booking has a room type, filter to matching rooms
    if (roomTypeId) {
      query = query.eq('room_type_id', roomTypeId);
    }

    const { data } = await query;
    if (data) setRooms(data as Room[]);
    setLoading(false);
  };

  const handleAssign = async () => {
    if (!selectedRoom) {
      toast.error('Выберите номер');
      return;
    }

    setSubmitting(true);
    
    // Update booking with room_id and status
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ room_id: selectedRoom, status: 'approved' })
      .eq('id', bookingId);

    if (bookingError) {
      toast.error(t('common.error'));
      setSubmitting(false);
      return;
    }

    // Update room status to booked
    const { error: roomError } = await supabase
      .from('rooms')
      .update({ status: 'booked' })
      .eq('id', selectedRoom);

    if (roomError) {
      toast.error(t('common.error'));
      setSubmitting(false);
      return;
    }

    toast.success('Номер назначен, бронирование подтверждено');
    setSelectedRoom('');
    onOpenChange(false);
    onSuccess?.();
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Назначить номер</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Доступные номера</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет свободных номеров</p>
            ) : (
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите номер" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.room_number} — {room.room_types?.name} (этаж {room.floor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleAssign} disabled={submitting || !selectedRoom}>
            {submitting ? t('common.loading') : 'Подтвердить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
