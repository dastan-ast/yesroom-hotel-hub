import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Menu, X, Shield, Settings } from 'lucide-react';
import { useState } from 'react';
import logo from '@/assets/logo.png';

export function Navbar() {
  const { t } = useTranslation();
  const { user, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-primary">
            <img src={logo} alt="YesRoom" className="h-8 w-8" />
            {t('brand')}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.home')}
            </Link>
            <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Тарифы
            </Link>
            <Link to="/contacts" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Контакты
            </Link>
            <Link to="/presentation" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Презентация
            </Link>
            {isAdmin && (
              <Link to="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.dashboard')}
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            {user ? (
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/super-admin">
                      <Shield className="h-4 w-4 mr-2" />
                      Super Admin
                    </Link>
                  </Button>
                )}
                {isAdmin && !isSuperAdmin && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin">
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      {t('nav.admin')}
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/account">
                    <Settings className="h-4 w-4 mr-2" />
                    Настройки
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('nav.logout')}
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" asChild>
                <Link to="/auth">{t('nav.login')}</Link>
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t animate-fade-in">
            <div className="flex flex-col gap-4">
              <Link 
                to="/" 
                className="text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.home')}
              </Link>
              <Link 
                to="/pricing" 
                className="text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Тарифы
              </Link>
              <Link 
                to="/contacts" 
                className="text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Контакты
              </Link>
              <Link 
                to="/presentation" 
                className="text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Презентация
              </Link>
              {isAdmin && (
                <Link 
                  to="/admin" 
                  className="text-sm font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.dashboard')}
                </Link>
              )}
              <div className="flex items-center gap-3 pt-4 border-t">
                <LanguageSwitcher />
                {user ? (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/account" onClick={() => setMobileMenuOpen(false)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Настройки
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      {t('nav.logout')}
                    </Button>
                  </div>
                ) : (
                  <Button variant="default" size="sm" asChild>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      {t('nav.login')}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
