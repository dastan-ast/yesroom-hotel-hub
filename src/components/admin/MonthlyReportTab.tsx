import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import {
  BedDouble, DoorOpen, Clock, Users, TrendingUp, TrendingDown,
  BarChart3, Percent, DollarSign, Activity, Globe, Star,
  CalendarDays, Award, Lightbulb, FileText, Printer,
  CheckCircle2, AlertTriangle, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { format, parseISO, differenceInDays, eachDayOfInterval, startOfDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  hotelId: string;
}

interface BookingRow {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  room_id: string | null;
  room_type_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  source: string;
  total_price: number | null;
  final_total: number | null;
  daily_rate: number | null;
  is_half_day: boolean;
  created_at: string;
  approved_at: string | null;
  actual_check_out_at: string | null;
  additional_info: any;
  prepayment_amount: number | null;
}

interface RoomRow {
  id: string;
  room_number: string;
  floor: number;
  room_type_id: string;
  room_types: { name: string; price_per_night: number } | null;
}

// February 2025 dates
const REPORT_MONTH = 'Февраль 2025';
const MONTH_START = new Date(2025, 1, 1); // Feb 1
const MONTH_END = new Date(2025, 1, 28); // Feb 28
const MONTH_DAYS = 28;
const START_STR = '2025-02-01';
const END_STR = '2025-03-01';

const SOURCE_LABELS: Record<string, string> = {
  web: 'Веб-сайт', manual: 'Ручное', booking: 'Booking.com',
  telegram: 'Telegram', whatsapp: 'WhatsApp',
};
const SOURCE_COLORS: Record<string, string> = {
  web: '#3b82f6', manual: '#8b5cf6', booking: '#ef4444',
  telegram: '#06b6d4', whatsapp: '#22c55e',
};
const PIE_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4'];

export function MonthlyReportTab({ hotelId }: Props) {
  const [loading, setLoading] = useState(true);
  const [hotelName, setHotelName] = useState('');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [allBookings, setAllBookings] = useState<BookingRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hotelId) fetchAll();
  }, [hotelId]);

  const fetchAll = async () => {
    setLoading(true);
    const [hotelRes, bookingsRes, roomsRes, servicesRes, leadsRes, allBookingsRes] = await Promise.all([
      supabase.from('hotels').select('name').eq('id', hotelId).single(),
      supabase.from('bookings').select('*').eq('hotel_id', hotelId)
        .lt('check_in_date', END_STR).gt('check_out_date', START_STR),
      supabase.from('rooms').select('id, room_number, floor, room_type_id, room_types(name, price_per_night)')
        .eq('hotel_id', hotelId).order('floor').order('room_number'),
      supabase.from('booking_services').select('service_name, unit_price, quantity, total_price, created_at')
        .eq('hotel_id', hotelId).gte('created_at', START_STR).lt('created_at', END_STR),
      supabase.from('leads').select('*').eq('hotel_id', hotelId)
        .gte('created_at', START_STR).lt('created_at', END_STR),
      supabase.from('bookings').select('id, check_in_date, check_out_date, status, room_id, guest_name, source, is_half_day')
        .eq('hotel_id', hotelId).lt('check_in_date', END_STR).gt('check_out_date', START_STR)
        .in('status', ['approved', 'checked_in', 'checked_out']),
    ]);

    setHotelName(hotelRes.data?.name || '');
    setBookings((bookingsRes.data as any[]) || []);
    setRooms((roomsRes.data as any[]) || []);
    setServices(servicesRes.data || []);
    setLeads(leadsRes.data || []);
    setAllBookings((allBookingsRes.data as any[]) || []);
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Загрузка отчёта...</div>;
  }

  // ========== CALCULATIONS ==========
  const activeBookings = bookings.filter(b => ['approved', 'checked_in', 'checked_out'].includes(b.status));
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');
  const pendingBookings = bookings.filter(b => b.status === 'pending');

  // Revenue
  let totalRevenue = 0;
  let roomRevenue = 0;
  for (const b of activeBookings) {
    const rev = Number(b.final_total ?? b.total_price ?? 0);
    totalRevenue += rev;
    roomRevenue += rev;
  }
  let serviceRevenue = 0;
  for (const s of services) {
    serviceRevenue += Number(s.total_price ?? (Number(s.unit_price) * s.quantity));
  }
  totalRevenue += serviceRevenue;

  // Occupancy
  const totalRoomNights = rooms.length * MONTH_DAYS;
  let soldRoomNights = 0;
  for (const b of activeBookings) {
    const ci = parseISO(b.check_in_date) < MONTH_START ? MONTH_START : parseISO(b.check_in_date);
    const co = parseISO(b.check_out_date) > addDays(MONTH_END, 1) ? addDays(MONTH_END, 1) : parseISO(b.check_out_date);
    soldRoomNights += Math.max(0, differenceInDays(co, ci));
  }
  const occupancyPercent = totalRoomNights > 0 ? Math.round((soldRoomNights / totalRoomNights) * 100) : 0;
  const adr = soldRoomNights > 0 ? Math.round(roomRevenue / soldRoomNights) : 0;
  const revpar = totalRoomNights > 0 ? Math.round(roomRevenue / totalRoomNights) : 0;

  // Avg stay
  const stayLengths = activeBookings.map(b => differenceInDays(parseISO(b.check_out_date), parseISO(b.check_in_date)));
  const avgStay = stayLengths.length > 0 ? (stayLengths.reduce((a, b) => a + b, 0) / stayLengths.length).toFixed(1) : '0';

  // Daily occupancy for chart
  const days = eachDayOfInterval({ start: MONTH_START, end: MONTH_END });
  const dailyOccupancy = days.map(day => {
    let occupied = 0;
    for (const b of activeBookings) {
      if (b.room_id && parseISO(b.check_in_date) <= day && parseISO(b.check_out_date) > day) {
        occupied++;
      }
    }
    return {
      day: format(day, 'd', { locale: ru }),
      date: format(day, 'dd.MM'),
      occupied,
      free: Math.max(0, rooms.length - occupied),
      percent: rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0,
    };
  });

  // Source breakdown
  const sourceMap: Record<string, { count: number; revenue: number }> = {};
  for (const b of activeBookings) {
    const src = b.source || 'manual';
    if (!sourceMap[src]) sourceMap[src] = { count: 0, revenue: 0 };
    sourceMap[src].count++;
    sourceMap[src].revenue += Number(b.final_total ?? b.total_price ?? 0);
  }
  const sourceData = Object.entries(sourceMap).map(([source, data]) => ({
    source, label: SOURCE_LABELS[source] || source, ...data,
  })).sort((a, b) => b.revenue - a.revenue);

  // Room occupancy per room
  const roomOccupancy = rooms.map(r => {
    let occ = 0;
    for (const b of activeBookings) {
      if (b.room_id === r.id) {
        const ci = parseISO(b.check_in_date) < MONTH_START ? MONTH_START : parseISO(b.check_in_date);
        const co = parseISO(b.check_out_date) > addDays(MONTH_END, 1) ? addDays(MONTH_END, 1) : parseISO(b.check_out_date);
        occ += Math.max(0, differenceInDays(co, ci));
      }
    }
    return {
      room: r.room_number,
      type: r.room_types?.name || '—',
      floor: r.floor,
      days: Math.min(occ, MONTH_DAYS),
      percent: Math.round((Math.min(occ, MONTH_DAYS) / MONTH_DAYS) * 100),
    };
  });

  // Services top
  const serviceMap: Record<string, { count: number; revenue: number }> = {};
  for (const s of services) {
    const name = s.service_name || 'Прочее';
    if (!serviceMap[name]) serviceMap[name] = { count: 0, revenue: 0 };
    serviceMap[name].count += s.quantity;
    serviceMap[name].revenue += Number(s.total_price ?? (Number(s.unit_price) * s.quantity));
  }
  const topServices = Object.entries(serviceMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // SLA metrics
  const approvalTimes: number[] = [];
  for (const b of activeBookings) {
    if (b.approved_at && b.created_at) {
      const diff = (new Date(b.approved_at).getTime() - new Date(b.created_at).getTime()) / 60000;
      if (diff >= 0 && diff < 10000) approvalTimes.push(diff);
    }
  }
  const avgApprovalMin = approvalTimes.length > 0 ? Math.round(approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length) : 0;

  // Leads
  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.status === 'converted').length;
  const leadConversion = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // Peak day
  const peakDay = dailyOccupancy.reduce((max, d) => d.occupied > max.occupied ? d : max, dailyOccupancy[0] || { date: '-', occupied: 0, percent: 0 });

  // Weakest day
  const weakDay = dailyOccupancy.reduce((min, d) => d.occupied < min.occupied ? d : min, dailyOccupancy[0] || { date: '-', occupied: 0, percent: 0 });

  // Recommendations
  const recommendations: { icon: any; title: string; text: string; priority: 'high' | 'medium' | 'low' }[] = [];
  
  if (occupancyPercent < 50) {
    recommendations.push({
      icon: TrendingDown, title: 'Низкая загрузка',
      text: `Загрузка ${occupancyPercent}% ниже рекомендуемого минимума (60%). Рассмотрите акции выходного дня, скидки за ранний заезд и партнёрство с туроператорами.`,
      priority: 'high',
    });
  }
  if (avgApprovalMin > 60) {
    recommendations.push({
      icon: Clock, title: 'Долгое подтверждение',
      text: `Среднее время подтверждения ${avgApprovalMin} мин. Цель: <30 мин. Настройте push-уведомления для администраторов и распределите зоны ответственности.`,
      priority: 'high',
    });
  }
  if (leadConversion < 30 && totalLeads > 0) {
    recommendations.push({
      icon: Users, title: 'Низкая конверсия лидов',
      text: `Конверсия ${leadConversion}% — потенциальная потеря клиентов. Обучите персонал скриптам продаж, предложите бонус за бронирование по звонку.`,
      priority: 'medium',
    });
  }
  if (serviceRevenue < roomRevenue * 0.05 && roomRevenue > 0) {
    recommendations.push({
      icon: Star, title: 'Потенциал доп. услуг',
      text: `Доход от услуг составляет менее 5% от номерного фонда. Предложите пакеты (завтрак + трансфер), кросс-продажи при заселении.`,
      priority: 'medium',
    });
  }
  if (cancelledBookings.length > activeBookings.length * 0.15) {
    recommendations.push({
      icon: AlertTriangle, title: 'Высокий % отмен',
      text: `${cancelledBookings.length} отмен из ${bookings.length} бронирований. Рассмотрите невозвратные тарифы и предоплату для снижения no-show.`,
      priority: 'medium',
    });
  }
  recommendations.push({
    icon: Lightbulb, title: 'Повышение среднего чека',
    text: `Текущий ADR: ${adr.toLocaleString()} ₸. Внедрите динамическое ценообразование: +15-20% в пиковые дни, -10% в низкий сезон для увеличения RevPAR.`,
    priority: 'low',
  });

  // ========== MINI SHAHMATKA ==========
  const shahmatkaRooms = rooms.slice().sort((a, b) => a.floor - b.floor || a.room_number.localeCompare(b.room_number));

  const getBookingForCell = (roomId: string, day: Date) => {
    return allBookings.find(b => {
      if (b.room_id !== roomId) return false;
      const ci = parseISO(b.check_in_date);
      const co = parseISO(b.check_out_date);
      return day >= ci && day < co;
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'bg-green-500';
      case 'approved': return 'bg-blue-500';
      case 'checked_out': return 'bg-gray-400';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div ref={printRef} className="space-y-8 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Ежемесячный отчёт
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {hotelName} — {REPORT_MONTH}
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="print:hidden gap-2">
          <Printer className="h-4 w-4" /> Печать
        </Button>
      </div>

      <Separator />

      {/* ===== PAGE 1: KEY METRICS ===== */}
      <div className="print:break-after-page">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Ключевые показатели
        </h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Percent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Загрузка</p>
                  <p className="text-2xl font-bold">{occupancyPercent}%</p>
                  <p className="text-[10px] text-muted-foreground">{soldRoomNights} из {totalRoomNights} н/с</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Выручка</p>
                  <p className="text-2xl font-bold">{totalRevenue.toLocaleString()} ₸</p>
                  <p className="text-[10px] text-muted-foreground">номера + услуги</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ADR</p>
                  <p className="text-2xl font-bold">{adr.toLocaleString()} ₸</p>
                  <p className="text-[10px] text-muted-foreground">ср. тариф/ночь</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-500/30 bg-violet-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <Activity className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RevPAR</p>
                  <p className="text-2xl font-bold">{revpar.toLocaleString()} ₸</p>
                  <p className="text-[10px] text-muted-foreground">доход/номер/ночь</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">Бронирований</p>
              <p className="text-xl font-bold">{activeBookings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">Отмен</p>
              <p className="text-xl font-bold text-destructive">{cancelledBookings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">Ср. проживание</p>
              <p className="text-xl font-bold">{avgStay} н.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">Лидов</p>
              <p className="text-xl font-bold">{totalLeads}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">Конверсия лидов</p>
              <p className="text-xl font-bold">{leadConversion}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Occupancy Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Загрузка по дням
              </CardTitle>
              <CardDescription className="text-xs">
                Пиковый день: {peakDay?.date} ({peakDay?.percent}%) | Минимум: {weakDay?.date} ({weakDay?.percent}%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyOccupancy}>
                  <defs>
                    <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v} номеров`, 'Занято']} labelFormatter={(l) => `${l} февраля`} />
                  <Area type="monotone" dataKey="occupied" stroke="#3b82f6" fill="url(#occupancyGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Source Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" /> Каналы продаж
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={false}>
                      {sourceData.map((entry, i) => (
                        <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {sourceData.map(s => (
                    <div key={s.source} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[s.source] || '#999' }} />
                      <span className="flex-1">{s.label}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue breakdown */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue split */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Структура дохода
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Номерной фонд</span>
                  <span className="font-semibold">{roomRevenue.toLocaleString()} ₸</span>
                </div>
                <Progress value={totalRevenue > 0 ? (roomRevenue / totalRevenue) * 100 : 0} className="h-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm">Доп. услуги</span>
                  <span className="font-semibold">{serviceRevenue.toLocaleString()} ₸</span>
                </div>
                <Progress value={totalRevenue > 0 ? (serviceRevenue / totalRevenue) * 100 : 0} className="h-2" />
                <Separator />
                <div className="flex justify-between items-center font-bold">
                  <span>Итого</span>
                  <span className="text-primary">{totalRevenue.toLocaleString()} ₸</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Services */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4" /> Популярные услуги
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет данных об услугах</p>
              ) : (
                <div className="space-y-2">
                  {topServices.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs p-0">
                        {i + 1}
                      </Badge>
                      <span className="flex-1 text-sm">{s.name}</span>
                      <span className="text-xs text-muted-foreground">×{s.count}</span>
                      <span className="text-sm font-semibold">{s.revenue.toLocaleString()} ₸</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== PAGE 2: ROOM ANALYTICS + SLA ===== */}
      <div className="print:break-after-page">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-primary" /> Загрузка по номерам и SLA
        </h2>

        {/* Room occupancy table */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Загрузка номеров за {REPORT_MONTH}</CardTitle>
            <CardDescription className="text-xs">Общая загрузка: {occupancyPercent}% | {rooms.length} номеров</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto print:max-h-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Номер</TableHead>
                    <TableHead className="text-xs">Категория</TableHead>
                    <TableHead className="text-xs">Этаж</TableHead>
                    <TableHead className="text-xs text-center">Дней занято</TableHead>
                    <TableHead className="text-xs w-[120px]">Загрузка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomOccupancy.map(r => (
                    <TableRow key={r.room}>
                      <TableCell className="text-sm font-medium">{r.room}</TableCell>
                      <TableCell className="text-xs">{r.type}</TableCell>
                      <TableCell className="text-xs text-center">{r.floor}</TableCell>
                      <TableCell className="text-xs text-center">{r.days} / {MONTH_DAYS}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={r.percent} className="h-2 flex-1" />
                          <span className={`text-xs font-semibold ${r.percent >= 70 ? 'text-green-600' : r.percent >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {r.percent}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* SLA & Operations */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Скорость обработки (SLA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Ср. время подтверждения</span>
                  <Badge variant={avgApprovalMin <= 30 ? 'default' : avgApprovalMin <= 60 ? 'secondary' : 'destructive'}>
                    {avgApprovalMin < 60 ? `${avgApprovalMin} мин` : `${Math.floor(avgApprovalMin / 60)}ч ${avgApprovalMin % 60}м`}
                  </Badge>
                </div>
                <Progress value={Math.min(100, (30 / Math.max(avgApprovalMin, 1)) * 100)} className="h-2" />
                <p className="text-[10px] text-muted-foreground mt-1">Цель: ≤30 минут</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{activeBookings.length}</p>
                  <p className="text-xs text-muted-foreground">Обработано</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvalTimes.length}</p>
                  <p className="text-xs text-muted-foreground">С отметкой SLA</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Channel Revenue Bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Доход по каналам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ₸`, 'Доход']} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {sourceData.map((entry, i) => (
                      <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== PAGE 3: SHAHMATKA + RECOMMENDATIONS ===== */}
      <div className="print:break-after-page">
        {/* Mini Shahmatka */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" /> Шахматка — {REPORT_MONTH}
        </h2>

        <Card className="mb-6">
          <CardContent className="pt-4 overflow-x-auto">
            <table className="text-[10px] border-collapse w-full min-w-[800px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background border px-2 py-1 text-left font-semibold min-w-[80px]">Номер</th>
                  {days.map(d => (
                    <th key={d.toISOString()} className="border px-0.5 py-1 text-center font-normal min-w-[24px]">
                      {format(d, 'd')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shahmatkaRooms.map((room, ri) => {
                  const prevFloor = ri > 0 ? shahmatkaRooms[ri - 1].floor : room.floor;
                  return (
                    <>
                      {room.floor !== prevFloor && (
                        <tr key={`sep-${room.floor}`}>
                          <td colSpan={days.length + 1} className="bg-muted/50 border px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                            Этаж {room.floor}
                          </td>
                        </tr>
                      )}
                      <tr key={room.id}>
                        <td className="sticky left-0 z-10 bg-background border px-2 py-0.5 font-medium whitespace-nowrap">
                          {room.room_number} <span className="text-muted-foreground font-normal">{room.room_types?.name}</span>
                        </td>
                        {days.map(d => {
                          const b = getBookingForCell(room.id, d);
                          return (
                            <td key={d.toISOString()} className="border p-0 h-5">
                              {b ? (
                                <div className={`w-full h-full ${statusColor(b.status)} opacity-80`} title={`${b.guest_name} (${b.status})`} />
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center gap-4 mt-3 text-[10px]">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /> Заселён</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Подтверждён</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-400" /> Выселен</div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" /> Рекомендации
        </h2>

        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <Card key={i} className={`border-l-4 ${rec.priority === 'high' ? 'border-l-destructive' : rec.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-primary'}`}>
              <CardContent className="py-4 flex gap-4">
                <div className={`p-2 rounded-lg shrink-0 ${rec.priority === 'high' ? 'bg-destructive/10' : rec.priority === 'medium' ? 'bg-yellow-500/10' : 'bg-primary/10'}`}>
                  <rec.icon className={`h-5 w-5 ${rec.priority === 'high' ? 'text-destructive' : rec.priority === 'medium' ? 'text-yellow-600' : 'text-primary'}`} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{rec.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{rec.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground border-t pt-4">
          <p>Отчёт сгенерирован автоматически системой YesRoom • {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
          <p className="mt-1">Данные за период: 01.02.2025 — 28.02.2025</p>
        </div>
      </div>
    </div>
  );
}
