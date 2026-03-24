
-- 1. KPI RPC function: server-side admin metrics calculation
CREATE OR REPLACE FUNCTION public.get_admin_kpi_metrics(_hotel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only allow admin/owner/superadmin
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH lead_metrics AS (
    SELECT
      l.admin_id,
      COUNT(*) as total_claimed,
      COUNT(*) FILTER (WHERE l.status = 'converted') as total_converted,
      AVG(EXTRACT(EPOCH FROM (l.claimed_at - l.created_at)) / 60) 
        FILTER (WHERE l.claimed_at IS NOT NULL) as avg_response_minutes
    FROM leads l
    WHERE l.hotel_id = _hotel_id AND l.admin_id IS NOT NULL
    GROUP BY l.admin_id
  ),
  booking_process AS (
    SELECT
      AVG(
        EXTRACT(EPOCH FROM (
          (b.additional_info->>'checked_in_at')::timestamptz - b.created_at
        )) / 60
      ) FILTER (WHERE b.additional_info->>'checked_in_at' IS NOT NULL) as avg_booking_process_minutes
    FROM bookings b
    WHERE b.hotel_id = _hotel_id AND b.status IN ('checked_in', 'checked_out')
  ),
  admin_data AS (
    SELECT
      lm.admin_id,
      COALESCE(p.full_name, 'Неизвестный') as admin_name,
      lm.total_claimed,
      lm.total_converted,
      ROUND(COALESCE(lm.avg_response_minutes, 0)::numeric, 1) as avg_response_minutes,
      CASE WHEN lm.total_claimed > 0 
        THEN ROUND((lm.total_converted::numeric / lm.total_claimed) * 100)
        ELSE 0 
      END as conversion_rate,
      ROUND(COALESCE(bp.avg_booking_process_minutes, 0)::numeric, 1) as avg_booking_process_minutes
    FROM lead_metrics lm
    LEFT JOIN profiles p ON p.user_id = lm.admin_id
    CROSS JOIN booking_process bp
    ORDER BY COALESCE(lm.avg_response_minutes, 0)
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'adminId', ad.admin_id,
      'adminName', ad.admin_name,
      'totalClaimed', ad.total_claimed,
      'totalConverted', ad.total_converted,
      'avgResponseMinutes', ad.avg_response_minutes,
      'conversionRate', ad.conversion_rate,
      'avgBookingProcessMinutes', ad.avg_booking_process_minutes
    )) FROM admin_data ad), '[]'::jsonb),
    'avgBookingProcessMinutes', COALESCE((SELECT ROUND(avg_booking_process_minutes::numeric, 1) FROM booking_process), 0),
    'avgResponseMinutes', COALESCE((SELECT ROUND(AVG(avg_response_minutes)::numeric, 1) FROM admin_data), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- 2. Merge audit_logs data into admin_activity_log
INSERT INTO admin_activity_log (id, hotel_id, user_id, user_name, action, entity_type, entity_id, details, created_at)
SELECT id, hotel_id, user_id, user_name, action, entity_type, entity_id, details, created_at
FROM audit_logs
WHERE NOT EXISTS (
  SELECT 1 FROM admin_activity_log aal WHERE aal.id = audit_logs.id
);

-- 3. Drop the audit_logs table (data is now in admin_activity_log)
DROP TABLE IF EXISTS audit_logs;
