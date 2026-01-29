import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { Building2, Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';

const signupSchema = z.object({
  fullName: z.string().min(2, 'Минимум 2 символа').max(100),
  password: z.string().min(6, 'Минимум 6 символов'),
});

type SignupFormData = z.infer<typeof signupSchema>;

interface InvitationData {
  id: string;
  email: string;
  hotel_name: string;
  hotel_id: string;
  permissions: string[];
  status: string;
  expires_at: string;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', password: '' },
  });

  useEffect(() => {
    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_invitations')
        .select(`
          id,
          email,
          permissions,
          status,
          expires_at,
          hotel_id,
          hotels!inner(name)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        setError('Приглашение не найдено');
        return;
      }

      if (data.status !== 'pending') {
        setError('Это приглашение уже использовано');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('Срок действия приглашения истёк');
        return;
      }

      setInvitation({
        id: data.id,
        email: data.email,
        hotel_name: (data.hotels as any)?.name || 'Отель',
        hotel_id: data.hotel_id,
        permissions: data.permissions,
        status: data.status,
        expires_at: data.expires_at,
      });
    } catch (err) {
      console.error('Error fetching invitation:', err);
      setError('Ошибка загрузки приглашения');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAsExistingUser = async () => {
    if (!user || !invitation) return;

    setAccepting(true);
    try {
      const { error } = await supabase.rpc('accept_invitation', {
        _token: token,
        _user_id: user.id,
      });

      if (error) throw error;

      toast.success('Приглашение принято! Добро пожаловать в команду!');
      await refreshProfile();
      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Accept error:', err);
      toast.error('Ошибка: ' + err.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleSignupAndAccept = async (data: SignupFormData) => {
    if (!invitation) return;

    setAccepting(true);
    try {
      // Register new user
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: invitation.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/invite/${token}`,
          data: { full_name: data.fullName },
        },
      });

      if (signupError) throw signupError;

      if (!authData.user) {
        toast.info('Проверьте почту для подтверждения регистрации');
        return;
      }

      // Accept invitation
      const { error: acceptError } = await supabase.rpc('accept_invitation', {
        _token: token,
        _user_id: authData.user.id,
      });

      if (acceptError) throw acceptError;

      toast.success('Регистрация успешна! Добро пожаловать в команду!');
      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.message.includes('already registered')) {
        toast.error('Этот email уже зарегистрирован. Войдите в аккаунт.');
      } else {
        toast.error('Ошибка: ' + err.message);
      }
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <main className="container mx-auto px-4 py-12 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Загрузка приглашения...
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <main className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-semibold mb-2">Ошибка</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => navigate('/')}>На главную</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="container mx-auto px-4 py-12 flex items-center justify-center">
        <Card className="w-full max-w-md animate-scale-in">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="font-display text-2xl">
              Приглашение в отель
            </CardTitle>
            <CardDescription className="text-lg font-medium text-foreground">
              {invitation?.hotel_name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground mb-6">
              Вас пригласили стать администратором отеля. 
              {user 
                ? ' Нажмите кнопку ниже, чтобы принять приглашение.'
                : ' Создайте аккаунт для продолжения.'}
            </p>

            {user ? (
              // Existing user flow
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Вы вошли как:</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleAcceptAsExistingUser}
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Принятие...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Принять приглашение
                    </>
                  )}
                </Button>
              </div>
            ) : (
              // New user signup flow
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSignupAndAccept)} className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Email:</p>
                    <p className="font-medium">{invitation?.email}</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ваше имя</FormLabel>
                        <FormControl>
                          <Input placeholder="Иван Иванов" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Пароль</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={accepting}>
                    {accepting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Регистрация...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Создать аккаунт и принять
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}

            {!user && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Уже есть аккаунт?{' '}
                <button
                  onClick={() => navigate('/auth')}
                  className="text-primary font-medium hover:underline"
                >
                  Войти
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
