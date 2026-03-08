import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, addDays, subDays, parseISO, differenceInDays, startOfDay, eachDayOfInterval, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { 
  BedDouble, DoorOpen, Clock, Users, TrendingUp, TrendingDown,
  BarChart3, PieChart as PieChartIcon, Percent, DollarSign,
  Activity, Globe, Star, Award, Lightbulb, AlertTriangle,
  FileDown, Printer, CalendarDays
} from 'lucide-react';

interface Props {
  hotelId: string;
}

interface DashboardStats {
  totalRooms: number;
  occupiedToday: number;
  freeToday: number;
  bookedToday: number;
  pendingRequests: number;
  monthlyRevenue: number;
}

interface KpiData {
  occupancyPercent: number;
  adr: number;
  revpar: number;
  soldRoomNights: number;
  totalRoomNights: number;
}

interface ChannelData {
  source: string;
  label: string;
  count: number;
  revenue: number;
}

interface RoomStatusDistribution {
  name: string;
  value: number;
  color: string;
}

const PIE_COLORS = {
  checkedIn: '#22c55e',
  approved: '#3b82f6',
  pending: '#eab308',
  free: '#9ca3af',
};

const SOURCE_LABELS: Record<string, string> = {
  web: 'Веб-сайт', manual: 'Ручное', booking: 'Booking.com',
  telegram: 'Telegram', whatsapp: 'WhatsApp',
};

const SOURCE_COLORS: Record<string, string> = {
  web: '#3b82f6', manual: '#8b5cf6', booking: '#ef4444',
  telegram: '#06b6d4', whatsapp: '#22c55e',
};

const MONTH_OPTIONS = (() => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'LLLL yyyy', { locale: ru }),
    });
  }
  return options;
})();

