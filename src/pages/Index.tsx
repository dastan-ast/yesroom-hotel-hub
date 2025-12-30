import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { 
  ArrowRight, 
  Building2, 
  CalendarDays, 
  BarChart3, 
  Users, 
  Shield, 
  Zap,
  Check,
  Star
} from 'lucide-react';

const Index = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: CalendarDays,
      title: 'Умное бронирование',
      description: 'Автоматизируйте приём заявок с сайта, Booking.com и других каналов'
    },
    {
      icon: Building2,
      title: 'Управление номерами',
      description: 'Визуальная карта номеров с отслеживанием статусов в реальном времени'
    },
    {
      icon: Users,
      title: 'База клиентов',
      description: 'Храните историю бронирований и предпочтения каждого гостя'
    },
    {
      icon: BarChart3,
      title: 'Аналитика',
      description: 'Отслеживайте загрузку, доход и эффективность работы'
    },
    {
      icon: Shield,
      title: 'Безопасность',
      description: 'Надёжное хранение данных с разграничением доступа'
    },
    {
      icon: Zap,
      title: 'AI-ready',
      description: 'Готовы к интеграции с искусственным интеллектом'
    }
  ];

  const pricingPlans = [
    {
      name: 'Стартовый',
      price: '9 900',
      period: 'месяц',
      description: 'Для небольших отелей до 20 номеров',
      features: [
        'До 20 номеров',
        'Неограниченные бронирования',
        'Базовая аналитика',
        'Email-поддержка'
      ],
      popular: false
    },
    {
      name: 'Бизнес',
      price: '19 900',
      period: 'месяц',
      description: 'Для растущих отелей до 50 номеров',
      features: [
        'До 50 номеров',
        'Всё из Стартового',
        'Расширенная аналитика',
        'Интеграция с Booking.com',
        'Приоритетная поддержка'
      ],
      popular: true
    },
    {
      name: 'Премиум',
      price: '39 900',
      period: 'месяц',
      description: 'Для крупных отелей без ограничений',
      features: [
        'Неограниченно номеров',
        'Всё из Бизнес',
        'White-label решение',
        'API доступ',
        'Персональный менеджер'
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)'
          }} />
        </div>
        <div className="relative container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center animate-slide-up">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Star className="h-4 w-4 text-accent" />
              <span className="text-sm">14 дней бесплатно</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 leading-tight">
              Умное управление отелем
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              YesRoom — облачная система для современных отелей. Бронирования, номера, гости — всё в одном месте
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-gold">
                <Link to="/auth">
                  Начать бесплатно
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <a href="#pricing">
                  Тарифы
                </a>
              </Button>
            </div>
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
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Всё для эффективной работы
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Инструменты, которые экономят время и повышают качество обслуживания
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="card-hover border-0 shadow-card animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Простые и понятные тарифы
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Выберите план, который подходит вашему отелю. Первые 14 дней бесплатно.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index}
                className={`relative ${plan.popular ? 'border-2 border-primary shadow-xl' : 'border shadow-card'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Популярный
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="font-display text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">₸{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    asChild 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    <Link to="/auth">Начать бесплатно</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
            Готовы начать?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Зарегистрируйте ваш отель и получите 14 дней бесплатного доступа ко всем функциям
          </p>
          <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-gold">
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
                Облачная система управления отелем
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Продукт</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><a href="#" className="hover:opacity-100">Возможности</a></li>
                <li><a href="#pricing" className="hover:opacity-100">Тарифы</a></li>
                <li><a href="#" className="hover:opacity-100">Интеграции</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Компания</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><a href="#" className="hover:opacity-100">О нас</a></li>
                <li><a href="#" className="hover:opacity-100">Контакты</a></li>
                <li><a href="#" className="hover:opacity-100">Блог</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Поддержка</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><a href="#" className="hover:opacity-100">Документация</a></li>
                <li><a href="#" className="hover:opacity-100">FAQ</a></li>
                <li><a href="#" className="hover:opacity-100">Обратная связь</a></li>
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
