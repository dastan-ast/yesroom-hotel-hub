import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, HelpCircle, Building2, Users } from 'lucide-react';

export default function Help() {
  const guestFaqs = [
    {
      question: 'Как забронировать номер?',
      answer: 'Выберите отель из списка на главной странице, укажите даты заезда и выезда, количество гостей, затем выберите подходящий номер и заполните форму бронирования. После отправки заявки отель свяжется с вами для подтверждения.'
    },
    {
      question: 'Как отменить бронирование?',
      answer: 'Для отмены бронирования свяжитесь напрямую с отелем по телефону или email, указанным в подтверждении бронирования. Условия отмены зависят от политики конкретного отеля.'
    },
    {
      question: 'Нужна ли предоплата?',
      answer: 'Условия предоплаты устанавливаются каждым отелем индивидуально. Информация о необходимости предоплаты будет указана при бронировании.'
    },
    {
      question: 'Как связаться с отелем?',
      answer: 'Контактные данные отеля указаны на странице отеля и в подтверждении бронирования. Вы также можете связаться через форму на нашем сайте.'
    }
  ];

  const hotelFaqs = [
    {
      question: 'Как зарегистрировать отель на платформе?',
      answer: 'Нажмите "Зарегистрировать отель" на главной странице, создайте аккаунт и заполните информацию об отеле. После проверки модератором ваш отель появится на платформе.'
    },
    {
      question: 'Какие преимущества платформы YesRoom?',
      answer: 'YesRoom позволяет получать прямые бронирования без комиссий посредников, управлять номерным фондом через удобную шахматку, вести базу гостей и отслеживать аналитику бронирований.'
    },
    {
      question: 'Сколько стоит использование платформы?',
      answer: 'Мы предлагаем индивидуальные условия для каждого отеля. Свяжитесь с нами для обсуждения тарифа. Доступен бесплатный пробный период.'
    },
    {
      question: 'Как настроить типы номеров и цены?',
      answer: 'В панели администратора перейдите в раздел "Типы номеров", где вы можете добавить категории номеров, указать вместимость, цены и удобства для каждого типа.'
    },
    {
      question: 'Как работает шахматка бронирований?',
      answer: 'Шахматка показывает визуальный календарь занятости всех номеров. Вы можете видеть текущие бронирования, добавлять новые и управлять статусами номеров.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Помощь и FAQ
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Ответы на часто задаваемые вопросы
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Guest FAQ */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Для гостей</CardTitle>
                    <CardDescription>Вопросы о бронировании</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {guestFaqs.map((faq, index) => (
                    <AccordionItem key={index} value={`guest-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Hotel FAQ */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Для отелей</CardTitle>
                    <CardDescription>Вопросы о платформе</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {hotelFaqs.map((faq, index) => (
                    <AccordionItem key={index} value={`hotel-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* Contact CTA */}
          <Card className="border-primary/20 bg-muted/50">
            <CardContent className="py-8 text-center">
              <MessageCircle className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Не нашли ответ на свой вопрос?
              </h3>
              <p className="text-muted-foreground mb-6">
                Свяжитесь с нами и мы поможем вам
              </p>
              <Button asChild>
                <Link to="/contacts">
                  Связаться с поддержкой
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
