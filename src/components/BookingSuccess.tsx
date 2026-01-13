import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CreditCard, MessageCircle, ExternalLink } from 'lucide-react';

interface HotelSettings {
  kaspi_id?: string;
  whatsapp_phone?: string;
}

interface BookingSuccessProps {
  hotelSettings?: HotelSettings | null;
  hotelName?: string;
  totalPrice?: number | null;
}

export function BookingSuccess({ hotelSettings, hotelName, totalPrice }: BookingSuccessProps) {
  const { t } = useTranslation();
  
  const kaspiId = hotelSettings?.kaspi_id;
  const whatsappPhone = hotelSettings?.whatsapp_phone;
  
  const kaspiPayUrl = kaspiId ? `https://kaspi.kz/pay/${kaspiId}` : null;
  
  const whatsappMessage = encodeURIComponent(
    `Здравствуйте! Я забронировал номер в ${hotelName || 'вашем отеле'}${totalPrice ? ` на сумму ${totalPrice.toLocaleString()} ₸` : ''}. Отправляю скриншот оплаты.`
  );
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${whatsappMessage}` : null;

  return (
    <div className="text-center py-6 space-y-6">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      
      <div>
        <h3 className="font-semibold text-lg mb-2">{t('booking.success')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('booking.successMessage')}
        </p>
      </div>

      {/* Kaspi Payment Section */}
      {kaspiId && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4" />
              Оплата через Kaspi
            </div>
            
            <Button 
              asChild 
              className="w-full bg-[#F14635] hover:bg-[#d13d2f] text-white"
            >
              <a 
                href={kaspiPayUrl!} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <span className="font-bold">Kaspi</span>
                Оплатить
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            
            <p className="text-xs text-muted-foreground">
              После оплаты, пожалуйста, отправьте скриншот платежа в WhatsApp
            </p>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Screenshot Section */}
      {whatsappPhone && (
        <Button 
          asChild 
          variant="outline"
          className="w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
        >
          <a 
            href={whatsappUrl!} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Отправить скриншот в WhatsApp
          </a>
        </Button>
      )}

      {/* Instructions if both are available */}
      {kaspiId && whatsappPhone && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p className="font-medium mb-1">Как оплатить:</p>
          <ol className="text-left space-y-1">
            <li>1. Нажмите "Оплатить" и совершите платёж через Kaspi</li>
            <li>2. Сделайте скриншот подтверждения платежа</li>
            <li>3. Отправьте скриншот нам в WhatsApp</li>
          </ol>
        </div>
      )}
    </div>
  );
}
