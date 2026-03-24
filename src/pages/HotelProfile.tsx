import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { RoomCard } from '@/components/RoomCard';
import { BookingModal } from '@/components/BookingModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  MapPin,
  Wifi,
  Car,
  Coffee,
  Utensils,
  ArrowLeft,
} from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  logo_url: string | null;
}

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
  images: string[] | null;
}

export default function HotelProfile() {
  const { t } = useTranslation();
  const { hotelSlug } = useParams();
  const [searchParams] = useSearchParams();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Booking modal state
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [preselectedRoomType, setPreselectedRoomType] = useState<string | null>(null);

  useEffect(() => {
    const fetchHotelData = async () => {
      if (!hotelSlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Use public view to exclude sensitive fields like owner_id
      const { data: hotelData, error: hotelError } = await supabase
        .from('hotels_public')
        .select('id, name, slug, location, description, logo_url')
        .eq('slug', hotelSlug)
        .maybeSingle() as any;

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

  // Handle booking from room card
  const handleBookRoom = (roomTypeId: string) => {
    setPreselectedRoomType(roomTypeId);
    setBookingModalOpen(true);
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
          <h1 className="text-2xl font-display font-bold mb-2">{t('common.error')}</h1>
          <p className="text-muted-foreground mb-6">
            Отель не найден
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.back')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const minPrice = roomTypes.length > 0
    ? Math.min(...roomTypes.map(r => Number(r.price_per_night)))
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Button variant="ghost" asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
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
              <p className="text-muted-foreground">{t('rooms.title')}</p>
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
              
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <Badge variant="secondary" className="gap-1">
                <Wifi className="h-3 w-3" /> Wi-Fi
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Car className="h-3 w-3" /> Парковка
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Coffee className="h-3 w-3" /> Кофе
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
        <h2 className="text-2xl font-display font-bold mb-6">{t('rooms.title')}</h2>
        {roomTypes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomTypes.map((room) => (
              <RoomCard
                key={room.id}
                id={room.id}
                name={room.name}
                description={room.description}
                price={Number(room.price_per_night)}
                capacity={room.capacity}
                amenities={room.amenities}
                images={room.images}
                imageUrl={room.image_url}
                onBook={handleBookRoom}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Номера пока не добавлены</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Booking Modal */}
      <BookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        hotelId={hotel.id}
        hotelName={hotel.name}
        hotelSettings={null}
        roomTypes={roomTypes}
        preselectedRoomTypeId={preselectedRoomType}
      />
    </div>
  );
}
