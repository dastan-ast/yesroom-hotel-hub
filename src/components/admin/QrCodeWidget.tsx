import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, QrCode, Instagram, Globe, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface QrCodeWidgetProps {
  hotelSlug: string;
  hotelName: string;
}

export function QrCodeWidget({ hotelSlug, hotelName }: QrCodeWidgetProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  const baseUrl = window.location.origin;
  const bookingUrl = `${baseUrl}/hotels/${hotelSlug}`;
  const instagramUrl = `${baseUrl}/i/${hotelSlug}`;

  const handleCopy = (url: string, type: string) => {
    navigator.clipboard.writeText(url);
    setCopied(type);
    toast.success('Ссылка скопирована');
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadQR = (elementId: string, filename: string) => {
    const svgElement = document.getElementById(elementId);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 1024;
      canvas.height = 1024;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.drawImage(img, 0, 0, 1024, 1024);
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR-коды и ссылки
        </CardTitle>
        <CardDescription>
          Скачайте QR-коды для размещения в соцсетях и печатных материалах
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Booking Page */}
        <div className="flex flex-col sm:flex-row gap-4 items-start p-4 rounded-lg border bg-muted/30">
          <div className="shrink-0">
            <QRCodeSVG
              id="qr-booking"
              value={bookingUrl}
              size={120}
              level="H"
              includeMargin
            />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Страница бронирования</span>
            </div>
            <div className="flex items-center gap-2">
              <Input value={bookingUrl} readOnly className="text-xs h-8" />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleCopy(bookingUrl, 'booking')}
              >
                {copied === 'booking' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadQR('qr-booking', `qr-${hotelSlug}-booking`)}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Скачать QR
            </Button>
          </div>
        </div>

        {/* Instagram Page */}
        <div className="flex flex-col sm:flex-row gap-4 items-start p-4 rounded-lg border bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <div className="shrink-0">
            <QRCodeSVG
              id="qr-instagram"
              value={instagramUrl}
              size={120}
              level="H"
              includeMargin
              fgColor="#833AB4"
            />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">Instagram лендинг</span>
              <Badge variant="secondary" className="text-[10px]">Быстрая форма</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Мобильная мини-страница для Instagram bio. Только телефон обязателен — максимум конверсий.
            </p>
            <div className="flex items-center gap-2">
              <Input value={instagramUrl} readOnly className="text-xs h-8" />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleCopy(instagramUrl, 'instagram')}
              >
                {copied === 'instagram' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadQR('qr-instagram', `qr-${hotelSlug}-instagram`)}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Скачать QR
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
