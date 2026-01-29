import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  ALL_MODULES, 
  MODULE_LABELS, 
  PERMISSION_PRESETS, 
  ModuleId 
} from '@/hooks/usePermissions';

interface StaffMember {
  user_id: string;
  full_name: string | null;
  permissions: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember | null;
  hotelId: string;
  onSaved: () => void;
}

export function StaffPermissionsDialog({ open, onOpenChange, staff, hotelId, onSaved }: Props) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (staff) {
      setSelectedPermissions(staff.permissions || []);
    }
  }, [staff]);

  const togglePermission = (moduleId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(moduleId)
        ? prev.filter(p => p !== moduleId)
        : [...prev, moduleId]
    );
  };

  const applyPreset = (presetKey: keyof typeof PERMISSION_PRESETS) => {
    setSelectedPermissions([...PERMISSION_PRESETS[presetKey].permissions]);
  };

  const handleSave = async () => {
    if (!staff) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('staff_permissions')
        .upsert({
          hotel_id: hotelId,
          user_id: staff.user_id,
          permissions: selectedPermissions,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'hotel_id,user_id'
        });

      if (error) throw error;

      toast.success('Права доступа сохранены');
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast.error('Ошибка сохранения: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter out 'staff' module - only owners can access it
  const editableModules = ALL_MODULES.filter(m => m !== 'staff');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Права доступа: {staff?.full_name || 'Сотрудник'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Presets */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Пресеты</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => applyPreset(key as keyof typeof PERMISSION_PRESETS)}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-2 gap-3">
            {editableModules.map((moduleId) => (
              <div
                key={moduleId}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent/50"
              >
                <Checkbox
                  id={moduleId}
                  checked={selectedPermissions.includes(moduleId)}
                  onCheckedChange={() => togglePermission(moduleId)}
                />
                <Label 
                  htmlFor={moduleId} 
                  className="text-sm cursor-pointer flex-1"
                >
                  {MODULE_LABELS[moduleId as ModuleId]}
                </Label>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="text-sm text-muted-foreground">
            Выбрано разделов: {selectedPermissions.length} из {editableModules.length}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
