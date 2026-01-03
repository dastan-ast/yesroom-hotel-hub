import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Phone, MessageCircle, Save } from 'lucide-react';

type BookingStatus = 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'cancelled';

interface Booking {
  id: string;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  room_types: { name: string } | null;
  total_price: number | null;
}

interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  hotelId: string;
}

const statusColors: Record<BookingStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700',
  approved: 'bg-blue-500/20 text-blue-700',
  checked_in: 'bg-green-500/20 text-green-700',
  checked_out: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/20 text-red-700',
};

export function GuestHistoryModal({ open, onOpenChange, phone, hotelId }: Props) {
  const { t } = useTranslation();
  const [client, setClient] = useState<Client | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && phone) {
      fetchClientData();
    }
  }, [open, phone, hotelId]);

  const fetchClientData = async () => {
    setLoading(true);
    
    // Find client by phone
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('phone', phone)
      .maybeSingle();

    if (clientData) {
      setClient(clientData);
      setNotes(clientData.notes || '');

      // Fetch booking history
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date, status, total_price, room_types(name)')
        .eq('client_id', clientData.id)
        .order('check_in_date', { ascending: false });

      setBookings((bookingsData as Booking[]) || []);
    } else {
      // No client record, search bookings by phone
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date, status, total_price, room_types(name)')
        .eq('hotel_id', hotelId)
        .eq('guest_phone', phone)
        .order('check_in_date', { ascending: false });

      setBookings((bookingsData as Booking[]) || []);
      setClient(null);
      setNotes('');
    }

    setLoading(false);
  };

  const handleSaveNotes = async () => {
    if (!client) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('clients')
      .update({ notes })
      .eq('id', client.id);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Заметки сохранены');
    }
    setSaving(false);
  };

  const getStatusLabel = (status: BookingStatus) => {
    const labels: Record<BookingStatus, string> = {
      pending: t('admin.pending'),
      approved: t('admin.approved'),
      checked_in: t('admin.checkedIn'),
      checked_out: t('admin.checkedOut'),
      cancelled: t('admin.cancelled'),
    };
    return labels[status];
  };

  const formatPhone = (p: string) => p.replace(/[^\d+]/g, '');
  const totalSpent = bookings
    .filter(b => b.status === 'checked_out' && b.total_price)
    .reduce((sum, b) => sum + (b.total_price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>История гостя</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            {/* Guest Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-lg">{client?.full_name || 'Гость'}</p>
                  <a
                    href={`tel:${formatPhone(phone)}`}
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {phone}
                  </a>
                  {client?.email && (
                    <p className="text-sm text-muted-foreground">{client.email}</p>
                  )}
                </div>
                <a
                  href={`https://wa.me/${formatPhone(phone).replace('+', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>

              <div className="mt-3 flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Визитов:</span>{' '}
                  <span className="font-medium">{bookings.filter(b => b.status === 'checked_out').length}</span>
                </div>
                {totalSpent > 0 && (
                  <div>
                    <span className="text-muted-foreground">Потратил:</span>{' '}
                    <span className="font-medium">{totalSpent.toLocaleString()} ₸</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {client && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Заметки о госте</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Предпочтения, особенности..."
                  className="resize-none"
                  rows={3}
                />
                <Button size="sm" onClick={handleSaveNotes} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  Сохранить
                </Button>
              </div>
            )}

            {/* Booking History */}
            <div>
              <h4 className="font-medium mb-2">История бронирований</h4>
              <ScrollArea className="h-[200px]">
                {bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет бронирований</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.map(booking => (
                      <div key={booking.id} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{booking.room_types?.name}</span>
                          <Badge className={statusColors[booking.status]} variant="secondary">
                            {getStatusLabel(booking.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.check_in_date), 'dd.MM.yyyy')} —{' '}
                          {format(new Date(booking.check_out_date), 'dd.MM.yyyy')}
                        </p>
                        {booking.total_price && (
                          <p className="text-xs font-medium mt-1">
                            {booking.total_price.toLocaleString()} ₸
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
