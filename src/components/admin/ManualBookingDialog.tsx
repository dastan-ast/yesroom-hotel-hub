import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { usePhoneMask } from '@/hooks/usePhoneMask';
import { syncBookingToExternal } from '@/lib/syncBooking';
import { checkRoomAvailability } from '@/lib/checkRoomAvailability';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/activityLog';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, ChevronDown, BedDouble, User, AlertTriangle, UserX } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const schema = z.object({
  guest_name: z.string().min(1, 'Обязательное поле'),
  room_type_id: z.string().min(1, 'Выберите тип'),
  check_in_date: z.date({ required_error: 'Укажите дату' }),
  check_out_date: z.date().optional(),
  source: z.enum(['manual', 'web', 'booking']),
  prepayment_received: z.boolean(),
  prepayment_amount: z.number().min(0).optional(),
  guest_comment: z.string().optional(),
  guest_count: z.number().min(1).max(10).optional(),
  is_half_day: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface RoomType {
  id: string;
  name: string;
  price_per_night: number;
  price_half_day: number | null;
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
  onSuccess: (createdBookingIds: string[]) => void | Promise<void>;
  hotelId: string;
  prefillPhone?: string;
}

export function ManualBookingDialog({ open, onOpenChange, onSuccess, hotelId, prefillPhone }: Props) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availabilityWarning, setAvailabilityWarning] = useState<string | null>(null);
  const phoneMask = usePhoneMask();
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Client search state
  const [clientSuggestions, setClientSuggestions] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevOpenRef = useRef<boolean>(false);

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
      is_half_day: false,
    },
  });

  const watchIsHalfDay = form.watch('is_half_day');
  const [halfDayCheckInHour, setHalfDayCheckInHour] = useState(12);

  const watchPrepayment = form.watch('prepayment_received');
  const watchCheckIn = form.watch('check_in_date');
  const watchCheckOut = form.watch('check_out_date');
  const watchRoomType = form.watch('room_type_id');

  const effectiveCheckOut = watchIsHalfDay ? watchCheckIn : watchCheckOut;

  const availabilityKey = useMemo(() => {
    if (!open || !hotelId || !watchCheckIn || !effectiveCheckOut) return null;
    return [
      hotelId,
      watchRoomType || 'all',
      format(watchCheckIn, 'yyyy-MM-dd'),
      format(effectiveCheckOut, 'yyyy-MM-dd'),
    ].join('|');
  }, [open, hotelId, watchRoomType, watchCheckIn, effectiveCheckOut]);

  const lastAvailabilityKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;

    if (justOpened && hotelId) {
      fetchRoomTypes();
      form.reset({
        guest_name: '',
        room_type_id: '',
        source: 'manual',
        prepayment_received: false,
        prepayment_amount: 0,
        guest_comment: '',
        guest_count: 1,
        is_half_day: false,
      });
      phoneMask.setValue(prefillPhone || '');
      setIsAnonymous(false);
      setHalfDayCheckInHour(12);
      setSelectedRooms([]);
      setAvailableRooms([]);
      setRoomsOpen(false);
      setClientSuggestions([]);
      setShowSuggestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hotelId]);

  // Fetch available rooms when dates and room type change
  useEffect(() => {
    if (!availabilityKey) return;
    if (lastAvailabilityKeyRef.current === availabilityKey) return;
    lastAvailabilityKeyRef.current = availabilityKey;
    fetchAvailableRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityKey]);

  const fetchRoomTypes = async () => {
    const { data } = await supabase
      .from('room_types')
      .select('id, name, price_per_night, price_half_day')
      .eq('hotel_id', hotelId);
    if (data) setRoomTypes(data);
  };

  // Client search
  const searchClients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setClientSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Sanitize query: remove special chars that break PostgREST filters
    const sanitized = query.replace(/[(),%\\]/g, '').trim();
    if (sanitized.length < 2) {
      setClientSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, phone')
        .eq('hotel_id', hotelId)
        .or(`full_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
        .limit(5);
      setClientSuggestions(data || []);
      setShowSuggestions((data || []).length > 0);
    } catch {
      setClientSuggestions([]);
      setShowSuggestions(false);
    }
  }, [hotelId]);

  const handleGuestNameChange = (value: string, onChange: (v: string) => void) => {
    onChange(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchClients(value), 300);
  };

  const selectClient = (client: { full_name: string; phone: string }) => {
    form.setValue('guest_name', client.full_name);
    phoneMask.setValue(client.phone);
    setShowSuggestions(false);
    setClientSuggestions([]);
  };

  const fetchAvailableRooms = async () => {
    if (!watchCheckIn || !effectiveCheckOut) return;
    
    setLoadingRooms(true);
    
    const checkInStr = format(watchCheckIn, 'yyyy-MM-dd');
    const checkOutStr = watchIsHalfDay ? format(addDays(watchCheckIn, 1), 'yyyy-MM-dd') : format(effectiveCheckOut, 'yyyy-MM-dd');
    
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

    // Avoid pointless state updates (can trigger render loops in some Radix/ref scenarios)
    setAvailableRooms(prev => {
      const prevIds = prev.map(r => r.id).join(',');
      const nextIds = (available as any[]).map(r => r.id).join(',');
      return prevIds === nextIds ? prev : (available as AvailableRoom[]);
    });
    
    // Clear selected rooms that are no longer available
    setSelectedRooms(prev => {
      const next = prev.filter(id => available.some(r => r.id === id));
      return next.length === prev.length && next.every((v, i) => v === prev[i]) ? prev : next;
    });
    
    setLoadingRooms(false);
  };

  const toggleRoom = (roomId: string) => {
    setSelectedRooms(prev => 
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const handleToggleAnonymous = (checked: boolean) => {
    setIsAnonymous(checked);
    if (checked) {
      form.setValue('guest_name', 'Анонимный гость');
      phoneMask.setValue('');
      setShowSuggestions(false);
      setClientSuggestions([]);
    } else {
      form.setValue('guest_name', '');
    }
  };

  const handleSubmit = async (data: FormData) => {
    if (!data.is_half_day && !data.check_out_date) {
      toast.error('Укажите дату выезда');
      return;
    }

    const checkInStr = format(data.check_in_date, 'yyyy-MM-dd');
    const checkOutStr = data.is_half_day
      ? format(addDays(data.check_in_date, 1), 'yyyy-MM-dd')
      : format(data.check_out_date!, 'yyyy-MM-dd');

    // Check room pool availability
    if (data.room_type_id && selectedRooms.length === 0) {
      const result = await checkRoomAvailability(hotelId, data.room_type_id, checkInStr, checkOutStr);
      if (!result.available) {
        const typeName = roomTypes.find(rt => rt.id === data.room_type_id)?.name || '';
        setAvailabilityWarning(
          `На выбранные даты все номера типа "${typeName}" заняты (${result.totalRooms} из ${result.totalRooms}). Бронирование всё равно будет создано со статусом "Ожидает".`
        );
      }
    }

    setLoading(true);
    
    const hasRoomsSelected = selectedRooms.length > 0;
    const status = hasRoomsSelected ? 'approved' : 'pending';

    const checkOutDate = data.is_half_day 
      ? format(data.check_in_date, 'yyyy-MM-dd') 
      : format(data.check_out_date!, 'yyyy-MM-dd');

    // ONE ROOM = ONE BOOKING: Create separate booking for each selected room
    const roomsToCreate = hasRoomsSelected ? selectedRooms : [null];
    const createdBookingIds: string[] = [];

    // Calculate total_price based on half-day or standard logic
    const selectedType = roomTypes.find(rt => rt.id === data.room_type_id);
    let totalPrice: number | null = null;
    if (selectedType) {
      if (data.is_half_day) {
        totalPrice = selectedType.price_half_day ?? Math.round(selectedType.price_per_night / 2);
      } else if (data.check_out_date) {
        const nights = Math.max(1, differenceInDays(data.check_out_date, data.check_in_date));
        totalPrice = nights * selectedType.price_per_night;
      }
    }

    for (const roomId of roomsToCreate) {
      const { data: booking, error } = await supabase.from('bookings').insert({
        guest_name: data.guest_name,
        guest_phone: phoneMask.value || null,
        room_type_id: data.room_type_id,
        room_id: roomId,
        check_in_date: format(data.check_in_date, 'yyyy-MM-dd'),
        check_out_date: checkOutDate,
        source: data.source,
        prepayment_received: data.prepayment_received,
        prepayment_amount: data.prepayment_received ? (data.prepayment_amount || 0) : 0,
        guest_comment: data.guest_comment || null,
        guest_count: data.guest_count || 1,
        status: status,
        hotel_id: hotelId,
        total_price: totalPrice,
        daily_rate: data.is_half_day
          ? (selectedType?.price_half_day ?? (selectedType ? Math.round(selectedType.price_per_night / 2) : null))
          : (selectedType?.price_per_night ?? null),
        created_by: user?.id || null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        additional_info: {
          ...(data.is_half_day ? { half_day_check_in_hour: halfDayCheckInHour } : {}),
        },
        is_half_day: data.is_half_day,
      } as any).select('id').single();

      if (error || !booking) {
        toast.error(t('common.error'));
        setLoading(false);
        return;
      }

      createdBookingIds.push(booking.id);
    }

    // Update room statuses to booked
    if (hasRoomsSelected) {
      await supabase
        .from('rooms')
        .update({ status: 'booked' })
        .in('id', selectedRooms);
    }

    setLoading(false);

    // Sync to external (async) - sync first booking
    if (createdBookingIds.length > 0) {
      syncBookingToExternal(createdBookingIds[0]).catch(console.error);
    }

    logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'booking_created', entityType: 'booking', entityId: createdBookingIds[0], details: { guest_name: data.guest_name, phone: phoneMask.value || null, rooms_count: roomsToCreate.length, anonymous: isAnonymous } });

    toast.success(selectedRooms.length > 1 
      ? `Создано ${selectedRooms.length} бронирований` 
      : t('common.success')
    );
    await onSuccess(createdBookingIds);
    onOpenChange(false);
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
            {/* Anonymous toggle — temporarily disabled due to stability issues */}
            {/* <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium cursor-pointer">Анонимный гость</Label>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={handleToggleAnonymous} />
            </div> */}

            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>{t('booking.guestName')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Иванов Иван Иванович"
                      {...field}
                      readOnly={isAnonymous}
                      className={isAnonymous ? 'bg-muted' : ''}
                      onChange={(e) => !isAnonymous && handleGuestNameChange(e.target.value, field.onChange)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      autoComplete="off"
                    />
                  </FormControl>
                  {!isAnonymous && showSuggestions && clientSuggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-[180px] overflow-y-auto"
                    >
                      {clientSuggestions.map(client => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 text-sm"
                          onMouseDown={() => selectClient(client)}
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{client.full_name}</span>
                          <span className="text-muted-foreground ml-auto">{client.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isAnonymous && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('booking.phone')} <span className="text-muted-foreground text-xs">(необязательно)</span></label>
                <Input 
                  placeholder="+7 (777) 123-45-67" 
                  value={phoneMask.value}
                  onChange={(e) => phoneMask.handleChange(e.target.value)}
                />
              </div>
            )}

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

            {/* Half-day checkbox */}
            <FormField
              control={form.control}
              name="is_half_day"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border border-input bg-background"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Полусуточное размещение (12 часов)</FormLabel>
                    <p className="text-xs text-muted-foreground">Гость заселяется с 12:00 до 00:00 в день заезда</p>
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="check_in_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('booking.checkIn')} (с 12:00)</FormLabel>
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

              {!watchIsHalfDay && (
                <FormField
                  control={form.control}
                  name="check_out_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('booking.checkOut')} (до 12:00)</FormLabel>
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
              )}

              {watchIsHalfDay && (
                <div className="flex flex-col justify-center space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Время заселения</Label>
                    <Select value={String(halfDayCheckInHour)} onValueChange={(v) => setHalfDayCheckInHour(Number(v))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Выезд</Label>
                    <p className="text-sm font-medium">
                      {String((halfDayCheckInHour + 12) % 24).padStart(2, '0')}:00
                      {halfDayCheckInHour >= 12 ? ' (след. день)' : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Room Selection Section */}
            {watchCheckIn && (watchIsHalfDay || watchCheckOut) && (
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
                                <input
                                  type="checkbox"
                                  checked={selectedRooms.includes(room.id)}
                                  readOnly
                                  className="h-4 w-4 rounded border border-input bg-background pointer-events-none"
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
                    <input
                      type="checkbox"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border border-input bg-background"
                    />
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
      {/* Room Availability Warning */}
      <AlertDialog open={!!availabilityWarning} onOpenChange={(open) => !open && setAvailabilityWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Нет свободных номеров
            </AlertDialogTitle>
            <AlertDialogDescription>{availabilityWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAvailabilityWarning(null)}>
              Понятно
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
