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
import { toast } from 'sonner';
import { Hotel } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export default function Auth() {
  const { t } = useTranslation();
  const { user, signIn, signUp, isAdmin, isSuperAdmin, hotelId, loading } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleMode = () => {
    loginForm.reset();
    signupForm.reset();
    setIsLogin(!isLogin);
  };

  useEffect(() => {
    if (user && !loading) {
      if (isSuperAdmin) {
        navigate('/super-admin');
      } else if (isAdmin && hotelId) {
        navigate('/admin/dashboard');
      } else if (isAdmin && !hotelId) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
    }
  }, [user, loading, isAdmin, isSuperAdmin, hotelId, navigate]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', fullName: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    if (error) {
      toast.error(error.message);
    }
    // Редирект произойдёт автоматически через useEffect
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
      toast.success('Регистрация успешна!');
      navigate('/onboarding');
    }
    setIsLoading(false);
  };

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
                  <FormField
                    control={signupForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.fullName')}</FormLabel>
                        <FormControl>
                          <Input placeholder="Иван Иванов" autoFocus {...field} />
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
