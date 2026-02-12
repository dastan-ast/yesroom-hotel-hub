import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';

interface ServiceCatalogItem {
  id: string;
  name: string;
  default_price: number;
  is_active: boolean;
}

interface BookingService {
  id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  created_at: string;
}

interface Props {
  hotelId: string;
  bookingId: string;
  onTotalChange?: (total: number) => void;
}

export function BookingServicesTab({ hotelId, bookingId, onTotalChange }: Props) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Form state for adding new service
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');

  const total = useMemo(() => {
    return services.reduce((sum, s) => sum + s.total_price, 0);
  }, [services]);

  useEffect(() => {
    if (hotelId && bookingId) {
      fetchData();
    }
  }, [hotelId, bookingId]);

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const fetchData = async () => {
    setLoading(true);

    const [catalogRes, servicesRes] = await Promise.all([
      supabase
        .from('service_catalog')
        .select('id, name, default_price, is_active')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('booking_services')
        .select('id, service_name, unit_price, quantity, total_price, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false }),
    ]);

    if (catalogRes.data) setCatalog(catalogRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    setLoading(false);
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const service = catalog.find((s) => s.id === serviceId);
    if (service) {
      setPrice(service.default_price.toString());
    }
  };

  const handleAddService = async () => {
    if (!selectedServiceId) {
      toast.error('Выберите услугу');
      return;
    }

    const priceNum = parseFloat(price);
    const quantityNum = parseInt(quantity);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Введите корректную цену');
      return;
    }

    if (isNaN(quantityNum) || quantityNum < 1) {
      toast.error('Укажите количество');
      return;
    }

    const service = catalog.find((s) => s.id === selectedServiceId);
    if (!service) return;

    setAdding(true);

    const { error } = await supabase.from('booking_services').insert({
      hotel_id: hotelId,
      booking_id: bookingId,
      service_id: selectedServiceId,
      service_name: service.name,
      unit_price: priceNum,
      quantity: quantityNum,
    });

    if (error) {
      toast.error(t('common.error'));
      console.error('Error adding service:', error);
    } else {
      toast.success('Услуга добавлена');
      logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'service_added', entityType: 'service', entityId: bookingId, details: { service_name: service.name, amount: priceNum * quantityNum } });
      setSelectedServiceId('');
      setPrice('');
      setQuantity('1');
      fetchData();
    }

    setAdding(false);
  };

  const handleRemoveService = async (id: string) => {
    const svc = services.find(s => s.id === id);
    const { error } = await supabase.from('booking_services').delete().eq('id', id);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Услуга удалена');
      logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'service_removed', entityType: 'service', entityId: bookingId, details: { service_name: svc?.service_name } });
      fetchData();
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-muted-foreground text-sm">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Service Form */}
      <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
        <Label className="text-sm font-medium">Добавить услугу</Label>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px]">
            <Select value={selectedServiceId} onValueChange={handleServiceSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите услугу" />
              </SelectTrigger>
              <SelectContent>
                {catalog.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Нет услуг в справочнике
                  </div>
                ) : (
                  catalog.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} — {item.default_price.toLocaleString()} ₸
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="w-28">
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Цена"
              min="0"
              step="100"
            />
          </div>

          <div className="w-20">
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Кол-во"
              min="1"
            />
          </div>

          <Button onClick={handleAddService} disabled={adding || !selectedServiceId} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Services List */}
      {services.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground border rounded-lg">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Нет добавленных услуг</p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex-1">
                <p className="font-medium">{service.service_name}</p>
                <p className="text-sm text-muted-foreground">
                  {service.unit_price.toLocaleString()} ₸ × {service.quantity}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{service.total_price.toLocaleString()} ₸</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveService(service.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {services.length > 0 && (
        <div className="flex justify-between items-center p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="font-medium">Итого услуг:</span>
          <span className="text-lg font-bold">{total.toLocaleString()} ₸</span>
        </div>
      )}
    </div>
  );
}
