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

const statusBg: Record<BookingStatus, string> = {
  pending: "bg-yellow-500",
  approved: "bg-blue-500",
  checked_in: "bg-green-500",
  checked_out: "bg-gray-400",
  cancelled: "bg-red-400",
};

const statusBgHex: Record<BookingStatus, string> = {
  pending: "#eab308",
  approved: "#3b82f6",
  checked_in: "#22c55e",
  checked_out: "#9ca3af",
  cancelled: "#ef4444",
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
  const [gridDays, setGridDays] = useState(window.innerWidth < 768 ? 7 : 14);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  useEffect(() => {
    const handleResize = () => setGridDays(window.innerWidth < 768 ? 7 : 14);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const days = useMemo(() => Array.from({ length: gridDays }, (_, i) => addDays(startDate, i)), [startDate, gridDays]);

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

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.floor - b.floor || a.room_number.localeCompare(b.room_number));
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
        .select("booking_id, room_id, bookings(id, room_id, check_in_date, check_out_date, status, guest_name, is_half_day)")
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

  const getCellData = (roomId: string, day: Date) => {
    const bookingIds = bookingRoomMap.get(roomId);
    const candidates =
      bookingIds && bookingIds.size > 0
        ? (Array.from(bookingIds).map((id) => bookings.find((b) => b.id === id)).filter(Boolean) as Booking[])
        : bookings.filter((b) => b.room_id === roomId);

    let checkInBooking: Booking | null = null;
    let checkOutBooking: Booking | null = null;
    let midBooking: Booking | null = null;

    for (const booking of candidates) {
      if (showOnlyActive && !["pending", "approved", "checked_in"].includes(booking.status)) continue;
      const ci = parseISO(booking.check_in_date);
      const co = parseISO(booking.check_out_date);

      if (isSameDay(day, ci)) checkInBooking = booking;
      if (isSameDay(day, co)) checkOutBooking = booking;
      if (day > ci && day < co) midBooking = booking;
    }
    return { checkInBooking, checkOutBooking, midBooking };
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col space-y-2 px-1">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-3 py-2 rounded-lg shadow-sm text-white">
            <p className="text-[9px] font-bold uppercase opacity-80">Загрузка {format(dailyStats.date, "dd.MM")}</p>
            <p className="text-xl font-black leading-tight">{dailyStats.occupancy}%</p>
          </div>
          <div className="bg-card px-3 py-2 rounded-lg border shadow-sm border-l-4 border-l-green-500">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Заезды</p>
            <p className="text-xl font-black leading-tight">{dailyStats.checkIns}</p>
          </div>
          <div className="bg-card px-3 py-2 rounded-lg border shadow-sm border-l-4 border-l-orange-400">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Выезды</p>
            <p className="text-xl font-black leading-tight">{dailyStats.checkOuts}</p>
          </div>
          <div className="bg-card px-3 py-2 rounded-lg border shadow-sm border-l-4 border-l-blue-400">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Проживают</p>
            <p className="text-xl font-black leading-tight">{dailyStats.total}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between bg-muted/50 p-1.5 rounded-lg border shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setBookingDialogOpen(true)} className="h-7 text-xs shadow-sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> <span className="hidden sm:inline">Бронировать</span>
            </Button>
            <div className="flex items-center bg-card rounded-md p-0.5 shadow-sm border">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrev}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" className="h-6 px-2 text-[9px] font-black uppercase" onClick={handleToday}>
                Сегодня
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNext}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-card px-2 py-1 rounded-md border shadow-sm">
            <Switch
              id="active-filter"
              checked={showOnlyActive}
              onCheckedChange={setShowOnlyActive}
              className="scale-75 data-[state=checked]:bg-green-500"
            />
            <Label htmlFor="active-filter" className="text-[9px] font-bold text-muted-foreground uppercase cursor-pointer">
              Активные
            </Label>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] shrink-0 px-1">
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Заселён</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Подтверждён</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> Ожидает</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-gray-400" /> Выселен</div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm flex overflow-hidden"><div className="w-1/2 bg-gray-400" /><div className="w-1/2 bg-green-500" /></div>
            Заезд/выезд
          </div>
        </div>

        {/* Grid - no scroll, stretches naturally */}
        <div className="border rounded-xl bg-card shadow-sm overflow-x-auto">
            <table className="text-[10px] border-collapse w-full table-fixed">
              <thead>
                <tr className="bg-muted/80">
                  <th className="bg-muted border-b border-r px-2 py-1 text-left font-bold text-muted-foreground uppercase w-[56px] min-w-[56px]">
                    №
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      onMouseEnter={() => setHoveredDate(day)}
                      onMouseLeave={() => setHoveredDate(null)}
                      className={cn(
                        "border-b border-r px-0 py-1 text-center cursor-pointer min-w-[28px]",
                        isSameDay(day, new Date()) ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/60",
                        hoveredDate && isSameDay(day, hoveredDate) && "bg-blue-100/50 dark:bg-blue-900/30",
                      )}
                    >
                      <div className="text-[8px] text-muted-foreground font-medium uppercase leading-tight">
                        {format(day, "EEE", { locale: ru })}
                      </div>
                      <div className={cn(
                        "text-[11px] font-black leading-tight",
                        isSameDay(day, new Date()) ? "text-blue-600" : "",
                      )}>
                        {format(day, "d", { locale: ru })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                    <td className="sticky left-0 z-[5] bg-card border-b border-r px-0 py-0 font-bold whitespace-nowrap w-[56px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="px-2 py-0 w-full h-full cursor-default">
                            {room.room_number}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          <p className="font-semibold">{room.room_number}</p>
                          <p className="text-muted-foreground">{room.room_types?.name || "—"}</p>
                          <p className="text-muted-foreground">Этаж {room.floor}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    {days.map((day) => {
                      const { checkInBooking, checkOutBooking, midBooking } = getCellData(room.id, day);

                      // Mid-stay: full cell
                      if (midBooking) {
                        return (
                          <Tooltip key={day.toISOString()}>
                            <TooltipTrigger asChild>
                              <td
                                className="border-b border-r p-0 h-[22px] cursor-pointer"
                                onClick={() => handleCellClick(midBooking)}
                              >
                                <div
                                  className={`w-full h-full ${statusBg[midBooking.status]} opacity-80 flex items-center justify-center`}
                                >
                                  <span className="text-[8px] font-bold text-white truncate px-0.5 leading-none">
                                    {midBooking.guest_name.split(" ")[0]}
                                  </span>
                                </div>
                              </td>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-semibold">{midBooking.guest_name}</p>
                              <p className="text-muted-foreground">{statusLabelsRu[midBooking.status]}</p>
                              <p className="text-muted-foreground">
                                {format(parseISO(midBooking.check_in_date), "dd.MM")} — {format(parseISO(midBooking.check_out_date), "dd.MM.yy")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      // Check-out + check-in same day (split)
                      if (checkOutBooking && checkInBooking && checkOutBooking.id !== checkInBooking.id) {
                        return (
                          <td key={day.toISOString()} className="border-b border-r p-0 h-[22px]">
                            <div className="flex w-full h-full">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`w-1/2 h-full ${statusBg[checkOutBooking.status]} opacity-60 cursor-pointer`}
                                    onClick={() => handleCellClick(checkOutBooking)}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p className="font-semibold">Выезд: {checkOutBooking.guest_name}</p>
                                  <p className="text-muted-foreground">{statusLabelsRu[checkOutBooking.status]}</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`w-1/2 h-full ${statusBg[checkInBooking.status]} opacity-80 cursor-pointer`}
                                    onClick={() => handleCellClick(checkInBooking)}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p className="font-semibold">Заезд: {checkInBooking.guest_name}</p>
                                  <p className="text-muted-foreground">{statusLabelsRu[checkInBooking.status]}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                        );
                      }

                      // Check-in only (right half)
                      if (checkInBooking) {
                        return (
                          <Tooltip key={day.toISOString()}>
                            <TooltipTrigger asChild>
                              <td
                                className="border-b border-r p-0 h-[22px] cursor-pointer"
                                onClick={() => handleCellClick(checkInBooking)}
                              >
                                <div className="flex w-full h-full">
                                  <div className="w-1/2 h-full" />
                                  <div className={`w-1/2 h-full ${statusBg[checkInBooking.status]} opacity-80 rounded-l-sm`} />
                                </div>
                              </td>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-semibold">Заезд: {checkInBooking.guest_name}</p>
                              <p className="text-muted-foreground">{statusLabelsRu[checkInBooking.status]}</p>
                              <p className="text-muted-foreground">
                                {format(parseISO(checkInBooking.check_in_date), "dd.MM")} — {format(parseISO(checkInBooking.check_out_date), "dd.MM.yy")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      // Check-out only (left half)
                      if (checkOutBooking) {
                        return (
                          <Tooltip key={day.toISOString()}>
                            <TooltipTrigger asChild>
                              <td
                                className="border-b border-r p-0 h-[22px] cursor-pointer"
                                onClick={() => handleCellClick(checkOutBooking)}
                              >
                                <div className="flex w-full h-full">
                                  <div className={`w-1/2 h-full ${statusBg[checkOutBooking.status]} opacity-60 rounded-r-sm`} />
                                  <div className="w-1/2 h-full" />
                                </div>
                              </td>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-semibold">Выезд: {checkOutBooking.guest_name}</p>
                              <p className="text-muted-foreground">{statusLabelsRu[checkOutBooking.status]}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      // Empty cell
                      return <td key={day.toISOString()} className="border-b border-r p-0 h-[22px]" />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
