import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { Settings, Mail, Lock, User } from 'lucide-react';
import { useEffect } from 'react';

const emailSchema = z.object({
  newEmail: z.string().email('Введите корректный email'),
});

type EmailFormData = z.infer<typeof emailSchema>;

export default function AccountSettings() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: '' },
  });

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setIsPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        setPasswordResetSent(true);
        toast.success('Ссылка для сброса пароля отправлена на вашу почту');
      }
    } catch {
      toast.error('Произошла ошибка');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleEmailChange = async (data: EmailFormData) => {
    if (data.newEmail === user?.email) {
      toast.error('Новый email совпадает с текущим');
      return;
    }
    setIsEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: data.newEmail });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Письмо для подтверждения отправлено на новый email');
        emailForm.reset();
      }
    } catch {
      toast.error('Произошла ошибка');
    } finally {
      setIsEmailLoading(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Настройки аккаунта</h1>
        </div>

        {/* User Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4" />
              Информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Имя</span>
              <span className="font-medium">{profile?.full_name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Password Reset */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Смена пароля
            </CardTitle>
            <CardDescription>
              Мы отправим ссылку для сброса пароля на ваш текущий email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passwordResetSent ? (
              <p className="text-sm text-muted-foreground">
                ✅ Ссылка отправлена на <span className="font-medium text-foreground">{user.email}</span>. Проверьте почту.
              </p>
            ) : (
              <Button
                onClick={handlePasswordReset}
                disabled={isPasswordLoading}
                variant="outline"
                className="w-full"
              >
                {isPasswordLoading ? 'Отправка...' : 'Отправить ссылку для сброса'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Email Change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Смена email
            </CardTitle>
            <CardDescription>
              На новый email будет отправлено письмо для подтверждения.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(handleEmailChange)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Новый email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="new@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isEmailLoading} className="w-full">
                  {isEmailLoading ? 'Отправка...' : 'Изменить email'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
