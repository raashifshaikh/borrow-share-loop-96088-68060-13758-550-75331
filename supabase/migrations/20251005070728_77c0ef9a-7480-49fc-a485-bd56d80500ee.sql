-- Update verify_qr_scan to award XP when order is completed
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
  v_buyer_id uuid;
  v_seller_id uuid;
BEGIN
  SELECT 
    qr_code_data->>'secret',
    (qr_code_data->>'expires_at')::timestamp with time zone,
    buyer_id,
    seller_id
  INTO v_stored_secret, v_expires_at, v_buyer_id, v_seller_id
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
      
      -- Award XP for successful delivery
      PERFORM award_xp(v_buyer_id, 25);
      PERFORM award_xp(v_seller_id, 25);
      
    ELSIF p_scan_type = 'return' THEN
      UPDATE public.orders
      SET return_scanned_at = now(),
          return_scanned_by = auth.uid(),
          status = 'completed'::order_status
      WHERE id = p_order_id;
      
      -- Award XP for successful completion
      PERFORM award_xp(v_buyer_id, 75);
      PERFORM award_xp(v_seller_id, 75);
      
    ELSIF p_scan_type = 'service_start' THEN
      UPDATE public.orders
      SET service_start_scan = now(),
          status = 'in_progress'::order_status
      WHERE id = p_order_id;
      
      -- Award XP for service start
      PERFORM award_xp(v_buyer_id, 25);
      PERFORM award_xp(v_seller_id, 25);
      
    ELSIF p_scan_type = 'service_end' THEN
      UPDATE public.orders
      SET service_end_scan = now(),
          status = 'completed'::order_status
      WHERE id = p_order_id;
      
      -- Award XP for service completion
      PERFORM award_xp(v_buyer_id, 75);
      PERFORM award_xp(v_seller_id, 75);
    END IF;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;