

# План: Улучшение авторизации и система приглашений

## Проблемы и решения

### 1. Проблема с выходом из системы
**Текущая ситуация:** В AdminDashboard кнопка "Выйти" вызывает `signOut` напрямую без навигации. После выхода пользователь остаётся на странице `/admin/dashboard`, и система может перенаправить его обратно на `/auth` с ошибками.

**Решение:** Добавить явную навигацию на страницу входа после выхода.

### 2. Быстрое переключение аккаунтов
**Сценарий:** На одном компьютере работают 3-4 администратора. Им нужно быстро переключаться между учётными записями.

**Решение:** 
- Добавить кнопку "Сменить пользователя" в шапку дашборда
- Показывать текущего пользователя в шапке
- После выхода сразу показывать форму входа

### 3. Приглашение администраторов по email
**Текущая ситуация:** Владелец не может самостоятельно добавить администратора. Приходится обращаться к SuperAdmin.

**Решение:** Создать систему приглашений с отправкой email через Resend.

---

## Архитектура системы приглашений

```text
+------------------------+
| staff_invitations      |
+------------------------+
| id (uuid)              |
| hotel_id (uuid FK)     |
| email (text)           |
| token (uuid)           |  <- Уникальный токен для ссылки
| permissions (text[])   |  <- Предустановленные права
| invited_by (uuid FK)   |
| expires_at (timestamptz)|
| accepted_at (timestamptz)|
| status (pending/accepted/expired)
+------------------------+
```

---

## Изменения базы данных

### 1. Новая таблица: staff_invitations

```sql
CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  permissions text[] NOT NULL DEFAULT '{}',
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, email, status)
);

-- RLS: Владелец может управлять приглашениями
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage invitations"
ON public.staff_invitations FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  has_role(auth.uid(), 'owner')
);

-- Публичный доступ для проверки токена (для регистрации)
CREATE POLICY "Anyone can verify valid invitation token"
ON public.staff_invitations FOR SELECT
USING (
  status = 'pending' AND
  expires_at > now()
);
```

### 2. Функция принятия приглашения

```sql
CREATE OR REPLACE FUNCTION public.accept_invitation(
  _token uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Найти приглашение
  SELECT * INTO v_invitation
  FROM staff_invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();
  
  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Назначить роль admin
  UPDATE user_roles SET role = 'admin' WHERE user_id = _user_id;
  
  -- Привязать к отелю
  UPDATE profiles SET hotel_id = v_invitation.hotel_id WHERE user_id = _user_id;
  
  -- Создать права
  INSERT INTO staff_permissions (hotel_id, user_id, permissions)
  VALUES (v_invitation.hotel_id, _user_id, v_invitation.permissions)
  ON CONFLICT (hotel_id, user_id) DO UPDATE SET permissions = EXCLUDED.permissions;
  
  -- Отметить приглашение как принятое
  UPDATE staff_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;
END;
$$;
```

---

## Новые компоненты UI

### 1. Улучшенный хедер AdminDashboard

**Изменения в шапке:**
- Показывать имя текущего пользователя
- Добавить кнопку "Выйти" с иконкой
- Добавить кнопку "Сменить пользователя"

```text
+----------------------------------------------------------+
| [☰] Название отеля > Текущий раздел      👤 Иван Иванов  |
|                                          [🔄 Сменить] [🚪]|
+----------------------------------------------------------+
```

### 2. InviteStaffDialog.tsx
**Расположение:** `src/components/admin/InviteStaffDialog.tsx`

**Функционал:**
- Ввод email приглашаемого
- Выбор прав доступа (чекбоксы модулей)
- Отправка приглашения

**UI:**
```text
+--------------------------------------------------+
| Пригласить администратора               [X]      |
+--------------------------------------------------+
| Email:                                           |
| [admin@hotel.kz                        ]         |
|                                                  |
| Права доступа:                                   |
| [✓] Бронирования  [✓] Шахматка                  |
| [✓] Номера        [✓] Клиенты                   |
| [ ] Справочник услуг  [ ] Настройки             |
|                                                  |
| [Пресет: Базовый доступ ▼]                      |
+--------------------------------------------------+
|              [Отменить] [Отправить приглашение] |
+--------------------------------------------------+
```

