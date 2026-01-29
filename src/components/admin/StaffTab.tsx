import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { StaffPermissionsDialog } from './StaffPermissionsDialog';
import { MODULE_LABELS, ModuleId, DEFAULT_ADMIN_PERMISSIONS } from '@/hooks/usePermissions';

interface StaffMember {
  user_id: string;
  full_name: string | null;
  email: string;
  permissions: string[];
}

interface Props {
  hotelId: string;
}

export function StaffTab({ hotelId }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, [hotelId]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      // Get all admins for this hotel
      // First get profiles with this hotel_id
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('hotel_id', hotelId);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setStaff([]);
        setLoading(false);
        return;
      }

      // Get user roles to filter only admins
      const userIds = profiles.map(p => p.user_id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds)
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminUserIds = roles?.map(r => r.user_id) || [];
      
      if (adminUserIds.length === 0) {
        setStaff([]);
        setLoading(false);
        return;
      }

      // Get permissions for these admins
      const { data: permissions, error: permError } = await supabase
        .from('staff_permissions')
        .select('user_id, permissions')
        .eq('hotel_id', hotelId)
        .in('user_id', adminUserIds);

      if (permError) throw permError;

      // Combine data
      const permissionsMap = new Map(permissions?.map(p => [p.user_id, p.permissions]) || []);
      
      const staffList: StaffMember[] = profiles
        .filter(p => adminUserIds.includes(p.user_id))
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: '', // We can't access auth.users directly, will show name only
          permissions: permissionsMap.get(p.user_id) || [],
        }));

      setStaff(staffList);
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      toast.error('Ошибка загрузки списка персонала');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffEmail.trim()) {
      toast.error('Введите email сотрудника');
      return;
    }

    setAdding(true);
    try {
      // Check if user exists by email in profiles (we can't query auth.users directly)
      // This is a limitation - we need to find user by some other means
      // For now, we'll show a message that the user needs to register first
      
      toast.info(
        'Для добавления сотрудника попросите его зарегистрироваться в системе, затем назначьте ему роль через панель SuperAdmin',
        { duration: 5000 }
      );
      
      setAddDialogOpen(false);
      setNewStaffEmail('');
    } catch (error: any) {
      console.error('Error adding staff:', error);
      toast.error('Ошибка добавления: ' + error.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    try {
      // Remove permissions
      const { error: permError } = await supabase
        .from('staff_permissions')
        .delete()
        .eq('hotel_id', hotelId)
        .eq('user_id', userId);

      if (permError) throw permError;

      // Update profile to remove hotel_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ hotel_id: null })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Note: We can't change the role here as it requires superadmin
      // The user will keep their admin role but without hotel access

      toast.success('Сотрудник удалён из отеля');
      fetchStaff();
    } catch (error: any) {
      console.error('Error removing staff:', error);
      toast.error('Ошибка удаления: ' + error.message);
    }
  };

  const openPermissionsDialog = (member: StaffMember) => {
    setSelectedStaff(member);
    setPermissionsDialogOpen(true);
  };

  const getPermissionsBadges = (permissions: string[]) => {
    if (permissions.length === 0) {
      return <Badge variant="secondary">Нет доступа</Badge>;
    }
    if (permissions.length >= 8) {
      return <Badge variant="default">Полный доступ</Badge>;
    }
    
    // Show first 3 permissions
    const shown = permissions.slice(0, 3);
    const remaining = permissions.length - 3;
    
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map(p => (
          <Badge key={p} variant="outline" className="text-xs">
            {MODULE_LABELS[p as ModuleId] || p}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{remaining}
          </Badge>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Управление персоналом
          </h2>
          <p className="text-sm text-muted-foreground">
            Настройте права доступа для администраторов вашего отеля
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Пока нет администраторов</p>
            <p className="text-sm mt-2">
              Для добавления сотрудника обратитесь к SuperAdmin
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Права доступа</TableHead>
                <TableHead className="w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <div className="font-medium">
                      {member.full_name || 'Без имени'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPermissionsBadges(member.permissions)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openPermissionsDialog(member)}
                        title="Редактировать права"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Удалить из отеля"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить сотрудника?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.full_name} потеряет доступ к этому отелю. 
                              Это действие нельзя отменить.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveStaff(member.user_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email сотрудника</Label>
              <Input
                id="email"
                type="email"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="admin@hotel.kz"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Сотрудник должен быть зарегистрирован в системе. 
              Для назначения роли обратитесь к SuperAdmin.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddStaff} disabled={adding}>
              {adding ? 'Добавление...' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <StaffPermissionsDialog
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
        staff={selectedStaff}
        hotelId={hotelId}
        onSaved={fetchStaff}
      />
    </div>
  );
}
