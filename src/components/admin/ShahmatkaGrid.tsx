import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format, addDays, startOfDay, isSameDay, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualBookingDialog } from "./ManualBookingDialog";
import { BookingDetailModal } from "./BookingDetailModal";

type BookingStatus = "pending" | "approved" | "checked_in" | "checked_out" | "cancelled";

const statusLabelsRu: Record<BookingStatus, string> = {
  pending: "Ожидает",
  approved: "Подтверждено",
  checked_in: "Заселён",
  checked_out: "Выселен",
  cancelled: "Отменено",
};

interface Room {
  id: string;
  room_number: string;
  floor: number;
  room_type_id: string;
  room_types: { name: string } | null;
}

interface Booking {
  id: string;
  room_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  guest_name: string;
  is_half_day?: boolean;
}

interface BookingRoomEntry {
  booking_id: string;
  room_id: string;
  bookings: Booking | null;
}

const statusBgHex: Record<BookingStatus, string> = {
  pending: "#eab308cc",
  approved: "#3b82f6cc",
  checked_in: "#22c55ecc",
  checked_out: "#6b728080",
  cancelled: "#ef444466",
};

interface Props {
  hotelId: string;
}

export function ShahmatkaGrid({ hotelId }: Props) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingRoomMap, setBookingRoomMap] = useState<Map<string, Set<string>>>(new Map());
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Добавь в начало компонента определение ширины экрана для адаптивности
  const [gridDays, setGridDays] = useState(window.innerWidth < 768 ? 4 : 7);

  useEffect(() => {
    const handleResize = () => setGridDays(window.innerWidth < 768 ? 4 : 10);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Обнови useMemo для дней, используя gridDays
  const days = useMemo(() => {
    return Array.from({ length: gridDays }, (_, i) => addDays(startDate, i));
  }, [startDate, gridDays]);

  // Group rooms by floor
  const groupedByFloor = useMemo(() => {
    const map = new Map<number, Room[]>();
    rooms.forEach((r) => {
      if (!map.has(r.floor)) map.set(r.floor, []);
      map.get(r.floor)!.push(r);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [rooms]);

  useEffect(() => {
    if (hotelId) fetchData();
  }, [hotelId, startDate]);

  const fetchData = async () => {
    setLoading(true);
    const endDate = addDays(startDate, GRID_DAYS);

    const [roomsRes, bookingsRes, bookingRoomsRes] = await Promise.all([
      supabase
        .from("rooms")
        .select("id, room_number, floor, room_type_id, room_types(name)")
        .eq("hotel_id", hotelId)
        .order("floor", { ascending: true })
        .order("room_number", { ascending: true }),
      supabase
        .from("bookings")
        .select("id, room_id, check_in_date, check_out_date, status, guest_name, is_half_day")
        .eq("hotel_id", hotelId)
        .gte("check_out_date", format(startDate, "yyyy-MM-dd"))
        .lte("check_in_date", format(endDate, "yyyy-MM-dd")),
      supabase
        .from("booking_rooms")
        .select(
          "booking_id, room_id, bookings(id, room_id, check_in_date, check_out_date, status, guest_name, is_half_day)",
        )
        .eq("hotel_id", hotelId),
    ]);

    if (roomsRes.data) setRooms(roomsRes.data as Room[]);

    const allBookings: Booking[] = [];
    const roomToBookingsMap = new Map<string, Set<string>>();

    if (bookingsRes.data) {
      bookingsRes.data.forEach((b: any) => {
        allBookings.push(b);
        if (b.room_id) {
          if (!roomToBookingsMap.has(b.room_id)) roomToBookingsMap.set(b.room_id, new Set());
          roomToBookingsMap.get(b.room_id)!.add(b.id);
        }
      });
    }

    if (bookingRoomsRes.data) {
      (bookingRoomsRes.data as BookingRoomEntry[]).forEach((br) => {
        if (br.bookings) {
          const bookingCheckIn = parseISO(br.bookings.check_in_date);
          const bookingCheckOut = parseISO(br.bookings.check_out_date);
          if (bookingCheckIn < endDate && bookingCheckOut > startDate) {
            if (!allBookings.find((b) => b.id === br.bookings!.id)) allBookings.push(br.bookings);
            if (!roomToBookingsMap.has(br.room_id)) roomToBookingsMap.set(br.room_id, new Set());
            roomToBookingsMap.get(br.room_id)!.add(br.booking_id);
          }
        }
      });
    }

    setBookings(allBookings);
    setBookingRoomMap(roomToBookingsMap);
    setLoading(false);
  };

  const getCellBookings = (roomId: string, date: Date): { left: Booking | null; right: Booking | null } => {
    const bookingIds = bookingRoomMap.get(roomId);
    const candidates =
      bookingIds && bookingIds.size > 0
        ? (Array.from(bookingIds)
            .map((id) => bookings.find((b) => b.id === id))
            .filter(Boolean) as Booking[])
        : bookings.filter((b) => b.room_id === roomId);

    let leftBooking: Booking | null = null;
    let rightBooking: Booking | null = null;

    for (const booking of candidates) {
      if (showOnlyActive && !["pending", "approved", "checked_in"].includes(booking.status)) continue;

      const checkIn = parseISO(booking.check_in_date);
      const checkOut = parseISO(booking.check_out_date);

      if (booking.is_half_day) {
        if (isSameDay(date, checkIn)) rightBooking = booking;
        continue;
      }

      const isCheckInDay = isSameDay(date, checkIn);
      const isCheckOutDay = isSameDay(date, checkOut);
      const isBetween = date > checkIn && date < checkOut;

      if (isCheckOutDay) leftBooking = booking;
      if (isCheckInDay) rightBooking = booking;
      if (isBetween) {
        leftBooking = booking;
        rightBooking = booking;
      }
    }
    return { left: leftBooking, right: rightBooking };
  };

  const handleCellClick = (booking: Booking | null) => {
    if (booking) {
      setSelectedBookingId(booking.id);
      setDetailModalOpen(true);
    }
  };

  const handlePrev = () => setStartDate((prev) => addDays(prev, -GRID_DAYS));
  const handleNext = () => setStartDate((prev) => addDays(prev, GRID_DAYS));
  const handleToday = () => setStartDate(startOfDay(new Date()));

  if (loading) return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;

  const renderRoomRow = (room: Room) => (
    <tr key={room.id} className="h-12 hover:bg-slate-50/50 transition-colors">
      <td className="border-b border-r p-2 text-xs font-black sticky left-0 bg-white z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-20">
        <div className="leading-tight">
          <div>{room.room_number}</div>
          <div className="text-[9px] font-normal text-muted-foreground truncate">{room.room_types?.name}</div>
        </div>
      </td>
      {days.map((day) => {
        const { left, right } = getCellBookings(room.id, day);
        const isSame = left && right && left.id === right.id;

        const renderTooltipBlock = (booking: Booking | null, side: "left" | "right") => {
          const isFullWidth = isSame;
          const baseClass = cn(
            "h-full rounded-sm flex items-center justify-center cursor-pointer overflow-hidden hover:brightness-95 transition-all",
            isFullWidth ? "w-full" : "w-1/2",
          );

          if (!booking) {
            return <div className={baseClass} style={{ backgroundColor: "#f8fafc" }} />;
          }

          return (
            <Tooltip key={`${booking.id}-${side}`}>
              <TooltipTrigger asChild>
                <div
                  className={baseClass}
                  style={{ backgroundColor: statusBgHex[booking.status] }}
                  onClick={() => handleCellClick(booking)}
                >
                  <span className="text-[10px] font-bold text-white truncate px-1">
                    {booking.guest_name.split(" ")[0]}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{booking.guest_name}</p>
                <p className="text-muted-foreground">{statusLabelsRu[booking.status]}</p>
                <p className="text-muted-foreground">
                  {format(parseISO(booking.check_in_date), "dd.MM")} —{" "}
                  {format(parseISO(booking.check_out_date), "dd.MM.yy")}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        };

        return (
          <td
            key={day.toISOString()}
            className={cn("border-b border-r p-0 relative", isSameDay(day, new Date()) && "bg-primary/[0.02]")}
          >
            <div className="flex h-full w-full gap-0.5 p-0.5">
              {isSame ? (
                renderTooltipBlock(left, "left")
              ) : (
                <>
                  {renderTooltipBlock(left, "left")}
                  {renderTooltipBlock(right, "right")}
                </>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-[calc(100vh-120px)] space-y-2 overflow-hidden px-1">
        {/* Аналитика (компактная версия) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <div className="min-w-[120px] bg-white p-2 rounded-lg border shadow-sm">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Загрузка</p>
            <p className="text-lg font-black">
              {Math.round((bookings.length / (rooms.length * gridDays || 1)) * 100)}%
            </p>
          </div>
          {/* Другие виджеты аналогично... */}
        </div>

        {/* Панель управления */}
        <div className="flex items-center justify-between bg-white/50 backdrop-blur-md p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setBookingDialogOpen(true)} className="h-8 rounded-lg shadow-sm">
              <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Бронь</span>
            </Button>

            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="h-7 px-2 text-[10px] font-bold uppercase" onClick={handleToday}>
                Сегодня
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-sm h-8">
            <Switch
              id="active-filter"
              checked={showOnlyActive}
              onCheckedChange={setShowOnlyActive}
              className="scale-75"
            />
            <Label htmlFor="active-filter" className="text-[9px] font-black text-slate-500 uppercase">
              Активные
            </Label>
          </div>
        </div>

        {/* ТАБЛИЦА С КОНТРОЛИРУЕМЫМ СКРОЛЛОМ (Google Style) */}
        <div className="flex-1 min-h-0 relative border rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div
            className="absolute inset-0 overflow-auto scroll-smooth scrollbar-thin scrollbar-thumb-slate-300"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <table className="w-full border-separate border-spacing-0 table-fixed">
              <thead className="sticky top-0 z-50">
                <tr className="bg-slate-50/95 backdrop-blur-md shadow-sm">
                  {/* Фиксированный угол */}
                  <th className="w-[60px] md:w-[100px] border-b border-r p-2 sticky left-0 z-[60] bg-slate-100/95 backdrop-blur-md">
                    <span className="text-[10px] font-black text-slate-400 uppercase">№</span>
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        "border-b border-r p-2 text-center min-w-[90px] md:min-w-[150px] transition-all",
                        isSameDay(day, new Date()) && "bg-blue-500/10 shadow-inner",
                      )}
                    >
                      <div className="text-[9px] text-slate-400 font-bold uppercase">
                        {format(day, "EEE", { locale: ru })}
                      </div>
                      <div
                        className={cn(
                          "text-xs md:text-sm font-black",
                          isSameDay(day, new Date()) ? "text-blue-600" : "text-slate-700",
                        )}
                      >
                        {format(day, "d MMM", { locale: ru })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedByFloor.map(([floor, floorRooms]) => (
                  <React.Fragment key={`floor-${floor}`}>
                    <tr className="sticky z-20">
                      <td
                        colSpan={gridDays + 1}
                        className="bg-slate-50/90 backdrop-blur-sm text-[10px] font-black px-4 py-1 border-b text-slate-400 uppercase tracking-widest sticky left-0"
                      >
                        Этаж {floor}
                      </td>
                    </tr>
                    {floorRooms.map(renderRoomRow)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Легенда (Компактная внизу) */}
        <div className="flex justify-center gap-3 py-1 bg-slate-50/50 rounded-lg shrink-0">
          {Object.entries(statusLabelsRu).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusBgHex[status as BookingStatus] }}
              />
              <span className="text-[8px] font-bold text-slate-400 uppercase">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
