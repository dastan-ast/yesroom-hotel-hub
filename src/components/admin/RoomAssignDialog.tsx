import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle, X } from 'lucide-react';

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
  multiRoom?: boolean;
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
  multiRoom: initialMultiRoom = false 
}: Props) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingDates, setBookingDates] = useState({ checkIn: '', checkOut: '' });
  const [multiRoomMode, setMultiRoomMode] = useState(initialMultiRoom);

  useEffect(() => {
    if (open && hotelId) {
      fetchAvailableRooms();
    }
    if (open) {
      setSelectedRooms([]);
      setMultiRoomMode(initialMultiRoom);
    }
  }, [open, hotelId, roomTypeId, checkInDate, checkOutDate]);

  const fetchAvailableRooms = async () => {
    setLoading(true);
    
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
    
    // Get all rooms (filter by room type if specified)
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

    // Get conflicting bookings using date overlap formula
    const { data: conflictingBookings } = await supabase
      .from('bookings')
      .select('room_id')
      .eq('hotel_id', hotelId)
      .neq('id', bookingId)
      .not('room_id', 'is', null)
      .in('status', ['approved', 'checked_in'])
      .lt('check_in_date', bookingCheckOut)
      .gt('check_out_date', bookingCheckIn);

    // Also check booking_rooms table for multi-room assignments
    const { data: conflictingBookingRooms } = await supabase
      .from('booking_rooms')
      .select('room_id, bookings!inner(id, check_in_date, check_out_date, status)')
      .eq('hotel_id', hotelId)
      .neq('booking_id', bookingId);

    // Filter booking_rooms by date and status
    const conflictingRoomIdsFromBookingRooms = (conflictingBookingRooms || [])
      .filter((br: any) => {
        const booking = br.bookings;
        if (!booking) return false;
        if (!['approved', 'checked_in'].includes(booking.status)) return false;
        return booking.check_in_date < bookingCheckOut && booking.check_out_date > bookingCheckIn;
      })
      .map((br: any) => br.room_id);

    const conflictingRoomIds = new Set([
      ...(conflictingBookings || []).map(b => b.room_id),
      ...conflictingRoomIdsFromBookingRooms
    ]);

    const roomsWithStatus: Room[] = allRooms.map(room => ({
      ...room,
      hasConflict: conflictingRoomIds.has(room.id),
    }));

    roomsWithStatus.sort((a, b) => {
      if (a.hasConflict && !b.hasConflict) return 1;
      if (!a.hasConflict && b.hasConflict) return -1;
      return 0;
    });

    setRooms(roomsWithStatus);
    setLoading(false);
  };

  const toggleRoomSelection = (roomId: string) => {
    if (multiRoomMode) {
      setSelectedRooms(prev => 
        prev.includes(roomId) 
          ? prev.filter(id => id !== roomId)
          : [...prev, roomId]
      );
    } else {
      setSelectedRooms([roomId]);
    }
  };

  const removeRoom = (roomId: string) => {
    setSelectedRooms(prev => prev.filter(id => id !== roomId));
  };

  const handleAssign = async () => {
    if (selectedRooms.length === 0) {
      toast.error('Выберите номер');
      return;
    }

    setSubmitting(true);
    
    try {
      // First, clear existing booking_rooms for this booking
      await supabase
        .from('booking_rooms')
        .delete()
        .eq('booking_id', bookingId);

      // Insert all selected rooms into booking_rooms table
      const roomEntries = selectedRooms.map(roomId => ({
        booking_id: bookingId,
        room_id: roomId,
        hotel_id: hotelId,
      }));

      const { error: bookingRoomsError } = await supabase
        .from('booking_rooms')
        .insert(roomEntries);

      if (bookingRoomsError) {
        console.error('Error inserting booking_rooms:', bookingRoomsError);
        toast.error(t('common.error'));
        setSubmitting(false);
        return;
      }

      // Update booking with first room_id for backward compatibility
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          room_id: selectedRooms[0], 
          status: 'approved',
          additional_info: {
            total_rooms: selectedRooms.length,
          }
        })
        .eq('id', bookingId);

      if (bookingError) {
        toast.error(t('common.error'));
        setSubmitting(false);
        return;
      }

      // Update all rooms to booked status
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'booked' })
        .in('id', selectedRooms);

      if (roomError) {
        toast.error(t('common.error'));
        setSubmitting(false);
        return;
      }

      toast.success(selectedRooms.length > 1 
        ? `${selectedRooms.length} номеров назначено` 
        : 'Номер назначен, бронирование подтверждено'
      );
      setSelectedRooms([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error assigning rooms:', error);
      toast.error(t('common.error'));
    }
    
    setSubmitting(false);
  };

  const availableRooms = rooms.filter(r => !r.hasConflict);
  const conflictRooms = rooms.filter(r => r.hasConflict);

  // Get selected room details for display
  const selectedRoomDetails = rooms.filter(r => selectedRooms.includes(r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Назначить номера</DialogTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="multi-room-switch" className="text-sm text-muted-foreground">
                Несколько номеров
              </Label>
              <Switch
                id="multi-room-switch"
                checked={multiRoomMode}
                onCheckedChange={(checked) => {
                  setMultiRoomMode(checked);
                  if (!checked && selectedRooms.length > 1) {
                    setSelectedRooms([selectedRooms[0]]);
                  }
                }}
              />
            </div>
          </div>
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
                          {multiRoomMode && (
                            <input
                              type="checkbox"
                              checked={selectedRooms.includes(room.id)}
                              readOnly
                              className="h-4 w-4 rounded border border-input bg-background pointer-events-none"
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
              
              {/* Conflicting rooms */}
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
          
          {/* Selected rooms summary with remove buttons */}
          {selectedRoomDetails.length > 0 && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="text-sm font-medium">
                Выбрано: {selectedRoomDetails.length} {selectedRoomDetails.length === 1 ? 'номер' : 'номера'}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedRoomDetails.map(room => (
                  <Badge key={room.id} variant="secondary" className="flex items-center gap-1">
                    {room.room_number} ({room.room_types?.name})
                    {multiRoomMode && selectedRoomDetails.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRoom(room.id);
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
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
