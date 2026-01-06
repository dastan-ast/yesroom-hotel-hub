import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ArrowRight, MessageCircle, Building2, Users, TrendingUp, Shield } from 'lucide-react';

export default function Pricing() {
  const benefits = [
    {
      icon: Building2,
      title: 'Прямые бронирования',
      description: 'Получайте бронирования напрямую от гостей без посредников'
    },
    {
      icon: Users,
      title: 'Управление номерами',
      description: 'Удобная шахматка для контроля загрузки отеля'
    },
    {
      icon: TrendingUp,
      title: 'Аналитика',
      description: 'Отслеживайте статистику бронирований и доходов'
    },
    {
      icon: Shield,
      title: 'Безопасность',
      description: 'Защищённое хранение данных гостей и платежей'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Тарифы для отелей
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Мы подбираем индивидуальные условия для каждого отеля
            </p>
          </div>

          {/* Main CTA Card */}
          <Card className="mb-12 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Индивидуальный тариф</CardTitle>
              <CardDescription className="text-base">
                Свяжитесь с нами для обсуждения условий сотрудничества
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <ul className="space-y-3 text-left max-w-md mx-auto">
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Бесплатный пробный период</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Гибкие условия оплаты</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Индивидуальная настройка под ваш отель</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Техническая поддержка 24/7</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Обучение персонала</span>
                </li>
              </ul>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" asChild>
                  <Link to="/contacts">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Связаться для уточнения
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/auth">
                    Начать бесплатно
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Benefits Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              Преимущества платформы
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <benefit.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{benefit.title}</h3>
                        <p className="text-sm text-muted-foreground">{benefit.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Остались вопросы?
            </p>
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
