
# План: Система управления правами доступа для администраторов

## Обзор решения

Реализуем гибкую систему прав доступа, позволяющую владельцам отелей контролировать, какие разделы и функции видят их администраторы.

### Принцип работы:
- **Владелец (owner)** — видит все разделы и может управлять правами администраторов
- **Администратор (admin)** — видит только те разделы, которые разрешил владелец
- **SuperAdmin** — полный доступ ко всему

---

## Архитектура прав доступа

### Модули системы (permissions):

| Код модуля | Название (RU) | Описание |
|------------|---------------|----------|
| `dashboard` | Дашборд | Главная страница со статистикой |
| `bookings` | Бронирования | Очередь бронирований, заселение/выселение |
| `shahmatka` | Шахматка | Календарная сетка занятости |
| `rooms` | Номера | Управление номерным фондом |
| `room_types` | Типы номеров | Категории и цены |
| `clients` | Клиенты | База гостей |
| `services` | Журнал услуг | Добавление услуг к бронированиям |
| `service_catalog` | Справочник услуг | Настройка прейскуранта |
| `integrations` | Интеграции | API ключи |
| `settings` | Настройки | Настройки отеля |
| `staff` | Персонал | Управление администраторами (только owner) |

---

## Изменения базы данных

### 1. Новая таблица: staff_permissions

```sql
CREATE TABLE public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, user_id)
);

-- RLS: Владелец может управлять, администратор может читать свои
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage staff permissions"
ON public.staff_permissions FOR ALL
USING (
  hotel_id = get_user_hotel_id(auth.uid()) AND
  has_role(auth.uid(), 'owner')
);

CREATE POLICY "Staff can read own permissions"
ON public.staff_permissions FOR SELECT
USING (user_id = auth.uid());
```

### 2. RPC функция для проверки прав

```sql
CREATE OR REPLACE FUNCTION public.check_permission(
  _user_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- SuperAdmin и Owner имеют все права
    WHEN has_role(_user_id, 'superadmin') THEN true
    WHEN has_role(_user_id, 'owner') THEN true
    -- Администратор проверяется по таблице permissions
    WHEN has_role(_user_id, 'admin') THEN EXISTS (
      SELECT 1 FROM staff_permissions
      WHERE user_id = _user_id
        AND _permission = ANY(permissions)
    )
    ELSE false
  END
$$;
```

---

## Новые компоненты UI

### 1. StaffTab.tsx — Управление персоналом
**Расположение:** `src/components/admin/StaffTab.tsx`

**Доступ:** Только для owner

**Функционал:**
- Список сотрудников отеля (role = admin)
- Добавление нового администратора (по email)
- Управление правами каждого сотрудника
- Удаление сотрудника из отеля

**UI:**
```text
+--------------------------------------------------+
| Персонал                      [+ Добавить]       |
+--------------------------------------------------+
| Имя              | Права доступа       | Действия|
+--------------------------------------------------+
| Асем Жумабаева   | Бронирования,       | [✏️] [🗑]|
|                  | Номера, Клиенты     |         |
+--------------------------------------------------+
| Серик Ермеков    | Только просмотр     | [✏️] [🗑]|
+--------------------------------------------------+
```

### 2. StaffPermissionsDialog.tsx — Редактирование прав
**Расположение:** `src/components/admin/StaffPermissionsDialog.tsx`

**Функционал:**
- Чекбоксы для каждого модуля
- Пресеты: "Полный доступ", "Только просмотр", "Бронирования"
- Сохранение в staff_permissions

**UI:**
```text
+--------------------------------------------------+
| Права доступа: Асем Жумабаева              [X]   |
+--------------------------------------------------+
| Пресеты: [Полный доступ] [Только просмотр]       |
+--------------------------------------------------+
| [✓] Дашборд           [✓] Бронирования           |
| [✓] Шахматка          [✓] Номера                 |
| [ ] Типы номеров      [✓] Клиенты                |
| [✓] Журнал услуг      [ ] Справочник услуг       |
| [ ] Интеграции        [ ] Настройки              |
+--------------------------------------------------+
|                    [Сохранить]                   |
+--------------------------------------------------+
```

