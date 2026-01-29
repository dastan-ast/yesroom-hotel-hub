import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MODULE_LABELS, ModuleId, DEFAULT_ADMIN_PERMISSIONS, PERMISSION_PRESETS } from '@/hooks/usePermissions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  onCreated: () => void;
  editStaff?: {
    user_id: string;
    full_name: string | null;
    email?: string;
    permissions: string[];
  } | null;
}

const AVAILABLE_PERMISSIONS: ModuleId[] = [
  'dashboard', 'bookings', 'shahmatka', 'rooms', 'room_types', 
  'clients', 'services', 'service_catalog', 'integrations', 'settings'
];

export function CreateStaffDialog({ open, onOpenChange, hotelId, onCreated, editStaff }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_ADMIN_PERMISSIONS);
  const [selectedPreset, setSelectedPreset] = useState('basic');
  const [saving, setSaving] = useState(false);

  const isEditing = !!editStaff;

  useEffect(() => {
    if (editStaff) {
      setFullName(editStaff.full_name || '');
      setEmail(editStaff.email || '');
      setPassword('');
      setPermissions(editStaff.permissions || []);
      
      // Determine preset
      const preset = PERMISSION_PRESETS.find(p => 
        p.permissions.length === editStaff.permissions.length &&
        p.permissions.every(perm => editStaff.permissions.includes(perm))
      );
      setSelectedPreset(preset?.id || 'custom');
    } else {
      setFullName('');
      setEmail('');
      setPassword('');
      setPermissions(DEFAULT_ADMIN_PERMISSIONS);
      setSelectedPreset('basic');
    }
  }, [editStaff, open]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PERMISSION_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setPermissions([...preset.permissions]);
    }
  };

  const togglePermission = (perm: string) => {
    setSelectedPreset('custom');
    setPermissions(prev => 
      prev.includes(perm) 
        ? prev.filter(p => p !== perm)
        : [...prev, perm]
    );
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
    setShowPassword(true);
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error('Введите имя сотрудника');
      return;
    }

    if (!isEditing) {
      if (!email.trim() || !email.includes('@')) {
        toast.error('Введите корректный email');
        return;
      }
      if (!password || password.length < 6) {
        toast.error('Пароль должен быть не менее 6 символов');
        return;
      }
    }

    if (permissions.length === 0) {
      toast.error('Выберите хотя бы одно право доступа');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: isEditing ? 'update' : 'create',
          hotelId,
          email: email.toLowerCase().trim(),
          password: password || undefined,
          fullName: fullName.trim(),
          permissions,
          userId: editStaff?.user_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(isEditing ? 'Данные сотрудника обновлены' : 'Администратор создан');
      onCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Staff error:', error);
      toast.error('Ошибка: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {isEditing ? 'Редактировать администратора' : 'Создать администратора'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Измените данные сотрудника. Оставьте пароль пустым, чтобы не менять его.'
              : 'Создайте учётную запись для нового администратора отеля.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="staff-name">Имя сотрудника *</Label>
            <Input
              id="staff-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Иванов"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-email">Email (логин) *</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hotel.kz"
              disabled={isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-password">
              {isEditing ? 'Новый пароль (оставьте пустым)' : 'Пароль *'}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEditing ? 'Не менять' : 'Минимум 6 символов'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={generatePassword}>
                Сгенерировать
              </Button>
            </div>
            {password && showPassword && (
              <p className="text-xs text-muted-foreground">
                Запишите пароль, он не будет показан снова
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Права доступа</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите пресет" />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_PRESETS.map(preset => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
                {selectedPreset === 'custom' && (
                  <SelectItem value="custom">Свой набор</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_PERMISSIONS.map(perm => (
              <div key={perm} className="flex items-center space-x-2">
                <Checkbox
                  id={`create-perm-${perm}`}
                  checked={permissions.includes(perm)}
                  onCheckedChange={() => togglePermission(perm)}
                />
                <Label 
                  htmlFor={`create-perm-${perm}`} 
                  className="text-sm font-normal cursor-pointer"
                >
                  {MODULE_LABELS[perm]}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? 'Сохранение...' : 'Создание...'}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                {isEditing ? 'Сохранить' : 'Создать'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
