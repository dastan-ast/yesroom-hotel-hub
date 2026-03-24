import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Pencil, History } from 'lucide-react';
import { ClientDialog } from './ClientDialog';
import { ClientHistoryDialog } from './ClientHistoryDialog';

interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  document_number: string | null;
  notes: string | null;
}

export function ClientsTab({ hotelId }: { hotelId?: string }) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (hotelId) {
      fetchClients();
    }
  }, [hotelId, search, currentPage]);

  const fetchClients = async () => {
    if (!hotelId) return;
    
    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('hotel_id', hotelId)
      .order('full_name');

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,document_number.ilike.%${search.trim()}%`);
    }

    const from = (currentPage - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);
    
    const { data, count, error } = await query;
    
    if (error) {
      toast.error(t('common.error'));
    } else {
      setClients(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    setSelectedClient(null);
    setDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleHistory = (client: Client) => {
    setSelectedClient(client);
    setHistoryOpen(true);
  };

  const handleSave = async (data: Partial<Client>) => {
    if (selectedClient) {
      const { error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', selectedClient.id);
      if (error) {
        toast.error(t('common.error'));
        return;
      }
      logAdminAction({ hotelId: hotelId!, userId: user!.id, userName: profile?.full_name || '', action: 'client_updated', entityType: 'client', entityId: selectedClient.id, details: { client_name: data.full_name || selectedClient.full_name } });
    } else {
      const { data: inserted, error } = await supabase.from('clients').insert([{
        full_name: data.full_name!,
        phone: data.phone!,
        email: data.email,
        document_number: data.document_number,
        notes: data.notes,
        hotel_id: hotelId
      }]).select('id').single();
      if (error) {
        toast.error(t('common.error'));
        return;
      }
      logAdminAction({ hotelId: hotelId!, userId: user!.id, userName: profile?.full_name || '', action: 'client_created', entityType: 'client', entityId: inserted?.id, details: { client_name: data.full_name } });
    }
    toast.success(t('common.success'));
    setDialogOpen(false);
    fetchClients();
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">{t('admin.clients')}</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить
          </Button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search ? 'Клиенты не найдены' : 'База клиентов пуста'}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Документ</TableHead>
                <TableHead className="w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.full_name}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell>{client.email || '—'}</TableCell>
                  <TableCell>{client.document_number || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(client)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleHistory(client)}>
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">
                {totalCount} клиентов, стр. {currentPage} из {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  Назад
                </Button>
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  Далее
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={selectedClient}
        onSave={handleSave}
      />

      <ClientHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        client={selectedClient}
      />
    </div>
  );
}
