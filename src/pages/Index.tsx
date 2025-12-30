import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { RoomCard } from '@/components/RoomCard';
import { Button } from '@/components/ui/button';
import { ArrowRight, Star, Shield, Clock } from 'lucide-react';

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
}

const Index = () => {
  const { t } = useTranslation();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoomTypes = async () => {
      const { data } = await supabase
        .from('room_types')
        .select('*')
        .order('price_per_night', { ascending: true });
      
      if (data) setRoomTypes(data);
      setLoading(false);
    };
    fetchRoomTypes();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero text-primary-foreground">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&auto=format&fit=crop')] opacity-20 bg-cover bg-center" />
        <div className="relative container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-2xl animate-slide-up">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 leading-tight">
              {t('hero.title')}
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-8">
              {t('hero.subtitle')}
            </p>
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-gold">
              <Link to="/booking">
                {t('hero.cta')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="hsl(var(--background))"/>
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Star, title: 'Премиум сервис', desc: 'Высокий уровень обслуживания' },
              { icon: Shield, title: 'Безопасность', desc: 'Надежная система бронирования' },
              { icon: Clock, title: '24/7 Поддержка', desc: 'Круглосуточная помощь гостям' },
            ].map((feature, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 p-6 rounded-lg bg-card shadow-card animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rooms Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-12">
            {t('rooms.title')}
          </h2>
          
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 bg-card rounded-lg animate-pulse" />
              ))}
            </div>
          ) : roomTypes.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {roomTypes.map((room, index) => (
                <div key={room.id} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <RoomCard
                    id={room.id}
                    name={room.name}
                    description={room.description}
                    price={Number(room.price_per_night)}
                    capacity={room.capacity}
                    amenities={room.amenities}
                    imageUrl={room.image_url}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-6">Номера скоро появятся</p>
              <Button asChild>
                <Link to="/booking">{t('hero.cta')}</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
            Готовы забронировать?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Оставьте заявку и наш администратор свяжется с вами для подтверждения бронирования
          </p>
          <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-gold">
            <Link to="/booking">
              {t('hero.cta')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 font-display text-xl font-semibold">
              <span>YesRoom</span>
            </div>
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
