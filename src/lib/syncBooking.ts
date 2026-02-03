import { supabase } from '@/integrations/supabase/client';

/**
 * Синхронизирует бронирование с внешним Supabase, если синхронизация включена
 */
export async function syncBookingToExternal(bookingId: string): Promise<void> {
  try {
    // Получить данные бронирования
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Failed to fetch booking for sync:', bookingError);
      return;
    }

    // Отправить на синхронизацию через Edge Function
    const { error } = await supabase.functions.invoke('sync-to-external', {
      body: {
        table: 'bookings',
        data: booking,
        operation: 'upsert'
      }
    });

    if (error) {
      console.error('Failed to sync booking to external:', error);
    } else {
      console.log('Booking synced to external:', bookingId);
    }
  } catch (error) {
    console.error('Error syncing booking:', error);
  }
}
