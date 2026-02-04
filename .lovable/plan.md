
# План исправления проблем авторизации

## Проблема 1: Выход из системы не работает

### Причина
Сервер возвращает ошибку 403 "Session not found" при попытке выхода, если сессия уже истекла или была удалена. Текущий код не обрабатывает эту ситуацию корректно - состояние `user` и `session` остаются в React-контексте.

### Решение
Изменить функцию `signOut` в `AuthContext.tsx`:

```typescript
const signOut = async () => {
  // Всегда очищаем локальное состояние, даже если сервер вернул ошибку
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.warn('Logout error (ignoring):', error);
  }
  
  // Принудительно очищаем состояние
  setUser(null);
  setSession(null);
  setRole(null);
  setHotelId(null);
  setProfile(null);
};
```

---

## Проблема 2: После входа всегда редирект на главную

### Причина
Есть race condition между загрузкой роли и редиректом. Когда `roleLoading` завершается, условия проверяются слишком рано или неправильно, и пользователь попадает в default case (`navigate('/')`).

### Решение

1. **Улучшить логику в Auth.tsx**:
   - Дождаться полной загрузки роли
   - Добавить задержку перед редиректом для стабилизации состояния
   - Использовать более надёжные проверки

2. **Убрать конфликтующий редирект из Index.tsx**:
   - Главная страница не должна редиректить авторизованных пользователей
   - Это создаёт бесконечный цикл редиректов

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/contexts/AuthContext.tsx` | Улучшение функции signOut для обработки 403 ошибок |
| `src/pages/Auth.tsx` | Исправление логики редиректа после входа |
| `src/pages/Index.tsx` | Удаление автоматического редиректа для админов |

---

## Техническая реализация

### 1. AuthContext.tsx - улучшенный signOut

```typescript
const signOut = async () => {
  // Сначала очищаем локальное состояние
  setUser(null);
  setSession(null);
  setRole(null);
  setHotelId(null);
  setProfile(null);
  
  // Затем пытаемся выйти на сервере (игнорируем ошибки)
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    // Игнорируем - состояние уже очищено
  }
};
```

### 2. Auth.tsx - исправленный редирект

```typescript
useEffect(() => {
  if (user && !loading && !roleLoading && role !== null) {
    // Редирект только когда роль действительно загружена
    if (isSuperAdmin) {
      navigate('/super-admin', { replace: true });
    } else if (isAdmin && hotelId) {
      navigate('/admin/dashboard', { replace: true });
    } else if ((role === 'owner' || role === 'admin') && !hotelId) {
      navigate('/onboarding', { replace: true });
    } else if (role === 'guest') {
      navigate('/', { replace: true });
    }
    // Не редиректим если роль не определена
  }
}, [user, loading, roleLoading, role, isAdmin, isSuperAdmin, hotelId, navigate]);
```

### 3. Index.tsx - удалить редирект

Убрать useEffect с редиректом админов (строки 33-44). Редирект должен происходить только из Auth.tsx.

---

## Ожидаемый результат

- Кнопка "Выход" всегда работает, даже если сессия истекла на сервере
- После входа пользователи корректно перенаправляются:
  - SuperAdmin → `/super-admin`
  - Owner/Admin с отелем → `/admin/dashboard`
  - Owner/Admin без отеля → `/onboarding`
  - Guest → `/` (главная)
