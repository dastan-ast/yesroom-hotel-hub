import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  room_types: { name: string } | null;
  hasConflict?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  hotelId: string;
  roomTypeId?: string | null;
  checkInDate?: string;
  checkOutDate?: string;
  onSuccess?: () => void;
  multiRoom?: boolean; // Enable multi-room selection
}

export function RoomAssignDialog({ 
  open, 
  onOpenChange, 
  bookingId, 
  hotelId, 
  roomTypeId, 
  checkInDate,
  checkOutDate,
  onSuccess,
  multiRoom = false 
}: Props) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingDates, setBookingDates] = useState({ checkIn: '', checkOut: '' });

  useEffect(() => {
    if (open && hotelId) {
      fetchAvailableRooms();
    }
    // Reset selection when dialog opens
    if (open) {
      setSelectedRooms([]);
    }
  }, [open, hotelId, roomTypeId, checkInDate, checkOutDate]);

  const fetchAvailableRooms = async () => {
    setLoading(true);
    
    // First, get booking dates if not provided
    let bookingCheckIn = checkInDate;
    let bookingCheckOut = checkOutDate;
    
    if (!bookingCheckIn || !bookingCheckOut) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('check_in_date, check_out_date')
        .eq('id', bookingId)
        .single();
      
      if (booking) {
        bookingCheckIn = booking.check_in_date;
        bookingCheckOut = booking.check_out_date;
      }
    }
    
    setBookingDates({ checkIn: bookingCheckIn || '', checkOut: bookingCheckOut || '' });
    
    // Get all rooms (not just 'available' status, we'll check conflicts)
    let query = supabase
      .from('rooms')
      .select('id, room_number, floor, room_types(name), status')
      .eq('hotel_id', hotelId)
      .neq('status', 'maintenance')
      .order('floor')
      .order('room_number');

    if (roomTypeId) {
      query = query.eq('room_type_id', roomTypeId);
    }

    const { data: allRooms } = await query;
    
    if (!allRooms || !bookingCheckIn || !bookingCheckOut) {
      setRooms([]);
      setLoading(false);
      return;
    }

    // Get all bookings that might conflict with our dates
    // Using date overlap formula: (RequestStart < ExistingEnd) AND (RequestEnd > ExistingStart)
    const { data: conflictingBookings } = await supabase
      .from('bookings')
      .select('room_id')
      .eq('hotel_id', hotelId)
      .neq('id', bookingId) // Exclude current booking
      .not('room_id', 'is', null)
      .in('status', ['approved', 'checked_in']) // Only active bookings cause conflicts
      .lt('check_in_date', bookingCheckOut)  // Existing start < requested end
      .gt('check_out_date', bookingCheckIn); // Existing end > requested start

    const conflictingRoomIds = new Set(
      (conflictingBookings || []).map(b => b.room_id)
    );

    // Mark rooms with conflicts
    const roomsWithStatus: Room[] = allRooms.map(room => ({
      ...room,
      hasConflict: conflictingRoomIds.has(room.id),
    }));

    // Sort: available first, then with conflicts
    roomsWithStatus.sort((a, b) => {
      if (a.hasConflict && !b.hasConflict) return 1;
      if (!a.hasConflict && b.hasConflict) return -1;
      return 0;
    });

    setRooms(roomsWithStatus);
    setLoading(false);
  };

  const toggleRoomSelection = (roomId: string) => {
    if (multiRoom) {
      setSelectedRooms(prev => 
        prev.includes(roomId) 
          ? prev.filter(id => id !== roomId)
          : [...prev, roomId]
      );
    } else {
      setSelectedRooms([roomId]);
    }
  };

  const handleAssign = async () => {
    if (selectedRooms.length === 0) {
      toast.error('Выберите номер');
      return;
    }

    setSubmitting(true);
    
    // For single room assignment (default behavior)
    if (!multiRoom) {
      const roomId = selectedRooms[0];
      
      // Update booking with room_id and status
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ room_id: roomId, status: 'approved' })
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
        .eq('id', roomId);

      if (roomError) {
        toast.error(t('common.error'));
        setSubmitting(false);
        return;
      }
    } else {
      // Multi-room: update all selected rooms to booked and mark booking as approved
      // The main booking gets the first room, additional rooms tracked in additional_info
      const [mainRoom, ...additionalRooms] = selectedRooms;
      
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          room_id: mainRoom, 
          status: 'approved',
          additional_info: {
            additional_rooms: additionalRooms,
            total_rooms: selectedRooms.length,
          }
        })
        .eq('id', bookingId);

      if (bookingError) {
        toast.error(t('common.error'));
        setSubmitting(false);
        return;
      }

      // Update all rooms to booked
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'booked' })
        .in('id', selectedRooms);

      if (roomError) {
        toast.error(t('common.error'));
        setSubmitting(false);
        return;
      }
    }

    toast.success(multiRoom && selectedRooms.length > 1 
      ? `${selectedRooms.length} номеров назначено` 
      : 'Номер назначен, бронирование подтверждено'
    );
    setSelectedRooms([]);
    onOpenChange(false);
    onSuccess?.();
    setSubmitting(false);
  };

  const availableRooms = rooms.filter(r => !r.hasConflict);
  const conflictRooms = rooms.filter(r => r.hasConflict);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {multiRoom ? 'Назначить номера' : 'Назначить номер'}
          </DialogTitle>
          {bookingDates.checkIn && bookingDates.checkOut && (
            <p className="text-sm text-muted-foreground">
              Период: {format(parseISO(bookingDates.checkIn), 'dd.MM')} — {format(parseISO(bookingDates.checkOut), 'dd.MM.yyyy')}
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : availableRooms.length === 0 && conflictRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет подходящих номеров</p>
          ) : (
            <>
              {/* Available rooms */}
              {availableRooms.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-green-600">Свободные номера</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableRooms.map(room => (
                      <div
                        key={room.id}
                        onClick={() => toggleRoomSelection(room.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedRooms.includes(room.id)
                            ? 'border-primary bg-primary/10'
                            : 'border-muted hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {multiRoom && (
                            <Checkbox 
                              checked={selectedRooms.includes(room.id)} 
                              className="pointer-events-none"
                            />
                          )}
                          <div>
                            <div className="font-medium">{room.room_number}</div>
                            <div className="text-xs text-muted-foreground">
                              {room.room_types?.name} • этаж {room.floor}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Conflicting rooms (show but disabled) */}
              {conflictRooms.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Занятые на эти даты
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {conflictRooms.map(room => (
                      <div
                        key={room.id}
                        className="p-3 rounded-lg border-2 border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                      >
                        <div className="font-medium">{room.room_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {room.room_types?.name} • этаж {room.floor}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          
          {selectedRooms.length > 0 && (
            <div className="p-2 bg-muted rounded-lg text-sm">
              Выбрано: {selectedRooms.length} {selectedRooms.length === 1 ? 'номер' : 'номера'}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleAssign} disabled={submitting || selectedRooms.length === 0}>
            {submitting ? t('common.loading') : 'Подтвердить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
