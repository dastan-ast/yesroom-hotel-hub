import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Copy, Plus, Trash2, Key, ExternalLink, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ApiKey {
  id: string;
  name: string;
  api_key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface ApiKeysTabProps {
  hotelId: string;
}

// Secure hash function for API key using PBKDF2
// PBKDF2 with high iterations is computationally expensive, making brute-force attacks infeasible
// IMPORTANT: Must match the hash function in booking-webhook edge function
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  
  // Use a fixed salt for deterministic hashing (key lookup)
  // The salt is not secret - it just prevents rainbow table attacks
  const salt = encoder.encode("hotel-api-key-v1");
  
  // Import the key for PBKDF2
  const baseKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  // Derive bits using PBKDF2 with 100,000 iterations (OWASP recommended minimum)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    256 // 32 bytes = 256 bits
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'hk_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function ApiKeysTab({ hotelId }: ApiKeysTabProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'wzbnxtyygxenmxnwnmoj';
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/booking-webhook`;
  const roomTypesUrl = `https://${projectId}.supabase.co/functions/v1/room-types`;
  const leadsWebhookUrl = `https://${projectId}.supabase.co/functions/v1/leads-webhook`;

  useEffect(() => {
    fetchApiKeys();
  }, [hotelId]);

  const fetchApiKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hotel_api_keys')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Ошибка загрузки API ключей');
      console.error(error);
    } else {
      setApiKeys(data || []);
    }
    setLoading(false);
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Введите название ключа');
      return;
    }

    setIsCreating(true);
    const newKey = generateApiKey();
    const keyHash = await hashApiKey(newKey);
    const keyPrefix = newKey.substring(0, 7) + '...';

    const { error } = await supabase.from('hotel_api_keys').insert({
      hotel_id: hotelId,
      name: newKeyName.trim(),
      api_key_hash: keyHash,
      api_key_prefix: keyPrefix,
    });

    if (error) {
      toast.error('Ошибка создания ключа');
      console.error(error);
    } else {
      setGeneratedKey(newKey);
      setShowKey(true);
      fetchApiKeys();
      toast.success('API ключ создан');
    }
    setIsCreating(false);
  };

  const toggleKeyStatus = async (keyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('hotel_api_keys')
      .update({ is_active: !currentStatus })
      .eq('id', keyId);

    if (error) {
      toast.error('Ошибка обновления статуса');
    } else {
      fetchApiKeys();
      toast.success(currentStatus ? 'Ключ деактивирован' : 'Ключ активирован');
    }
  };

  const deleteApiKey = async (keyId: string) => {
    const { error } = await supabase.from('hotel_api_keys').delete().eq('id', keyId);

    if (error) {
      toast.error('Ошибка удаления ключа');
    } else {
      fetchApiKeys();
      toast.success('Ключ удален');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован`);
  };

  const closeDialogAndReset = () => {
    setDialogOpen(false);
    setNewKeyName('');
    setGeneratedKey(null);
    setShowKey(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">API Интеграции</h2>
          <p className="text-sm text-muted-foreground">
            Управляйте API ключами для интеграции с Telegram и WhatsApp ботами
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать ключ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {generatedKey ? 'API ключ создан' : 'Создать API ключ'}
              </DialogTitle>
              <DialogDescription>
                {generatedKey
                  ? 'Сохраните ключ сейчас. Он больше не будет показан!'
                  : 'Введите название для нового API ключа'}
              </DialogDescription>
            </DialogHeader>

            {!generatedKey ? (
              <>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="keyName">Название</Label>
                    <Input
                      id="keyName"
                      placeholder="Например: Telegram Bot"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialogAndReset}>
                    Отмена
                  </Button>
                  <Button onClick={createApiKey} disabled={isCreating}>
                    {isCreating ? 'Создание...' : 'Создать'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm break-all">
                        {showKey ? generatedKey : '•'.repeat(32)}
                      </code>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowKey(!showKey)}
                        >
                          {showKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(generatedKey, 'API ключ')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-destructive">
                    ⚠️ Этот ключ показывается только один раз. Сохраните его в безопасном месте!
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={closeDialogAndReset}>Готово</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* API Endpoints Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Эндпоинты API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">
              Создание бронирования (POST)
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                {webhookUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, 'URL')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Список типов номеров (GET)
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                {roomTypesUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(roomTypesUrl, 'URL')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Создание лида (POST)
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                {leadsWebhookUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(leadsWebhookUrl, 'URL')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Передайте API ключ в заголовке: <code>X-API-Key: your_key</code>
          </div>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : apiKeys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет API ключей</p>
              <p className="text-sm">Создайте ключ для интеграции с ботами</p>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{key.name}</span>
                      <Badge variant={key.is_active ? 'default' : 'secondary'}>
                        {key.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <code>{key.api_key_prefix}</code>
                      <span className="mx-2">•</span>
                      Создан: {formatDate(key.created_at)}
                      {key.last_used_at && (
                        <>
                          <span className="mx-2">•</span>
                          Использован: {formatDate(key.last_used_at)}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={() => toggleKeyStatus(key.id, key.is_active)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить API ключ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Это действие нельзя отменить. Все интеграции, использующие этот
                            ключ, перестанут работать.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteApiKey(key.id)}>
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Документация API</CardTitle>
          <CardDescription>Примеры использования для Telegram/WhatsApp ботов</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">GET /room-types - Получить типы номеров</Label>
              <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
{`curl -X GET "${roomTypesUrl}" \\
  -H "X-API-Key: hk_your_api_key"`}
              </pre>
            </div>
            
            <div>
              <Label className="text-sm font-medium">POST /booking-webhook - Создать бронирование</Label>
              <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: hk_your_api_key" \\
  -d '{
    "source": "telegram",
    "guest_name": "Иван Иванов",
    "guest_phone": "+77771234567",
    "check_in_date": "2026-01-15",
    "check_out_date": "2026-01-17",
    "room_type_id": "uuid-here",
    "guest_count": 2,
    "comment": "Ранний заезд",
    "external_id": "tg_msg_12345"
  }'`}
              </pre>
            </div>

            <div>
              <Label className="text-sm font-medium">POST /leads-webhook - Создать лид</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Только поле <code>phone</code> обязательно. Если <code>name</code> не передан, будет записано «Новый лид».
              </p>
              <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
{`curl -X POST "${leadsWebhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: hk_your_api_key" \\
  -d '{
    "phone": "+77771234567"
  }'`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">Полный пример со всеми полями:</p>
              <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
{`curl -X POST "${leadsWebhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: hk_your_api_key" \\
  -d '{
    "phone": "+77771234567",
    "name": "Иван Иванов",
    "source": "whatsapp",
    "notes": "Интересуется люксом на выходные"
  }'`}
              </pre>
              <div className="mt-3 p-3 bg-muted rounded-lg text-xs space-y-1">
                <p className="font-medium">Допустимые значения source:</p>
                <p><code>whatsapp</code> (по умолчанию), <code>telegram</code>, <code>phone</code>, <code>walk_in</code>, <code>website</code>, <code>other</code></p>
              </div>
              <div className="mt-3 p-3 bg-muted rounded-lg text-xs space-y-1">
                <p className="font-medium">Коды ответов:</p>
                <p><code>201</code> — лид создан успешно</p>
                <p><code>400</code> — невалидный телефон или отсутствует phone</p>
                <p><code>401</code> — неверный или отсутствующий API ключ</p>
                <p><code>403</code> — отель неактивен</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
