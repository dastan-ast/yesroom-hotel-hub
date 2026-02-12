import { supabase } from '@/integrations/supabase/client';

interface LogActionParams {
  hotelId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
}

export async function logAdminAction({
  hotelId,
  userId,
  userName,
  action,
  entityType,
  entityId,
  details = {},
}: LogActionParams) {
  try {
    await supabase.from('admin_activity_log' as any).insert({
      hotel_id: hotelId,
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details,
    });
  } catch (e) {
    console.error('Activity log error:', e);
  }
}
