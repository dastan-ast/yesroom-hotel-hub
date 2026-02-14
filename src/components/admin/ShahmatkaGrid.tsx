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

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Принцип Парето: Фокус на 1 дне для максимальной ясности
  const days = useMemo(() => [startDate], [startDate]);

  useEffect(() => {
    if (hotelId) fetchData();
  }, [hotelId, startDate]);

  const fetchData = async () => {
    setLoading(true);
    const endDate = addDays(startDate, 1);

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
          const bIn = parseISO(br.bookings.check_in_date);
          const bOut = parseISO(br.bookings.check_out_date);
          if (bIn < endDate && bOut >= startDate) {
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

  const getCellBookings = (roomId: string, date: Date) => {
    const bookingIds = bookingRoomMap.get(roomId);
    const candidates = bookingIds
      ? (Array.from(bookingIds)
          .map((id) => bookings.find((b) => b.id === id))
          .filter(Boolean) as Booking[])
      : bookings.filter((b) => b.room_id === roomId);
    let left: Booking | null = null;
    let right: Booking | null = null;
    for (const b of candidates) {
      if (showOnlyActive && !["pending", "approved", "checked_in"].includes(b.status)) continue;
      const bin = parseISO(b.check_in_date);
      const bout = parseISO(b.check_out_date);
      if (b.is_half_day && isSameDay(date, bin)) {
        right = b;
        continue;
      }
      if (isSameDay(date, bout)) left = b;
      if (isSameDay(date, bin)) right = b;
      if (date > bin && date < bout) {
        left = b;
        right = b;
      }
    }
    return { left, right };
  };

  const handlePrev = () => setStartDate((prev) => addDays(prev, -1));
  const handleNext = () => setStartDate((prev) => addDays(prev, 1));

  if (loading) return <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Панель управления */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold uppercase">Оперативный план</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartDate(startOfDay(new Date()))}>
              Сегодня
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setBookingDialogOpen(true)} className="ml-2">
              <Plus className="h-4 w-4 mr-1" /> Бронь
            </Button>
          </div>
        </div>

        {/* Сетка с фиксированными заголовками */}
        <div className="overflow-auto border rounded-lg max-h-[70vh] relative bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-30 bg-muted/95 backdrop-blur-sm">
              <tr>
                <th className="border-r p-3 text-left text-[10px] font-bold w-24 sticky left-0 bg-muted z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                  НОМЕР
                </th>
                {days.map((day) => (
                  <th key={day.toISOString()} className="p-4 text-center">
                    <div className="text-xs text-muted-foreground uppercase">{format(day, "EEEE", { locale: ru })}</div>
                    <div className="text-2xl font-black text-primary tracking-tight">
                      {format(day, "d MMMM yyyy", { locale: ru })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-t hover:bg-muted/5 transition-colors">
                  <td className="border-r p-4 font-black text-sm sticky left-0 bg-white z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                    {room.room_number}
                  </td>
                  {days.map((day) => {
                    const { left, right } = getCellBookings(room.id, day);
                    return (
                      <td key={day.toISOString()} className="p-0 h-20 relative min-w-[300px]">
                        <div className="flex h-full w-full gap-1 p-1">
                          {/* Слот выезда (Лево) */}
                          <div
                            className="w-1/2 h-full rounded flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                            style={{ backgroundColor: left ? statusBgHex[left.status] : "#f8fafc" }}
                            onClick={() => left && (setSelectedBookingId(left.id), setDetailModalOpen(true))}
                          >
                            {left && (
                              <span className="text-[10px] font-bold text-white text-center leading-tight px-1">
                                {left.guest_name}
                              </span>
                            )}
                          </div>
                          {/* Слот заезда (Право) */}
                          <div
                            className="w-1/2 h-full rounded flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                            style={{ backgroundColor: right ? statusBgHex[right.status] : "#f8fafc" }}
                            onClick={() => right && (setSelectedBookingId(right.id), setDetailModalOpen(true))}
                          >
                            {right && (
                              <span className="text-[10px] font-bold text-white text-center leading-tight px-1">
                                {right.guest_name}
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
