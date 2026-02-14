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

  // Генерируем 10 дней, начиная с выбранной даты
  const days = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  useEffect(() => {
    if (hotelId) fetchData();
  }, [hotelId, startDate]);

  const fetchData = async () => {
    setLoading(true);
    const endDate = addDays(startDate, 10); // Изменено с 1 на 10

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
    // ... далее остальной код функции fetchData без изменений

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
        {/* Заголовок и Навигация */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold uppercase tracking-tight">Оперативный план (10 дней)</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStartDate((prev) => addDays(prev, -10))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> -10 дн.
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartDate(startOfDay(new Date()))}>
              Сегодня
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartDate((prev) => addDays(prev, 10))}>
              +10 дн. <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button size="sm" onClick={() => setBookingDialogOpen(true)} className="ml-2">
              <Plus className="h-4 w-4 mr-1" /> Бронь
            </Button>
          </div>
        </div>

        {/* Сетка с фиксированными заголовками и Snap-эффектом */}
        <div className="overflow-auto border rounded-xl max-h-[75vh] relative bg-white shadow-md snap-x snap-mandatory">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
              <tr>
                {/* Фиксированный "Номер" */}
                <th className="border-b border-r p-4 text-left text-[10px] font-bold w-24 sticky left-0 bg-slate-50 z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                  НОМЕР
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-r p-3 text-center min-w-[150px] snap-center transition-colors",
                      isSameDay(day, new Date()) ? "bg-primary/10" : "",
                    )}
                  >
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {format(day, "EEE", { locale: ru })}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-bold",
                        isSameDay(day, new Date()) ? "text-primary" : "text-slate-700",
                      )}
                    >
                      {format(day, "d MMM", { locale: ru })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Номер комнаты (Sticky) */}
                  <td className="border-b border-r p-4 font-black text-sm sticky left-0 bg-white z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                    {room.room_number}
                  </td>
                  {days.map((day) => {
                    const { left, right } = getCellBookings(room.id, day);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <td
                        key={day.toISOString()}
                        className={cn("border-b border-r p-0 h-14 relative snap-center", isToday && "bg-primary/5")}
                      >
                        <div className="flex h-full w-full gap-0.5 p-1">
                          <div
                            className="w-1/2 h-full rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-all active:scale-95"
                            style={{ backgroundColor: left ? statusBgHex[left.status] : "#f1f5f9" }}
                            onClick={() => left && (setSelectedBookingId(left.id), setDetailModalOpen(true))}
                          >
                            {left && (
                              <span className="text-[9px] font-bold text-white truncate px-0.5">
                                {left.guest_name.split(" ")[0]}
                              </span>
                            )}
                          </div>
                          <div
                            className="w-1/2 h-full rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-all active:scale-95"
                            style={{ backgroundColor: right ? statusBgHex[right.status] : "#f1f5f9" }}
                            onClick={() => right && (setSelectedBookingId(right.id), setDetailModalOpen(true))}
                          >
                            {right && (
                              <span className="text-[9px] font-bold text-white truncate px-0.5">
                                {right.guest_name.split(" ")[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Компоненты диалогов */}
        <ManualBookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          onSuccess={() => fetchData()}
          hotelId={hotelId}
        />
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
