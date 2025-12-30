import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, Coffee, Tv, Bath, Wind } from 'lucide-react';

interface RoomCardProps {
  id: string;
  name: string;
  description: string | null;
  price: number;
  capacity: number;
  amenities: string[] | null;
  imageUrl: string | null;
}

const amenityIcons: Record<string, React.ElementType> = {
  wifi: Wifi,
  coffee: Coffee,
  tv: Tv,
  bath: Bath,
  ac: Wind,
};

export function RoomCard({ id, name, description, price, capacity, amenities, imageUrl }: RoomCardProps) {
  const { t } = useTranslation();

  const defaultImage = 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&auto=format&fit=crop&q=60';

  return (
    <Card className="overflow-hidden card-hover group">
      <div className="relative h-56 overflow-hidden">
        <img
          src={imageUrl || defaultImage}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4">
          <Badge className="bg-accent text-accent-foreground font-semibold shadow-gold">
            {price.toLocaleString()} ₸ / {t('rooms.perNight')}
          </Badge>
        </div>
      </div>
      <CardContent className="p-6">
        <h3 className="text-xl font-display font-semibold mb-2">{name}</h3>
        {description && (
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{capacity} {t('rooms.guests')}</span>
          </div>
          {amenities && amenities.length > 0 && (
            <div className="flex items-center gap-2">
              {amenities.slice(0, 3).map((amenity) => {
                const Icon = amenityIcons[amenity.toLowerCase()] || Wifi;
                return <Icon key={amenity} className="h-4 w-4" />;
              })}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="px-6 pb-6 pt-0">
        <Button asChild className="w-full">
          <Link to={`/booking?roomType=${id}`}>{t('rooms.book')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
