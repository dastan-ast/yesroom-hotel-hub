import React, { useState, useEffect, useMemo } from "react";
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
  const [gridDays, setGridDays] = useState(window.innerWidth < 768 ? 4 : 10);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  useEffect(() => {
    const handleResize = () => setGridDays(window.innerWidth < 768 ? 4 : 10);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: gridDays }, (_, i) => addDays(startDate, i));
  }, [startDate, gridDays]);

  const dailyStats = useMemo(() => {
    const targetDate = hoveredDate || new Date();
    const dayBookings = bookings.filter((b) => {
      const start = parseISO(b.check_in_date);
      const end = parseISO(b.check_out_date);
      return targetDate >= start && targetDate < end;
    });
    const checkIns = bookings.filter((b) => isSameDay(parseISO(b.check_in_date), targetDate)).length;
    const checkOuts = bookings.filter((b) => isSameDay(parseISO(b.check_out_date), targetDate)).length;
    const occupancy = rooms.length > 0 ? Math.round((dayBookings.length / rooms.length) * 100) : 0;
    return { occupancy, checkIns, checkOuts, total: dayBookings.length, date: targetDate };
  }, [bookings, rooms, hoveredDate]);

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
    const endDate = addDays(startDate, gridDays);

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

  const handlePrev = () => setStartDate((prev) => addDays(prev, -gridDays));
  const handleNext = () => setStartDate((prev) => addDays(prev, gridDays));
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
      <div className="flex flex-col h-[calc(100vh-140px)] space-y-3 overflow-hidden px-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-sm text-white">
            <p className="text-[10px] font-bold uppercase opacity-80">Загрузка на {format(dailyStats.date, "dd.MM")}</p>
            <p className="text-2xl font-black">{dailyStats.occupancy}%</p>
          </div>
          <div className="bg-white p-3 rounded-xl border shadow-sm border-l-4 border-l-green-500">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Заезды</p>
            <p className="text-2xl font-black text-slate-800">{dailyStats.checkIns}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border shadow-sm border-l-4 border-l-orange-400">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Выезды</p>
            <p className="text-2xl font-black text-slate-800">{dailyStats.checkOuts}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border shadow-sm border-l-4 border-l-blue-400">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Проживают</p>
            <p className="text-2xl font-black text-slate-800">{dailyStats.total}</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-100/50 p-1.5 rounded-xl border shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setBookingDialogOpen(true)} className="h-8 shadow-sm">
              <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Бронировать</span>
            </Button>
            <div className="flex items-center bg-white rounded-lg p-0.5 shadow-sm border">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="h-7 px-3 text-[10px] font-black uppercase" onClick={handleToday}>
                Сегодня
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ВОЗВРАЩЕННАЯ КНОПКА АКТИВНОСТИ */}
          <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-lg border shadow-sm">
            <div className="flex items-center gap-2">
              <Switch
                id="active-filter"
                checked={showOnlyActive}
                onCheckedChange={setShowOnlyActive}
                className="scale-75 data-[state=checked]:bg-green-500"
              />
              <Label htmlFor="active-filter" className="text-[10px] font-black text-slate-500 uppercase cursor-pointer">
                Только активные
              </Label>
            </div>
          </div>
        </div>

        <div className="flex-1 relative border rounded-2xl bg-white shadow-xl overflow-hidden min-h-0">
          <div className="absolute inset-0 overflow-auto scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full border-separate border-spacing-0 table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="bg-white/95 backdrop-blur-md">
                  <th className="w-[60px] md:w-[90px] border-b border-r p-2 sticky left-0 z-20 bg-slate-50">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Room</span>
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      onMouseEnter={() => setHoveredDate(day)}
                      onMouseLeave={() => setHoveredDate(null)}
                      className={cn(
                        "border-b border-r p-2 text-center transition-all cursor-pointer",
                        isSameDay(day, new Date()) ? "bg-blue-50" : "hover:bg-slate-50",
                        hoveredDate && isSameDay(day, hoveredDate) && "bg-blue-100/50",
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
                    <tr>
                      <td
                        colSpan={gridDays + 1}
                        className="bg-slate-50/80 text-[10px] font-black px-4 py-1.5 border-b text-slate-400 uppercase tracking-widest sticky left-0 z-[5] backdrop-blur-sm"
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
      </div>

      {/* МОДАЛЬНЫЕ ОКНА ДЛЯ РАБОТЫ КАРТОЧЕК */}
      <ManualBookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        onSuccess={fetchData}
        hotelId={hotelId}
      />

      {selectedBookingId && (
        <BookingDetailModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          bookingIds={[selectedBookingId]}
          hotelId={hotelId}
          onUpdate={fetchData}
        />
      )}
    </TooltipProvider>
  );
}
