import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ImageUpload } from './ImageUpload';
import { Loader2 } from 'lucide-react';

interface HotelData {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  logo_url: string | null;
}

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
  });

  useEffect(() => {
    if (hotelId) fetchHotel();
  }, [hotelId]);

  const fetchHotel = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hotels')
      .select('id, name, description, location, logo_url')
      .eq('id', hotelId)
      .single();

    if (error) {
      toast.error(t('common.error'));
    } else if (data) {
      setHotel(data);
      setForm({
        name: data.name || '',
        description: data.description || '',
        location: data.location || '',
        logo_url: data.logo_url,
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
    const { error } = await supabase
      .from('hotels')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        logo_url: form.logo_url,
      })
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

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
