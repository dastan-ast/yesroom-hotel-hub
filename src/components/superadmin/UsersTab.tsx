import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, UserCog } from 'lucide-react';
import { AssignRoleDialog } from './AssignRoleDialog';

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'guest' | 'admin' | 'owner' | 'superadmin';
  hotel_id: string | null;
  hotel_name: string | null;
}

interface Hotel {
  id: string;
  name: string;
}

export function UsersTab() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch all user roles with profile data
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role
      `);

    if (rolesError) {
      toast.error('Ошибка загрузки ролей');
      setLoading(false);
      return;
    }

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name, hotel_id');

    // Fetch all hotels
    const { data: hotelsData } = await supabase
      .from('hotels')
      .select('id, name')
      .order('name');

    setHotels(hotelsData || []);

    // Get user emails from auth metadata (we'll use profiles for now)
    const usersMap = new Map<string, UserWithRole>();
    
    rolesData?.forEach(role => {
      const profile = profilesData?.find(p => p.user_id === role.user_id);
      const hotel = hotelsData?.find(h => h.id === profile?.hotel_id);
      
      usersMap.set(role.user_id, {
        user_id: role.user_id,
        email: '', // We don't have direct access to auth.users email
        full_name: profile?.full_name || null,
        role: role.role as UserWithRole['role'],
        hotel_id: profile?.hotel_id || null,
        hotel_name: hotel?.name || null
      });
    });

    setUsers(Array.from(usersMap.values()));
    setLoading(false);
  };

  const handleAssignRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleSaveRole = async (userId: string, role: 'admin' | 'owner', hotelId: string) => {
    try {
      // Update user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Update profile hotel_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ hotel_id: hotelId })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // If assigning owner, update hotel owner_id
      if (role === 'owner') {
        const { error: hotelError } = await supabase
          .from('hotels')
          .update({ owner_id: userId })
          .eq('id', hotelId);

        if (hotelError) throw hotelError;
      }

      toast.success('Роль успешно назначена');
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Ошибка при назначении роли');
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      superadmin: { variant: 'destructive', label: 'SuperAdmin' },
      owner: { variant: 'default', label: 'Владелец' },
      admin: { variant: 'secondary', label: 'Администратор' },
      guest: { variant: 'outline', label: 'Гость' }
    };
    const config = variants[role] || { variant: 'outline' as const, label: role };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.hotel_name?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <h2 className="text-xl font-semibold">Пользователи</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Роль" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="superadmin">SuperAdmin</SelectItem>
              <SelectItem value="owner">Владелец</SelectItem>
              <SelectItem value="admin">Администратор</SelectItem>
              <SelectItem value="guest">Гость</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Имя</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead>Отель</TableHead>
            <TableHead className="w-[100px]">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user.user_id}>
              <TableCell className="font-medium">
                {user.full_name || 'Без имени'}
              </TableCell>
              <TableCell>{getRoleBadge(user.role)}</TableCell>
              <TableCell>{user.hotel_name || '—'}</TableCell>
              <TableCell>
                {user.role !== 'superadmin' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAssignRole(user)}
                  >
                    <UserCog className="h-4 w-4 mr-1" />
                    Роль
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filteredUsers.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Пользователи не найдены
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AssignRoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        hotels={hotels}
        onSave={handleSaveRole}
      />
    </div>
  );
}
