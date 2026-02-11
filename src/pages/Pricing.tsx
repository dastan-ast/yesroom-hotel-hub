import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, MessageCircle, Building2, Users, TrendingUp, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PricingPlan {
  name: string;
  price: number;
  period: string;
  features: string[];
  highlighted: boolean;
}

export default function Pricing() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'pricing_plans')
        .maybeSingle();

      if (data?.value && Array.isArray(data.value)) {
        setPlans(data.value as unknown as PricingPlan[]);
      }
      setLoading(false);
    };
    fetchPlans();
  }, []);

  const benefits = [
    { icon: Building2, title: 'Прямые бронирования', description: 'Получайте бронирования напрямую от гостей без посредников' },
    { icon: Users, title: 'Управление номерами', description: 'Удобная шахматка для контроля загрузки отеля' },
    { icon: TrendingUp, title: 'Аналитика', description: 'Отслеживайте статистику бронирований и доходов' },
    { icon: Shield, title: 'Безопасность', description: 'Защищённое хранение данных гостей и платежей' },
  ];

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('ru-RU').format(price);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">Тарифы для отелей</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Выберите подходящий тарифный план для вашего отеля
            </p>
          </div>

          {/* Pricing Plans */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {plans.map((plan, i) => (
                <Card
                  key={i}
                  className={plan.highlighted ? 'border-primary shadow-lg relative' : ''}
                >
                  {plan.highlighted && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Популярный</Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="pt-2">
                      <span className="text-3xl font-bold">{formatPrice(plan.price)} ₸</span>
                      <span className="text-muted-foreground ml-1">/ {plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                      asChild
                    >
                      <Link to="/contacts">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Связаться для оплаты
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Fallback CTA if no plans configured */
            <Card className="mb-12 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Индивидуальный тариф</CardTitle>
                <CardDescription className="text-base">
                  Свяжитесь с нами для обсуждения условий сотрудничества
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button size="lg" asChild>
                  <Link to="/contacts">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Связаться для уточнения
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Free trial CTA */}
          <div className="text-center mb-12">
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">
                Начать бесплатно
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Benefits */}
          <div className="mb-12">
            <h2 className="text-2xl font-display font-bold text-center mb-8">Преимущества платформы</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {benefits.map((b, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <b.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{b.title}</h3>
                        <p className="text-sm text-muted-foreground">{b.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Presentation CTA */}
          <Card className="mb-12 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6 text-center space-y-4">
              <h2 className="text-2xl font-display font-bold">Узнайте больше о YesRoom</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Посмотрите презентацию платформы — возможности, надёжность и как начать работу
              </p>
              <Button size="lg" asChild>
                <Link to="/presentation">
                  Смотреть презентацию
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-muted-foreground mb-4">Остались вопросы?</p>
            <Button variant="outline" asChild>
              <Link to="/help">
                Перейти в раздел помощи
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
