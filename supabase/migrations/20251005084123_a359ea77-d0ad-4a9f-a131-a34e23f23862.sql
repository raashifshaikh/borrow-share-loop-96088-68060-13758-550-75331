-- Add 'order_update' to notification_type enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'order_update' 
    AND enumtypid = 'notification_type'::regtype
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'order_update';
  END IF;
END $$;

-- Verify create_notification function exists and is SECURITY DEFINER
-- This function should already exist based on the schema, but let's ensure it's correct
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type notification_type,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_action_url text DEFAULT NULL,
  p_action_label text DEFAULT NULL,
  p_priority text DEFAULT 'medium'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    action_url,
    action_label,
    priority,
    expires_at
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_body,
    p_data,
    p_action_url,
    p_action_label,
    p_priority,
    now() + interval '30 days'
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$function$;

-- Ensure triggers exist for order notifications
DROP TRIGGER IF EXISTS order_notification_trigger ON orders;
CREATE TRIGGER order_notification_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_changes();

DROP TRIGGER IF EXISTS service_order_notification_trigger ON service_orders;
CREATE TRIGGER service_order_notification_trigger
  AFTER INSERT OR UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_service_order_changes();