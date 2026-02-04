import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { usePhoneMask } from '@/hooks/usePhoneMask';
import { syncBookingToExternal } from '@/lib/syncBooking';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, ChevronDown, BedDouble } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const schema = z.object({
  guest_name: z.string().min(1, 'Обязательное поле'),
  room_type_id: z.string().min(1, 'Выберите тип'),
  check_in_date: z.date({ required_error: 'Укажите дату' }),
  check_out_date: z.date({ required_error: 'Укажите дату' }),
  source: z.enum(['manual', 'web', 'booking']),
  prepayment_received: z.boolean(),
  prepayment_amount: z.number().min(0).optional(),
  guest_comment: z.string().optional(),
  guest_count: z.number().min(1).max(10).optional(),
});

type FormData = z.infer<typeof schema>;

interface RoomType {
  id: string;
  name: string;
  price_per_night: number;
}

interface AvailableRoom {
  id: string;
  room_number: string;
  floor: number;
  room_type_id: string;
  room_types: { name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  hotelId: string;
}

export function ManualBookingDialog({ open, onOpenChange, onSuccess, hotelId }: Props) {
  const { t } = useTranslation();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loading, setLoading] = useState(false);
  const phoneMask = usePhoneMask();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      guest_name: '',
      room_type_id: '',
      source: 'manual',
      prepayment_received: false,
      prepayment_amount: 0,
      guest_comment: '',
      guest_count: 1,
    },
  });

  const watchPrepayment = form.watch('prepayment_received');
  const watchCheckIn = form.watch('check_in_date');
  const watchCheckOut = form.watch('check_out_date');
  const watchRoomType = form.watch('room_type_id');

  useEffect(() => {
    if (open && hotelId) {
      fetchRoomTypes();
      form.reset({
        guest_name: '',
        room_type_id: '',
        source: 'manual',
        prepayment_received: false,
        prepayment_amount: 0,
        guest_comment: '',
        guest_count: 1,
      });
      phoneMask.setValue('');
      setSelectedRooms([]);
      setAvailableRooms([]);
      setRoomsOpen(false);
    }
  }, [open, hotelId, form]);

  // Fetch available rooms when dates and room type change
  useEffect(() => {
    if (watchCheckIn && watchCheckOut && hotelId) {
      fetchAvailableRooms();
    }
  }, [watchCheckIn, watchCheckOut, watchRoomType, hotelId]);

  const fetchRoomTypes = async () => {
    const { data } = await supabase
      .from('room_types')
      .select('id, name, price_per_night')
      .eq('hotel_id', hotelId);
    if (data) setRoomTypes(data);
  };

  const fetchAvailableRooms = async () => {
    if (!watchCheckIn || !watchCheckOut) return;
    
    setLoadingRooms(true);
    
    const checkInStr = format(watchCheckIn, 'yyyy-MM-dd');
    const checkOutStr = format(watchCheckOut, 'yyyy-MM-dd');
    
    // Get all rooms
    let query = supabase
      .from('rooms')
      .select('id, room_number, floor, room_type_id, room_types(name)')
      .eq('hotel_id', hotelId)
      .neq('status', 'maintenance')
      .order('floor')
      .order('room_number');

    if (watchRoomType) {
      query = query.eq('room_type_id', watchRoomType);
    }

    const { data: allRooms } = await query;

    if (!allRooms) {
      setAvailableRooms([]);
      setLoadingRooms(false);
      return;
    }

    // Get conflicting bookings
    const { data: conflictingBookings } = await supabase
      .from('bookings')
      .select('room_id')
      .eq('hotel_id', hotelId)
      .not('room_id', 'is', null)
      .in('status', ['approved', 'checked_in'])
      .lt('check_in_date', checkOutStr)
      .gt('check_out_date', checkInStr);

    // Get conflicting booking_rooms
    const { data: conflictingBookingRooms } = await supabase
      .from('booking_rooms')
      .select('room_id, bookings!inner(check_in_date, check_out_date, status)')
      .eq('hotel_id', hotelId);

    const conflictingRoomIdsFromBookingRooms = (conflictingBookingRooms || [])
      .filter((br: any) => {
        const booking = br.bookings;
        if (!booking) return false;
        if (!['approved', 'checked_in'].includes(booking.status)) return false;
        return booking.check_in_date < checkOutStr && booking.check_out_date > checkInStr;
      })
      .map((br: any) => br.room_id);

    const conflictingRoomIds = new Set([
      ...(conflictingBookings || []).map(b => b.room_id),
      ...conflictingRoomIdsFromBookingRooms
    ]);

    const available = allRooms.filter(room => !conflictingRoomIds.has(room.id));
    setAvailableRooms(available as AvailableRoom[]);
    
    // Clear selected rooms that are no longer available
    setSelectedRooms(prev => prev.filter(id => available.some(r => r.id === id)));
    
    setLoadingRooms(false);
  };

  const toggleRoom = (roomId: string) => {
    setSelectedRooms(prev => 
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const handleSubmit = async (data: FormData) => {
    if (!phoneMask.value) {
      toast.error('Укажите телефон');
      return;
    }

    setLoading(true);
    
    // Determine status based on room selection
    const hasRoomsSelected = selectedRooms.length > 0;
    const status = hasRoomsSelected ? 'approved' : 'pending';
    
    const { data: booking, error } = await supabase.from('bookings').insert({
      guest_name: data.guest_name,
      guest_phone: phoneMask.value,
      room_type_id: data.room_type_id,
      room_id: hasRoomsSelected ? selectedRooms[0] : null,
      check_in_date: format(data.check_in_date, 'yyyy-MM-dd'),
      check_out_date: format(data.check_out_date, 'yyyy-MM-dd'),
      source: data.source,
      prepayment_received: data.prepayment_received,
      prepayment_amount: data.prepayment_received ? (data.prepayment_amount || 0) : 0,
      guest_comment: data.guest_comment || null,
      guest_count: data.guest_count || 1,
      status: status,
      hotel_id: hotelId,
      additional_info: hasRoomsSelected ? { total_rooms: selectedRooms.length } : {},
    }).select('id').single();

    if (error || !booking) {
      toast.error(t('common.error'));
      setLoading(false);
      return;
    }

    // If rooms were selected, create booking_rooms entries
    if (hasRoomsSelected) {
      const roomEntries = selectedRooms.map(roomId => ({
        booking_id: booking.id,
        room_id: roomId,
        hotel_id: hotelId,
      }));

      const { error: bookingRoomsError } = await supabase
        .from('booking_rooms')
        .insert(roomEntries);

      if (bookingRoomsError) {
        console.error('Error inserting booking_rooms:', bookingRoomsError);
      }

      // Update room statuses to booked
      await supabase
        .from('rooms')
        .update({ status: 'booked' })
        .in('id', selectedRooms);
    }

    setLoading(false);

    // Sync to external (async)
    syncBookingToExternal(booking.id).catch(console.error);

    toast.success(t('common.success'));
    onOpenChange(false);
    onSuccess();
  };

  const selectedRoomDetails = availableRooms.filter(r => selectedRooms.includes(r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin.newBooking')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.guestName')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Иванов Иван Иванович" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('booking.phone')}</label>
              <Input 
                placeholder="+7 (777) 123-45-67" 
                value={phoneMask.value}
                onChange={(e) => phoneMask.handleChange(e.target.value)}
              />
            </div>

            <FormField
              control={form.control}
              name="room_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.roomType')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('booking.selectRoom')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} — {type.price_per_night.toLocaleString()} ₸
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="check_in_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('booking.checkIn')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd.MM.yyyy') : 'Выбрать'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="check_out_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('booking.checkOut')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd.MM.yyyy') : 'Выбрать'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Room Selection Section */}
            {watchCheckIn && watchCheckOut && (
              <Collapsible open={roomsOpen} onOpenChange={setRoomsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4" />
                      <span>
                        {selectedRooms.length > 0 
                          ? `Выбрано: ${selectedRooms.length} номер${selectedRooms.length > 1 ? 'а' : ''}`
                          : 'Назначить номера сразу (опционально)'
                        }
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      roomsOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="border rounded-lg p-3 space-y-3">
                    {loadingRooms ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        {t('common.loading')}
                      </p>
                    ) : availableRooms.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Нет свободных номеров на эти даты
                      </p>
                    ) : (
                      <>
                        <Label className="text-xs text-muted-foreground">
                          Свободные номера ({availableRooms.length})
                        </Label>
                        <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                          {availableRooms.map(room => (
                            <div
                              key={room.id}
                              onClick={() => toggleRoom(room.id)}
                              className={cn(
                                'p-2 rounded border cursor-pointer transition-all text-sm',
                                selectedRooms.includes(room.id)
                                  ? 'border-primary bg-primary/10'
                                  : 'border-muted hover:border-primary/50'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  checked={selectedRooms.includes(room.id)}
                                  className="pointer-events-none"
                                />
                                <div>
                                  <div className="font-medium">{room.room_number}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {room.room_types?.name}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {selectedRoomDetails.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2 border-t">
                            {selectedRoomDetails.map(room => (
                              <Badge key={room.id} variant="secondary" className="text-xs">
                                {room.room_number}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.source')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manual">{t('admin.manual')}</SelectItem>
                      <SelectItem value="web">{t('admin.web')}</SelectItem>
                      <SelectItem value="booking">{t('admin.bookingCom')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guest_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Количество гостей</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={1} 
                      max={10} 
                      {...field} 
                      value={field.value || 1}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prepayment_received"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('admin.prepayment')}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {watchPrepayment && (
              <FormField
                control={form.control}
                name="prepayment_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сумма предоплаты (₸)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        placeholder="0"
                        {...field} 
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="guest_comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('booking.comment')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('booking.commentPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('common.loading') : t('admin.save')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
