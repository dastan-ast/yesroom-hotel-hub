import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';

interface ServiceCatalogItem {
  id: string;
  name: string;
  default_price: number;
  is_active: boolean;
  created_at: string;
}

interface Props {
  hotelId: string;
}

export function ServiceCatalogTab({ hotelId }: Props) {
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceCatalogItem | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hotelId) {
      fetchServices();
    }
  }, [hotelId]);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('service_catalog')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('name', { ascending: true });

    if (data) setServices(data);
    if (error) console.error('Error fetching services:', error);
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingService(null);
    setName('');
    setPrice('');
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (service: ServiceCatalogItem) => {
    setEditingService(service);
    setName(service.name);
    setPrice(service.default_price.toString());
    setIsActive(service.is_active);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price) {
      toast.error('Заполните все поля');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Введите корректную цену');
      return;
    }

    setSubmitting(true);

    if (editingService) {
      // Update existing
      const { error } = await supabase
        .from('service_catalog')
        .update({
          name: name.trim(),
          default_price: priceNum,
          is_active: isActive,
        })
        .eq('id', editingService.id);

      if (error) {
        toast.error(t('common.error'));
      } else {
        toast.success('Услуга обновлена');
        setDialogOpen(false);
        fetchServices();
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('service_catalog')
        .insert({
          hotel_id: hotelId,
          name: name.trim(),
          default_price: priceNum,
          is_active: isActive,
        });

      if (error) {
        toast.error(t('common.error'));
      } else {
        toast.success('Услуга добавлена');
        setDialogOpen(false);
        fetchServices();
      }
    }

    setSubmitting(false);
  };

  const handleDeleteClick = (service: ServiceCatalogItem) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    const { error } = await supabase
      .from('service_catalog')
      .delete()
      .eq('id', serviceToDelete.id);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Услуга удалена');
      fetchServices();
    }

    setDeleteDialogOpen(false);
    setServiceToDelete(null);
  };

  const toggleActive = async (service: ServiceCatalogItem) => {
    const { error } = await supabase
      .from('service_catalog')
      .update({ is_active: !service.is_active })
      .eq('id', service.id);

    if (error) {
      toast.error(t('common.error'));
    } else {
      fetchServices();
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Справочник услуг</h2>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить услугу
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Нет услуг в справочнике</p>
          <p className="text-sm mt-1">Добавьте услуги, которые можно будет применять к бронированиям</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="text-right">Цена по умолчанию</TableHead>
                <TableHead className="text-center">Статус</TableHead>
                <TableHead className="w-24 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id} className={!service.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="text-right">
                    {service.default_price.toLocaleString()} ₸
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={service.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(service)}
                    >
                      {service.is_active ? 'Активна' : 'Скрыта'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(service)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(service)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Редактировать услугу' : 'Новая услуга'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Завтрак, Трансфер..."
              />
            </div>

            <div className="space-y-2">
              <Label>Цена по умолчанию (₸)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                min="0"
                step="100"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-active">Активна</Label>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('common.loading') : editingService ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить услугу?</AlertDialogTitle>
            <AlertDialogDescription>
              Услуга «{serviceToDelete?.name}» будет удалена из справочника.
              Записи об уже оказанных услугах сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
