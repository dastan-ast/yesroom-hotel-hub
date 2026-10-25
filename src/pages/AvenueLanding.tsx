import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BookingModal } from '@/components/BookingModal';
import { ArrowRight, Coffee, Droplets, MapPin, MessageCircle, Trees, Tv, Users, Wifi } from 'lucide-react';
import heroImg from '@/assets/avenue-hero.jpg';

const HOTEL_SLUG = 'atyrau-mjssiu4y';
const WHATSAPP = '77784245935';
const PHONE_DISPLAY = '+7 (778) 424-59-35';
const waLink = (text: string) =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

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

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n);

export default function AvenueLanding() {
  const [hotel, setHotel] = useState<{ id: string; name: string } | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [open, setOpen] = useState(false);
  const [pre, setPre] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Atyrau Avenue — отель в сосновом лесу Борового';
    (async () => {
      const { data: h } = await supabase
        .from('hotels_public')
        .select('id, name')
        .eq('slug', HOTEL_SLUG)
        .maybeSingle();
      if (!h) return;
      setHotel(h as any);
      const { data: rt } = await supabase.from('room_types').select('*').eq('hotel_id', (h as any).id);
      setRooms(((rt as RoomType[]) || []).sort((a, b) => a.price_per_night - b.price_per_night));
    })();
  }, []);

  const minPrice = useMemo(
    () => (rooms.length ? Math.min(...rooms.map((r) => Number(r.price_per_night))) : null),
    [rooms]
  );
  const featured = rooms.find((r) => r.image_url) || rooms[0];
  const book = (id: string | null = null) => {
    setPre(id);
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-primary text-primary-foreground">
      {/* Header */}
      <header className="container mx-auto px-4 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <Trees className="h-7 w-7 text-accent" />
          <div className="leading-tight">
            <p className="font-display text-lg tracking-wide">ATYRAU AVENUE</p>
            <p className="text-[10px] tracking-[0.3em] text-accent">БОРОВОЕ · БУРАБАЙ</p>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-primary-foreground/70">
          <a href="#rooms" className="hover:text-accent transition-colors">Номера</a>
          <a href="#about" className="hover:text-accent transition-colors">Об отеле</a>
          <a href="#contacts" className="hover:text-accent transition-colors">Контакты</a>
        </nav>
        <a href={`tel:+${WHATSAPP}`} className="hidden sm:block text-sm text-accent">{PHONE_DISPLAY}</a>
      </header>

      {/* Bento hero */}
      <main className="container mx-auto px-4 pb-24 md:pb-12">
        <section className="grid gap-4 md:grid-cols-5 md:grid-rows-[auto_auto_auto]">
          {/* Main tile */}
          <div className="relative overflow-hidden rounded-3xl md:col-span-3 md:row-span-3 min-h-[460px] md:min-h-[620px]">
            <img src={heroImg} alt="Озеро и сосновый лес Борового" width={1280} height={1280}
              className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
            <div className="relative h-full flex flex-col justify-end p-6 md:p-10">
              <p className="text-xs tracking-[0.3em] text-accent mb-4">ОТЕЛЬ В СОСНОВОМ ЛЕСУ</p>
              <h1 className="font-display text-4xl md:text-6xl leading-[1.05] mb-4">
                Тишина леса,<br />воздух Борового
              </h1>
              <p className="text-primary-foreground/80 max-w-md mb-6">
                Уютные номера и капсулы среди сосен. Завтрак включён, артезианская вода, Wi‑Fi и Smart TV.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => book()}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground hover:opacity-90 transition">
                  Забронировать <ArrowRight className="h-4 w-4" />
                </button>
                <a href="#rooms" className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 hover:border-accent hover:text-accent transition">
                  Смотреть номера
                </a>
              </div>
            </div>
          </div>

          {/* Featured room */}
          {featured && (
            <button onClick={() => book(featured.id)}
              className="group relative overflow-hidden rounded-3xl md:col-span-2 min-h-[240px] text-left">
              {featured.image_url && (
                <img src={featured.image_url} alt={featured.name} loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/95 to-primary/10" />
              <div className="relative h-full flex flex-col justify-between p-6">
                <p className="text-xs tracking-[0.2em] text-accent">НОМЕРА</p>
                <div>
                  <p className="font-display text-2xl mb-1">{featured.name}</p>
                  {minPrice && <p className="text-primary-foreground/80">от <span className="text-3xl font-semibold text-primary-foreground">{fmt(minPrice)} ₸</span> / ночь</p>}
                </div>
              </div>
            </button>
          )}

          {/* Two small tiles */}
          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            <div className="rounded-3xl bg-primary-foreground/5 border border-primary-foreground/10 p-5">
              <Coffee className="h-6 w-6 text-accent mb-3" />
              <p className="font-medium">Завтрак включён</p>
              <p className="text-sm text-primary-foreground/60 mt-1">Во всех номерах</p>
            </div>
            <div className="rounded-3xl bg-primary-foreground/5 border border-primary-foreground/10 p-5">
              <Droplets className="h-6 w-6 text-accent mb-3" />
              <p className="font-medium">Артезианская вода</p>
              <p className="text-sm text-primary-foreground/60 mt-1">Чистая, из своей скважины</p>
            </div>
          </div>

          {/* WhatsApp CTA */}
          <a href={waLink('Здравствуйте! Хочу забронировать номер в Atyrau Avenue')} target="_blank" rel="noreferrer"
            className="md:col-span-2 flex items-center gap-4 rounded-3xl bg-accent p-5 text-accent-foreground hover:opacity-90 transition">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessageCircle className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Забронировать через WhatsApp</span>
              <span className="block text-sm opacity-80">Ответим быстро, без переплат</span>
            </span>
            <ArrowRight className="h-5 w-5" />
          </a>
        </section>

        {/* Perks strip */}
        <section id="about" className="grid grid-cols-2 md:grid-cols-4 gap-6 py-12 border-b border-primary-foreground/10">
          {[
            { icon: MapPin, t: 'Боровое', d: 'Сосновый лес и озёра рядом' },
            { icon: Trees, t: 'Тишина и природа', d: 'Отдых от городского шума' },
            { icon: Wifi, t: 'Wi‑Fi', d: 'Во всех номерах' },
            { icon: Tv, t: 'Smart TV', d: 'Для вечеров в уюте' },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="flex gap-3">
              <I className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div><p className="font-medium">{t}</p><p className="text-sm text-primary-foreground/60">{d}</p></div>
            </div>
          ))}
        </section>

        {/* Rooms */}
        <section id="rooms" className="py-12">
          <p className="text-xs tracking-[0.3em] text-accent mb-2">ВЫБЕРИТЕ НОМЕР</p>
          <h2 className="font-display text-3xl md:text-4xl mb-8">Номера и капсулы</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rooms.map((r) => (
              <article key={r.id} className="overflow-hidden rounded-3xl bg-primary-foreground/5 border border-primary-foreground/10 flex flex-col">
                <div className="aspect-[4/3] bg-primary-foreground/10">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><Trees className="h-10 w-10 text-accent/60" /></div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-display text-xl mb-2">{r.name}</h3>
                  <p className="text-sm text-primary-foreground/60 flex items-center gap-1 mb-4"><Users className="h-4 w-4" /> до {r.capacity} гостей</p>
                  <p className="mt-auto mb-4">от <span className="text-xl font-semibold">{fmt(Number(r.price_per_night))} ₸</span></p>
                  <button onClick={() => book(r.id)}
                    className="rounded-full bg-accent py-2.5 font-medium text-accent-foreground hover:opacity-90 transition">
                    Забронировать
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Contacts */}
        <section id="contacts" className="rounded-3xl border border-primary-foreground/10 p-6 md:p-10 grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h2 className="font-display text-3xl mb-2">Ждём вас в Боровом</h2>
            <p className="text-primary-foreground/70">Позвоните или напишите — подберём номер на ваши даты.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <a href={`tel:+${WHATSAPP}`} className="rounded-full border border-primary-foreground/30 px-6 py-3 hover:border-accent hover:text-accent transition">{PHONE_DISPLAY}</a>
            <a href={waLink('Здравствуйте! Вопрос по бронированию')} target="_blank" rel="noreferrer" className="rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground">WhatsApp</a>
          </div>
        </section>
        <footer className="py-8 text-center text-xs text-primary-foreground/40">© Atyrau Avenue · Боровое, Казахстан</footer>
      </main>

      {/* Mobile sticky bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 p-3 bg-primary/95 backdrop-blur border-t border-primary-foreground/10 flex gap-2">
        <a href={waLink('Здравствуйте! Хочу забронировать номер')} target="_blank" rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-full border border-accent text-accent py-3">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button onClick={() => book()} className="flex-1 rounded-full bg-accent py-3 font-medium text-accent-foreground">Забронировать</button>
      </div>

      {hotel && (
        <BookingModal open={open} onOpenChange={setOpen} hotelId={hotel.id} hotelName={hotel.name}
          hotelSettings={null} roomTypes={rooms as any} preselectedRoomTypeId={pre} />
      )}
    </div>
  );
}
