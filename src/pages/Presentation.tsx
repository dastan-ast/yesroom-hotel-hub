import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';
import {
  ArrowLeft, ArrowDown, ChevronRight,
  CalendarRange, Globe, Users, BarChart3, ShoppingCart, Plug,
  XCircle, CheckCircle2, Shield, Cloud, Clock, Server,
  Lock, Database, RefreshCw, MapPin,
  UserPlus, Settings, CalendarCheck
} from 'lucide-react';

const SLIDE_COUNT = 5;

function useInView() {
  const [visibleSet, setVisibleSet] = useState<Set<string>>(new Set());
  const observe = useCallback((el: HTMLElement | null, id: string) => {
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleSet(prev => new Set(prev).add(id));
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
  }, []);
  return { visibleSet, observe };
}

export default function Presentation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const { visibleSet, observe } = useInView();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      setActiveSlide(Math.min(index, SLIDE_COUNT - 1));
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (i: number) => {
    containerRef.current?.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* Back button */}
      <Link
        to="/"
        className="fixed top-6 left-6 z-50 flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full glass hover:bg-background/90 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Назад
      </Link>

      {/* Nav dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              activeSlide === i
                ? 'bg-accent scale-125 shadow-lg'
                : 'bg-foreground/20 hover:bg-foreground/40'
            }`}
            aria-label={`Слайд ${i + 1}`}
          />
        ))}
      </div>

      {/* Slides container */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* === SLIDE 1: Hero === */}
        <section
          className="min-h-screen flex items-center justify-center gradient-hero text-primary-foreground relative"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            ref={el => observe(el, 's1')}
            className={`text-center max-w-3xl px-6 transition-all duration-700 ${visibleSet.has('s1') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <img src={logo} alt="YesRoom" className="h-20 w-20 mx-auto mb-8" />
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
              Современная система управления отелем
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-10">
              Прямые бронирования. Удобное управление. Без комиссий.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gradient-gold text-accent-foreground font-semibold text-base px-8" asChild>
                <Link to="/auth">Начать бесплатно</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" onClick={() => scrollTo(1)}>
                Узнать больше <ArrowDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
          <button onClick={() => scrollTo(1)} className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-primary-foreground/60">
            <ArrowDown className="h-6 w-6" />
          </button>
        </section>

        {/* === SLIDE 2: Problem / Solution === */}
        <section
          className="min-h-screen flex items-center bg-background"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            ref={el => observe(el, 's2')}
            className={`container mx-auto px-6 py-16 transition-all duration-700 ${visibleSet.has('s2') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-16">
              Почему <span className="text-accent">YesRoom</span>?
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Without */}
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-destructive">
                  <XCircle className="h-6 w-6" /> Без YesRoom
                </h3>
                <ul className="space-y-4">
                  {[
                    'Ручной учёт в тетрадях и Excel',
                    'Комиссии OTA до 20% от каждого бронирования',
                    'Хаос в бронированиях и двойные заселения',
                    'Потеря данных о гостях и истории визитов',
                    'Нет аналитики и понимания загрузки',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-muted-foreground">
                      <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              {/* With */}
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-8">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-accent">
                  <CheckCircle2 className="h-6 w-6" /> С YesRoom
                </h3>
                <ul className="space-y-4">
                  {[
                    'Полная автоматизация всех процессов',
                    'Прямые бронирования без комиссий',
                    'Шахматка — визуальный контроль загрузки',
                    'CRM: история гостей и персонализация',
                    'Аналитика и отчёты в реальном времени',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* === SLIDE 3: Features === */}
        <section
          className="min-h-screen flex items-center bg-muted"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            ref={el => observe(el, 's3')}
            className={`container mx-auto px-6 py-16 transition-all duration-700 ${visibleSet.has('s3') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-4">
              Возможности системы
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Всё необходимое для эффективного управления отелем в одном месте
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: CalendarRange, title: 'Шахматка', desc: 'Визуальный календарь загрузки номеров с drag-and-drop управлением' },
                { icon: Globe, title: 'Онлайн-бронирование', desc: 'Персональная страница отеля с формой бронирования для гостей' },
                { icon: Users, title: 'CRM клиентов', desc: 'Полная история гостей, контакты и персонализированный сервис' },
                { icon: BarChart3, title: 'Аналитика', desc: 'Графики загрузки, доходов и эффективности в реальном времени' },
                { icon: ShoppingCart, title: 'Услуги', desc: 'Каталог допуслуг, автоматические счета и учёт допродаж' },
                { icon: Plug, title: 'Интеграции', desc: 'API для внешних систем, Telegram и WhatsApp уведомления' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-card border p-6 card-hover"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="h-12 w-12 rounded-xl gradient-gold flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* === SLIDE 4: Reliability === */}
        <section
          className="min-h-screen flex items-center gradient-hero text-primary-foreground"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            ref={el => observe(el, 's4')}
            className={`container mx-auto px-6 py-16 transition-all duration-700 ${visibleSet.has('s4') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-4">
              Надёжность и безопасность
            </h2>
            <p className="text-center opacity-80 mb-14 max-w-2xl mx-auto">
              Ваши данные под надёжной защитой — мы используем банковский уровень безопасности
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-14">
              {[
                { icon: Server, value: '99.9%', label: 'Uptime' },
                { icon: Lock, value: 'SSL', label: 'Шифрование' },
                { icon: Database, value: '24/7', label: 'Бэкапы' },
                { icon: Cloud, value: 'Cloud', label: 'Инфраструктура' },
              ].map(({ icon: Icon, value, label }, i) => (
                <div key={i} className="text-center p-6 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10">
                  <Icon className="h-8 w-8 mx-auto mb-3 text-accent" />
                  <div className="text-3xl md:text-4xl font-display font-bold mb-1">{value}</div>
                  <div className="text-sm opacity-70">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { icon: MapPin, label: 'Казахстан' },
                { icon: Shield, label: 'RLS защита данных' },
                { icon: Clock, label: '24/7 доступ' },
                { icon: RefreshCw, label: 'Авто-обновления' },
              ].map(({ icon: Icon, label }, i) => (
                <span key={i} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-sm">
                  <Icon className="h-4 w-4 text-accent" /> {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* === SLIDE 5: CTA === */}
        <section
          className="min-h-screen flex items-center bg-background"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            ref={el => observe(el, 's5')}
            className={`container mx-auto px-6 py-16 transition-all duration-700 ${visibleSet.has('s5') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-14">
              Начните управлять отелем <span className="text-accent">эффективно</span>
            </h2>

            {/* 3 steps */}
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16">
              {[
                { icon: UserPlus, step: '01', title: 'Регистрация', desc: 'Создайте аккаунт за 30 секунд — бесплатно' },
                { icon: Settings, step: '02', title: 'Настройка', desc: 'Добавьте номера, тарифы и настройте страницу отеля' },
                { icon: CalendarCheck, step: '03', title: 'Приём гостей', desc: 'Получайте бронирования и управляйте отелем онлайн' },
              ].map(({ icon: Icon, step, title, desc }, i) => (
                <div key={i} className="text-center relative">
                  <div className="h-16 w-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-8 w-8 text-accent-foreground" />
                  </div>
                  <div className="text-xs font-bold text-accent mb-1">{step}</div>
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                  {i < 2 && (
                    <ChevronRight className="hidden md:block absolute top-8 -right-6 h-6 w-6 text-accent" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="gradient-gold text-accent-foreground font-semibold text-base px-8" asChild>
                <Link to="/auth">Зарегистрироваться бесплатно</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/contacts">Связаться с нами</Link>
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} YesRoom — Современная система управления отелем
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
