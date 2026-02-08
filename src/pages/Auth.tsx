import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Hotel, User, Building2, Mail } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  userType: z.enum(['guest', 'owner']),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export default function Auth() {
  const { t } = useTranslation();
  const { user, signIn, signUp, isAdmin, isSuperAdmin, hotelId, loading, roleLoading, role } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  const handleToggleMode = () => {
    loginForm.reset();
    signupForm.reset();
    setIsLogin(!isLogin);
  };

  useEffect(() => {
    if (user && !loading && !roleLoading && role !== null) {
      if (isSuperAdmin) {
        navigate('/super-admin', { replace: true });
      } else if (isAdmin && hotelId) {
        navigate('/admin/dashboard', { replace: true });
      } else if ((role === 'owner' || role === 'admin') && !hotelId) {
        navigate('/onboarding', { replace: true });
      } else if (role === 'guest') {
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, roleLoading, isAdmin, isSuperAdmin, hotelId, role, navigate]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', fullName: '', userType: 'guest' },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        toast.error('Подтвердите email перед входом. Проверьте почту.');
      } else {
        toast.error(error.message);
      }
    }
    setIsLoading(false);
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Этот email уже зарегистрирован');
      } else {
        toast.error(error.message);
      }
    } else {
      setEmailSent(data.email);
    }
    setIsLoading(false);
  };

  const selectedUserType = signupForm.watch('userType');

  if (emailSent) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <main className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Card className="w-full max-w-md animate-scale-in text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="font-display text-2xl">Проверьте почту</CardTitle>
              <CardDescription className="text-base mt-2">
                Мы отправили письмо на{' '}
                <span className="font-medium text-foreground">{emailSent}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Перейдите по ссылке в письме для подтверждения аккаунта. После этого вы сможете войти.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEmailSent(null);
                  setIsLogin(true);
                }}
              >
                Вернуться ко входу
              </Button>
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
              <Hotel className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="font-display text-2xl">
              {isLogin ? t('auth.login') : t('auth.signup')}
            </CardTitle>
            <CardDescription>
              YesRoom - {t('hero.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLogin ? (
              <Form {...loginForm} key="login-form">
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.email')}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@example.com" autoFocus {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.password')}</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t('common.loading') : t('auth.loginButton')}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...signupForm} key="signup-form">
                <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                  {/* Role Selection */}
                  <FormField
                    control={signupForm.control}
                    name="userType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Я хочу:</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-3"
                          >
                            <div>
                              <RadioGroupItem
                                value="guest"
                                id="guest"
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor="guest"
                                className={`flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                                  selectedUserType === 'guest'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted hover:border-primary/50'
                                }`}
                              >
                                <User className={`h-6 w-6 mb-2 ${selectedUserType === 'guest' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className={`text-sm font-medium ${selectedUserType === 'guest' ? 'text-primary' : ''}`}>
                                  Бронировать
                                </span>
                                <span className="text-xs text-muted-foreground text-center mt-1">
                                  Искать и бронировать отели
                                </span>
                              </Label>
                            </div>
                            <div>
                              <RadioGroupItem
                                value="owner"
                                id="owner"
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor="owner"
                                className={`flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                                  selectedUserType === 'owner'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted hover:border-primary/50'
                                }`}
                              >
                                <Building2 className={`h-6 w-6 mb-2 ${selectedUserType === 'owner' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className={`text-sm font-medium ${selectedUserType === 'owner' ? 'text-primary' : ''}`}>
                                  Мой отель
                                </span>
                                <span className="text-xs text-muted-foreground text-center mt-1">
                                  Зарегистрировать отель
                                </span>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.fullName')}</FormLabel>
                        <FormControl>
                          <Input placeholder="Иван Иванов" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.email')}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.password')}</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t('common.loading') : t('auth.signupButton')}
                  </Button>
                </form>
              </Form>
            )}

            <div className="mt-6 text-center text-sm">
              {isLogin ? (
                <p>
                  {t('auth.noAccount')}{' '}
                  <button
                    type="button"
                    onClick={handleToggleMode}
                    className="text-primary font-medium hover:underline"
                  >
                    {t('auth.signup')}
                  </button>
                </p>
              ) : (
                <p>
                  {t('auth.hasAccount')}{' '}
                  <button
                    type="button"
                    onClick={handleToggleMode}
                    className="text-primary font-medium hover:underline"
                  >
                    {t('auth.login')}
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}