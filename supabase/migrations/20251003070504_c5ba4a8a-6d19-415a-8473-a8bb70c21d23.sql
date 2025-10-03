-- Phase 7: Database Schema Updates for QR Codes and Enhanced Notifications

-- Add QR code and scanning fields to orders table
ALTER TABLE public.orders
ADD COLUMN qr_code_data jsonb,
ADD COLUMN delivery_scanned_at timestamp with time zone,
ADD COLUMN delivery_scanned_by uuid REFERENCES auth.users(id),
ADD COLUMN return_scanned_at timestamp with time zone,
ADD COLUMN return_scanned_by uuid REFERENCES auth.users(id),
ADD COLUMN service_start_scan timestamp with time zone,
ADD COLUMN service_end_scan timestamp with time zone;

-- Add enhanced notification fields
ALTER TABLE public.notifications
ADD COLUMN action_url text,
ADD COLUMN action_label text,
ADD COLUMN priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN expires_at timestamp with time zone;

-- Create index for faster notification queries
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_expires ON public.notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Create index for order scanning fields
CREATE INDEX idx_orders_qr_data ON public.orders USING GIN (qr_code_data) WHERE qr_code_data IS NOT NULL;

-- Function to generate QR code data
CREATE OR REPLACE FUNCTION public.generate_order_qr_code(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr_data jsonb;
BEGIN
  v_qr_data := jsonb_build_object(
    'order_id', p_order_id,
    'generated_at', now(),
    'expires_at', now() + interval '30 days',
    'secret', encode(gen_random_bytes(32), 'hex')
  );
  
  UPDATE public.orders
  SET qr_code_data = v_qr_data
  WHERE id = p_order_id;
  
  RETURN v_qr_data;
END;
$$;

-- Function to verify QR scan
CREATE OR REPLACE FUNCTION public.verify_qr_scan(
  p_order_id uuid,
  p_qr_secret text,
  p_scan_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_secret text;
  v_expires_at timestamp with time zone;
BEGIN
  SELECT 
    qr_code_data->>'secret',
    (qr_code_data->>'expires_at')::timestamp with time zone
  INTO v_stored_secret, v_expires_at
  FROM public.orders
  WHERE id = p_order_id;
  
  -- Verify secret and expiration
  IF v_stored_secret = p_qr_secret AND v_expires_at > now() THEN
    -- Update scan timestamp based on type
    IF p_scan_type = 'delivery' THEN
      UPDATE public.orders
      SET delivery_scanned_at = now(),
          delivery_scanned_by = auth.uid(),
          status = 'in_progress'::order_status
      WHERE id = p_order_id;
    ELSIF p_scan_type = 'return' THEN
      UPDATE public.orders
      SET return_scanned_at = now(),
          return_scanned_by = auth.uid(),
          status = 'completed'::order_status
      WHERE id = p_order_id;
    ELSIF p_scan_type = 'service_start' THEN
      UPDATE public.orders
      SET service_start_scan = now(),
          status = 'in_progress'::order_status
      WHERE id = p_order_id;
    ELSIF p_scan_type = 'service_end' THEN
      UPDATE public.orders
      SET service_end_scan = now(),
          status = 'completed'::order_status
      WHERE id = p_order_id;
    END IF;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to create notification
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
SET search_path = public
AS $$
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
$$;