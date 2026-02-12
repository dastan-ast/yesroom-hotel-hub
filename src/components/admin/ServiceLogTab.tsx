import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Coffee } from 'lucide-react';

interface BookingService {
  id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  total_price: number | null;
  created_at: string;
  booking_id: string;
  bookings: {
    guest_name: string;
    room_id: string | null;
    rooms: { room_number: string } | null;
  } | null;
}

interface ActiveBooking {
  id: string;
  guest_name: string;
  room_id: string | null;
  rooms: { room_number: string } | null;
}

interface CatalogService {
  id: string;
  name: string;
  default_price: number;
}

interface Props {
  hotelId: string;
}

export function ServiceLogTab({ hotelId }: Props) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [services, setServices] = useState<BookingService[]>([]);
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [customName, setCustomName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hotelId) {
      fetchData();
    }
  }, [hotelId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch booking services (новая таблица)
    const { data: servicesData } = await supabase
      .from('booking_services')
      .select('id, service_name, unit_price, quantity, total_price, created_at, booking_id, bookings(guest_name, room_id, rooms(room_number))')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch active bookings (checked_in)
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, guest_name, room_id, rooms(room_number)')
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_in')
      .order('check_in_date', { ascending: false });

    // Fetch catalog services
    const { data: catalogData } = await supabase
      .from('service_catalog')
      .select('id, name, default_price')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .order('name');

    if (servicesData) setServices(servicesData as unknown as BookingService[]);
    if (bookingsData) setActiveBookings(bookingsData as unknown as ActiveBooking[]);
    if (catalogData) setCatalogServices(catalogData);
    setLoading(false);
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    if (serviceId === 'custom') {
      setCustomName('');
      setPrice('');
    } else {
      const service = catalogServices.find(s => s.id === serviceId);
      if (service) {
        setCustomName(service.name);
        setPrice(service.default_price.toString());
      }
    }
  };

  const handleAddService = async () => {
    if (!selectedBooking || !customName.trim() || !price || !quantity) {
      toast.error('Заполните все поля');
      return;
    }

    setSubmitting(true);
    
    const unitPrice = parseFloat(price);
    const qty = parseInt(quantity);
    
    const { error } = await supabase.from('booking_services').insert({
      hotel_id: hotelId,
      booking_id: selectedBooking,
      service_id: selectedService !== 'custom' ? selectedService : null,
      service_name: customName.trim(),
      unit_price: unitPrice,
      quantity: qty,
    });

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Услуга добавлена');
      logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'service_added', entityType: 'service', entityId: selectedBooking, details: { service_name: customName.trim(), amount: unitPrice * qty } });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSelectedBooking('');
    setSelectedService('');
    setCustomName('');
    setPrice('');
    setQuantity('1');
  };

  const handleDeleteService = async (id: string) => {
    const svc = services.find(s => s.id === id);
    const { error } = await supabase.from('booking_services').delete().eq('id', id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Услуга удалена');
      logAdminAction({ hotelId, userId: user!.id, userName: profile?.full_name || '', action: 'service_removed', entityType: 'service', entityId: id, details: { service_name: svc?.service_name } });
      fetchData();
    }
  };

  // Calculate totals per booking
  const bookingTotals = services.reduce((acc, service) => {
    const total = service.total_price ?? (service.unit_price * service.quantity);
    acc[service.booking_id] = (acc[service.booking_id] || 0) + total;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Журнал услуг</h2>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={activeBookings.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить услугу
        </Button>
      </div>

      {activeBookings.length === 0 && (
        <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
          Нет активных гостей (заселенных). Услуги можно добавлять только для заселенных гостей.
        </div>
      )}

      {/* Active guests summary */}
      {activeBookings.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeBookings.map(booking => (
            <div key={booking.id} className="p-4 border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{booking.guest_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Номер: {booking.rooms?.room_number || '—'}
                  </p>
                </div>
                {bookingTotals[booking.id] && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {bookingTotals[booking.id].toLocaleString()} ₸
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Services table */}
      {services.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Гость / Номер</TableHead>
                <TableHead>Услуга</TableHead>
                <TableHead className="text-center">Кол-во</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map(service => {
                const total = service.total_price ?? (service.unit_price * service.quantity);
                return (
                  <TableRow key={service.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(service.created_at), 'dd.MM HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{service.bookings?.guest_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {service.bookings?.rooms?.room_number || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{service.service_name}</TableCell>
                    <TableCell className="text-center">{service.quantity}</TableCell>
                    <TableCell className="text-right">
                      {service.unit_price.toLocaleString()} ₸
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {total.toLocaleString()} ₸
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteService(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground border rounded-lg">
          Нет записей об услугах
        </div>
      )}

      {/* Add service dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить услугу</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Гость</Label>
              <Select value={selectedBooking} onValueChange={setSelectedBooking}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите гостя" />
                </SelectTrigger>
                <SelectContent>
                  {activeBookings.map(booking => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.guest_name} — {booking.rooms?.room_number || 'без номера'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Услуга из справочника</Label>
              <Select value={selectedService} onValueChange={handleServiceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                  {catalogServices.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} — {service.default_price.toLocaleString()} ₸
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Своя услуга</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedService === 'custom' && (
              <div className="space-y-2">
                <Label>Название услуги</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Например: Трансфер, Экскурсия..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Цена (₸)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Количество</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            {price && quantity && (
              <div className="p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Итого:</span>
                <span className="font-semibold">
                  {(parseFloat(price || '0') * parseInt(quantity || '1')).toLocaleString()} ₸
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Отмена
            </Button>
            <Button onClick={handleAddService} disabled={submitting}>
              {submitting ? t('common.loading') : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
