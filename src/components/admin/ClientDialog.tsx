import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const schema = z.object({
  full_name: z.string().min(1, 'Обязательное поле'),
  phone: z.string().min(1, 'Обязательное поле'),
  email: z.string().email('Неверный email').optional().or(z.literal('')),
  document_number: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  document_number: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSave: (data: Partial<Client>) => void;
}

export function ClientDialog({ open, onOpenChange, client, onSave }: Props) {
  const { t } = useTranslation();
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      document_number: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (client) {
        form.reset({
          full_name: client.full_name,
          phone: client.phone,
          email: client.email || '',
          document_number: client.document_number || '',
          notes: client.notes || '',
        });
      } else {
        form.reset({
          full_name: '',
          phone: '',
          email: '',
          document_number: '',
          notes: '',
        });
      }
    }
  }, [open, client, form]);

  const handleSubmit = (data: FormData) => {
    onSave({
      full_name: data.full_name,
      phone: data.phone,
      email: data.email || null,
      document_number: data.document_number || null,
      notes: data.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {client ? t('admin.edit') : 'Добавить клиента'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ФИО</FormLabel>
                  <FormControl>
                    <Input placeholder="Иван Иванов" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('booking.phone')}</FormLabel>
                    <FormControl>
                      <Input placeholder="+7 777 123 45 67" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="document_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номер документа</FormLabel>
                  <FormControl>
                    <Input placeholder="ИИН / номер паспорта" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Заметки</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Дополнительная информация о клиенте..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('admin.save')}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
