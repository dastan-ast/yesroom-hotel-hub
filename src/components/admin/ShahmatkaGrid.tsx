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

  const GRID_DAYS = 7;

  const days = useMemo(() => {
    return Array.from({ length: GRID_DAYS }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  // Group rooms by floor
  const groupedByFloor = useMemo(() => {
    const map = new Map<number, Room[]>();
    rooms.forEach(r => {
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
          <div className="text-[9px] font-normal text-muted-foreground truncate">
            {room.room_types?.name}
          </div>
        </div>
      </td>
      {days.map((day) => {
        const { left, right } = getCellBookings(room.id, day);
        const isSame = left && right && left.id === right.id;

        const renderTooltipBlock = (booking: Booking | null, side: "left" | "right") => {
          const isFullWidth = isSame;
          const baseClass = cn(
            "h-full rounded-sm flex items-center justify-center cursor-pointer overflow-hidden hover:brightness-95 transition-all",
            isFullWidth ? "w-full" : "w-1/2"
          );

          if (!booking) {
            return (
              <div
                className={baseClass}
                style={{ backgroundColor: "#f8fafc" }}
              />
            );
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
                  {format(parseISO(booking.check_in_date), "dd.MM")} — {format(parseISO(booking.check_out_date), "dd.MM.yy")}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        };

        return (
          <td
            key={day.toISOString()}
            className={cn(
              "border-b border-r p-0 relative",
              isSameDay(day, new Date()) && "bg-primary/[0.02]",
            )}
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
      <div className="space-y-3">
        {/* Control panel */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-1">
          <Button size="sm" onClick={() => setBookingDialogOpen(true)} className="h-8 shadow-sm shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Новое бронирование
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center border rounded-md h-8 overflow-hidden bg-background">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border-r" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="h-7 px-3 text-xs font-medium" onClick={handleToday}>
                Сегодня
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border-l" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-md border h-8">
              <Switch
                id="active-filter"
                checked={showOnlyActive}
                onCheckedChange={setShowOnlyActive}
                className="scale-75"
              />
              <Label
                htmlFor="active-filter"
                className="text-[10px] font-semibold text-slate-600 uppercase cursor-pointer"
              >
                Только активные
              </Label>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-bold uppercase text-slate-500 border-b pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#eab308cc]" />
            <span>Ожидает</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#3b82f6cc]" />
            <span>Подтверждено</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#22c55ecc]" />
            <span>Заселён</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#6b728080]" />
            <span>Выселен</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#ef444466]" />
            <span>Отмена</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-dashed border-slate-400" />
            <span>Полсуток</span>
          </div>
        </div>

        {/* Grid */}
        <div
          className="relative z-0 overflow-auto border rounded-xl bg-white shadow-md max-h-[70vh]"
          style={{ isolation: "isolate" }}
        >
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm">
              <tr>
                <th className="border-b border-r p-2 text-[10px] font-black w-20 sticky left-0 bg-slate-100 z-40">№</th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-r p-1 text-center min-w-[130px] sm:min-w-[150px]",
                      isSameDay(day, new Date()) && "bg-primary/5",
                    )}
                  >
                    <div className="text-[9px] text-slate-400 uppercase leading-none">
                      {format(day, "EEE", { locale: ru })}
                    </div>
                    <div className="text-sm font-bold text-slate-700">{format(day, "d MMM", { locale: ru })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedByFloor.map(([floor, floorRooms]) => (
                <>
                  <tr key={`floor-${floor}`}>
                    <td colSpan={GRID_DAYS + 1} className="bg-slate-100 text-xs font-bold px-3 py-1 border-b">
                      Этаж {floor}
                    </td>
                  </tr>
                  {floorRooms.map(renderRoomRow)}
                </>
              ))}
            </tbody>
          </table>
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
      </div>
    </TooltipProvider>
  );
}
