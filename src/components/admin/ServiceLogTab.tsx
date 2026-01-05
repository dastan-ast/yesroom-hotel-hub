import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
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
import { Plus, Trash2, Coffee, UtensilsCrossed, Wine, Sparkles } from 'lucide-react';

interface ServiceCharge {
  id: string;
  description: string;
  amount: number;
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

interface Props {
  hotelId: string;
}

const quickItems = [
  { label: 'Завтрак', amount: 2000, icon: UtensilsCrossed },
  { label: 'Мини-бар', amount: 3000, icon: Wine },
  { label: 'Уборка номера', amount: 1500, icon: Sparkles },
];

export function ServiceLogTab({ hotelId }: Props) {
  const { t } = useTranslation();
  const [charges, setCharges] = useState<ServiceCharge[]>([]);
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hotelId) {
      fetchData();
    }
  }, [hotelId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch service charges
    const { data: chargesData } = await supabase
      .from('service_charges')
      .select('id, description, amount, created_at, booking_id, bookings(guest_name, room_id, rooms(room_number))')
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

    if (chargesData) setCharges(chargesData as unknown as ServiceCharge[]);
    if (bookingsData) setActiveBookings(bookingsData as unknown as ActiveBooking[]);
    setLoading(false);
  };

  const handleAddCharge = async () => {
    if (!selectedBooking || !description.trim() || !amount) {
      toast.error('Заполните все поля');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('service_charges').insert({
      hotel_id: hotelId,
      booking_id: selectedBooking,
      description: description.trim(),
      amount: parseFloat(amount),
    });

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Услуга добавлена');
      setDialogOpen(false);
      setDescription('');
      setAmount('');
      setSelectedBooking('');
      fetchData();
    }
    setSubmitting(false);
  };

  const handleQuickAdd = (item: { label: string; amount: number }) => {
    setDescription(item.label);
    setAmount(item.amount.toString());
  };

  const handleDeleteCharge = async (id: string) => {
    const { error } = await supabase.from('service_charges').delete().eq('id', id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Услуга удалена');
      fetchData();
    }
  };

  // Calculate totals per booking
  const bookingTotals = charges.reduce((acc, charge) => {
    acc[charge.booking_id] = (acc[charge.booking_id] || 0) + charge.amount;
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

      {/* Charges table */}
      {charges.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Гость / Номер</TableHead>
                <TableHead>Услуга</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {charges.map(charge => (
                <TableRow key={charge.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(charge.created_at), 'dd.MM HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{charge.bookings?.guest_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {charge.bookings?.rooms?.room_number || '—'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{charge.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    {charge.amount.toLocaleString()} ₸
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteCharge(charge.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground border rounded-lg">
          Нет записей об услугах
        </div>
      )}

      {/* Add charge dialog */}
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

            {/* Quick add buttons */}
            <div className="flex flex-wrap gap-2">
              {quickItems.map(item => (
                <Button
                  key={item.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAdd(item)}
                  className="gap-1.5"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: Завтрак, Мини-бар..."
              />
            </div>

            <div className="space-y-2">
              <Label>Сумма (₸)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddCharge} disabled={submitting}>
              {submitting ? t('common.loading') : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
