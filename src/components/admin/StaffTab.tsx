import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, UserPlus, Shield, Mail, Clock, X, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { StaffPermissionsDialog } from './StaffPermissionsDialog';
import { InviteStaffDialog } from './InviteStaffDialog';
import { MODULE_LABELS, ModuleId } from '@/hooks/usePermissions';

interface StaffMember {
  user_id: string;
  full_name: string | null;
  email: string;
  permissions: string[];
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
  permissions: string[];
}

interface Props {
  hotelId: string;
  hotelName?: string;
}

export function StaffTab({ hotelId, hotelName = 'Отель' }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    fetchStaff();
    fetchInvitations();
  }, [hotelId]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
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

      const { data: permissions, error: permError } = await supabase
        .from('staff_permissions')
        .select('user_id, permissions')
        .eq('hotel_id', hotelId)
        .in('user_id', adminUserIds);

      if (permError) throw permError;

      const permissionsMap = new Map(permissions?.map(p => [p.user_id, p.permissions]) || []);
      
      const staffList: StaffMember[] = profiles
        .filter(p => adminUserIds.includes(p.user_id))
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: '',
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

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_invitations')
        .select('id, email, status, created_at, expires_at, permissions')
        .eq('hotel_id', hotelId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
    }
  };

  const handleCancelInvitation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('staff_invitations')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Приглашение отменено');
      fetchInvitations();
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message);
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      const inviteUrl = `${window.location.origin}/invite/${invitation.id}`;
      
      const { error } = await supabase.functions.invoke('send-staff-invitation', {
        body: {
          email: invitation.email,
          hotelName,
          inviteUrl,
          invitedByName: 'Владелец отеля',
        },
      });

      if (error) {
        navigator.clipboard.writeText(inviteUrl);
        toast.success('Ссылка скопирована в буфер обмена');
      } else {
        toast.success('Приглашение отправлено повторно');
      }
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    try {
      const { error: permError } = await supabase
        .from('staff_permissions')
        .delete()
        .eq('hotel_id', hotelId)
        .eq('user_id', userId);

      if (permError) throw permError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ hotel_id: null })
        .eq('user_id', userId);

      if (profileError) throw profileError;

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
        <Button onClick={() => setInviteDialogOpen(true)}>
          <Mail className="h-4 w-4 mr-2" />
          Пригласить
        </Button>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ожидают подтверждения
            </h3>
            <div className="space-y-2">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Истекает: {new Date(inv.expires_at).toLocaleDateString('ru')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResendInvitation(inv)}
                      title="Отправить повторно"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancelInvitation(inv.id)}
                      title="Отменить"
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {staff.length === 0 && invitations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Пока нет администраторов</p>
            <p className="text-sm mt-2">
              Пригласите сотрудника по email
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setInviteDialogOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Пригласить администратора
            </Button>
          </CardContent>
        </Card>
      ) : staff.length > 0 && (
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

      {/* Invite Dialog */}
      <InviteStaffDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        hotelId={hotelId}
        hotelName={hotelName}
        onInviteSent={() => {
          fetchInvitations();
        }}
      />

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
