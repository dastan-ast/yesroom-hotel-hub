import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, startOfDay, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type BookingStatus = 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'cancelled';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  room_type_id: string;
  room_types: { name: string } | null;
}

interface Booking {
  id: string;
  room_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  guest_name: string;
}

const statusColors: Record<BookingStatus, string> = {
  pending: 'bg-yellow-400/80',
  approved: 'bg-blue-400/80',
  checked_in: 'bg-green-500/80',
  checked_out: 'bg-muted',
  cancelled: 'bg-red-400/60',
};

interface Props {
  hotelId: string;
}

export function ShahmatkaGrid({ hotelId }: Props) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  useEffect(() => {
    if (hotelId) {
      fetchData();
    }
  }, [hotelId, startDate]);

  const fetchData = async () => {
    setLoading(true);
    
    const endDate = addDays(startDate, 14);
    
    const [roomsRes, bookingsRes] = await Promise.all([
      supabase
        .from('rooms')
        .select('id, room_number, floor, room_type_id, room_types(name)')
        .eq('hotel_id', hotelId)
        .order('floor', { ascending: true })
        .order('room_number', { ascending: true }),
      supabase
        .from('bookings')
        .select('id, room_id, check_in_date, check_out_date, status, guest_name')
        .eq('hotel_id', hotelId)
        .not('room_id', 'is', null)
        .gte('check_out_date', format(startDate, 'yyyy-MM-dd'))
        .lte('check_in_date', format(endDate, 'yyyy-MM-dd'))
        .in('status', ['pending', 'approved', 'checked_in'])
    ]);

    if (roomsRes.data) setRooms(roomsRes.data as Room[]);
    if (bookingsRes.data) setBookings(bookingsRes.data as Booking[]);
    setLoading(false);
  };

  const getBookingForCell = (roomId: string, date: Date): Booking | null => {
    return bookings.find(b => {
      if (b.room_id !== roomId) return false;
      const checkIn = parseISO(b.check_in_date);
      const checkOut = parseISO(b.check_out_date);
      return isWithinInterval(date, { start: checkIn, end: addDays(checkOut, -1) });
    }) || null;
  };

  const handlePrev = () => setStartDate(prev => addDays(prev, -7));
  const handleNext = () => setStartDate(prev => addDays(prev, 7));
  const handleToday = () => setStartDate(startOfDay(new Date()));

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Шахматка</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Сегодня
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-yellow-400/80" />
          <span>{t('admin.pending')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-400/80" />
          <span>{t('admin.approved')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-500/80" />
          <span>{t('admin.checkedIn')}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-r p-2 text-left text-sm font-medium w-28 sticky left-0 bg-muted/50 z-10">
                Номер
              </th>
              {days.map(day => (
                <th
                  key={day.toISOString()}
                  className={cn(
                    'border-r p-1.5 text-center text-xs font-medium min-w-[60px]',
                    isSameDay(day, new Date()) && 'bg-primary/10'
                  )}
                >
                  <div>{format(day, 'EEE', { locale: ru })}</div>
                  <div className="font-bold">{format(day, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 ? (
              <tr>
                <td colSpan={15} className="p-8 text-center text-muted-foreground">
                  Нет номеров
                </td>
              </tr>
            ) : (
              rooms.map(room => (
                <tr key={room.id} className="border-t hover:bg-muted/20">
                  <td className="border-r p-2 text-sm font-medium sticky left-0 bg-background z-10">
                    <div>{room.room_number}</div>
                    <div className="text-xs text-muted-foreground">{room.room_types?.name}</div>
                  </td>
                  {days.map(day => {
                    const booking = getBookingForCell(room.id, day);
                    return (
                      <td
                        key={day.toISOString()}
                        className={cn(
                          'border-r p-0.5 text-center',
                          isSameDay(day, new Date()) && 'bg-primary/5'
                        )}
                      >
                        {booking && (
                          <div
                            className={cn(
                              'h-8 rounded text-xs flex items-center justify-center text-white font-medium truncate px-1',
                              statusColors[booking.status]
                            )}
                            title={`${booking.guest_name} (${booking.status})`}
                          >
                            {isSameDay(parseISO(booking.check_in_date), day) 
                              ? booking.guest_name.split(' ')[0] 
                              : ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