### 3. usePermissions.ts — Хук для проверки прав
**Расположение:** `src/hooks/usePermissions.ts`

**Функционал:**
```typescript
interface UsePermissionsReturn {
  permissions: string[];
  loading: boolean;
  hasPermission: (key: string) => boolean;
  canAccessModule: (moduleId: string) => boolean;
}

export function usePermissions() {
  const { user, role, isOwner, isSuperAdmin, hotelId } = useAuth();
  
  // Owner и SuperAdmin имеют все права
  if (isOwner || isSuperAdmin) {
    return { 
      permissions: ALL_MODULES, 
      hasPermission: () => true,
      canAccessModule: () => true 
    };
  }
  
  // Для admin — загружаем из БД
  // ...fetch from staff_permissions
}
```

---

## Изменения существующих компонентов

### 1. AdminDashboard.tsx

**Изменения:**
- Импортировать `usePermissions`
- Фильтровать `menuItems` по правам доступа
- Добавить пункт "Персонал" для owner
- Скрывать недоступные разделы

```typescript
const { canAccessModule, isOwner } = usePermissions();

const menuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Дашборд', permission: 'dashboard' },
  { id: 'bookings', icon: CalendarDays, label: 'Бронирования', permission: 'bookings' },
  // ...
  { id: 'staff', icon: Users, label: 'Персонал', permission: 'staff', ownerOnly: true },
].filter(item => {
  if (item.ownerOnly && !isOwner) return false;
  return canAccessModule(item.permission);
});
```

### 2. AuthContext.tsx

**Добавить:**
- Загрузку permissions при авторизации
- Метод `refreshPermissions()`
- Экспорт прав в контекст

---

## Логика прав по умолчанию

При назначении роли "admin" через `assign_user_role`:

```sql
-- Создать запись с базовыми правами
INSERT INTO staff_permissions (hotel_id, user_id, permissions)
VALUES (_hotel_id, _target_user_id, 
  ARRAY['dashboard', 'bookings', 'shahmatka', 'rooms', 'clients', 'services']
)
ON CONFLICT (hotel_id, user_id) DO NOTHING;
```

**Базовый набор прав для нового администратора:**
- Дашборд
- Бронирования
- Шахматка
- Номера
- Клиенты
- Журнал услуг

**НЕ включены по умолчанию:**
- Типы номеров (цены)
- Справочник услуг (цены)
- Интеграции (API ключи)
- Настройки отеля

---

## Порядок реализации

| Этап | Задача | Файлы |
|------|--------|-------|
| 1 | Миграция БД: staff_permissions + RPC | SQL миграция |
| 2 | usePermissions hook | Новый файл |
| 3 | StaffTab компонент | Новый компонент |
| 4 | StaffPermissionsDialog | Новый компонент |
| 5 | Интеграция в AdminDashboard | Существующий компонент |
| 6 | Обновить assign_user_role RPC | SQL миграция |

---

## Безопасность

### RLS на уровне БД:
- `staff_permissions` защищена RLS
- Owner может управлять записями своего hotel_id
- Admin может только читать свою запись

### Проверка на клиенте:
- `usePermissions` hook скрывает UI элементы
- Двойная проверка: UI + RLS на сервере

### Защита от эскалации:
- Только owner может редактировать права
- SuperAdmin обходит все проверки
- Функция `check_permission` — SECURITY DEFINER

---

## Результат

После реализации:
1. Владелец видит новый раздел "Персонал" в меню
2. Владелец может добавлять администраторов и настраивать их права
3. Администраторы видят только разрешённые разделы
4. Права проверяются и на UI, и на уровне БД
5. Новые администраторы получают базовый набор прав автоматически
