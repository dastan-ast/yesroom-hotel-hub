import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ImageUpload } from './ImageUpload';
import { QrCodeWidget } from './QrCodeWidget';
import { PROPERTY_TYPES } from '@/lib/propertyTypes';
import { Loader2, CreditCard, MessageCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HotelSettings {
  kaspi_id?: string;
  whatsapp_phone?: string;
  [key: string]: string | undefined;
}

interface HotelData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  logo_url: string | null;
  property_type: string;
  settings: HotelSettings | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export function HotelSettingsTab({ hotelId }: { hotelId: string }) {
  const { t } = useTranslation();
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: '',
    logo_url: '' as string | null,
    property_type: 'hotel',
    kaspi_id: '',
    whatsapp_phone: '',
  });

  useEffect(() => {
    if (hotelId) fetchHotel();
  }, [hotelId]);

  const fetchHotel = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hotels')
      .select('id, name, slug, description, location, logo_url, settings, property_type')
      .eq('id', hotelId)
      .single();

    if (error) {
      toast.error(t('common.error'));
    } else if (data) {
      const hotelData: HotelData = {
        ...data,
        property_type: (data as any).property_type || 'hotel',
        settings: data.settings as HotelSettings | null,
      };
      setHotel(hotelData);
      const settings = (hotelData.settings || {}) as HotelSettings;
      setForm({
        name: hotelData.name || '',
        description: hotelData.description || '',
        location: hotelData.location || '',
        logo_url: hotelData.logo_url,
        property_type: hotelData.property_type || 'hotel',
        kaspi_id: settings.kaspi_id || '',
        whatsapp_phone: settings.whatsapp_phone || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Название отеля обязательно');
      return;
    }

    setSaving(true);
    
    // Build settings object
    const settings: HotelSettings = {};
    if (form.kaspi_id.trim()) settings.kaspi_id = form.kaspi_id.trim();
    if (form.whatsapp_phone.trim()) settings.whatsapp_phone = form.whatsapp_phone.trim();

    const { error } = await supabase
      .from('hotels')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        logo_url: form.logo_url,
        property_type: form.property_type,
        settings: Object.keys(settings).length > 0 ? settings : null,
      } as any)
      .eq('id', hotelId);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('common.success'));
      fetchHotel();
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Настройки отеля</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Фото отеля</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload
              currentUrl={form.logo_url}
              onUpload={(url) => setForm({ ...form, logo_url: url })}
              onRemove={() => setForm({ ...form, logo_url: null })}
              folder="hotels"
              itemId={hotelId}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Название отеля"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Адрес</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Город, улица, дом"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Краткое описание отеля"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Настройки оплаты
            </CardTitle>
            <CardDescription>
              Настройте Kaspi оплату для получения предоплаты от гостей
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kaspi_id" className="flex items-center gap-2">
                  <span className="text-[#F14635] font-semibold">Kaspi</span> ID / Телефон
                </Label>
                <Input
                  id="kaspi_id"
                  value={form.kaspi_id}
                  onChange={(e) => setForm({ ...form, kaspi_id: e.target.value })}
                  placeholder="77771234567"
                />
                <p className="text-xs text-muted-foreground">
                  Номер телефона или ID для Kaspi.kz (без +). Используется для кнопки "Оплатить через Kaspi"
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_phone" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  WhatsApp номер
                </Label>
                <Input
                  id="whatsapp_phone"
                  value={form.whatsapp_phone}
                  onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })}
                  placeholder="77771234567"
                />
                <p className="text-xs text-muted-foreground">
                  Номер для связи по WhatsApp (без +). Гости смогут отправить скриншот оплаты
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Сохранить
      </Button>

      {hotel && <QrCodeWidget hotelSlug={hotel.slug} hotelName={hotel.name} />}
    </div>
  );
}
