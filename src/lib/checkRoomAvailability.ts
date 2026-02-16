import { supabase } from '@/integrations/supabase/client';

/**
 * Check if there are available rooms of a given type for the specified date range.
 * Returns { available: true, remaining: N } or { available: false, remaining: 0 }.
 */
export async function checkRoomAvailability(
  hotelId: string,
  roomTypeId: string,
  checkInDate: string,  // yyyy-MM-dd
  checkOutDate: string, // yyyy-MM-dd
  excludeBookingId?: string
): Promise<{ available: boolean; totalRooms: number; bookedCount: number; remaining: number }> {
  // 1. Count total rooms of this type (not in maintenance)
  const { count: totalRooms } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('room_type_id', roomTypeId)
    .neq('status', 'maintenance');

  const total = totalRooms || 0;

  // 2. Count overlapping active bookings for this room type
  let query = supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('room_type_id', roomTypeId)
    .in('status', ['pending', 'approved', 'checked_in'])
    .lt('check_in_date', checkOutDate)
    .gt('check_out_date', checkInDate);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { count: bookedCount } = await query;
  const booked = bookedCount || 0;

  const remaining = Math.max(0, total - booked);

  return {
    available: remaining > 0,
    totalRooms: total,
    bookedCount: booked,
    remaining,
  };
}
