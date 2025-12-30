import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Building2, RefreshCw, Home } from 'lucide-react';

export default function PendingApproval() {
  const { user, hotelId } = useAuth();
  const navigate = useNavigate();
  const [hotelName, setHotelName] = useState<string>('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const fetchHotelInfo = async () => {
      if (!hotelId) return;
      
      const { data } = await supabase
        .from('hotels')
        .select('name, status')
        .eq('id', hotelId)
        .maybeSingle();
      
      if (data) {
        setHotelName(data.name);
        // If approved, redirect to admin
        if (data.status === 'active') {
          navigate('/admin/dashboard');
        }
      }
    };

    fetchHotelInfo();
  }, [hotelId, navigate]);

  const handleCheckStatus = async () => {
    setChecking(true);
    
    if (!hotelId) {
      setChecking(false);
      return;
    }

    const { data } = await supabase
      .from('hotels')
      .select('status')
      .eq('id', hotelId)
      .maybeSingle();
    
    if (data?.status === 'active') {
      navigate('/admin/dashboard');
    } else if (data?.status === 'rejected') {
      navigate('/');
    }
    
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-display">Ожидание подтверждения</CardTitle>
          <CardDescription className="text-base">
            {hotelName ? (
              <>Ваш отель <strong>"{hotelName}"</strong> находится на рассмотрении</>
            ) : (
              'Ваша заявка находится на рассмотрении'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-left">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Что происходит?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Наша команда проверяет информацию о вашем отеле. Как только заявка будет одобрена, 
                  вы получите полный доступ к панели управления.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Обычно проверка занимает до 24 часов
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleCheckStatus} 
              disabled={checking}
              className="w-full"
            >
              {checking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Проверить статус
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              <Home className="h-4 w-4 mr-2" />
              На главную
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
