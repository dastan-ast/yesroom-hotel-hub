import { useState, useEffect } from 'react';
import { format, addDays, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  room_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  guest_name: string;
  is_half_day?: boolean;
}

interface Room {
  id: string;
  room_number: string;
  room_type_id: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-400',
  approved: 'bg-blue-400',
  checked_in: 'bg-green-500',
  checked_out: 'bg-muted',
  cancelled: 'bg-destructive/40',
};

export function MiniShahmatka({ hotelId, onNavigate }: { hotelId: string; onNavigate?: (tab: string) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const today = startOfDay(new Date());
  const days = [today, addDays(today, 1), addDays(today, 2)];

  useEffect(() => {
    if (!hotelId) return;
    const from = format(today, 'yyyy-MM-dd');
    const to = format(addDays(today, 3), 'yyyy-MM-dd');

    Promise.all([
      supabase.from('rooms').select('id, room_number, room_type_id').eq('hotel_id', hotelId).order('room_number'),
      supabase.from('bookings').select('id, room_id, check_in_date, check_out_date, status, guest_name, is_half_day')
        .eq('hotel_id', hotelId)
        .neq('status', 'cancelled')
        .lte('check_in_date', to)
        .gte('check_out_date', from),
    ]).then(([roomsRes, bookingsRes]) => {
      if (roomsRes.data) setRooms(roomsRes.data);
      if (bookingsRes.data) setBookings(bookingsRes.data as Booking[]);
    });
  }, [hotelId]);

  const getBookingForCell = (roomId: string, day: Date) => {
    return bookings.find(b =>
      b.room_id === roomId &&
      isWithinInterval(day, {
        start: startOfDay(parseISO(b.check_in_date)),
        end: startOfDay(parseISO(b.check_out_date)),
      })
    );
  };

  const displayRooms = rooms.slice(0, 10);

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('bookings')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Загрузка на 3 дня
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <TooltipProvider delayDuration={200}>
          <div className="overflow-hidden">
            {/* Header row */}
            <div className="grid gap-px" style={{ gridTemplateColumns: `56px repeat(3, 1fr)` }}>
              <div className="text-[10px] text-muted-foreground p-1" />
              {days.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-muted-foreground p-1">
                  {i === 0 ? 'Сегодня' : format(d, 'dd MMM', { locale: ru })}
                </div>
              ))}
            </div>

            {/* Room rows */}
            {displayRooms.map(room => (
              <div key={room.id} className="grid gap-px" style={{ gridTemplateColumns: `56px repeat(3, 1fr)` }}>
                <div className="text-[10px] font-medium p-1 truncate flex items-center">
                  №{room.room_number}
                </div>
                {days.map((day, di) => {
                  const booking = getBookingForCell(room.id, day);
                  return (
                    <Tooltip key={di}>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          'h-6 rounded-sm border border-border/50',
                          booking ? statusColors[booking.status] || 'bg-muted' : 'bg-muted/30'
                        )} />
                      </TooltipTrigger>
                      {booking && (
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{booking.guest_name}</p>
                          <p className="text-muted-foreground">
                            {format(parseISO(booking.check_in_date), 'dd.MM')} — {format(parseISO(booking.check_out_date), 'dd.MM')}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            ))}

            {rooms.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                +{rooms.length - 10} номеров…
              </p>
            )}

            {/* Legend */}
            <div className="flex gap-3 pt-2 mt-2 border-t flex-wrap">
              {[
                { color: 'bg-yellow-400', label: 'Ожидает' },
                { color: 'bg-blue-400', label: 'Подтв.' },
                { color: 'bg-green-500', label: 'Заселён' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className={cn('w-2.5 h-2.5 rounded-sm', l.color)} />
                  <span className="text-[10px] text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
