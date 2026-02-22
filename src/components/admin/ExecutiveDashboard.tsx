import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, addDays, subDays, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { 
  BedDouble, 
  DoorOpen, 
  Clock, 
  Users,
  TrendingUp, 
  BarChart3,
  PieChart as PieChartIcon,
  Percent,
  DollarSign,
  Activity,
  Globe
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
  web: 'Веб-сайт',
  manual: 'Ручное',
  booking: 'Booking',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

const SOURCE_COLORS: Record<string, string> = {
  web: '#3b82f6',
  manual: '#8b5cf6',
  booking: '#ef4444',
  telegram: '#06b6d4',
  whatsapp: '#22c55e',
};

export function ExecutiveDashboard({ hotelId }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0, occupiedToday: 0, freeToday: 0, bookedToday: 0,
    pendingRequests: 0, monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [piePeriod, setPiePeriod] = useState<string>('7days');
  const [pieData, setPieData] = useState<RoomStatusDistribution[]>([]);
  const [pieLoading, setPieLoading] = useState(false);

  // KPI state
  const [kpiPeriod, setKpiPeriod] = useState<string>('month');
  const [kpiData, setKpiData] = useState<KpiData>({ occupancyPercent: 0, adr: 0, revpar: 0, soldRoomNights: 0, totalRoomNights: 0 });
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Occupancy report state
  const [reportStart, setReportStart] = useState<Date>(startOfMonth(new Date()));
  const [reportEnd, setReportEnd] = useState<Date>(new Date());
  const [reportData, setReportData] = useState<{ room_number: string; type: string; daysOccupied: number; daysFree: number; percent: number }[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTotalPercent, setReportTotalPercent] = useState(0);

  // Fetch occupancy report
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

    for (const b of allBookings) {
      if (b.room_id) countDays(b.room_id, b.check_in_date, b.check_out_date);
    }
    for (const br of brEntries) {
      if (br.bookings && ['approved', 'checked_in', 'checked_out'].includes(br.bookings.status)) {
        if (br.bookings.check_in_date < endStr && br.bookings.check_out_date > startStr) {
          countDays(br.room_id, br.bookings.check_in_date, br.bookings.check_out_date);
        }
      }
    }

    const data = rooms.map((r: any) => {
      const occupied = Math.min(roomDays.get(r.id) || 0, totalDays);
      return {
        room_number: r.room_number,
        type: r.room_types?.name || '—',
        daysOccupied: occupied,
        daysFree: totalDays - occupied,
        percent: totalDays > 0 ? Math.round((occupied / totalDays) * 100) : 0,
      };
    });

    const totalOccupied = data.reduce((s: number, r: any) => s + r.daysOccupied, 0);
    const totalPossible = rooms.length * totalDays;
    setReportTotalPercent(totalPossible > 0 ? Math.round((totalOccupied / totalPossible) * 100) : 0);
    setReportData(data);
    setReportLoading(false);
  };

  useEffect(() => {
    if (hotelId && reportStart && reportEnd) fetchReport();
  }, [hotelId, reportStart, reportEnd]);

  useEffect(() => {
    if (hotelId) fetchDashboardData();
  }, [hotelId]);

  useEffect(() => {
    if (hotelId && stats.totalRooms > 0) fetchPieData();
  }, [hotelId, piePeriod, stats.totalRooms]);

  useEffect(() => {
    if (hotelId && stats.totalRooms > 0) fetchKpiData();
  }, [hotelId, kpiPeriod, stats.totalRooms]);

  const fetchPieData = async () => {
    setPieLoading(true);
    const today = startOfDay(new Date());
    
    let periodStart: Date;
    let periodEnd: Date;
    
    if (piePeriod === '7days') {
      periodStart = subDays(today, 6);
      periodEnd = today;
    } else {
      periodStart = startOfMonth(today);
      periodEnd = today;
    }

    const startStr = format(periodStart, 'yyyy-MM-dd');
    const endStr = format(addDays(periodEnd, 1), 'yyyy-MM-dd');

    const { data: bookings } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date, status, room_id')
      .eq('hotel_id', hotelId)
      .not('room_id', 'is', null)
      .gte('check_out_date', startStr)
      .lte('check_in_date', endStr)
      .in('status', ['pending', 'approved', 'checked_in', 'checked_out']);

    const totalRooms = stats.totalRooms;
    const numDays = differenceInDays(periodEnd, periodStart) + 1;

    let totalCheckedIn = 0, totalApproved = 0, totalPending = 0, totalFree = 0;

    for (let i = 0; i < numDays; i++) {
      const day = addDays(periodStart, i);
      const roomsCheckedIn = new Set<string>();
      const roomsApproved = new Set<string>();
      const roomsPending = new Set<string>();

      if (bookings) {
        for (const b of bookings) {
          const checkIn = parseISO(b.check_in_date);
          const checkOut = parseISO(b.check_out_date);
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

    const avgCheckedIn = Math.round(totalCheckedIn / numDays);
    const avgApproved = Math.round(totalApproved / numDays);
    const avgPending = Math.round(totalPending / numDays);
    const avgFree = Math.round(totalFree / numDays);

    setPieData([
      { name: 'Заселены', value: avgCheckedIn, color: PIE_COLORS.checkedIn },
      { name: 'Забронированы', value: avgApproved, color: PIE_COLORS.approved },
      { name: 'Ожидают', value: avgPending, color: PIE_COLORS.pending },
      { name: 'Свободны', value: avgFree, color: PIE_COLORS.free },
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

    // Fetch all non-cancelled bookings overlapping the period
    const { data: bookings } = await supabase
      .from('bookings')
      .select('source, final_total, daily_rate, check_in_date, check_out_date, status')
      .eq('hotel_id', hotelId)
      .in('status', ['approved', 'checked_in', 'checked_out'])
      .lt('check_in_date', endStr)
      .gt('check_out_date', startStr);

    const totalRoomNights = stats.totalRooms * daysBack;
    let soldRoomNights = 0;
    let totalRevenue = 0;
    const channelMap: Record<string, { count: number; revenue: number }> = {};

    if (bookings) {
      for (const b of bookings) {
        const ci = parseISO(b.check_in_date) < periodStart ? periodStart : parseISO(b.check_in_date);
        const co = parseISO(b.check_out_date) > addDays(today, 1) ? addDays(today, 1) : parseISO(b.check_out_date);
        const nights = Math.max(0, differenceInDays(co, ci));
        soldRoomNights += nights;

        // Revenue for this booking (proportional to period)
        const totalNights = differenceInDays(parseISO(b.check_out_date), parseISO(b.check_in_date));
        let bookingRevenue = 0;
        if (b.final_total && totalNights > 0) {
          bookingRevenue = (Number(b.final_total) / totalNights) * nights;
        } else if (b.daily_rate) {
          bookingRevenue = Number(b.daily_rate) * nights;
        }
        totalRevenue += bookingRevenue;

        // Channel breakdown
        const src = b.source || 'manual';
        if (!channelMap[src]) channelMap[src] = { count: 0, revenue: 0 };
        channelMap[src].count += 1;
        channelMap[src].revenue += bookingRevenue;
      }
    }

    const occupancyPercent = totalRoomNights > 0 ? Math.round((soldRoomNights / totalRoomNights) * 100) : 0;
    const adr = soldRoomNights > 0 ? Math.round(totalRevenue / soldRoomNights) : 0;
    const revpar = totalRoomNights > 0 ? Math.round(totalRevenue / totalRoomNights) : 0;

    setKpiData({ occupancyPercent, adr, revpar, soldRoomNights, totalRoomNights });

    const channels: ChannelData[] = Object.entries(channelMap)
      .map(([source, data]) => ({
        source,
        label: SOURCE_LABELS[source] || source,
        count: data.count,
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);
    setChannelData(channels);
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
      supabase.from('bookings').select('final_total, daily_rate, check_in_date, check_out_date')
        .eq('hotel_id', hotelId).eq('status', 'checked_out')
        .gte('check_out_date', monthStart).lte('check_out_date', monthEnd),
      supabase.from('booking_services').select('total_price, unit_price, quantity')
        .eq('hotel_id', hotelId).gte('created_at', monthStart).lte('created_at', monthEnd),
    ]);

    const totalRooms = roomsRes.count || 0;
    const occupiedToday = occupiedRes.count || 0;
    const bookedToday = bookedRes.count || 0;
    const freeToday = Math.max(0, totalRooms - occupiedToday - bookedToday);

    let monthlyRevenue = 0;
    if (revenueRes.data) {
      for (const booking of revenueRes.data) {
        if (booking.final_total) {
          monthlyRevenue += Number(booking.final_total);
        } else if (booking.daily_rate) {
          const nights = differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date));
          monthlyRevenue += Number(booking.daily_rate) * nights;
        }
      }
    }
    if (servicesRevenueRes.data) {
      for (const service of servicesRevenueRes.data) {
        monthlyRevenue += Number(service.total_price ?? (Number(service.unit_price) * service.quantity));
      }
    }

    setStats({ totalRooms, occupiedToday, freeToday, bookedToday, pendingRequests: pendingRes.count || 0, monthlyRevenue });
    setLoading(false);
  };

  const todayOccupancyPercent = stats.totalRooms > 0 
    ? Math.round((stats.occupiedToday / stats.totalRooms) * 100) : 0;

  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
    if (value === 0) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percent = pieTotal > 0 ? Math.round((value / pieTotal) * 100) : 0;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {value} ({percent}%)
      </text>
    );
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  const kpiPeriodLabel = kpiPeriod === '7days' ? 'за 7 дней' : 'за месяц';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold">Панель руководителя</h2>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <BedDouble className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Занято сегодня</p>
                <p className="text-2xl font-bold text-green-600">{stats.occupiedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <DoorOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Свободно сегодня</p>
                <p className="text-2xl font-bold text-blue-600">{stats.freeToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.pendingRequests > 0 ? "border-yellow-500/30 bg-yellow-500/5" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.pendingRequests > 0 ? 'bg-yellow-500/20' : 'bg-muted'}`}>
                <Clock className={`h-5 w-5 ${stats.pendingRequests > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ожидают решения</p>
                <p className={`text-2xl font-bold ${stats.pendingRequests > 0 ? 'text-yellow-600' : ''}`}>
                  {stats.pendingRequests}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Выручка за месяц</p>
                <p className="text-xl font-bold text-emerald-600">
                  {stats.monthlyRevenue.toLocaleString()} ₸
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Row */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Ключевые показатели
            </CardTitle>
            <ToggleGroup type="single" value={kpiPeriod} onValueChange={(v) => v && setKpiPeriod(v)} size="sm">
              <ToggleGroupItem value="7days" className="text-xs">7 дней</ToggleGroupItem>
              <ToggleGroupItem value="month" className="text-xs">Месяц</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {kpiLoading ? (
            <div className="h-[80px] flex items-center justify-center text-muted-foreground text-sm">Загрузка...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Загрузка (Occupancy)</p>
                </div>
                <p className="text-3xl font-bold text-primary">{kpiData.occupancyPercent}%</p>
                <p className="text-xs text-muted-foreground">
                  {kpiData.soldRoomNights} из {kpiData.totalRoomNights} ночей {kpiPeriodLabel}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs text-muted-foreground">ADR (Ср. цена номера)</p>
                </div>
                <p className="text-3xl font-bold text-emerald-600">{kpiData.adr.toLocaleString()} ₸</p>
                <p className="text-xs text-muted-foreground">{kpiPeriodLabel}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-muted-foreground">RevPAR (Доход на номер)</p>
                </div>
                <p className="text-3xl font-bold text-blue-600">{kpiData.revpar.toLocaleString()} ₸</p>
                <p className="text-xs text-muted-foreground">{kpiPeriodLabel}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Status Pie Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              Распределение номеров
            </CardTitle>
            <ToggleGroup type="single" value={piePeriod} onValueChange={(v) => v && setPiePeriod(v)} size="sm">
              <ToggleGroupItem value="7days" className="text-xs">7 дней</ToggleGroupItem>
              <ToggleGroupItem value="month" className="text-xs">Месяц</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {pieLoading ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Загрузка...</div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const percent = pieTotal > 0 ? Math.round((value / pieTotal) * 100) : 0;
                      return [`${value} (${percent}%)`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 min-w-[150px]">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}:</span>
                    <span className="font-medium">{item.value}</span>
                    <span className="text-muted-foreground text-xs">
                      ({pieTotal > 0 ? Math.round((item.value / pieTotal) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Analysis + Today's Occupancy */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Анализ каналов ({kpiPeriod === '7days' ? '7 дн' : 'месяц'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpiLoading ? (
              <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">Загрузка...</div>
            ) : channelData.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm">Нет данных за этот период</div>
            ) : (
              <div className="space-y-3">
                {channelData.map((ch) => {
                  const maxRevenue = Math.max(...channelData.map(c => c.revenue), 1);
                  const widthPercent = Math.max((ch.revenue / maxRevenue) * 100, 8);
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
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${widthPercent}%`, backgroundColor: SOURCE_COLORS[ch.source] || '#6b7280' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Загрузка отеля сегодня
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Занятость: {stats.occupiedToday} из {stats.totalRooms} номеров</span>
                <span className="font-medium">{todayOccupancyPercent}%</span>
              </div>
              <Progress value={todayOccupancyPercent} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Report */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Отчёт по номерам
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !reportStart && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(reportStart, 'd MMM yyyy', { locale: ru })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={reportStart} onSelect={(d) => d && setReportStart(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !reportEnd && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(reportEnd, 'd MMM yyyy', { locale: ru })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={reportEnd} onSelect={(d) => d && setReportEnd(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {reportLoading ? (
            <div className="py-4 text-center text-muted-foreground text-sm">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Дней занят</TableHead>
                    <TableHead className="text-right">Дней свободен</TableHead>
                    <TableHead className="text-right">% загрузки</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row) => (
                    <TableRow key={row.room_number}>
                      <TableCell className="font-medium">{row.room_number}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="text-right">{row.daysOccupied}</TableCell>
                      <TableCell className="text-right">{row.daysFree}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.percent >= 80 ? 'default' : row.percent >= 50 ? 'secondary' : 'outline'}>
                          {row.percent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={4}>Общая загрузка отеля</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default">{reportTotalPercent}%</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
