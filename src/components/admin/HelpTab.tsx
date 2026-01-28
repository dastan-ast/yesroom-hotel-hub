import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Printer, 
  FileText, 
  BedDouble, 
  DoorOpen, 
  CalendarDays, 
  Grid3X3, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Home,
  Wrench,
  AlertCircle,
  PhoneCall,
  Plus
} from 'lucide-react';

export function HelpTab() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="help-content max-w-4xl mx-auto space-y-8">
      {/* Header with print button */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-display font-bold">Руководство администратора</h1>
          <p className="text-muted-foreground">Полная инструкция по управлению отелем</p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Скачать PDF
        </Button>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block print:mb-8">
        <h1 className="text-3xl font-bold text-center">YesRoom</h1>
        <p className="text-xl text-center text-muted-foreground">Руководство администратора</p>
        <Separator className="my-4" />
      </div>

      {/* Table of Contents */}
      <Card className="print:shadow-none print:border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Содержание
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li><a href="#section-start" className="text-primary hover:underline">Начало работы</a></li>
            <li><a href="#section-room-types" className="text-primary hover:underline">Создание типов номеров</a></li>
            <li><a href="#section-rooms" className="text-primary hover:underline">Добавление номеров</a></li>
            <li><a href="#section-bookings" className="text-primary hover:underline">Управление бронированиями</a></li>
            <li><a href="#section-shahmatka" className="text-primary hover:underline">Работа с Шахматкой</a></li>
            <li><a href="#section-clients" className="text-primary hover:underline">Клиентская база</a></li>
            <li><a href="#section-statuses" className="text-primary hover:underline">Справочник статусов</a></li>
          </ol>
        </CardContent>
      </Card>

      {/* Section 1: Getting Started */}
      <section id="section-start" className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              1. Начало работы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Добро пожаловать в систему управления отелем YesRoom! Для начала работы 
              вам необходимо настроить структуру номерного фонда в следующем порядке:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li><strong>Создайте типы номеров</strong> — категории номеров с ценами и удобствами</li>
              <li><strong>Добавьте номера</strong> — конкретные комнаты, привязанные к типам</li>
              <li><strong>Начните принимать бронирования</strong> — через сайт или вручную</li>
            </ol>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                <strong>Важно:</strong> Сначала создайте типы номеров, затем добавляйте номера. 
                Без типов невозможно создать номер.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: Room Types */}
      <section id="section-room-types" className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5" />
              2. Создание типов номеров
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Типы номеров — это категории (Стандарт, Люкс, Семейный и т.д.) с общими 
              характеристиками: ценой, вместимостью и удобствами.
            </p>
            
            <h4 className="font-semibold">Как создать тип номера:</h4>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Перейдите в раздел <strong>«Типы номеров»</strong> в боковом меню</li>
              <li>Нажмите кнопку <strong>«Добавить тип»</strong></li>
              <li>Заполните форму:
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li><strong>Название</strong> — например, «Стандартный двухместный»</li>
                  <li><strong>Цена за ночь</strong> — стоимость проживания</li>
                  <li><strong>Вместимость</strong> — максимальное число гостей</li>
                  <li><strong>Описание</strong> — краткое описание для гостей</li>
                  <li><strong>Удобства</strong> — Wi-Fi, кондиционер, мини-бар и т.д.</li>
                  <li><strong>Фотографии</strong> — загрузите изображения номера</li>
                </ul>
              </li>
              <li>Нажмите <strong>«Сохранить»</strong></li>
            </ol>

            {/* Placeholder for screenshot */}
            <div className="help-screenshot bg-muted border-2 border-dashed rounded-lg p-8 text-center">
              <BedDouble className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Скриншот: Форма создания типа номера</p>
              <p className="text-xs text-muted-foreground mt-1">Путь: public/help/help-room-types.png</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 3: Rooms */}
      <section id="section-rooms" className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              3. Добавление номеров
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Номера — это конкретные комнаты в вашем отеле. Каждый номер привязывается 
              к одному из созданных типов.
            </p>
            
            <h4 className="font-semibold">Как добавить номер:</h4>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Перейдите в раздел <strong>«Номера»</strong></li>
              <li>Нажмите <strong>«Добавить номер»</strong></li>
              <li>Укажите:
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li><strong>Номер комнаты</strong> — например, «101», «205A»</li>
                  <li><strong>Тип номера</strong> — выберите из созданных ранее</li>
                  <li><strong>Этаж</strong> — для удобной навигации</li>
                  <li><strong>Заметки</strong> — внутренние комментарии</li>
                </ul>
              </li>
              <li>Нажмите <strong>«Сохранить»</strong></li>
            </ol>

            {/* Placeholder for screenshot */}
            <div className="help-screenshot bg-muted border-2 border-dashed rounded-lg p-8 text-center">
              <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Скриншот: Сетка номеров с цветовой кодировкой</p>
              <p className="text-xs text-muted-foreground mt-1">Путь: public/help/help-rooms.png</p>
            </div>

            <h4 className="font-semibold mt-6">Статусы номеров:</h4>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span><strong>Свободен</strong> — можно бронировать</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <span><strong>Забронирован</strong> — ожидает заселения</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                <span><strong>Занят</strong> — гость проживает</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span><strong>Ремонт</strong> — недоступен для брони</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 4: Bookings */}
      <section id="section-bookings" className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              4. Управление бронированиями
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p>
              Бронирования поступают из онлайн-формы на сайте или создаются вручную 
              администратором.
            </p>

            {/* 4.1 New booking from web */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                Новая заявка с сайта
              </h4>
              <p className="ml-8">
                Когда гость оставляет заявку на сайте, она появляется в 
                <strong> «Ленте заявок»</strong> (справа) со статусом <Badge className="status-pending">Ожидает</Badge>
              </p>
            </div>

            {/* 4.2 Manual booking */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                Ручное бронирование
              </h4>
              <ol className="list-decimal list-inside space-y-2 ml-8">
                <li>В разделе <strong>«Бронирования»</strong> нажмите <strong>«+ Новое бронирование»</strong></li>
                <li>Заполните данные гостя (имя, телефон)</li>
                <li>Выберите даты заезда и выезда</li>
                <li>Укажите тип номера и количество гостей</li>
                <li>При необходимости отметьте предоплату</li>
                <li>Нажмите <strong>«Создать бронь»</strong></li>
              </ol>

              {/* Placeholder for screenshot */}
              <div className="help-screenshot bg-muted border-2 border-dashed rounded-lg p-8 text-center ml-8">
                <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Скриншот: Форма ручного бронирования</p>
                <p className="text-xs text-muted-foreground mt-1">Путь: public/help/help-manual-booking.png</p>
              </div>
            </div>

            {/* 4.3 Room assignment */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                Назначение номера
              </h4>
              <p className="ml-8">
                Для подтверждения брони нужно назначить конкретный номер:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-8">
                <li>Найдите бронь в списке или ленте</li>
                <li>Нажмите <strong>«Назначить номер»</strong></li>
                <li>Выберите свободный номер из списка</li>
                <li>Подтвердите выбор</li>
              </ol>
              <p className="ml-8 text-muted-foreground text-sm">
                Также можно нажать <strong>«Быстрое подтверждение»</strong> — бронь будет одобрена 
                без назначения номера (номер можно выбрать позже).
              </p>
            </div>

            {/* 4.4 Check-in / Check-out */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
                Заселение и выселение
              </h4>
              <div className="ml-8 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Заселение (Check-in)</strong>
                    <p className="text-sm text-muted-foreground">
                      Нажмите «Заселить» — статус брони изменится на 
                      <Badge className="status-checked-in ml-1">Проживает</Badge>, 
                      а номер станет «Занят»
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <strong>Выселение (Check-out)</strong>
                    <p className="text-sm text-muted-foreground">
                      Нажмите «Выселить» — статус изменится на 
                      <Badge className="status-checked-out ml-1">Выехал</Badge>, 
                      номер освободится
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4.5 Cancellation */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">5</span>
                Отмена бронирования
              </h4>
              <p className="ml-8">
                Нажмите <strong>«Отменить»</strong> в карточке брони. Подтвердите действие в диалоге. 
                Номер автоматически освободится.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 5: Shahmatka */}
      <section id="section-shahmatka" className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              5. Работа с Шахматкой
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Шахматка — это визуальный календарь занятости номеров на 7 дней вперёд. 
              Строки — номера комнат, столбцы — даты.
            </p>

            <h4 className="font-semibold">Цветовая кодировка:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="flex items-center gap-2 p-2 rounded border">
                <div className="w-8 h-4 rounded bg-green-100"></div>
                <span className="text-sm">Свободно — номер доступен</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border">
                <div className="w-8 h-4 rounded bg-blue-500"></div>
                <span className="text-sm">Подтверждено — ожидает заселения</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border">
                <div className="w-8 h-4 rounded bg-amber-500"></div>
                <span className="text-sm">Занято — гость проживает</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border">
                <div className="w-8 h-4 rounded bg-yellow-400"></div>
                <span className="text-sm">Ожидает — не подтверждено</span>
              </div>
            </div>

            {/* Placeholder for screenshot */}
            <div className="help-screenshot bg-muted border-2 border-dashed rounded-lg p-8 text-center">
              <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Скриншот: Шахматка — визуальная сетка занятости</p>
              <p className="text-xs text-muted-foreground mt-1">Путь: public/help/help-shahmatka.png</p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                <strong>Совет:</strong> Кликните на ячейку брони в шахматке, чтобы быстро 
                перейти к деталям бронирования.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 6: Clients */}
      <section id="section-clients" className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              6. Клиентская база
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Система автоматически создаёт карточку клиента при первом бронировании. 
              В карточке хранится история всех бронирований гостя.
            </p>

            <h4 className="font-semibold">Возможности:</h4>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Поиск по телефону</strong> — быстро найти гостя</li>
              <li><strong>История бронирований</strong> — все визиты гостя</li>
              <li><strong>Заметки</strong> — предпочтения, особенности</li>
              <li><strong>WhatsApp</strong> — связь в один клик</li>
            </ul>

            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <PhoneCall className="h-5 w-5 text-green-600" />
              <span className="text-sm">
                Нажмите на иконку WhatsApp рядом с номером телефона для быстрой связи с гостем
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 7: Status Reference */}
      <section id="section-statuses" className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              7. Справочник статусов
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3">Статусы бронирований:</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статус</TableHead>
                    <TableHead>Цвет</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead className="print:hidden">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell><Badge className="status-pending">Ожидает</Badge></TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-yellow-400"></div></TableCell>
                    <TableCell>Новая заявка, требует обработки</TableCell>
                    <TableCell className="print:hidden">Назначить номер / Подтвердить</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge className="status-approved">Подтверждено</Badge></TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-blue-500"></div></TableCell>
                    <TableCell>Бронь подтверждена, ожидает заезда</TableCell>
                    <TableCell className="print:hidden">Заселить</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge className="status-checked-in">Проживает</Badge></TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-green-500"></div></TableCell>
                    <TableCell>Гость заселён и проживает</TableCell>
                    <TableCell className="print:hidden">Выселить / Отменить</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge className="status-checked-out">Выехал</Badge></TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-gray-400"></div></TableCell>
                    <TableCell>Гость выселился</TableCell>
                    <TableCell className="print:hidden">—</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge className="status-cancelled">Отменено</Badge></TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-red-500"></div></TableCell>
                    <TableCell>Бронирование отменено</TableCell>
                    <TableCell className="print:hidden">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-3">Статусы номеров:</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статус</TableHead>
                    <TableHead>Цвет</TableHead>
                    <TableHead>Описание</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Свободен</TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-green-500"></div></TableCell>
                    <TableCell>Номер готов к заселению</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Забронирован</TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-blue-500"></div></TableCell>
                    <TableCell>Есть подтверждённая бронь</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Занят</TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-amber-500"></div></TableCell>
                    <TableCell>Гость проживает в номере</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">На ремонте</TableCell>
                    <TableCell><div className="w-4 h-4 rounded bg-red-500"></div></TableCell>
                    <TableCell>Номер недоступен для бронирования</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ Section */}
      <section className="help-section">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Частые вопросы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Как отменить заселение (undo check-in)?</h4>
                <p className="text-sm text-muted-foreground">
                  В карточке брони со статусом «Проживает» нажмите «Отменить заселение». 
                  Статус вернётся к «Подтверждено», номер освободится.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold">Можно ли изменить даты брони?</h4>
                <p className="text-sm text-muted-foreground">
                  Да, откройте бронирование и отредактируйте даты. Система проверит 
                  доступность номера на новые даты.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold">Как добавить дополнительные услуги?</h4>
                <p className="text-sm text-muted-foreground">
                  Перейдите в «Журнал услуг», выберите бронирование и добавьте услугу 
                  (завтрак, мини-бар, трансфер и т.д.).
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold">Где посмотреть историю клиента?</h4>
                <p className="text-sm text-muted-foreground">
                  В разделе «Клиенты» найдите гостя по номеру телефона и нажмите «История». 
                  Увидите все его бронирования.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Print footer */}
      <div className="hidden print:block print:mt-8 print:text-center print:text-sm print:text-muted-foreground">
        <Separator className="mb-4" />
        <p>YesRoom — Система управления отелем</p>
        <p>Документ создан: {new Date().toLocaleDateString('ru-RU')}</p>
      </div>
    </div>
  );
}
