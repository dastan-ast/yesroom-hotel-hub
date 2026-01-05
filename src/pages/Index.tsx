import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { SearchBar } from '@/components/SearchBar';
import { HotelCard } from '@/components/HotelCard';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight, Star } from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  logo_url: string | null;
}

interface HotelWithPrice extends Hotel {
  minPrice: number | null;
}

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [hotels, setHotels] = useState<HotelWithPrice[]>([]);
  const [loading, setLoading] = useState(true);

  // Parse URL params
  const checkInParam = searchParams.get('checkIn');
  const checkOutParam = searchParams.get('checkOut');
  const guestsParam = searchParams.get('guests');
  const childrenParam = searchParams.get('children');
  const childrenAgesParam = searchParams.get('childrenAges');

  const [checkIn, setCheckIn] = useState<Date | undefined>(
    checkInParam ? new Date(checkInParam) : undefined
  );
  const [checkOut, setCheckOut] = useState<Date | undefined>(
    checkOutParam ? new Date(checkOutParam) : undefined
  );
  const [guests, setGuests] = useState(guestsParam ? parseInt(guestsParam) : 2);
  const [children, setChildren] = useState(childrenParam ? parseInt(childrenParam) : 0);
  const [childrenAges, setChildrenAges] = useState<number[]>(
    childrenAgesParam ? childrenAgesParam.split(',').map(Number) : []
  );

  useEffect(() => {
    fetchHotels();
  }, [checkIn, checkOut, guests]);

  const fetchHotels = async () => {
    setLoading(true);

    // Fetch active hotels
    const { data: hotelsData, error: hotelsError } = await supabase
      .from('hotels')
      .select('id, name, slug, location, description, logo_url')
      .eq('status', 'active')
      .in('subscription_status', ['trial', 'active']);

    if (hotelsError) {
      setLoading(false);
      return;
    }

    if (!hotelsData || hotelsData.length === 0) {
      setHotels([]);
      setLoading(false);
      return;
    }

    const hotelIds = hotelsData.map(h => h.id);

    // Fetch room types with capacity filtering
    let roomTypesQuery = supabase
      .from('room_types')
      .select('hotel_id, price_per_night, capacity')
      .in('hotel_id', hotelIds);
    
    if (guests > 1) {
      roomTypesQuery = roomTypesQuery.gte('capacity', guests);
    }
    
    const { data: roomTypesData } = await roomTypesQuery;

    // If filtering by dates, check room availability
    let availableHotelIds = new Set(hotelIds);
    
    if (checkIn && checkOut) {
      // Get hotels that have at least one available room
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('hotel_id, id, room_type_id')
        .in('hotel_id', hotelIds)
        .eq('status', 'available');

      if (roomsData && roomsData.length > 0) {
        const roomIds = roomsData.map(r => r.id);
        
        // Check for conflicting bookings
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('room_id')
          .in('room_id', roomIds)
          .in('status', ['pending', 'approved', 'checked_in'])
          .lt('check_in_date', format(checkOut, 'yyyy-MM-dd'))
          .gt('check_out_date', format(checkIn, 'yyyy-MM-dd'));

        const bookedRoomIds = new Set(bookingsData?.map(b => b.room_id) || []);
        
        // Filter to hotels with at least one available room
        const hotelRoomCounts = new Map<string, number>();
        roomsData.forEach(room => {
          if (!bookedRoomIds.has(room.id)) {
            hotelRoomCounts.set(room.hotel_id!, (hotelRoomCounts.get(room.hotel_id!) || 0) + 1);
          }
        });

        availableHotelIds = new Set(hotelRoomCounts.keys());
      } else {
        availableHotelIds = new Set();
      }
    }

    // Calculate min price per hotel (considering capacity filter)
    const minPriceMap: Record<string, number> = {};
    roomTypesData?.forEach(rt => {
      if (rt.hotel_id) {
        const price = Number(rt.price_per_night);
        if (!minPriceMap[rt.hotel_id] || price < minPriceMap[rt.hotel_id]) {
          minPriceMap[rt.hotel_id] = price;
        }
      }
    });

    // Filter hotels based on availability and capacity
    const filteredHotels = hotelsData.filter(hotel => {
      // If no dates selected, show hotels with rooms matching capacity
      if (!checkIn || !checkOut) {
        return !guests || guests <= 1 || minPriceMap[hotel.id] !== undefined;
      }
      // If dates selected, filter by availability
      return availableHotelIds.has(hotel.id);
    });

    const hotelsWithPrices: HotelWithPrice[] = filteredHotels.map(hotel => ({
      ...hotel,
      minPrice: minPriceMap[hotel.id] || null,
    }));

    setHotels(hotelsWithPrices);
    setLoading(false);
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set('checkIn', format(checkIn, 'yyyy-MM-dd'));
    if (checkOut) params.set('checkOut', format(checkOut, 'yyyy-MM-dd'));
    params.set('guests', guests.toString());
    if (children > 0) {
      params.set('children', children.toString());
      if (childrenAges.length > 0) {
        params.set('childrenAges', childrenAges.join(','));
      }
    }
    setSearchParams(params);
  };

  const getSearchParamsString = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set('checkIn', format(checkIn, 'yyyy-MM-dd'));
    if (checkOut) params.set('checkOut', format(checkOut, 'yyyy-MM-dd'));
    params.set('guests', guests.toString());
    if (children > 0) {
      params.set('children', children.toString());
      if (childrenAges.length > 0) {
        params.set('childrenAges', childrenAges.join(','));
      }
    }
    return params.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section with Search */}
      <section className="relative overflow-hidden gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
            }}
          />
        </div>
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center animate-slide-up mb-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Star className="h-4 w-4 text-accent" />
              <span className="text-sm">Лучшие отели Казахстана</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 leading-tight">
              Найдите идеальный отель
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Бронируйте напрямую у отелей без комиссий и посредников
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto animate-fade-in">
            <SearchBar
              checkIn={checkIn}
              checkOut={checkOut}
              guests={guests}
              children={children}
              childrenAges={childrenAges}
              onCheckInChange={setCheckIn}
              onCheckOutChange={setCheckOut}
              onGuestsChange={setGuests}
              onChildrenChange={setChildren}
              onChildrenAgesChange={setChildrenAges}
              onSearch={handleSearch}
            />
          </div>
        </div>

        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="hsl(var(--background))"
            />
          </svg>
        </div>
      </section>

      {/* Hotels Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold">
                Доступные отели
              </h2>
              <p className="text-muted-foreground mt-1">
                {hotels.length} {hotels.length === 1 ? 'отель' : hotels.length < 5 ? 'отеля' : 'отелей'} найдено
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-card rounded-xl animate-pulse h-[340px]">
                  <div className="aspect-[16/10] bg-muted rounded-t-xl" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-10 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : hotels.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
              {hotels.map((hotel, index) => (
                <div
                  key={hotel.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <HotelCard
                    id={hotel.id}
                    name={hotel.name}
                    slug={hotel.slug}
                    location={hotel.location}
                    description={hotel.description}
                    logoUrl={hotel.logo_url}
                    minPrice={hotel.minPrice}
                    searchParams={getSearchParamsString()}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-display font-semibold mb-2">
                Отели скоро появятся
              </h3>
              <p className="text-muted-foreground mb-6">
                Станьте первым отелем на нашей платформе
              </p>
              <Button asChild>
                <Link to="/auth">
                  Зарегистрировать отель
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA for Hotels */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">
            Вы владелец отеля?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Присоединяйтесь к YesRoom и получайте прямые бронирования без комиссий
          </p>
          <Button size="lg" asChild>
            <Link to="/auth">
              Зарегистрировать отель
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 font-display text-xl font-semibold mb-4">
                <Building2 className="h-6 w-6" />
                <span>YesRoom</span>
              </div>
              <p className="text-sm opacity-70">
                Бронируйте отели напрямую
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Гостям</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><a href="/" className="hover:opacity-100">Найти отель</a></li>
                <li><a href="#" className="hover:opacity-100">Как забронировать</a></li>
                <li><a href="#" className="hover:opacity-100">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Отелям</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><Link to="/auth" className="hover:opacity-100">Регистрация</Link></li>
                <li><a href="#" className="hover:opacity-100">Преимущества</a></li>
                <li><a href="#" className="hover:opacity-100">Тарифы</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Поддержка</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><a href="#" className="hover:opacity-100">Контакты</a></li>
                <li><a href="#" className="hover:opacity-100">Помощь</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center">
            <p className="text-sm opacity-70">
              © {new Date().getFullYear()} YesRoom. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