### 3. Страница AcceptInvite.tsx
**Расположение:** `src/pages/AcceptInvite.tsx`
**Маршрут:** `/invite/:token`

**Сценарии:**
1. **Новый пользователь** — показать форму регистрации
2. **Существующий пользователь** — показать кнопку "Принять приглашение"
3. **Истёкший токен** — показать сообщение об ошибке

**UI для нового пользователя:**
```text
+--------------------------------------------------+
|        🏨 Приглашение в отель "Астана"           |
+--------------------------------------------------+
| Вас пригласили стать администратором отеля.      |
| Создайте аккаунт для продолжения:                |
|                                                  |
| Имя:       [                           ]         |
| Email:     [admin@hotel.kz            ] (locked) |
| Пароль:    [                           ]         |
|                                                  |
|              [Создать аккаунт и принять]         |
+--------------------------------------------------+
```

### 4. Edge Function: send-staff-invitation
**Расположение:** `supabase/functions/send-staff-invitation/index.ts`

**Функционал:**
- Принимает: email, hotelName, inviteUrl, invitedByName
- Отправляет красивое email через Resend
- Возвращает статус отправки

**Шаблон письма:**
```
Тема: Приглашение в отель "{hotelName}" — YesRoom

Здравствуйте!

{invitedByName} приглашает вас стать администратором отеля "{hotelName}" 
в системе управления YesRoom.

Чтобы принять приглашение, нажмите на кнопку ниже:

[Принять приглашение]

Ссылка действительна 7 дней.

С уважением,
Команда YesRoom
```

---

## Изменения существующих компонентов

### 1. AdminDashboard.tsx
**Изменения в хедере:**
```typescript
const handleSignOut = async () => {
  await signOut();
  navigate('/auth');
};

// В шапке:
<div className="flex items-center gap-3">
  <Avatar>
    <AvatarFallback>{profile?.full_name?.[0] || 'U'}</AvatarFallback>
  </Avatar>
  <div className="hidden sm:block">
    <p className="text-sm font-medium">{profile?.full_name}</p>
    <p className="text-xs text-muted-foreground">{isOwner ? 'Владелец' : 'Администратор'}</p>
  </div>
  <Button variant="ghost" size="icon" onClick={handleSignOut} title="Выйти">
    <LogOut className="h-4 w-4" />
  </Button>
</div>
```

### 2. StaffTab.tsx
**Изменения:**
- Заменить текущий диалог добавления на `InviteStaffDialog`
- Добавить список ожидающих приглашений
- Добавить возможность отменить/переотправить приглашение

### 3. Auth.tsx
**Изменения:**
- Проверять URL параметр `invite` при загрузке
- Если есть токен приглашения — показывать специальную форму
- После регистрации — автоматически принимать приглашение

### 4. App.tsx
**Изменения:**
- Добавить маршрут `/invite/:token` -> `AcceptInvite`

---

## Порядок реализации

| Этап | Задача | Файлы |
|------|--------|-------|
| 1 | Исправить logout в AdminDashboard | AdminDashboard.tsx |
| 2 | Миграция БД: staff_invitations | SQL миграция |
| 3 | Edge function для email | send-staff-invitation/index.ts |
| 4 | InviteStaffDialog | Новый компонент |
| 5 | Обновить StaffTab | Существующий компонент |
| 6 | AcceptInvite страница | Новая страница |
| 7 | Обновить маршруты | App.tsx |

---

## Требования для email отправки

Для отправки email через Resend потребуется:
1. Аккаунт на resend.com
2. Подтверждённый домен отправки
3. API ключ `RESEND_API_KEY`

---

## Безопасность

### Защита токенов:
- Токен — случайный UUID
- Срок действия — 7 дней
- Одноразовое использование
- RLS ограничивает доступ

### Валидация:
- Проверка email формата
- Проверка что email не зарегистрирован с ролью в этом отеле
- Серверная проверка в RPC функции

---

## Результат

После реализации:
1. Кнопка "Выйти" работает корректно и перенаправляет на страницу входа
2. В шапке отображается текущий пользователь для быстрой идентификации
3. Владелец может приглашать администраторов прямо из панели управления
4. Приглашённый получает email со ссылкой для регистрации
5. После регистрации по приглашению — автоматическое назначение прав

