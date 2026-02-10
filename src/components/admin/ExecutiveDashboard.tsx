import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, addDays, subDays, isSameDay, parseISO, differenceInDays, startOfDay, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  BedDouble, 
  DoorOpen, 
  CalendarCheck, 
  TrendingUp, 
  Clock, 
  Users,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';

interface Props {
  hotelId: string;
}

interface OccupancyData {
  date: Date;
  occupied: number;
  total: number;
  percentage: number;
}

interface DashboardStats {
  totalRooms: number;
  occupiedToday: number;
  freeToday: number;
  bookedToday: number;
  bookingsNext7Days: number;
  bookingsNext30Days: number;
  pendingRequests: number;
  monthlyRevenue: number;
  occupancyData: OccupancyData[];
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

export function ExecutiveDashboard({ hotelId }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    occupiedToday: 0,
    freeToday: 0,
    bookedToday: 0,
    bookingsNext7Days: 0,
    bookingsNext30Days: 0,
    pendingRequests: 0,
    monthlyRevenue: 0,
    occupancyData: [],
  });
  const [loading, setLoading] = useState(true);
  const [piePeriod, setPiePeriod] = useState<string>('7days');
  const [pieData, setPieData] = useState<RoomStatusDistribution[]>([]);
  const [pieLoading, setPieLoading] = useState(false);

  useEffect(() => {
    if (hotelId) {
      fetchDashboardData();
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelId && stats.totalRooms > 0) {
      fetchPieData();
    }
  }, [hotelId, piePeriod, stats.totalRooms]);

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

    let totalCheckedIn = 0;
    let totalApproved = 0;
    let totalPending = 0;
    let totalFree = 0;

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

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const next7Days = format(addDays(today, 7), 'yyyy-MM-dd');
    const next30Days = format(addDays(today, 30), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

    const [
      roomsRes,
      occupiedRes,
      bookedRes,
      bookings7Res,
      bookings30Res,
      pendingRes,
      revenueRes,
      servicesRevenueRes,
      allBookingsRes,
    ] = await Promise.all([
      supabase.from('rooms').select('id', { count: 'exact' }).eq('hotel_id', hotelId),
      supabase.from('rooms').select('id', { count: 'exact' }).eq('hotel_id', hotelId).eq('status', 'occupied'),
      supabase.from('rooms').select('id', { count: 'exact' }).eq('hotel_id', hotelId).eq('status', 'booked'),
      supabase.from('bookings').select('id', { count: 'exact' }).eq('hotel_id', hotelId).gte('check_in_date', todayStr).lte('check_in_date', next7Days).not('status', 'eq', 'cancelled'),
      supabase.from('bookings').select('id', { count: 'exact' }).eq('hotel_id', hotelId).gte('check_in_date', todayStr).lte('check_in_date', next30Days).not('status', 'eq', 'cancelled'),
      supabase.from('bookings').select('id', { count: 'exact' }).eq('hotel_id', hotelId).eq('status', 'pending'),
      supabase.from('bookings').select('final_total, daily_rate, check_in_date, check_out_date').eq('hotel_id', hotelId).eq('status', 'checked_out').gte('check_out_date', monthStart).lte('check_out_date', monthEnd),
      supabase.from('booking_services').select('total_price, unit_price, quantity, created_at').eq('hotel_id', hotelId).gte('created_at', monthStart).lte('created_at', monthEnd),
      supabase.from('bookings').select('room_id, check_in_date, check_out_date, status').eq('hotel_id', hotelId).not('room_id', 'is', null).gte('check_out_date', format(subDays(today, 5), 'yyyy-MM-dd')).lte('check_in_date', next30Days).in('status', ['approved', 'checked_in', 'checked_out']),
    ]);

    const totalRooms = roomsRes.count || 0;
    const occupiedToday = occupiedRes.count || 0;
    const bookedToday = bookedRes.count || 0;
    const freeToday = totalRooms - occupiedToday - bookedToday;

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

    const occupancyData: OccupancyData[] = [];
    for (let i = 0; i < 30; i++) {
      const date = addDays(today, i);
      let occupied = 0;
      if (allBookingsRes.data) {
        for (const booking of allBookingsRes.data) {
          const checkIn = parseISO(booking.check_in_date);
          const checkOut = parseISO(booking.check_out_date);
          if (date >= checkIn && date < checkOut) occupied++;
        }
      }
      occupancyData.push({
        date, occupied, total: totalRooms,
        percentage: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
      });
    }

    setStats({
      totalRooms, occupiedToday, freeToday: Math.max(0, freeToday), bookedToday,
      bookingsNext7Days: bookings7Res.count || 0, bookingsNext30Days: bookings30Res.count || 0,
      pendingRequests: pendingRes.count || 0, monthlyRevenue, occupancyData,
    });
    setLoading(false);
  };

  const todayOccupancyPercent = stats.totalRooms > 0 
    ? Math.round((stats.occupiedToday / stats.totalRooms) * 100) : 0;

  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }: any) => {
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

      {/* Secondary Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Предстоящие заезды
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold">{stats.bookingsNext7Days}</p>
                <p className="text-sm text-muted-foreground">на 7 дней</p>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div>
                <p className="text-3xl font-bold">{stats.bookingsNext30Days}</p>
                <p className="text-sm text-muted-foreground">на 30 дней</p>
              </div>
            </div>
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

      {/* 30-Day Occupancy Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Загрузка отеля на 30 дней
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-[800px] h-32 items-end pb-6 relative">
              {stats.occupancyData.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center group relative">
                  <div 
                    className={`w-full rounded-t transition-colors ${
                      day.percentage >= 80 ? 'bg-green-500' : 
                      day.percentage >= 50 ? 'bg-blue-500' : 
                      day.percentage >= 20 ? 'bg-yellow-500' : 'bg-muted'
                    }`}
                    style={{ height: `${Math.max(day.percentage, 5)}%` }}
                    title={`${format(day.date, 'd MMM', { locale: ru })}: ${day.occupied}/${day.total} (${day.percentage}%)`}
                  />
                  {(idx === 0 || idx === 29 || idx % 7 === 0) && (
                    <span className="absolute -bottom-5 text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(day.date, 'd.MM', { locale: ru })}
                    </span>
                  )}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-popover border rounded px-2 py-1 text-xs shadow-lg z-10 whitespace-nowrap">
                    <div className="font-medium">{format(day.date, 'd MMMM', { locale: ru })}</div>
                    <div>{day.occupied} из {day.total} ({day.percentage}%)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /><span>80%+</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500" /><span>50-79%</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500" /><span>20-49%</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted" /><span>0-19%</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