export function ExecutiveDashboard({ hotelId }: Props) {
  const { t } = useTranslation();
  const reportRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0, occupiedToday: 0, freeToday: 0, bookedToday: 0,
    pendingRequests: 0, monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [piePeriod, setPiePeriod] = useState<string>('7days');
  const [pieData, setPieData] = useState<RoomStatusDistribution[]>([]);
  const [pieLoading, setPieLoading] = useState(false);
  const [kpiPeriod, setKpiPeriod] = useState<string>('month');
  const [kpiData, setKpiData] = useState<KpiData>({ occupancyPercent: 0, adr: 0, revpar: 0, soldRoomNights: 0, totalRoomNights: 0 });
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);

  const [reportStart, setReportStart] = useState<Date>(startOfMonth(new Date()));
  const [reportEnd, setReportEnd] = useState<Date>(new Date());
  const [reportData, setReportData] = useState<{ room_number: string; type: string; daysOccupied: number; daysFree: number; percent: number }[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTotalPercent, setReportTotalPercent] = useState(0);

  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [monthlyReportData, setMonthlyReportData] = useState<any>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const fetchReport = async () => {
    setReportLoading(true);
    const startStr = format(reportStart, 'yyyy-MM-dd');
    const endStr = format(addDays(reportEnd, 1), 'yyyy-MM-dd');
    const totalDays = differenceInDays(reportEnd, reportStart) + 1;

    const [roomsRes, bookingsRes, bookingRoomsRes] = await Promise.all([
      supabase.from('rooms').select('id, room_number, room_types(name)').eq('hotel_id', hotelId).order('room_number'),
      supabase.from('bookings').select('id, room_id, check_in_date, check_out_date, status')
        .eq('hotel_id', hotelId).in('status', ['approved', 'checked_in', 'checked_out'])
        .lt('check_in_date', endStr).gt('check_out_date', startStr),
      supabase.from('booking_rooms').select('room_id, bookings!inner(check_in_date, check_out_date, status)')
        .eq('hotel_id', hotelId),
    ]);

    const rooms = roomsRes.data || [];
    const allBookings = bookingsRes.data || [];
    const brEntries = (bookingRoomsRes.data || []) as any[];

    const roomDays = new Map<string, number>();
    const countDays = (roomId: string, checkIn: string, checkOut: string) => {
      const ci = parseISO(checkIn) < reportStart ? reportStart : parseISO(checkIn);
      const co = parseISO(checkOut) > addDays(reportEnd, 1) ? addDays(reportEnd, 1) : parseISO(checkOut);
      const days = differenceInDays(co, ci);
      if (days > 0) roomDays.set(roomId, (roomDays.get(roomId) || 0) + days);
    };

    for (const b of allBookings) { if (b.room_id) countDays(b.room_id, b.check_in_date, b.check_out_date); }
    for (const br of brEntries) {
      if (br.bookings && ['approved', 'checked_in', 'checked_out'].includes(br.bookings.status)) {
        if (br.bookings.check_in_date < endStr && br.bookings.check_out_date > startStr) {
          countDays(br.room_id, br.bookings.check_in_date, br.bookings.check_out_date);
        }
      }
    }

    const data = rooms.map((r: any) => {
      const occupied = Math.min(roomDays.get(r.id) || 0, totalDays);
      return { room_number: r.room_number, type: r.room_types?.name || '—', daysOccupied: occupied, daysFree: totalDays - occupied, percent: totalDays > 0 ? Math.round((occupied / totalDays) * 100) : 0 };
    });

    const totalOccupied = data.reduce((s: number, r: any) => s + r.daysOccupied, 0);
    const totalPossible = rooms.length * totalDays;
    setReportTotalPercent(totalPossible > 0 ? Math.round((totalOccupied / totalPossible) * 100) : 0);
    setReportData(data);
    setReportLoading(false);
  };

  useEffect(() => { if (hotelId && reportStart && reportEnd) fetchReport(); }, [hotelId, reportStart, reportEnd]);
  useEffect(() => { if (hotelId) fetchDashboardData(); }, [hotelId]);
  useEffect(() => { if (hotelId && stats.totalRooms > 0) fetchPieData(); }, [hotelId, piePeriod, stats.totalRooms]);
  useEffect(() => { if (hotelId && stats.totalRooms > 0) fetchKpiData(); }, [hotelId, kpiPeriod, stats.totalRooms]);
  useEffect(() => { if (hotelId) fetchMonthlyReport(); }, [hotelId, selectedMonth]);

  const fetchPieData = async () => {
    setPieLoading(true);
    const today = startOfDay(new Date());
    let periodStart: Date, periodEnd: Date;
    if (piePeriod === '7days') { periodStart = subDays(today, 6); periodEnd = today; }
    else { periodStart = startOfMonth(today); periodEnd = today; }

    const startStr = format(periodStart, 'yyyy-MM-dd');
    const endStr = format(addDays(periodEnd, 1), 'yyyy-MM-dd');

    const { data: bookings } = await supabase.from('bookings')
      .select('check_in_date, check_out_date, status, room_id').eq('hotel_id', hotelId)
      .not('room_id', 'is', null).gte('check_out_date', startStr).lte('check_in_date', endStr)
      .in('status', ['pending', 'approved', 'checked_in', 'checked_out']);

    const totalRooms = stats.totalRooms;
    const numDays = differenceInDays(periodEnd, periodStart) + 1;
    let totalCheckedIn = 0, totalApproved = 0, totalPending = 0, totalFree = 0;

    for (let i = 0; i < numDays; i++) {
      const day = addDays(periodStart, i);
      const roomsCheckedIn = new Set<string>(), roomsApproved = new Set<string>(), roomsPending = new Set<string>();
      if (bookings) {
        for (const b of bookings) {
          const checkIn = parseISO(b.check_in_date), checkOut = parseISO(b.check_out_date);
          if (day >= checkIn && day < checkOut && b.room_id) {
            if (b.status === 'checked_in') roomsCheckedIn.add(b.room_id);
            else if (b.status === 'approved') roomsApproved.add(b.room_id);
            else if (b.status === 'pending') roomsPending.add(b.room_id);
          }
        }
      }
      totalCheckedIn += roomsCheckedIn.size;
      totalApproved += roomsApproved.size;
      totalPending += roomsPending.size;
      totalFree += Math.max(0, totalRooms - roomsCheckedIn.size - roomsApproved.size - roomsPending.size);
    }

    setPieData([
      { name: 'Заселены', value: Math.round(totalCheckedIn / numDays), color: PIE_COLORS.checkedIn },
      { name: 'Забронированы', value: Math.round(totalApproved / numDays), color: PIE_COLORS.approved },
      { name: 'Ожидают', value: Math.round(totalPending / numDays), color: PIE_COLORS.pending },
      { name: 'Свободны', value: Math.round(totalFree / numDays), color: PIE_COLORS.free },
    ]);
    setPieLoading(false);
  };

  const fetchKpiData = async () => {
    setKpiLoading(true);
    const today = startOfDay(new Date());
    const daysBack = kpiPeriod === '7days' ? 7 : differenceInDays(today, startOfMonth(today)) + 1;
    const periodStart = kpiPeriod === '7days' ? subDays(today, 6) : startOfMonth(today);
    const startStr = format(periodStart, 'yyyy-MM-dd');
    const endStr = format(addDays(today, 1), 'yyyy-MM-dd');

    const { data: bookings } = await supabase.from('bookings')
      .select('source, final_total, total_price, daily_rate, check_in_date, check_out_date, status')
      .eq('hotel_id', hotelId).in('status', ['approved', 'checked_in', 'checked_out'])
      .lt('check_in_date', endStr).gt('check_out_date', startStr);

    const totalRoomNights = stats.totalRooms * daysBack;
    let soldRoomNights = 0, totalRevenue = 0;
    const channelMap: Record<string, { count: number; revenue: number }> = {};

    if (bookings) {
      for (const b of bookings) {
        const ci = parseISO(b.check_in_date) < periodStart ? periodStart : parseISO(b.check_in_date);
        const co = parseISO(b.check_out_date) > addDays(today, 1) ? addDays(today, 1) : parseISO(b.check_out_date);
        const nights = Math.max(0, differenceInDays(co, ci));
        soldRoomNights += nights;
        const totalNights = differenceInDays(parseISO(b.check_out_date), parseISO(b.check_in_date));
        let bookingRevenue = 0;
        const revenueBase = b.final_total ?? b.total_price;
        if (revenueBase && totalNights > 0) bookingRevenue = (Number(revenueBase) / totalNights) * nights;
        else if (b.daily_rate) bookingRevenue = Number(b.daily_rate) * nights;
        totalRevenue += bookingRevenue;
        const src = b.source || 'manual';
        if (!channelMap[src]) channelMap[src] = { count: 0, revenue: 0 };
        channelMap[src].count += 1;
        channelMap[src].revenue += bookingRevenue;
      }
    }

    setKpiData({
      occupancyPercent: totalRoomNights > 0 ? Math.round((soldRoomNights / totalRoomNights) * 100) : 0,
      adr: soldRoomNights > 0 ? Math.round(totalRevenue / soldRoomNights) : 0,
      revpar: totalRoomNights > 0 ? Math.round(totalRevenue / totalRoomNights) : 0,
      soldRoomNights, totalRoomNights,
    });
    setChannelData(Object.entries(channelMap).map(([source, data]) => ({
      source, label: SOURCE_LABELS[source] || source, count: data.count, revenue: Math.round(data.revenue),
    })).sort((a, b) => b.revenue - a.revenue));
    setKpiLoading(false);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = startOfDay(new Date());
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

    const [roomsRes, occupiedRes, bookedRes, pendingRes, revenueRes, servicesRevenueRes] = await Promise.all([
      supabase.from('rooms').select('id', { count: 'exact' }).eq('hotel_id', hotelId),
      supabase.from('rooms').select('id', { count: 'exact' }).eq('hotel_id', hotelId).eq('status', 'occupied'),
      supabase.from('rooms').select('id', { count: 'exact' }).eq('hotel_id', hotelId).eq('status', 'booked'),
      supabase.from('bookings').select('id', { count: 'exact' }).eq('hotel_id', hotelId).eq('status', 'pending'),
      supabase.from('bookings').select('final_total, total_price, daily_rate, check_in_date, check_out_date')
        .eq('hotel_id', hotelId).eq('status', 'checked_out')
        .gte('check_out_date', monthStart).lte('check_out_date', monthEnd),
      supabase.from('booking_services').select('total_price, unit_price, quantity')
        .eq('hotel_id', hotelId).gte('created_at', monthStart).lte('created_at', monthEnd),
    ]);

    const totalRooms = roomsRes.count || 0;
    const occupiedToday = occupiedRes.count || 0;
    const bookedToday = bookedRes.count || 0;
    let monthlyRevenue = 0;
    if (revenueRes.data) {
      for (const booking of revenueRes.data) {
        const base = booking.final_total ?? booking.total_price;
        if (base) monthlyRevenue += Number(base);
        else if (booking.daily_rate) monthlyRevenue += Number(booking.daily_rate) * differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date));
      }
    }
    if (servicesRevenueRes.data) {
      for (const service of servicesRevenueRes.data) {
        monthlyRevenue += Number(service.total_price ?? (Number(service.unit_price) * service.quantity));
      }
    }

    setStats({ totalRooms, occupiedToday, freeToday: Math.max(0, totalRooms - occupiedToday - bookedToday), bookedToday, pendingRequests: pendingRes.count || 0, monthlyRevenue });
    setLoading(false);
  };

  const fetchMonthlyReport = async () => {
    setMonthlyLoading(true);
    const [year, month] = selectedMonth.split('-').map(Number);
    const mStart = new Date(year, month - 1, 1);
    const mEnd = endOfMonth(mStart);
    const mDays = differenceInDays(mEnd, mStart) + 1;
    const startStr = format(mStart, 'yyyy-MM-dd');
    const endStr = format(addDays(mEnd, 1), 'yyyy-MM-dd');

    const [bookingsRes, roomsRes, servicesRes, leadsRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('hotel_id', hotelId).lt('check_in_date', endStr).gt('check_out_date', startStr),
      supabase.from('rooms').select('id, room_number, floor, room_type_id, room_types(name, price_per_night)').eq('hotel_id', hotelId).order('floor').order('room_number'),
      supabase.from('booking_services').select('service_name, unit_price, quantity, total_price').eq('hotel_id', hotelId).gte('created_at', startStr).lt('created_at', endStr),
      supabase.from('leads').select('*').eq('hotel_id', hotelId).gte('created_at', startStr).lt('created_at', endStr),
    ]);

    const allBookings = (bookingsRes.data as any[]) || [];
    const rooms = (roomsRes.data as any[]) || [];
    const services = servicesRes.data || [];
    const leads = leadsRes.data || [];

    const active = allBookings.filter((b: any) => ['approved', 'checked_in', 'checked_out'].includes(b.status));
    const cancelled = allBookings.filter((b: any) => b.status === 'cancelled');

    // Revenue
    let roomRevenue = 0, serviceRevenue = 0;
    for (const b of active) roomRevenue += Number(b.final_total ?? b.total_price ?? 0);
    for (const s of services) serviceRevenue += Number(s.total_price ?? (Number(s.unit_price) * s.quantity));

    // Occupancy
    const totalRoomNights = rooms.length * mDays;
    let soldRoomNights = 0;
    for (const b of active) {
      const ci = parseISO(b.check_in_date) < mStart ? mStart : parseISO(b.check_in_date);
      const co = parseISO(b.check_out_date) > addDays(mEnd, 1) ? addDays(mEnd, 1) : parseISO(b.check_out_date);
      soldRoomNights += Math.max(0, differenceInDays(co, ci));
    }
    const occ = totalRoomNights > 0 ? Math.round((soldRoomNights / totalRoomNights) * 100) : 0;
    const adrVal = soldRoomNights > 0 ? Math.round(roomRevenue / soldRoomNights) : 0;
    const revparVal = totalRoomNights > 0 ? Math.round(roomRevenue / totalRoomNights) : 0;

    // Avg stay
    const stays = active.map((b: any) => differenceInDays(parseISO(b.check_out_date), parseISO(b.check_in_date)));
    const avgStay = stays.length > 0 ? (stays.reduce((a: number, b: number) => a + b, 0) / stays.length).toFixed(1) : '0';

    // Daily occupancy
    const days = eachDayOfInterval({ start: mStart, end: mEnd });
    const dailyOcc = days.map(day => {
      let occupied = 0;
      for (const b of active) {
        if (b.room_id && parseISO(b.check_in_date) <= day && parseISO(b.check_out_date) > day) occupied++;
      }
      return { day: format(day, 'd'), date: format(day, 'dd.MM'), occupied, percent: rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0 };
    });

    // Sources
    const srcMap: Record<string, { count: number; revenue: number }> = {};
    for (const b of active) {
      const src = b.source || 'manual';
      if (!srcMap[src]) srcMap[src] = { count: 0, revenue: 0 };
      srcMap[src].count++;
      srcMap[src].revenue += Number(b.final_total ?? b.total_price ?? 0);
    }
    const sources = Object.entries(srcMap).map(([source, d]) => ({ source, label: SOURCE_LABELS[source] || source, ...d })).sort((a, b) => b.revenue - a.revenue);

    // Room occupancy
    const roomOcc = rooms.map((r: any) => {
      let occ = 0;
      for (const b of active) {
        if (b.room_id === r.id) {
          const ci = parseISO(b.check_in_date) < mStart ? mStart : parseISO(b.check_in_date);
          const co = parseISO(b.check_out_date) > addDays(mEnd, 1) ? addDays(mEnd, 1) : parseISO(b.check_out_date);
          occ += Math.max(0, differenceInDays(co, ci));
        }
      }
      return { room: r.room_number, type: r.room_types?.name || '—', floor: r.floor, days: Math.min(occ, mDays), percent: Math.round((Math.min(occ, mDays) / mDays) * 100) };
    });

    // Services
    const svcMap: Record<string, { count: number; revenue: number }> = {};
    for (const s of services) {
      const name = s.service_name || 'Прочее';
      if (!svcMap[name]) svcMap[name] = { count: 0, revenue: 0 };
      svcMap[name].count += s.quantity;
      svcMap[name].revenue += Number(s.total_price ?? (Number(s.unit_price) * s.quantity));
    }
    const topSvcs = Object.entries(svcMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // SLA
    const approvalTimes: number[] = [];
    for (const b of active) {
      if (b.approved_at && b.created_at) {
        const diff = (new Date(b.approved_at).getTime() - new Date(b.created_at).getTime()) / 60000;
        if (diff >= 0 && diff < 10000) approvalTimes.push(diff);
      }
    }
    const avgApproval = approvalTimes.length > 0 ? Math.round(approvalTimes.reduce((a: number, b: number) => a + b, 0) / approvalTimes.length) : 0;

    // Leads
    const convertedLeads = leads.filter((l: any) => l.status === 'converted').length;
    const leadConv = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;

    // Recommendations
    const recs: { icon: any; title: string; text: string; priority: 'high' | 'medium' | 'low' }[] = [];
    if (occ < 50) recs.push({ icon: TrendingDown, title: 'Низкая загрузка', text: `Загрузка ${occ}% ниже рекомендуемого минимума (60%). Рассмотрите акции выходного дня и партнёрство с туроператорами.`, priority: 'high' });
    if (avgApproval > 60) recs.push({ icon: Clock, title: 'Долгое подтверждение', text: `Среднее время подтверждения ${avgApproval} мин. Цель: <30 мин. Настройте уведомления для администраторов.`, priority: 'high' });
    if (leadConv < 30 && leads.length > 0) recs.push({ icon: Users, title: 'Низкая конверсия лидов', text: `Конверсия ${leadConv}%. Обучите персонал скриптам продаж, предложите бонус за бронирование.`, priority: 'medium' });
    if (serviceRevenue < roomRevenue * 0.05 && roomRevenue > 0) recs.push({ icon: Star, title: 'Потенциал доп. услуг', text: `Доход от услуг <5% от номерного фонда. Предложите пакеты при заселении.`, priority: 'medium' });
    if (cancelled.length > active.length * 0.15) recs.push({ icon: AlertTriangle, title: 'Высокий % отмен', text: `${cancelled.length} отмен. Рассмотрите невозвратные тарифы и предоплату.`, priority: 'medium' });
    recs.push({ icon: Lightbulb, title: 'Динамическое ценообразование', text: `ADR: ${adrVal.toLocaleString()} ₸. +15-20% в пиковые дни, -10% в низкий сезон для увеличения RevPAR.`, priority: 'low' });

    // Shahmatka
    const shahmatkaBookings = active.filter((b: any) => b.room_id);

    setMonthlyReportData({
      mStart, mEnd, mDays, active, cancelled, roomRevenue, serviceRevenue,
      totalRevenue: roomRevenue + serviceRevenue, occ, adrVal, revparVal,
      soldRoomNights, totalRoomNights, avgStay, dailyOcc, sources,
      roomOcc, topSvcs, avgApproval, approvalTimes, leads,
      leadConv, recs, rooms, shahmatkaBookings, days,
    });
    setMonthlyLoading(false);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const todayOccupancyPercent = stats.totalRooms > 0 ? Math.round((stats.occupiedToday / stats.totalRooms) * 100) : 0;
  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);
  const kpiPeriodLabel = kpiPeriod === '7days' ? 'за 7 дней' : 'за месяц';

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
    if (value === 0) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percent = pieTotal > 0 ? Math.round((value / pieTotal) * 100) : 0;
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">{value} ({percent}%)</text>;
  };

  const getBookingForCell = (roomId: string, day: Date) => {
    if (!monthlyReportData) return null;
    return monthlyReportData.shahmatkaBookings.find((b: any) => {
      if (b.room_id !== roomId) return false;
      return parseISO(b.check_in_date) <= day && parseISO(b.check_out_date) > day;
    });
  };

  const statusColor = (status: string) => {
    switch (status) { case 'checked_in': return 'bg-green-500'; case 'approved': return 'bg-blue-500'; case 'checked_out': return 'bg-gray-400'; default: return 'bg-yellow-500'; }
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  const d = monthlyReportData;
  const monthLabel = MONTH_OPTIONS.find(o => o.value === selectedMonth)?.label || selectedMonth;

  return (
    <div ref={reportRef} className="space-y-6 print:space-y-4">
      <h2 className="text-2xl font-display font-bold">Панель руководителя</h2>
      
      {/* ===== LIVE STATS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20"><BedDouble className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-sm text-muted-foreground">Занято сегодня</p><p className="text-2xl font-bold text-green-600">{stats.occupiedToday}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20"><DoorOpen className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-muted-foreground">Свободно сегодня</p><p className="text-2xl font-bold text-blue-600">{stats.freeToday}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.pendingRequests > 0 ? "border-yellow-500/30 bg-yellow-500/5" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.pendingRequests > 0 ? 'bg-yellow-500/20' : 'bg-muted'}`}>
                <Clock className={`h-5 w-5 ${stats.pendingRequests > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              </div>
              <div><p className="text-sm text-muted-foreground">Ожидают решения</p><p className={`text-2xl font-bold ${stats.pendingRequests > 0 ? 'text-yellow-600' : ''}`}>{stats.pendingRequests}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-sm text-muted-foreground">Выручка за месяц</p><p className="text-xl font-bold text-emerald-600">{stats.monthlyRevenue.toLocaleString()} ₸</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Row */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Ключевые показатели</CardTitle>
            <ToggleGroup type="single" value={kpiPeriod} onValueChange={(v) => v && setKpiPeriod(v)} size="sm">
              <ToggleGroupItem value="7days" className="text-xs">7 дней</ToggleGroupItem>
              <ToggleGroupItem value="month" className="text-xs">Месяц</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {kpiLoading ? <div className="h-[80px] flex items-center justify-center text-muted-foreground text-sm">Загрузка...</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2"><Percent className="h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Загрузка (Occupancy)</p></div>
                <p className="text-3xl font-bold text-primary">{kpiData.occupancyPercent}%</p>
                <p className="text-xs text-muted-foreground">{kpiData.soldRoomNights} из {kpiData.totalRoomNights} ночей {kpiPeriodLabel}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-600" /><p className="text-xs text-muted-foreground">ADR (Ср. цена номера)</p></div>
                <p className="text-3xl font-bold text-emerald-600">{kpiData.adr.toLocaleString()} ₸</p>
                <p className="text-xs text-muted-foreground">{kpiPeriodLabel}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-600" /><p className="text-xs text-muted-foreground">RevPAR (Доход на номер)</p></div>
                <p className="text-3xl font-bold text-blue-600">{kpiData.revpar.toLocaleString()} ₸</p>
                <p className="text-xs text-muted-foreground">{kpiPeriodLabel}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pie + Channels */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="h-4 w-4" />Распределение номеров</CardTitle>
              <ToggleGroup type="single" value={piePeriod} onValueChange={(v) => v && setPiePeriod(v)} size="sm">
                <ToggleGroupItem value="7days" className="text-xs">7 дней</ToggleGroupItem>
                <ToggleGroupItem value="month" className="text-xs">Месяц</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            {pieLoading ? <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Загрузка...</div> : (
              <div className="flex flex-col md:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={renderCustomLabel} outerRadius={100} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => { const p = pieTotal > 0 ? Math.round((value / pieTotal) * 100) : 0; return [`${value} (${p}%)`, name]; }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 min-w-[150px]">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}:</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Анализ каналов ({kpiPeriod === '7days' ? '7 дн' : 'месяц'})</CardTitle>
          </CardHeader>
          <CardContent>
            {kpiLoading ? <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">Загрузка...</div> :
              channelData.length === 0 ? <div className="py-4 text-center text-muted-foreground text-sm">Нет данных</div> : (
                <div className="space-y-3">
                  {channelData.map(ch => {
                    const maxRev = Math.max(...channelData.map(c => c.revenue), 1);
                    return (
                      <div key={ch.source} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ch.label}</span>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>{ch.count} брон.</span>
                            <span className="font-medium text-foreground">{ch.revenue.toLocaleString()} ₸</span>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max((ch.revenue / maxRev) * 100, 8)}%`, backgroundColor: SOURCE_COLORS[ch.source] || '#6b7280' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Today occupancy + Room report */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Загрузка отеля сегодня</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Занятость: {stats.occupiedToday} из {stats.totalRooms}</span><span className="font-medium">{todayOccupancyPercent}%</span></div>
              <Progress value={todayOccupancyPercent} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Occupancy Report with date picker */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Отчёт по номерам</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}><CalendarIcon className="h-4 w-4 mr-2" />{format(reportStart, 'd MMM yyyy', { locale: ru })}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={reportStart} onSelect={(d) => d && setReportStart(d)} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <span className="text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}><CalendarIcon className="h-4 w-4 mr-2" />{format(reportEnd, 'd MMM yyyy', { locale: ru })}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={reportEnd} onSelect={(d) => d && setReportEnd(d)} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
          </div>
          {reportLoading ? <div className="py-4 text-center text-muted-foreground text-sm">Загрузка...</div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Номер</TableHead><TableHead>Тип</TableHead><TableHead className="text-right">Дней занят</TableHead><TableHead className="text-right">Дней свободен</TableHead><TableHead className="text-right">% загрузки</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reportData.map(row => (
                    <TableRow key={row.room_number}>
                      <TableCell className="font-medium">{row.room_number}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="text-right">{row.daysOccupied}</TableCell>
                      <TableCell className="text-right">{row.daysFree}</TableCell>
                      <TableCell className="text-right"><Badge variant={row.percent >= 80 ? 'default' : row.percent >= 50 ? 'secondary' : 'outline'}>{row.percent}%</Badge></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2"><TableCell colSpan={4}>Общая загрузка</TableCell><TableCell className="text-right"><Badge variant="default">{reportTotalPercent}%</Badge></TableCell></TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== MONTHLY REPORT SECTION ===== */}
      <Separator className="my-6" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-display font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" /> Отчёт за месяц
        </h2>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportPdf} className="print:hidden gap-2">
            <FileDown className="h-4 w-4" /> Экспорт PDF
          </Button>
        </div>
      </div>

      {monthlyLoading ? (
        <div className="py-12 text-center text-muted-foreground">Загрузка отчёта...</div>
      ) : d ? (
        <div className="space-y-6">
          {/* Monthly KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20"><Percent className="h-5 w-5 text-primary" /></div>
                  <div><p className="text-xs text-muted-foreground">Загрузка</p><p className="text-2xl font-bold">{d.occ}%</p><p className="text-[10px] text-muted-foreground">{d.soldRoomNights} из {d.totalRoomNights} н/с</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
                  <div><p className="text-xs text-muted-foreground">Выручка</p><p className="text-2xl font-bold">{d.totalRevenue.toLocaleString()} ₸</p><p className="text-[10px] text-muted-foreground">номера + услуги</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
                  <div><p className="text-xs text-muted-foreground">ADR</p><p className="text-2xl font-bold">{d.adrVal.toLocaleString()} ₸</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-violet-500/30 bg-violet-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/20"><Activity className="h-5 w-5 text-violet-600" /></div>
                  <div><p className="text-xs text-muted-foreground">RevPAR</p><p className="text-2xl font-bold">{d.revparVal.toLocaleString()} ₸</p></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card><CardContent className="py-3 px-4 text-center"><p className="text-xs text-muted-foreground">Бронирований</p><p className="text-xl font-bold">{d.active.length}</p></CardContent></Card>
            <Card><CardContent className="py-3 px-4 text-center"><p className="text-xs text-muted-foreground">Отмен</p><p className="text-xl font-bold text-destructive">{d.cancelled.length}</p></CardContent></Card>
            <Card><CardContent className="py-3 px-4 text-center"><p className="text-xs text-muted-foreground">Ср. проживание</p><p className="text-xl font-bold">{d.avgStay} н.</p></CardContent></Card>
            <Card><CardContent className="py-3 px-4 text-center"><p className="text-xs text-muted-foreground">Лидов</p><p className="text-xl font-bold">{d.leads.length}</p></CardContent></Card>
            <Card><CardContent className="py-3 px-4 text-center"><p className="text-xs text-muted-foreground">Конверсия лидов</p><p className="text-xl font-bold">{d.leadConv}%</p></CardContent></Card>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Загрузка по дням</CardTitle>
                {d.dailyOcc.length > 0 && (
                  <CardDescription className="text-xs">
                    Пик: {d.dailyOcc.reduce((m: any, x: any) => x.occupied > m.occupied ? x : m, d.dailyOcc[0]).date} ({d.dailyOcc.reduce((m: any, x: any) => x.percent > m.percent ? x : m, d.dailyOcc[0]).percent}%)
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={d.dailyOcc}>
                    <defs><linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v} номеров`, 'Занято']} />
                    <Area type="monotone" dataKey="occupied" stroke="#3b82f6" fill="url(#occGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Globe className="h-4 w-4" /> Каналы продаж</CardTitle></CardHeader>
              <CardContent>
                {d.sources.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p> : (
                  <div className="flex items-center">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart><Pie data={d.sources} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80}>{d.sources.map((e: any, i: number) => <Cell key={e.source} fill={SOURCE_COLORS[e.source] || '#999'} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {d.sources.map((s: any) => (
                        <div key={s.source} className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[s.source] || '#999' }} />
                          <span className="flex-1">{s.label}</span><span className="font-semibold">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue + Services */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Структура дохода</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-sm">Номерной фонд</span><span className="font-semibold">{d.roomRevenue.toLocaleString()} ₸</span></div>
                <Progress value={d.totalRevenue > 0 ? (d.roomRevenue / d.totalRevenue) * 100 : 0} className="h-2" />
                <div className="flex justify-between items-center"><span className="text-sm">Доп. услуги</span><span className="font-semibold">{d.serviceRevenue.toLocaleString()} ₸</span></div>
                <Progress value={d.totalRevenue > 0 ? (d.serviceRevenue / d.totalRevenue) * 100 : 0} className="h-2" />
                <Separator />
                <div className="flex justify-between items-center font-bold"><span>Итого</span><span className="text-primary">{d.totalRevenue.toLocaleString()} ₸</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Star className="h-4 w-4" /> Популярные услуги</CardTitle></CardHeader>
              <CardContent>
                {d.topSvcs.length === 0 ? <p className="text-sm text-muted-foreground">Нет данных</p> : (
                  <div className="space-y-2">{d.topSvcs.map((s: any, i: number) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs p-0">{i + 1}</Badge>
                      <span className="flex-1 text-sm">{s.name}</span><span className="text-xs text-muted-foreground">×{s.count}</span>
                      <span className="text-sm font-semibold">{s.revenue.toLocaleString()} ₸</span>
                    </div>
                  ))}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SLA */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Скорость обработки (SLA) — {monthLabel}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Ср. подтверждение</span>
                    <Badge variant={d.avgApproval <= 30 ? 'default' : d.avgApproval <= 60 ? 'secondary' : 'destructive'}>
                      {d.avgApproval < 60 ? `${d.avgApproval} мин` : `${Math.floor(d.avgApproval / 60)}ч ${d.avgApproval % 60}м`}
                    </Badge>
                  </div>
                  <Progress value={Math.min(100, (30 / Math.max(d.avgApproval, 1)) * 100)} className="h-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">Цель: ≤30 мин</p>
                </div>
                <div className="text-center"><p className="text-2xl font-bold">{d.active.length}</p><p className="text-xs text-muted-foreground">Обработано</p></div>
                <div className="text-center"><p className="text-2xl font-bold">{d.approvalTimes.length}</p><p className="text-xs text-muted-foreground">С отметкой SLA</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Room occupancy table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Загрузка номеров — {monthLabel}</CardTitle>
              <CardDescription className="text-xs">Общая: {d.occ}% | {d.rooms.length} номеров</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[350px] overflow-auto print:max-h-none">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-xs">Номер</TableHead><TableHead className="text-xs">Категория</TableHead><TableHead className="text-xs text-center">Дней</TableHead><TableHead className="text-xs w-[120px]">Загрузка</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.roomOcc.map((r: any) => (
                      <TableRow key={r.room}>
                        <TableCell className="text-sm font-medium">{r.room}</TableCell>
                        <TableCell className="text-xs">{r.type}</TableCell>
                        <TableCell className="text-xs text-center">{r.days}/{d.mDays}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={r.percent} className="h-2 flex-1" />
                            <span className={`text-xs font-semibold ${r.percent >= 70 ? 'text-green-600' : r.percent >= 40 ? 'text-yellow-600' : 'text-destructive'}`}>{r.percent}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations - moved to top */}
          {d.recs.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Рекомендации</h3>
              <div className="space-y-3">
                {d.recs.map((rec: any, i: number) => (
                  <Card key={i} className={`border-l-4 ${rec.priority === 'high' ? 'border-l-destructive' : rec.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-primary'}`}>
                    <CardContent className="py-4 flex gap-4">
                      <div className={`p-2 rounded-lg shrink-0 ${rec.priority === 'high' ? 'bg-destructive/10' : rec.priority === 'medium' ? 'bg-yellow-500/10' : 'bg-primary/10'}`}>
                        <rec.icon className={`h-5 w-5 ${rec.priority === 'high' ? 'text-destructive' : rec.priority === 'medium' ? 'text-yellow-600' : 'text-primary'}`} />
                      </div>
                      <div><h4 className="font-semibold text-sm">{rec.title}</h4><p className="text-sm text-muted-foreground mt-1">{rec.text}</p></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Mini Shahmatka with half-day coloring */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Шахматка — {monthLabel}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="text-[10px] border-collapse w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background border px-2 py-1 text-left font-semibold min-w-[80px]">Номер</th>
                    {d.days.map((day: Date) => <th key={day.toISOString()} className="border px-0.5 py-1 text-center font-normal min-w-[22px]">{format(day, 'd')}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {d.rooms.slice().sort((a: any, b: any) => a.floor - b.floor || a.room_number.localeCompare(b.room_number)).map((room: any, ri: number, arr: any[]) => {
                    const prevFloor = ri > 0 ? arr[ri - 1].floor : room.floor;
                    return (
                      <React.Fragment key={room.id}>
                        {room.floor !== prevFloor && <tr key={`f-${room.floor}`}><td colSpan={d.days.length + 1} className="bg-muted/50 border px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">Этаж {room.floor}</td></tr>}
                        <tr>
                          <td className="sticky left-0 z-10 bg-background border px-2 py-0.5 font-medium whitespace-nowrap">{room.room_number} <span className="text-muted-foreground font-normal">{room.room_types?.name}</span></td>
                          {d.days.map((day: Date) => {
                            const dayBookings = d.shahmatkaBookings.filter((b: any) => b.room_id === room.id);
                            const isCheckIn = dayBookings.find((b: any) => isSameDay(parseISO(b.check_in_date), day));
                            const isCheckOut = dayBookings.find((b: any) => isSameDay(parseISO(b.check_out_date), day));
                            const isMid = dayBookings.find((b: any) => parseISO(b.check_in_date) < day && parseISO(b.check_out_date) > day);

                            if (isMid) {
                              // Full day occupied
                              return <td key={day.toISOString()} className="border p-0 h-5"><div className={`w-full h-full ${statusColor(isMid.status)} opacity-80`} title={`${isMid.guest_name}`} /></td>;
                            }
                            if (isCheckIn && isCheckOut) {
                              // Check-out morning + check-in afternoon (two different bookings)
                              return <td key={day.toISOString()} className="border p-0 h-5">
                                <div className="flex w-full h-full">
                                  <div className={`w-1/2 h-full ${statusColor(isCheckOut.status)} opacity-60`} title={`Выезд: ${isCheckOut.guest_name}`} />
                                  <div className={`w-1/2 h-full ${statusColor(isCheckIn.status)} opacity-80`} title={`Заезд: ${isCheckIn.guest_name}`} />
                                </div>
                              </td>;
                            }
                            if (isCheckIn) {
                              // Afternoon only (check-in)
                              return <td key={day.toISOString()} className="border p-0 h-5">
                                <div className="flex w-full h-full">
                                  <div className="w-1/2 h-full" />
                                  <div className={`w-1/2 h-full ${statusColor(isCheckIn.status)} opacity-80 rounded-l-sm`} title={`Заезд: ${isCheckIn.guest_name}`} />
                                </div>
                              </td>;
                            }
                            if (isCheckOut) {
                              // Morning only (check-out)
                              return <td key={day.toISOString()} className="border p-0 h-5">
                                <div className="flex w-full h-full">
                                  <div className={`w-1/2 h-full ${statusColor(isCheckOut.status)} opacity-60 rounded-r-sm`} title={`Выезд: ${isCheckOut.guest_name}`} />
                                  <div className="w-1/2 h-full" />
                                </div>
                              </td>;
                            }
                            return <td key={day.toISOString()} className="border p-0 h-5" />;
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center gap-4 mt-3 text-[10px]">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /> Заселён</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Подтверждён</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-400" /> Выселен</div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded flex"><div className="w-1/2 bg-gray-400 rounded-l" /><div className="w-1/2 bg-green-500 rounded-r" /></div>
                  Заезд/выезд
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p>Отчёт YesRoom • {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
            <p className="mt-1">Период: {format(d.mStart, 'dd.MM.yyyy')} — {format(d.mEnd, 'dd.MM.yyyy')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
