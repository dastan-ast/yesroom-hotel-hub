import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format, addDays, startOfDay, isSameDay, isWithinInterval, parseISO } from "date-fns";
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

  // Manual booking dialog
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  // Booking detail modal
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Внутри ShahmatkaGrid
  const days = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  const fetchData = async () => {
    setLoading(true);
    const endDate = addDays(startDate, 10); // Меняем 7 на 10
    // ... остальной код запроса без изменений

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

  // Determine cell halves
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

  const handlePrev = () => setStartDate((prev) => addDays(prev, -7));
  const handleNext = () => setStartDate((prev) => addDays(prev, 7));
  const handleToday = () => setStartDate(startOfDay(new Date()));

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Шахматка</h2>
          <div className="flex items-center gap-4">
            <Button size="sm" onClick={() => setBookingDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Новое бронирование
            </Button>
            <div className="flex items-center gap-2">
              <Switch id="show-active-only" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
              <Label htmlFor="show-active-only" className="text-sm text-muted-foreground cursor-pointer">
                Только активные
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Сегодня
              </Button>
              <Button variant="outline" size="sm" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-yellow-400/80" />
            <span>{t("admin.pending")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-blue-400/80" />
            <span>{t("admin.approved")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-green-500/80" />
            <span>{t("admin.checkedIn")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-muted-foreground/40 opacity-50" />
            <span>{t("admin.checkedOut")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-destructive/40 opacity-40" />
            <span>{t("admin.cancelled")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded border border-dashed border-muted-foreground/50 flex">
              <div className="w-1/2" />
              <div className="w-1/2 bg-green-500/50 rounded-r" />
            </div>
            <span>Полсуток</span>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="border-r p-2 text-left text-sm font-medium w-28 sticky left-0 bg-muted/50 z-10">
                  Номер
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={cn(
                      "border-r p-1.5 text-center text-xs font-medium min-w-[90px]",
                      isSameDay(day, new Date()) && "bg-primary/10",
                    )}
                  >
                    <div>{format(day, "EEE", { locale: ru })}</div>
                    <div className="font-bold">{format(day, "d")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Нет номеров
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.id} className="border-t hover:bg-muted/20">
                    <td className="border-r p-2 text-sm font-medium sticky left-0 bg-background z-10">
                      {room.room_number}
                    </td>
                    {days.map((day) => {
                      const { left, right } = getCellBookings(room.id, day);

                      return (
                        <td
                          key={day.toISOString()}
                          className={cn(
                            "border-r p-0 text-center relative",
                            isSameDay(day, new Date()) && "bg-primary/5",
                          )}
                          style={{ height: "40px" }}
                        >
                          <div className="flex h-full w-full">
                            {/* Left half */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn("w-1/2 h-full", left && "cursor-pointer")}
                                  style={{ backgroundColor: left ? statusBgHex[left.status] : "transparent" }}
                                  onClick={() => handleCellClick(left)}
                                />
                              </TooltipTrigger>
                              {left && (
                                <TooltipContent side="top">
                                  <p>
                                    {left.guest_name} — {statusLabelsRu[left.status]}
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                            {/* Right half */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn("w-1/2 h-full", right && "cursor-pointer")}
                                  style={{ backgroundColor: right ? statusBgHex[right.status] : "transparent" }}
                                  onClick={() => handleCellClick(right)}
                                />
                              </TooltipTrigger>
                              {right && (
                                <TooltipContent side="top">
                                  <p>
                                    {right.guest_name} — {statusLabelsRu[right.status]}
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Manual Booking Dialog */}
        <ManualBookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          onSuccess={() => fetchData()}
          hotelId={hotelId}
        />

        {/* Booking Detail Modal */}
        {selectedBookingId && (
          <BookingDetailModal
            open={detailModalOpen}
            onOpenChange={setDetailModalOpen}
            bookingId={selectedBookingId}
            hotelId={hotelId}
            onUpdate={() => fetchData()}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
