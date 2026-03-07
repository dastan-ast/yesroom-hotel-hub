import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Hotel, User, Building2, Mail, Lock } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  userType: z.enum(['guest', 'owner']),
});

const newPasswordSchema = z.object({
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type NewPasswordFormData = z.infer<typeof newPasswordSchema>;

export default function Auth() {
  const { t } = useTranslation();
  const { user, signIn, signUp, isAdmin, isSuperAdmin, hotelId, loading, roleLoading, role } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isNewPasswordLoading, setIsNewPasswordLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleToggleMode = () => {
    loginForm.reset();
    signupForm.reset();
    setIsLogin(!isLogin);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isRecoveryMode) return; // don't redirect during password recovery
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
  }, [user, loading, roleLoading, isAdmin, isSuperAdmin, hotelId, role, navigate, isRecoveryMode]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', fullName: '', userType: 'guest' },
  });

  const newPasswordForm = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleNewPassword = async (data: NewPasswordFormData) => {
    setIsNewPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Пароль успешно изменён');
        setIsRecoveryMode(false);
        navigate('/', { replace: true });
      }
    } catch {
      toast.error('Произошла ошибка');
    } finally {
      setIsNewPasswordLoading(false);
    }
  };

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

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast.error('Введите email');
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Ссылка для сброса пароля отправлена на вашу почту');
        setIsForgotPassword(false);
        setForgotEmail('');
      }
    } catch {
      toast.error('Произошла ошибка');
    } finally {
      setForgotLoading(false);
    }
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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast.error(error.message);
      }
    } catch (e) {
      toast.error('Ошибка входа через Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <main className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Card className="w-full max-w-md animate-scale-in">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle className="font-display text-2xl">Новый пароль</CardTitle>
              <CardDescription>Введите новый пароль для вашего аккаунта</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...newPasswordForm}>
                <form onSubmit={newPasswordForm.handleSubmit(handleNewPassword)} className="space-y-4">
                  <FormField
                    control={newPasswordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Новый пароль</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" autoFocus {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newPasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Подтвердите пароль</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isNewPasswordLoading}>
                    {isNewPasswordLoading ? 'Сохранение...' : 'Сохранить пароль'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
              <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                💡 Не нашли письмо? Проверьте папку «Спам» или «Нежелательная почта». Иногда письма попадают туда.
              </div>
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">или</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isGoogleLoading ? t('common.loading') : 'Войти через Google'}
            </Button>

            <div className="mt-4 text-center text-sm">
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