// ... (импорты и типы остаются без изменений)

export function ShahmatkaGrid({ hotelId }: Props) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingRoomMap, setBookingRoomMap] = useState<Map<string, Set<string>>>(new Map());
  // Инициализация текущей датой
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Изменено: теперь отображаем только 1 день
  const days = useMemo(() => [startDate], [startDate]);

  useEffect(() => {
    if (hotelId) fetchData();
  }, [hotelId, startDate]);

  const fetchData = async () => {
    setLoading(true);
    // Изменено: диапазон запроса ограничен 1 днем (+1 для захвата выездов)
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

    // ... (логика обработки данных остается прежней)
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
          if (bookingCheckIn < endDate && bookingCheckOut >= startDate) {
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

      if (booking.is_half_day && isSameDay(date, checkIn)) {
        rightBooking = booking;
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

  // Изменено: навигация теперь по 1 дню
  const handlePrev = () => setStartDate((prev) => addDays(prev, -1));
  const handleNext = () => setStartDate((prev) => addDays(prev, 1));
  const handleToday = () => setStartDate(startOfDay(new Date()));

  if (loading) return <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header section remains similar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Шахматка (1 день)</h2>
          <div className="flex items-center gap-4">
            <Button size="sm" onClick={() => setBookingDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> {t("admin.newBooking")}
            </Button>
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

        {/* Grid: Добавлены стили для фиксации шапки */}
        <div className="overflow-x-auto border rounded-lg max-h-[70vh] relative">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-30 bg-background shadow-sm">
              <tr className="bg-muted/50">
                <th className="border-r p-2 text-left text-sm font-medium w-28 sticky left-0 bg-muted z-40">Номер</th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={cn("border-r p-3 text-center text-sm font-bold min-w-[200px] bg-primary/5")}
                  >
                    <div className="uppercase text-[10px] text-muted-foreground">
                      {format(day, "EEEE", { locale: ru })}
                    </div>
                    <div className="text-lg">{format(day, "d MMMM yyyy", { locale: ru })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-muted-foreground">
                    Нет номеров
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.id} className="border-t hover:bg-muted/20">
                    <td className="border-r p-2 text-sm font-medium sticky left-0 bg-background z-20">
                      {room.room_number}
                    </td>
                    {days.map((day) => {
                      const { left, right } = getCellBookings(room.id, day);
                      return (
                        <td
                          key={day.toISOString()}
                          className="border-r p-0 text-center relative"
                          style={{ height: "60px" }}
                        >
                          <div className="flex h-full w-full">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "w-1/2 h-full border-r border-dashed border-muted-foreground/20",
                                    left && "cursor-pointer",
                                  )}
                                  style={{ backgroundColor: left ? statusBgHex[left.status] : "transparent" }}
                                  onClick={() => handleCellClick(left)}
                                />
                              </TooltipTrigger>
                              {left && (
                                <TooltipContent>
                                  <p>{left.guest_name} (Выезд)</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn("w-1/2 h-full", right && "cursor-pointer")}
                                  style={{ backgroundColor: right ? statusBgHex[right.status] : "transparent" }}
                                  onClick={() => handleCellClick(right)}
                                />
                              </TooltipTrigger>
                              {right && (
                                <TooltipContent>
                                  <p>{right.guest_name} (Заезд)</p>
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

        {/* Dialogs remain same */}
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
