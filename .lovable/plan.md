
# План: Улучшение модуля Бронирования и Шахматки

## Задача 1: Модуль "Бронирование" (BookingsTab + i18n)

### 1.1 Переименование
- Изменить `bookingQueue` → `"Бронирование"` в трёх файлах локализации: `ru.json`, `en.json`, `kz.json`
- Затронутые места: заголовок вкладки в сайдбаре, заголовок страницы, h2 внутри `BookingsTab`, хлебные крошки в header

### 1.2 Замена фильтра статусов — из `<Select>` в горизонтальные вкладки-таблетки
Заменить `<Select value={statusFilter}>` на ряд кнопок-фильтров в порядке жизненного цикла:

```
[ Все ] [ Ожидает ] [ Подтверждено ] [ Заселён ] [ Выселен ] [ Отменено ]
```

- Активная вкладка — выделяется цветом статуса (yellow / blue / green / gray / red)
- При клике — фильтрует список (как раньше через `statusFilter`)
- На вкладке "Ожидает" — бейдж с количеством pending-записей для визуального акцента

### 1.3 Пагинация (страницы по 20 записей)
Добавить пагинацию к `filteredGroups`:

- Константа `PAGE_SIZE = 20`
- Состояние `currentPage` (сбрасывается при смене фильтра или поискового запроса)
- `paginatedGroups = filteredGroups.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE)`
- Под списком — компонент `<Pagination>` из shadcn/ui с кнопками Prev/Next и номерами страниц
- Показывать только если `filteredGroups.length > PAGE_SIZE`

---

## Задача 2: Шахматка (ShahmatkaGrid)

### 2.1 Кнопка "+ Бронирование" слева
Текущее расположение: кнопка справа в панели управления.

**Изменение:** перенести кнопку в левую часть панели управления (перед навигацией или как первый элемент слева), сделать её более заметной — добавить `variant="default"` и полное название "Новое бронирование".

```
[ + Новое бронирование ]  [ < Сегодня > ]  [ Только активные ]
```

### 2.2 Бронирование занимает всю ширину ячейки дня
**Текущее поведение:** каждая ячейка дня делится на `left` (половина) и `right` (половина) для отображения заезда/выезда в один день.

**Проблема:** бронирование, занимающее весь день (не день заезда/выезда), отображается только на половину ячейки, визуально теряясь.

**Изменение логики отображения:**
- Если `left === right` (одно и то же бронирование на весь день — "isBetween") → рендерить один `div` на всю ширину (`w-full`) вместо двух половин
- Если `left !== right` (разные брони или только заезд/выезд) → оставить текущую логику split (50%/50%)
- Если одна из половин пустая, а другая занята → занятая половина остаётся 50%, пустая — пустая

### 2.3 Tooltip при наведении на бронь
Обернуть каждый цветной блок бронирования в `<Tooltip>` из shadcn/ui.

Содержимое тултипа:
```
Имя гостя: Иванов Иван
Статус: Заселён
Заезд: 15.02 — Выезд: 18.02
Тип номера: [если есть]
```

**Реализация:**
- `TooltipProvider` уже есть на уровне компонента (`delayDuration={200}`)
- Для каждого блока (left/right) если бронирование есть → обернуть в `<Tooltip><TooltipTrigger>...<TooltipContent>...</TooltipContent></Tooltip>`
- Данные для tooltip: `booking.guest_name`, `statusLabelsRu[booking.status]`, даты check_in/check_out
- Так как tooltip нужен и для левой и для правой половины, вынести рендер половины в отдельную inline-функцию `renderHalf(booking, side)`

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/i18n/locales/ru.json` | `bookingQueue: "Бронирование"` |
| `src/i18n/locales/en.json` | `bookingQueue: "Bookings"` |
| `src/i18n/locales/kz.json` | `bookingQueue: "Брондаулар"` |
| `src/components/admin/BookingsTab.tsx` | Вкладки-фильтры вместо Select + пагинация |
| `src/components/admin/ShahmatkaGrid.tsx` | Кнопка слева + полная ширина ячейки + tooltip |

---

## Технические детали

**Пагинация — сброс при фильтре:**
```typescript
useEffect(() => { setCurrentPage(1); }, [statusFilter, searchQuery]);
```

**Шахматка — логика ячейки (упрощённо):**
```typescript
// Если left и right — одна и та же бронь → полная ширина
if (left && right && left.id === right.id) {
  return <div className="w-full ..."> ... </div>
}
// Иначе — split
return (
  <div className="flex">
    <div className="w-1/2 ..."> {left ? ... : null} </div>
    <div className="w-1/2 ..."> {right ? ... : null} </div>
  </div>
)
```

**Tooltip содержимое:**
```tsx
<TooltipContent side="top">
  <p className="font-semibold">{booking.guest_name}</p>
  <p className="text-xs">{statusLabelsRu[booking.status]}</p>
  <p className="text-xs">{format(parseISO(booking.check_in_date), 'dd.MM')} – {format(parseISO(booking.check_out_date), 'dd.MM.yy')}</p>
</TooltipContent>
```
