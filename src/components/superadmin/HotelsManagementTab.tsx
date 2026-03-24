import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Search, ChevronDown, ChevronRight, Edit2, Trash2, Users, Shield,
  Building2, MapPin, Calendar, UserCog
} from 'lucide-react';
import { ALL_MODULES, MODULE_LABELS, ModuleId, PERMISSION_PRESETS } from '@/hooks/usePermissions';

interface Hotel {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  property_type: string;
  subscription_status: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  owner_id: string | null;
}

interface StaffMember {
  user_id: string;
  full_name: string | null;
  role: string;
  permissions: string[];
}

export function HotelsManagementTab() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);
  const [staffMap, setStaffMap] = useState<Record<string, StaffMember[]>>({});
  const [loadingStaff, setLoadingStaff] = useState<string | null>(null);
  const [editHotel, setEditHotel] = useState<Hotel | null>(null);
  const [editForm, setEditForm] = useState({ name: '', location: '', description: '', property_type: 'hotel', status: 'active', subscription_status: 'trial' });
  const [deleteConfirm, setDeleteConfirm] = useState<Hotel | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<{ staff: StaffMember; hotelId: string } | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<{ staff: StaffMember; hotelId: string } | null>(null);
  const [newRole, setNewRole] = useState<string>('admin');

  const stats = {
    total: hotels.length,
    trial: hotels.filter(h => h.subscription_status === 'trial').length,
    active: hotels.filter(h => h.subscription_status === 'active').length,
    expired: hotels.filter(h => h.subscription_status === 'expired').length,
  };

  useEffect(() => { fetchHotels(); }, []);

  const fetchHotels = async () => {
    const { data } = await supabase
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setHotels(data);
  };

  const fetchStaff = async (hotelId: string) => {
    if (staffMap[hotelId]) return;
    setLoadingStaff(hotelId);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('hotel_id', hotelId);

    if (!profiles || profiles.length === 0) {
      setStaffMap(prev => ({ ...prev, [hotelId]: [] }));
      setLoadingStaff(null);
      return;
    }

    const userIds = profiles.map(p => p.user_id);
    const [rolesRes, permsRes] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      supabase.from('staff_permissions').select('user_id, permissions').eq('hotel_id', hotelId),
    ]);

    const staff: StaffMember[] = profiles.map(p => ({
      user_id: p.user_id,
      full_name: p.full_name,
      role: rolesRes.data?.find(r => r.user_id === p.user_id)?.role || 'guest',
      permissions: (permsRes.data?.find(pm => pm.user_id === p.user_id)?.permissions as string[]) || [],
    }));

    setStaffMap(prev => ({ ...prev, [hotelId]: staff }));
    setLoadingStaff(null);
  };

  const toggleExpand = (hotelId: string) => {
    if (expandedHotel === hotelId) {
      setExpandedHotel(null);
    } else {
      setExpandedHotel(hotelId);
      fetchStaff(hotelId);
    }
  };

  const handleEditHotel = (hotel: Hotel) => {
    setEditHotel(hotel);
    setEditForm({
      name: hotel.name,
      location: hotel.location || '',
      description: hotel.description || '',
      property_type: hotel.property_type,
      status: hotel.status,
      subscription_status: hotel.subscription_status,
    });
  };

  const saveHotel = async () => {
    if (!editHotel) return;
    const { error } = await supabase
      .from('hotels')
      .update({
        name: editForm.name,
        location: editForm.location || null,
        description: editForm.description || null,
        property_type: editForm.property_type,
        status: editForm.status,
        subscription_status: editForm.subscription_status,
      })
      .eq('id', editHotel.id);

    if (error) { toast.error('Ошибка сохранения'); return; }
    toast.success('Отель обновлён');
    setEditHotel(null);
    fetchHotels();
  };

  const deleteHotel = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('hotels').delete().eq('id', deleteConfirm.id);
    if (error) { toast.error('Ошибка удаления: ' + error.message); return; }
    toast.success('Отель удалён');
    setDeleteConfirm(null);
    setExpandedHotel(null);
    fetchHotels();
  };

  const openPermissionsEdit = (staff: StaffMember, hotelId: string) => {
    setEditingPermissions({ staff, hotelId });
    setSelectedPermissions([...staff.permissions]);
  };

  const savePermissions = async () => {
    if (!editingPermissions) return;
    const { staff, hotelId } = editingPermissions;
    const { error } = await supabase
      .from('staff_permissions')
      .upsert({
        hotel_id: hotelId,
        user_id: staff.user_id,
        permissions: selectedPermissions,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'hotel_id,user_id' });

    if (error) { toast.error('Ошибка сохранения прав'); return; }
    toast.success('Права обновлены');
    setStaffMap(prev => ({ ...prev, [hotelId]: undefined as any }));
    fetchStaff(hotelId);
    setEditingPermissions(null);
  };

  const openRoleEdit = (staff: StaffMember, hotelId: string) => {
    setEditingRole({ staff, hotelId });
    setNewRole(staff.role);
  };

  const saveRole = async () => {
    if (!editingRole) return;
    const { staff, hotelId } = editingRole;
    const { error } = await supabase.rpc('assign_user_role', {
      _target_user_id: staff.user_id,
      _new_role: newRole as any,
      _hotel_id: hotelId,
    });
    if (error) { toast.error('Ошибка: ' + error.message); return; }
    toast.success('Роль обновлена');
    setStaffMap(prev => ({ ...prev, [hotelId]: undefined as any }));
    fetchStaff(hotelId);
    setEditingRole(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      trial: { variant: 'secondary', label: 'Пробный' },
      active: { variant: 'default', label: 'Активный' },
      expired: { variant: 'destructive', label: 'Истёк' },
      suspended: { variant: 'outline', label: 'Приостановлен' },
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      superadmin: { variant: 'destructive', label: 'SuperAdmin' },
      owner: { variant: 'default', label: 'Владелец' },
      admin: { variant: 'secondary', label: 'Администратор' },
      guest: { variant: 'outline', label: 'Гость' },
    };
    const c = map[role] || { variant: 'outline' as const, label: role };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const editableModules = ALL_MODULES.filter(m => m !== 'staff');

  const filteredHotels = hotels.filter(hotel => {
    const matchSearch = hotel.name.toLowerCase().includes(search.toLowerCase()) ||
      hotel.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || hotel.subscription_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { label: 'Всего отелей', value: stats.total, color: '' },
          { label: 'Пробный', value: stats.trial, color: 'text-blue-600' },
          { label: 'Активных', value: stats.active, color: 'text-green-600' },
          { label: 'Истекших', value: stats.expired, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hotels List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <CardTitle>Управление отелями</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-64" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Статус" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="trial">Пробный</SelectItem>
                  <SelectItem value="active">Активный</SelectItem>
                  <SelectItem value="expired">Истёк</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredHotels.map(hotel => (
            <Collapsible key={hotel.id} open={expandedHotel === hotel.id} onOpenChange={() => toggleExpand(hotel.id)}>
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {expandedHotel === hotel.id ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{hotel.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          {hotel.location && <><MapPin className="h-3 w-3" />{hotel.location}</>}
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          {format(new Date(hotel.created_at), 'dd.MM.yyyy', { locale: ru })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(hotel.subscription_status)}
                      <Badge variant="outline">{hotel.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); handleEditHotel(hotel); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); setDeleteConfirm(hotel); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4" />
                      <h4 className="font-medium text-sm">Сотрудники отеля</h4>
                    </div>

                    {loadingStaff === hotel.id ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Загрузка...</p>
                    ) : !staffMap[hotel.id] || staffMap[hotel.id].length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Нет сотрудников</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Имя</TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead>Права доступа</TableHead>
                            <TableHead className="w-[120px]">Действия</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffMap[hotel.id].map(s => (
                            <TableRow key={s.user_id}>
                              <TableCell className="font-medium">{s.full_name || 'Без имени'}</TableCell>
                              <TableCell>{getRoleBadge(s.role)}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {s.role === 'owner' || s.role === 'superadmin' ? (
                                    <Badge variant="outline" className="text-xs">Полный доступ</Badge>
                                  ) : s.permissions.length > 0 ? (
                                    s.permissions.slice(0, 4).map(p => (
                                      <Badge key={p} variant="outline" className="text-xs">
                                        {MODULE_LABELS[p as ModuleId] || p}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Нет прав</span>
                                  )}
                                  {s.permissions.length > 4 && (
                                    <Badge variant="outline" className="text-xs">+{s.permissions.length - 4}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {s.role !== 'superadmin' && (
                                    <>
                                      <Button size="sm" variant="ghost" title="Изменить роль" onClick={() => openRoleEdit(s, hotel.id)}>
                                        <UserCog className="h-4 w-4" />
                                      </Button>
                                      {s.role === 'admin' && (
                                        <Button size="sm" variant="ghost" title="Редактировать права" onClick={() => openPermissionsEdit(s, hotel.id)}>
                                          <Shield className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
          {filteredHotels.length === 0 && (
            <div className="text-center text-muted-foreground py-8">Отели не найдены</div>
          )}
        </CardContent>
      </Card>

      {/* Edit Hotel Dialog */}
      <Dialog open={!!editHotel} onOpenChange={open => !open && setEditHotel(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Редактировать отель</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Адрес</Label>
              <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Тип</Label>
                <Select value={editForm.property_type} onValueChange={v => setEditForm(f => ({ ...f, property_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Отель</SelectItem>
                    <SelectItem value="hostel">Хостел</SelectItem>
                    <SelectItem value="guesthouse">Гостевой дом</SelectItem>
                    <SelectItem value="camping">Кемпинг</SelectItem>
                    <SelectItem value="recreation">Зона отдыха</SelectItem>
                    <SelectItem value="cottage">Коттедж</SelectItem>
                    <SelectItem value="apartment">Апартаменты</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="active">Активный</SelectItem>
                    <SelectItem value="rejected">Отклонён</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Подписка</Label>
              <Select value={editForm.subscription_status} onValueChange={v => setEditForm(f => ({ ...f, subscription_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Пробный</SelectItem>
                  <SelectItem value="active">Активный</SelectItem>
                  <SelectItem value="expired">Истёк</SelectItem>
                  <SelectItem value="suspended">Приостановлен</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditHotel(null)}>Отмена</Button>
            <Button onClick={saveHotel}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Удалить отель?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы уверены что хотите удалить отель <strong>{deleteConfirm?.name}</strong>? Все данные (бронирования, номера, клиенты) будут потеряны. Это действие нельзя отменить.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Отмена</Button>
            <Button variant="destructive" onClick={deleteHotel}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingPermissions} onOpenChange={open => !open && setEditingPermissions(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Права доступа: {editingPermissions?.staff.full_name || 'Сотрудник'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-wrap gap-2">
              {PERMISSION_PRESETS.map(preset => (
                <Badge key={preset.id} variant="outline" className="cursor-pointer hover:bg-accent"
                  onClick={() => setSelectedPermissions([...preset.permissions])}>
                  {preset.label}
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {editableModules.map(moduleId => (
                <div key={moduleId} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent/50">
                  <Checkbox
                    id={`sa-${moduleId}`}
                    checked={selectedPermissions.includes(moduleId)}
                    onCheckedChange={() => setSelectedPermissions(prev =>
                      prev.includes(moduleId) ? prev.filter(p => p !== moduleId) : [...prev, moduleId]
                    )}
                  />
                  <Label htmlFor={`sa-${moduleId}`} className="text-sm cursor-pointer flex-1">
                    {MODULE_LABELS[moduleId as ModuleId]}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Выбрано: {selectedPermissions.length} из {editableModules.length}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPermissions(null)}>Отмена</Button>
            <Button onClick={savePermissions}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={open => !open && setEditingRole(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Изменить роль</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Пользователь: <strong>{editingRole?.staff.full_name || 'Без имени'}</strong>
            </p>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="owner">Владелец</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>Отмена</Button>
            <Button onClick={saveRole}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
