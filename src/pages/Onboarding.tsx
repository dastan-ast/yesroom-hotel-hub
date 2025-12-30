import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Building2, MapPin, Hash } from 'lucide-react';

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    roomCount: ''
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const slug = generateSlug(formData.name) + '-' + Date.now().toString(36);

      // Create hotel
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .insert([{
          name: formData.name,
          slug,
          location: formData.location,
          description: formData.description,
          owner_id: user.id,
          settings: { room_count: parseInt(formData.roomCount) || 0 }
        }] as any)
        .select()
        .single();

      if (hotelError) throw hotelError;

      // Update user profile with hotel_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ hotel_id: hotel.id })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Update user role to owner
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: 'owner' })
        .eq('user_id', user.id);

      if (roleError) throw roleError;

      await refreshProfile();

      toast({
        title: 'Отель создан!',
        description: 'Ваша заявка отправлена на рассмотрение.'
      });

      navigate('/pending-approval');
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Создайте ваш отель</CardTitle>
          <CardDescription>
            Заполните информацию о вашем отеле, чтобы начать работу с YesRoom
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название отеля *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Гранд Отель"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Адрес</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="г. Алматы, ул. Примерная, 123"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomCount">Количество номеров</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="roomCount"
                  type="number"
                  placeholder="20"
                  value={formData.roomCount}
                  onChange={(e) => setFormData({ ...formData, roomCount: e.target.value })}
                  className="pl-10"
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                placeholder="Краткое описание вашего отеля..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !formData.name}>
              {loading ? 'Создание...' : 'Создать отель'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
