import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { usePhoneMask } from '@/hooks/usePhoneMask';
import { BookingSuccess } from '@/components/BookingSuccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CalendarIcon, Users, Minus, Plus, Baby } from 'lucide-react';

interface RoomType {
  id: string;
  name: string;
  price_per_night: number;
  capacity: number;
}

interface HotelSettings {
  kaspi_id?: string;
  whatsapp_phone?: string;
}

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  hotelName: string;
  hotelSettings: HotelSettings | null;
  roomTypes: RoomType[];
  preselectedRoomTypeId?: string | null;
}

export function BookingModal({
  open,
  onOpenChange,
  hotelId,
  hotelName,
  hotelSettings,
  roomTypes,
  preselectedRoomTypeId,
}: BookingModalProps) {
  const { t } = useTranslation();
  const phoneMask = usePhoneMask();

  // Default dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);

  const [checkIn, setCheckIn] = useState<Date | undefined>(today);
  const [checkOut, setCheckOut] = useState<Date | undefined>(tomorrow);
  const [guests, setGuests] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [guestName, setGuestName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCheckIn(today);
      setCheckOut(tomorrow);
      setGuests(2);
      setChildrenCount(0);
      setChildrenAges([]);
      setGuestName('');
      phoneMask.setValue('');
      setComment('');
      setIsSuccess(false);
      setSelectedRoomType(preselectedRoomTypeId || '');
    }
  }, [open, preselectedRoomTypeId]);

  // Auto-set checkout when check-in changes
  useEffect(() => {
    if (checkIn && (!checkOut || checkOut <= checkIn)) {
      setCheckOut(addDays(checkIn, 1));
    }
  }, [checkIn]);

  // Update children ages array when count changes
  useEffect(() => {
    setChildrenAges(prev => {
      if (childrenCount > prev.length) {
        return [...prev, ...Array(childrenCount - prev.length).fill(0)];
      }
      return prev.slice(0, childrenCount);
    });
  }, [childrenCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName || !phoneMask.value || !checkIn || !checkOut || !selectedRoomType) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    try {
      const additionalInfo: Record<string, any> = {};
      if (childrenCount > 0) {
        additionalInfo.children_count = childrenCount;
        additionalInfo.children_ages = childrenAges;
      }

      const { error } = await supabase.from('bookings').insert({
        guest_name: guestName,
        guest_phone: phoneMask.value,
        check_in_date: format(checkIn, 'yyyy-MM-dd'),
        check_out_date: format(checkOut, 'yyyy-MM-dd'),
        room_type_id: selectedRoomType,
        guest_comment: comment || null,
        guest_count: guests,
        source: 'web',
        status: 'pending',
        hotel_id: hotelId,
        additional_info: Object.keys(additionalInfo).length > 0 ? additionalInfo : null,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success('Заявка отправлена!');
    } catch (error) {
      toast.error('Ошибка при отправке заявки');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nights = checkIn && checkOut
    ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const selectedRoom = roomTypes.find(r => r.id === selectedRoomType);
  const totalPrice = selectedRoom && nights > 0
    ? Number(selectedRoom.price_per_night) * nights
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{t('booking.title')}</DialogTitle>
        </DialogHeader>

        {isSuccess ? (
          <BookingSuccess
            hotelSettings={hotelSettings}
            hotelName={hotelName}
            totalPrice={totalPrice}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('booking.checkIn')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !checkIn && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkIn ? format(checkIn, 'dd.MM.yy') : t('booking.checkIn')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkIn}
                      onSelect={setCheckIn}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('booking.checkOut')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !checkOut && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkOut ? format(checkOut, 'dd.MM.yy') : t('booking.checkOut')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkOut}
                      onSelect={setCheckOut}
                      disabled={(date) => date <= (checkIn || new Date())}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Guests */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('rooms.guests')}</label>
              <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="mr-2 h-4 w-4" />
                    {guests} {guests === 1 ? 'гость' : guests < 5 ? 'гостя' : 'гостей'}
                    {childrenCount > 0 && `, ${childrenCount} дет.`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full" align="start">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('rooms.guests')}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          type="button"
                          onClick={() => setGuests(Math.max(1, guests - 1))}
                          disabled={guests <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{guests}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          type="button"
                          onClick={() => setGuests(Math.min(10, guests + 1))}
                          disabled={guests >= 10}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Baby className="h-4 w-4" />
                        {t('booking.children')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          type="button"
                          onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                          disabled={childrenCount <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{childrenCount}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          type="button"
                          onClick={() => setChildrenCount(Math.min(5, childrenCount + 1))}
                          disabled={childrenCount >= 5}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {childrenCount > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">{t('booking.childrenAges')}</p>
                        <div className="flex flex-wrap gap-2">
                          {childrenAges.map((age, idx) => (
                            <Select
                              key={idx}
                              value={age.toString()}
                              onValueChange={(val) => {
                                const newAges = [...childrenAges];
                                newAges[idx] = parseInt(val);
                                setChildrenAges(newAges);
                              }}
                            >
                              <SelectTrigger className="w-16 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 18 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Room Type */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('booking.roomType')}</label>
              <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('booking.selectRoom')} />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} — {Number(type.price_per_night).toLocaleString()} ₸
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Guest Info */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('booking.guestName')}</label>
              <Input
                placeholder="Иванов Иван Иванович"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('booking.phone')}</label>
              <Input
                placeholder="+7 (777) 123-45-67"
                value={phoneMask.value}
                onChange={(e) => phoneMask.handleChange(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('booking.comment')}</label>
              <Textarea
                placeholder={t('booking.commentPlaceholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>

            {/* Price Summary */}
            {totalPrice && nights > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {Number(selectedRoom?.price_per_night).toLocaleString()} ₸ × {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}
                  </span>
                  <span>{totalPrice.toLocaleString()} ₸</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-border">
                  <span>Итого</span>
                  <span className="text-primary">{totalPrice.toLocaleString()} ₸</span>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('booking.submit')}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
