import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin } from 'lucide-react';

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
    <Link to={hotelUrl} className="block h-full">
      <Card className="overflow-hidden card-hover group h-full flex flex-col">
        <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 to-primary/5 relative overflow-hidden flex-shrink-0">
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
        <CardContent className="p-5 flex flex-col flex-grow">
          <h3 className="font-display font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
            {name}
          </h3>
          {location && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          )}
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
              {description}
            </p>
          )}
          <div className="mt-4 pt-3 border-t border-border">
            <span className="text-sm font-medium text-primary">Смотреть номера →</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
