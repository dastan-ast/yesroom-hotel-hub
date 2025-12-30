import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Users } from 'lucide-react';

interface HotelCardProps {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  logoUrl: string | null;
  minPrice: number | null;
  searchParams?: string;
}

export function HotelCard({
  id,
  name,
  slug,
  location,
  description,
  logoUrl,
  minPrice,
  searchParams = '',
}: HotelCardProps) {
  const hotelUrl = `/hotels/${slug}${searchParams ? `?${searchParams}` : ''}`;

  return (
    <Card className="overflow-hidden card-hover group">
      <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 to-primary/5 relative overflow-hidden">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Building2 className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
        {minPrice && (
          <Badge className="absolute bottom-3 right-3 bg-accent text-accent-foreground shadow-lg">
            от {minPrice.toLocaleString()} ₸
          </Badge>
        )}
      </div>
      <CardContent className="p-5">
        <h3 className="font-display font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
          {name}
        </h3>
        {location && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <MapPin className="h-3.5 w-3.5" />
            {location}
          </p>
        )}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {description}
          </p>
        )}
        <Button asChild className="w-full">
          <Link to={hotelUrl}>Смотреть номера</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
