import { eachDayOfInterval, parseISO, isWeekend, addDays } from 'date-fns';

interface RoomTypePricing {
  price_per_night: number;
  price_weekend?: number | null;
  price_half_day?: number | null;
}

/**
 * Calculate total price for a stay, considering weekday/weekend pricing.
 * Each night's price is determined by the check-in day of that night.
 * E.g., Friday night (Fri→Sat) uses weekend price if day is Fri/Sat.
 * Weekend = Saturday and Sunday nights (i.e., the guest sleeps Sat→Sun or Sun→Mon).
 */
export function calculateStayPrice(
  checkInDate: string | Date,
  checkOutDate: string | Date,
  roomType: RoomTypePricing,
  isHalfDay: boolean = false,
): { totalPrice: number; nightBreakdown: { date: Date; price: number; isWeekendDay: boolean }[] } {
  if (isHalfDay) {
    const price = roomType.price_half_day ?? Math.round(roomType.price_per_night / 2);
    return { totalPrice: price, nightBreakdown: [] };
  }

  const checkIn = typeof checkInDate === 'string' ? parseISO(checkInDate) : checkInDate;
  const checkOut = typeof checkOutDate === 'string' ? parseISO(checkOutDate) : checkOutDate;

  if (checkIn >= checkOut) {
    return { totalPrice: 0, nightBreakdown: [] };
  }

  // Each night = from day to day+1. The price is based on the day.
  const nights = eachDayOfInterval({ start: checkIn, end: addDays(checkOut, -1) });
  const weekendPrice = roomType.price_weekend ?? roomType.price_per_night;

  const nightBreakdown = nights.map(day => {
    const isWeekendDay = isWeekend(day); // Saturday = 6, Sunday = 0
    const price = isWeekendDay ? weekendPrice : roomType.price_per_night;
    return { date: day, price, isWeekendDay };
  });

  const totalPrice = nightBreakdown.reduce((sum, n) => sum + n.price, 0);

  return { totalPrice, nightBreakdown };
}

/**
 * Get average daily rate considering weekday/weekend mix
 */
export function getAverageDailyRate(
  checkInDate: string | Date,
  checkOutDate: string | Date,
  roomType: RoomTypePricing,
): number {
  const { totalPrice, nightBreakdown } = calculateStayPrice(checkInDate, checkOutDate, roomType);
  return nightBreakdown.length > 0 ? Math.round(totalPrice / nightBreakdown.length) : roomType.price_per_night;
}

/**
 * Format price range for display (e.g., "15 000 — 20 000 ₸")
 */
export function formatPriceRange(roomType: RoomTypePricing): string {
  const weekday = roomType.price_per_night;
  const weekend = roomType.price_weekend;
  
  if (!weekend || weekend === weekday) {
    return `${weekday.toLocaleString()} ₸`;
  }

  const min = Math.min(weekday, weekend);
  const max = Math.max(weekday, weekend);
  return `${min.toLocaleString()} — ${max.toLocaleString()} ₸`;
}
