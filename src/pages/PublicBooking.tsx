import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { RoomCard } from '@/components/RoomCard';
import { BookingForm } from '@/components/BookingForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin } from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
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

export default function PublicBooking() {
  const { hotelSlug } = useParams();
  const { t } = useTranslation();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchHotelData = async () => {
      if (!hotelSlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Fetch hotel by slug using public view (excludes sensitive fields like owner_id)
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

      // Fetch room types for this hotel (RLS allows public view for active hotels only)
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
          <p className="text-muted-foreground">
            Проверьте правильность ссылки или обратитесь к администратору отеля
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="gradient-hero text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            {hotel.logo_url ? (
              <img src={hotel.logo_url} alt={hotel.name} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center">
                <Building2 className="h-8 w-8" />
              </div>
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold">{hotel.name}</h1>
              {hotel.location && (
                <p className="flex items-center gap-1 opacity-80 mt-1">
                  <MapPin className="h-4 w-4" />
                  {hotel.location}
                </p>
              )}
            </div>
          </div>
          {hotel.description && (
            <p className="text-lg opacity-90 max-w-2xl">{hotel.description}</p>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Room Types */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-display font-bold mb-6">{t('rooms.title')}</h2>
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
                    images={room.images}
                    imageUrl={room.image_url}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Номера скоро появятся</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Booking Form */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>{t('booking.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingForm hotelId={hotel.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
