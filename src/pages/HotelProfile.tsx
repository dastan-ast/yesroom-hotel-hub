import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { RoomCard } from '@/components/RoomCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
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
import {
  Building2,
  MapPin,
  Wifi,
  Car,
  Coffee,
  Utensils,
  ArrowLeft,
  CalendarIcon,
  Users,
  Minus,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  logo_url: string | null;
  settings: any;
}

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
}

export default function HotelProfile() {
  const { hotelSlug } = useParams();
  const [searchParams] = useSearchParams();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Booking form state - pre-fill from URL params
  const checkInParam = searchParams.get('checkIn');
  const checkOutParam = searchParams.get('checkOut');
  const guestsParam = searchParams.get('guests');

  const [checkIn, setCheckIn] = useState<Date | undefined>(
    checkInParam ? new Date(checkInParam) : undefined
  );
  const [checkOut, setCheckOut] = useState<Date | undefined>(
    checkOutParam ? new Date(checkOutParam) : undefined
  );
  const [guests, setGuests] = useState(guestsParam ? parseInt(guestsParam) : 2);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  useEffect(() => {
    const fetchHotelData = async () => {
      if (!hotelSlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: hotelData, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('slug', hotelSlug)
        .eq('status', 'active')
        .in('subscription_status', ['trial', 'active'])
        .maybeSingle();

      if (hotelError || !hotelData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setHotel(hotelData);

      const { data: roomData } = await supabase
        .from('room_types')
        .select('*')
        .eq('hotel_id', hotelData.id)
        .order('price_per_night', { ascending: true });

      if (roomData) {
        setRoomTypes(roomData);
      }

      setLoading(false);
    };

    fetchHotelData();
  }, [hotelSlug]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName || !guestPhone || !checkIn || !checkOut || !selectedRoomType) {
      toast.error('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        guest_name: guestName,
        guest_phone: guestPhone,
        check_in_date: format(checkIn, 'yyyy-MM-dd'),
        check_out_date: format(checkOut, 'yyyy-MM-dd'),
        room_type_id: selectedRoomType,
        guest_comment: comment || null,
        guest_count: guests,
        source: 'web',
        status: 'pending',
        hotel_id: hotel?.id || null,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success('Заявка успешно отправлена!');
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Произошла ошибка при отправке заявки');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (notFound || !hotel) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold mb-2">Отель не найден</h1>
          <p className="text-muted-foreground mb-6">
            Проверьте правильность ссылки или отель ещё не активирован
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Вернуться к поиску
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const minPrice = roomTypes.length > 0
    ? Math.min(...roomTypes.map(r => Number(r.price_per_night)))
    : null;

  const nights = checkIn && checkOut
    ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const selectedRoom = roomTypes.find(r => r.id === selectedRoomType);
  const totalPrice = selectedRoom && nights > 0
    ? Number(selectedRoom.price_per_night) * nights
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Button variant="ghost" asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Назад к поиску
          </Link>
        </Button>
      </div>

      {/* Hero Section */}
      <section className="relative">
        <div className="h-[300px] md:h-[400px] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          {hotel.logo_url ? (
            <img
              src={hotel.logo_url}
              alt={hotel.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-center">
              <Building2 className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Фотографии отеля</p>
            </div>
          )}
        </div>

        <div className="container mx-auto px-4">
          <div className="relative -mt-20 bg-background rounded-xl shadow-lg p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold">{hotel.name}</h1>
                {hotel.location && (
                  <p className="flex items-center gap-2 text-muted-foreground mt-2">
                    <MapPin className="h-4 w-4" />
                    {hotel.location}
                  </p>
                )}
                {hotel.description && (
                  <p className="text-muted-foreground mt-4 max-w-2xl">{hotel.description}</p>
                )}
              </div>
              {minPrice && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">от</p>
                  <p className="text-3xl font-bold text-primary">{minPrice.toLocaleString()} ₸</p>
                  <p className="text-sm text-muted-foreground">за ночь</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <Badge variant="secondary" className="gap-1">
                <Wifi className="h-3 w-3" /> Wi-Fi
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Car className="h-3 w-3" /> Парковка
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Coffee className="h-3 w-3" /> Завтрак
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Utensils className="h-3 w-3" /> Ресторан
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Room Types */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-display font-bold mb-6">Доступные номера</h2>
            {roomTypes.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {roomTypes.map((room) => (
                  <RoomCard
                    key={room.id}
                    id={room.id}
                    name={room.name}
                    description={room.description}
                    price={Number(room.price_per_night)}
                    capacity={room.capacity}
                    amenities={room.amenities}
                    imageUrl={room.image_url}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Номера скоро появятся</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Booking Form - Sticky */}
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="font-display">Забронировать номер</CardTitle>
              </CardHeader>
              <CardContent>
                {isSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Заявка отправлена!</h3>
                    <p className="text-sm text-muted-foreground">
                      Мы свяжемся с вами для подтверждения
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleBookingSubmit} className="space-y-4">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Заезд</label>
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
                              {checkIn ? format(checkIn, 'dd.MM.yy') : 'Дата'}
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
                        <label className="text-sm font-medium mb-1.5 block">Выезд</label>
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
                              {checkOut ? format(checkOut, 'dd.MM.yy') : 'Дата'}
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
                      <label className="text-sm font-medium mb-1.5 block">Гости</label>
                      <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <Users className="mr-2 h-4 w-4" />
                            {guests} {guests === 1 ? 'гость' : guests < 5 ? 'гостя' : 'гостей'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full" align="start">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Количество гостей</span>
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
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Room Type */}
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Тип номера</label>
                      <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите номер" />
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
                      <label className="text-sm font-medium mb-1.5 block">Ваше имя</label>
                      <Input
                        placeholder="Иван Иванов"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Телефон</label>
                      <Input
                        placeholder="+7 (777) 123-45-67"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Комментарий</label>
                      <Textarea
                        placeholder="Пожелания к бронированию..."
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
                      {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
