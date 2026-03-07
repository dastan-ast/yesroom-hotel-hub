import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, Coffee, Tv, Bath, Wind, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

interface RoomCardProps {
  id: string;
  name: string;
  description: string | null;
  price?: number;
  priceWeekend?: number | null;
  capacity: number;
  amenities: string[] | null;
  images: string[] | null;
  imageUrl: string | null;
  onBook?: (roomTypeId: string) => void;
  showPrice?: boolean;
}

const amenityIcons: Record<string, React.ElementType> = {
  wifi: Wifi,
  coffee: Coffee,
  tv: Tv,
  bath: Bath,
  ac: Wind,
};

export function RoomCard({ id, name, description, price, priceWeekend, capacity, amenities, images, imageUrl, onBook, showPrice = true }: RoomCardProps) {
  const { t } = useTranslation();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const defaultImage = 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&auto=format&fit=crop&q=60';

  // Combine images array with fallback to imageUrl
  const allImages = (() => {
    const imgs: string[] = [];
    if (images && images.length > 0) {
      imgs.push(...images);
    } else if (imageUrl) {
      imgs.push(imageUrl);
    }
    return imgs.length > 0 ? imgs : [defaultImage];
  })();

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on('select', () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  const handleBookClick = () => {
    if (onBook) {
      onBook(id);
    }
  };

  const scrollPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    api?.scrollPrev();
  };

  const scrollNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    api?.scrollNext();
  };

  const renderImage = () => {
    // Single image - no carousel needed
    if (allImages.length === 1) {
      return (
        <div className="relative h-56 overflow-hidden">
          <img
            src={allImages[0]}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
      );
    }

    // Multiple images - use carousel
    return (
      <Carousel setApi={setApi} className="w-full" opts={{ loop: true }}>
        <CarouselContent className="ml-0">
          {allImages.map((img, index) => (
            <CarouselItem key={index} className="pl-0">
              <div className="relative h-56 overflow-hidden">
                <img
                  src={img}
                  alt={`${name} - ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {/* Navigation arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background shadow-md z-10"
          onClick={scrollPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background shadow-md z-10"
          onClick={scrollNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Slide indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-1 rounded-full text-xs font-medium z-10">
          {current} / {count}
        </div>
      </Carousel>
    );
  };

  return (
    <Card className="overflow-hidden card-hover group">
      <div className="relative">
        {renderImage()}
        {showPrice && price !== undefined && (
          <div className="absolute top-4 right-4 z-10">
            <Badge className="bg-accent text-accent-foreground font-semibold shadow-gold">
              {priceWeekend && priceWeekend !== price
                ? `${Math.min(price, priceWeekend).toLocaleString()} — ${Math.max(price, priceWeekend).toLocaleString()} ₸`
                : `${price.toLocaleString()} ₸ / ${t('rooms.perNight')}`
              }
            </Badge>
          </div>
        )}
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
        <Button className="w-full" onClick={handleBookClick}>
          {t('rooms.book')}
        </Button>
      </CardFooter>
    </Card>
  );
}
