import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface User {
  user_id: string;
  full_name: string | null;
  role: string;
  hotel_id: string | null;
}

interface Hotel {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  hotels: Hotel[];
  onSave: (userId: string, role: 'admin' | 'owner', hotelId: string) => void;
}

export function AssignRoleDialog({ open, onOpenChange, user, hotels, onSave }: Props) {
  const [role, setRole] = useState<'admin' | 'owner'>('admin');
  const [hotelId, setHotelId] = useState('');

  useEffect(() => {
    if (user) {
      setRole(user.role === 'owner' ? 'owner' : 'admin');
      setHotelId(user.hotel_id || '');
    }
  }, [user]);

  const handleSave = () => {
    if (!user || !hotelId) return;
    onSave(user.user_id, role, hotelId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить роль</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Пользователь</Label>
            <p className="text-sm text-muted-foreground">
              {user?.full_name || 'Без имени'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Роль</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'owner')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Администратор</SelectItem>
                <SelectItem value="owner">Владелец отеля</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'owner' 
                ? 'Владелец имеет полный доступ к отелю и может управлять администраторами'
                : 'Администратор управляет бронированиями, номерами и клиентами'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Отель</Label>
            <Select value={hotelId} onValueChange={setHotelId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите отель" />
              </SelectTrigger>
              <SelectContent>
                {hotels.map((hotel) => (
                  <SelectItem key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!hotelId}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
