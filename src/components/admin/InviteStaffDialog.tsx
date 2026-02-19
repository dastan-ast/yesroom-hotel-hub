import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MODULE_LABELS, ModuleId, DEFAULT_ADMIN_PERMISSIONS, PERMISSION_PRESETS } from '@/hooks/usePermissions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  hotelName: string;
  onInviteSent: () => void;
}

const AVAILABLE_PERMISSIONS: ModuleId[] = [
  'dashboard', 'bookings', 'shahmatka', 'rooms', 'room_types', 
  'clients', 'services', 'service_catalog', 'integrations', 'settings'
];

export function InviteStaffDialog({ open, onOpenChange, hotelId, hotelName, onInviteSent }: Props) {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_ADMIN_PERMISSIONS);
  const [selectedPreset, setSelectedPreset] = useState('basic');
  const [sending, setSending] = useState(false);

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

  const handleSendInvite = async () => {
    if (!email.trim()) {
      toast.error('Введите email');
      return;
    }

    if (!email.includes('@')) {
      toast.error('Некорректный email');
      return;
    }

    if (permissions.length === 0) {
      toast.error('Выберите хотя бы одно право доступа');
      return;
    }

    setSending(true);
    try {
      // Create invitation record
      const { data: invitation, error: insertError } = await supabase
        .from('staff_invitations')
        .insert({
          hotel_id: hotelId,
          email: email.toLowerCase().trim(),
          permissions,
          invited_by: user?.id,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          toast.error('Приглашение на этот email уже отправлено');
        } else {
          throw insertError;
        }
        return;
      }

      // Send email via edge function
      const inviteUrl = `${window.location.origin}/invite/${invitation.token}`;
      
      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-staff-invitation', {
        body: {
          email: email.toLowerCase().trim(),
          hotelName,
          inviteUrl,
          invitedByName: profile?.full_name || 'Владелец отеля',
        },
      });

      if (emailError || (emailResult && !emailResult.success)) {
        console.error('Email error:', emailError || emailResult?.error);
        // Still success - invitation created, just email failed
        toast.success('Приглашение создано! Ссылка скопирована в буфер обмена.');
        navigator.clipboard.writeText(inviteUrl);
      } else {
        toast.success('Приглашение отправлено на ' + email);
      }

      onInviteSent();
      onOpenChange(false);
      setEmail('');
      setPermissions(DEFAULT_ADMIN_PERMISSIONS);
      setSelectedPreset('basic');
    } catch (error: any) {
      console.error('Invite error:', error);
      toast.error('Ошибка отправки: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Пригласить администратора
          </DialogTitle>
          <DialogDescription>
            Отправьте приглашение по email. Приглашённый получит ссылку для регистрации.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hotel.kz"
              autoFocus
            />
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
                  id={`perm-${perm}`}
                  checked={permissions.includes(perm)}
                  onCheckedChange={() => togglePermission(perm)}
                />
                <Label 
                  htmlFor={`perm-${perm}`} 
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
          <Button onClick={handleSendInvite} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Отправить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
